// Correções em relação à versão anterior:
//  1. Numeração via RPC atômica obter_proximo_numero_nfce (UPDATE ... RETURNING)
//     — a versão antiga lia proximo_numero e gravava numero + 1 em dois passos,
//     e duas emissões simultâneas recebiam o MESMO número (rejeição na SEFAZ).
//  2. Persistência: TODA tentativa de emissão vira uma linha em nfce_emissoes
//     ANTES de chamar a Focus NFe (status 'processando') e é atualizada com o
//     resultado. Antes, uma nota autorizada na SEFAZ podia não deixar nenhum
//     rastro no banco se o navegador fechasse no meio.
//  3. Falha de rede após o envio não perde a nota: a linha 'processando' fica
//     registrada e pode ser reconciliada depois via /api/nfce/consultar.
// Depende da migration 20260727_nfce_numero_atomico_persistencia.sql.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrasilNFeAdaptadorNFCe } from '@/lib/nfce/brasilnfe';
import { buildPayloadNFCe } from '@/lib/nfce/payloadBalcao';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Converte "1.234,56" ou número em float — mesma convenção do buildPayloadNFCe. */
function moedaParaFloat(v: string | number): number {
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}

export async function POST(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'POST /api/nfce/emitir');
  if (erro) return erro;

  const body = await req.json().catch(() => ({}));
  const { itens, consumidor, pagamentos, desconto = 0, os_numero } = body;

  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ erro: 'Nenhum item informado' }, { status: 400 });
  }

  // ── Dados do salão ──────────────────────────────────────────────────────────
  const { data: salao } = await supabaseAdmin
    .from('saloes')
    .select('cnpj, inscricao_estadual, razao_social, nome_fantasia, logradouro, numero, complemento, bairro, cidade, estado, cep, codigo_ibge, telefone, config_fiscal')
    .eq('id', perfil.salao_id)
    .single();

  const tokenNFCe: string | undefined = salao?.config_fiscal?.brasilnfe_company_token || undefined;

  if (!salao?.cnpj) return NextResponse.json({ erro: 'CNPJ não cadastrado. Configure em Dados da Empresa.' }, { status: 422 });
  if (!salao?.codigo_ibge) return NextResponse.json({ erro: 'Código IBGE não cadastrado. Configure em Dados da Empresa.' }, { status: 422 });
  if (!tokenNFCe) {
    return NextResponse.json({ erro: 'Salão não registrado na Brasil NFe. Solicite ao administrador do Luarys que faça o cadastro do CNPJ.' }, { status: 422 });
  }

  // Empresa excluida na Brasil NFe (modulo fiscal cancelado): o token continua
  // guardado para consultar o que ja foi emitido, mas o CNPJ nao esta mais
  // habilitado a emitir. Sem esta trava a tentativa iria ate o provedor e
  // voltaria um erro sem explicacao para o salao.
  if (salao?.config_fiscal?.brasilnfe_excluido_em) {
    return NextResponse.json({
      erro: 'A emissao de notas foi encerrada quando o modulo fiscal foi cancelado. Contrate o modulo novamente para voltar a emitir — as notas ja emitidas continuam consultaveis.',
    }, { status: 409 });
  }


  // ── Config NFC-e ─────────────────────────────────────────────────────────────
  const { data: configNfce } = await supabaseAdmin
    .from('configuracoes_nfce_produtos')
    .select('crt, serie')
    .eq('salao_id', perfil.salao_id)
    .maybeSingle();

  if (!configNfce) {
    return NextResponse.json({ erro: 'Configuração fiscal do NFC-e não encontrada. Configure em NFC-e → Configuração Fiscal.' }, { status: 422 });
  }

  // ── Reserva do número: atômico, uma única instrução no banco ────────────────
  const { data: numeroReservado, error: erroNumero } = await supabaseAdmin
    .rpc('obter_proximo_numero_nfce', { p_salao_id: perfil.salao_id });

  if (erroNumero || !numeroReservado) {
    console.error('[nfce/emitir] Falha ao reservar número:', erroNumero?.message);
    return NextResponse.json({ erro: 'Não foi possível reservar o número da NFC-e. Tente novamente.' }, { status: 500 });
  }

  const numero: number = numeroReservado;
  const referencia = `nfce-${perfil.salao_id}-${numero}`;

  const payload = buildPayloadNFCe({
    numero,
    salao,
    config: configNfce as any,
    itens,
    consumidor,
    pagamentos,
    desconto,
  });

  const valorTotal =
    itens.reduce((acc: number, it: any) => acc + moedaParaFloat(it.vProd), 0)
    - moedaParaFloat(desconto);

  // ── Registro ANTES da emissão (nunca ter nota na SEFAZ sem rastro local) ────
  const { error: erroRegistro } = await supabaseAdmin.from('nfce_emissoes').insert({
    salao_id: perfil.salao_id,
    referencia,
    numero,
    serie: configNfce.serie || '1',
    status: 'processando',
    valor_total: Math.max(0, valorTotal),
    payload,
    os_numero: typeof os_numero === 'string' ? os_numero : null,
  });

  if (erroRegistro) {
    // Sem registro local não emitimos: o número reservado fica "queimado"
    // (pulo de numeração é aceitável; nota sem rastro não é).
    console.error('[nfce/emitir] Falha ao registrar emissão:', erroRegistro.message);
    return NextResponse.json({ erro: 'Não foi possível registrar a emissão. Tente novamente.' }, { status: 500 });
  }

  // ── Emissão na Brasil NFe ────────────────────────────────────────────────────
  const resultado = await BrasilNFeAdaptadorNFCe.emitir(referencia, payload, tokenNFCe);

  // ── Atualiza o registro com o resultado ──────────────────────────────────────
  const statusInterno =
    resultado.status === 'autorizado' ? 'autorizado' :
    resultado.status === 'processando' ? 'processando' :
    'erro';

  const { error: erroUpdate } = await supabaseAdmin
    .from('nfce_emissoes')
    .update({
      status: statusInterno,
      chave_acesso: resultado.chave ?? null,
      storage_path_danfe: resultado.storage_path_danfe ?? null,
      storage_path_xml: resultado.storage_path_xml ?? null,
      mensagem_erro: resultado.status === 'erro' ? (resultado.mensagem_erro ?? null) : null,
    })
    .eq('referencia', referencia)
    .eq('salao_id', perfil.salao_id);

  if (erroUpdate) {
    console.error('[nfce/emitir] Emissão feita mas falhou ao atualizar registro:', erroUpdate.message);
    // Não devolve erro ao usuário: a nota existe e a linha 'processando'
    // permite reconciliar depois via /api/nfce/consultar.
  }

  return NextResponse.json({ ...resultado, referencia, numero });
}
