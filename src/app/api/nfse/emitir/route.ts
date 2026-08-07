import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrasilNFeAdaptador, buildPayloadNFSe } from '@/lib/nfse';
import { autenticarRota } from '@/lib/apiAuth';
import { registrarResultadoCodigo } from '@/lib/nfse/codigosMunicipais';

/**
 * Emissao roda em lotes limitados de proposito.
 *
 * A transmissao do backlog de 253 notas falhou em 7 delas com "Erro ao efetuar
 * requisicao HTTPS": cada nota e uma chamada sequencial ao provedor (~1s), e a
 * funcao serverless morre bem antes de terminar. A nota fica marcada como erro
 * permanente sem que a prefeitura tenha recusado nada.
 *
 * O corte fica no backend, nao na tela: o usuario seleciona o periodo que
 * quiser e o cliente pede os lotes em sequencia, mostrando progresso. Empurrar
 * a limitacao para o salao — obrigando a fatiar a selecao na mao — seria
 * transferir um problema nosso para quem esta usando.
 */
export const maxDuration = 60;

/** Notas por chamada. Com ~1s por nota, cabe folgado no limite da funcao. */
const LOTE_MAX = 25;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { user, perfil, erro } = await autenticarRota(req, 'POST /api/nfse/emitir');
  if (erro) return erro;

  const { nota_ids }: { nota_ids: string[] } = await req.json();
  if (!Array.isArray(nota_ids) || nota_ids.length === 0) {
    return NextResponse.json({ erro: 'nota_ids obrigatório' }, { status: 400 });
  }

  // Busca dados do salão — inclui regime_tributario direto (Dados da Empresa)
  // e config_fiscal (token, alíquota, provedor configurados no painel fiscal)
  const { data: salao, error: erroSalao } = await supabaseAdmin
    .from('saloes')
    .select('cnpj, inscricao_municipal, codigo_ibge, regime_tributario, email_fiscal, cnae, config_fiscal, acesso_total, limite_notas_mes')
    .eq('id', perfil.salao_id)
    .single();

  // O erro da consulta era descartado: qualquer falha aqui (coluna inexistente,
  // salão não encontrado, RLS) deixava `salao` nulo e caía no if de CNPJ abaixo,
  // acusando "CNPJ não cadastrado" mesmo com o CNPJ preenchido na tela. Isso
  // mandava o usuário arrumar um cadastro que já estava certo. Agora o motivo
  // real aparece.
  if (erroSalao || !salao) {
    console.error('[nfse/emitir] falha ao carregar salão', perfil.salao_id, erroSalao);
    return NextResponse.json(
      { erro: 'Não foi possível ler os dados da empresa: ' + (erroSalao?.message ?? 'salão não encontrado') },
      { status: 500 },
    );
  }

  const tokenNFSe = salao?.config_fiscal?.brasilnfe_company_token || undefined;

  // Empresa excluida na Brasil NFe (modulo fiscal cancelado): o token continua
  // guardado para consultar o que ja foi emitido, mas o CNPJ nao esta mais
  // habilitado a emitir. Sem esta trava a tentativa iria ate o provedor e
  // voltaria um erro sem explicacao para o salao.
  if (salao?.config_fiscal?.brasilnfe_excluido_em) {
    return NextResponse.json({
      erro: 'A emissao de notas foi encerrada quando o modulo fiscal foi cancelado. Contrate o modulo novamente para voltar a emitir — as notas ja emitidas continuam consultaveis.',
    }, { status: 409 });
  }

  if (!salao?.cnpj) {
    return NextResponse.json({ erro: 'CNPJ não cadastrado. Configure em Dados da Empresa.' }, { status: 422 });
  }
  if (!salao?.codigo_ibge) {
    return NextResponse.json({ erro: 'Código IBGE não cadastrado. Configure em Dados da Empresa.' }, { status: 422 });
  }

  // Trava de cota mensal: 150 notas/mês incluídas no módulo (acesso_total isenta)
  if (!salao?.acesso_total) {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { count: notasMes } = await supabaseAdmin
      .from('notas_fiscais')
      .select('id', { count: 'exact', head: true })
      .eq('salao_id', perfil.salao_id)
      .eq('status', 'Emitida')
      .gte('data_emissao', inicioMes.toISOString());

    const LIMITE_MENSAL = salao?.limite_notas_mes ?? 150;
    if ((notasMes ?? 0) + nota_ids.length > LIMITE_MENSAL) {
      const restantes = Math.max(0, LIMITE_MENSAL - (notasMes ?? 0));
      return NextResponse.json({
        erro: `Limite mensal de ${LIMITE_MENSAL} notas atingido. Você já emitiu ${notasMes} notas este mês.${restantes > 0 ? ` Você pode emitir mais ${restantes} nota(s) agora.` : ' Adquira créditos adicionais para continuar.'}`,
      }, { status: 402 });
    }
  }

  // Busca as notas fiscais garantindo que pertencem ao salão do usuário
  const { data: notas } = await supabaseAdmin
    .from('notas_fiscais')
    .select('id, cliente_nome, cliente_cpf, descricao_servico, valor, item_lista_servico, aliquota_iss, codigo_tributacao_municipio, nbs, data_movimentacao, cnpj_profissional, tipo_parceiro, valor_cota_profissional, valor_cota_salao')
    .in('id', nota_ids)
    .eq('salao_id', perfil.salao_id)
    // Aceita reenvio de nota rejeitada: sem isto uma recusa da prefeitura
    // travava a nota para sempre, porque a tela nao deixava selecionar e a rota
    // nao aceitaria mesmo se deixasse. 'Pendente' segue de fora — ja esta em
    // processamento e reenviar duplicaria.
    .in('status', ['Não Emitido', 'Erro']);

  if (!notas || notas.length === 0) {
    return NextResponse.json({ erro: 'Nenhuma nota válida encontrada' }, { status: 404 });
  }

  // Processa só o começo da fila e devolve o que sobrou, para o cliente pedir o
  // próximo lote. Nota não processada continua intocada — nada a desfazer.
  const desteLote = notas.slice(0, LOTE_MAX);
  const restantes = notas.slice(LOTE_MAX).map(n => n.id);

  // Mesmo ambiente que o adaptador usa. Lido aqui para registrar o aprendizado
  // no ambiente certo — aceite em produção vale mais que aceite em teste.
  const { data: cfgPlataforma } = await supabaseAdmin
    .from('plataforma_nfse_config').select('ambiente').eq('id', 1).maybeSingle();
  const ambienteAtual: 1 | 2 = cfgPlataforma?.ambiente === 'producao' ? 1 : 2;

  const resultados: Record<string, any> = {};

  for (const nota of desteLote) {
    const referencia = nota.id;
    const payload = buildPayloadNFSe({ salao, nota });
    const resultado = await BrasilNFeAdaptador.emitir(referencia, payload, tokenNFSe);

    const novoStatus =
      resultado.status === 'autorizado' ? 'Emitida' :
      resultado.status === 'processando' ? 'Pendente' :
      'Erro';

    const { error: erroUpdateNota } = await supabaseAdmin.from('notas_fiscais').update({
      status: novoStatus,
      id_externo: referencia,
      numero_nota: resultado.numero_nota ?? null,
      storage_path_pdf: resultado.storage_path_pdf ?? null,
      storage_path_xml: resultado.storage_path_xml ?? null,
      mensagem_erro: resultado.mensagem_erro ?? null,
      data_emissao: resultado.status === 'autorizado' ? new Date().toISOString() : null,
      // O que a prefeitura devolve junto e antes era descartado. A chave e a que
      // abre a nota no portal nacional; sem ela o salao nao tem como provar a
      // emissao fora do nosso banco.
      chave_acesso: resultado.chave_acesso ?? null,
      rps_numero: resultado.rps_numero ?? null,
      protocolo_sefaz: resultado.protocolo_sefaz ?? null,
      codigo_verificacao: resultado.codigo_verificacao ?? null,
      base_calculo: resultado.base_calculo ?? null,
      valor_iss: resultado.valor_iss ?? null,
      aliquota_apurada: resultado.aliquota_apurada ?? null,
    }).eq('id', nota.id);

    if (erroUpdateNota) {
      // A emissão em si já aconteceu (ou não) na Brasil NFe — isso só falhou ao
      // registrar o resultado localmente. Loga alto porque, sem isso, a nota
      // pode ficar presa em "Não Emitido" mesmo já emitida de verdade lá fora.
      console.error(`[nfse/emitir] Nota ${nota.id} processada (${resultado.status}) mas falhou ao atualizar o registro local:`, erroUpdateNota.message);
    }

    // Aprendizado por municipio: guarda se aquela combinacao de codigo passou ou
    // foi recusada ali. E a unica fonte que temos — nao existe API publica de
    // codigo municipal — e serve para sugerir o codigo ao proximo salao da mesma
    // cidade. Nao bloqueia a emissao se falhar.
    if (resultado.status !== 'processando') {
      await registrarResultadoCodigo({
        codigoIbge: salao.codigo_ibge,
        ctribNac: nota.item_lista_servico,
        ctribMun: nota.codigo_tributacao_municipio,
        ambiente: ambienteAtual,
        aceito: resultado.status === 'autorizado',
        erro: resultado.mensagem_erro,
      });
    }

    resultados[nota.id] = { ...resultado, status: novoStatus };
  }

  return NextResponse.json({ resultados, restantes, processadas: desteLote.length });
}
