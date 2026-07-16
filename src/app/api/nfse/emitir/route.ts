import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolverAdaptador, resolverToken, buildPayloadNFSe } from '@/lib/nfse';
import { autenticarRota } from '@/lib/apiAuth';

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
  const { data: salao } = await supabaseAdmin
    .from('saloes')
    .select('cnpj, inscricao_municipal, codigo_ibge, regime_tributario, email_fiscal, cnae, config_fiscal, acesso_total, limite_notas_mes')
    .eq('id', perfil.salao_id)
    .single();

  const provedor = salao?.config_fiscal?.provedor_nfse ?? 'focusnfe';
  const adaptador = resolverAdaptador(provedor);
  const tokenNFSe = resolverToken(salao?.config_fiscal, provedor);

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
    .select('id, cliente_nome, cliente_cpf, descricao_servico, valor, item_lista_servico')
    .in('id', nota_ids)
    .eq('salao_id', perfil.salao_id)
    .eq('status', 'Não Emitido');

  if (!notas || notas.length === 0) {
    return NextResponse.json({ erro: 'Nenhuma nota válida encontrada' }, { status: 404 });
  }

  const resultados: Record<string, any> = {};

  for (const nota of notas) {
    const referencia = nota.id;
    const payload = buildPayloadNFSe({ salao, nota });
    const resultado = await adaptador.emitir(referencia, payload, tokenNFSe);

    // Mapeia status Focus NFe → status interno
    const novoStatus =
      resultado.status === 'autorizado' ? 'Emitida' :
      resultado.status === 'processando' ? 'Pendente' :
      'Erro';

    await supabaseAdmin.from('notas_fiscais').update({
      status: novoStatus,
      id_externo: referencia,
      numero_nota: resultado.numero_nota ?? null,
      link_pdf: resultado.link_pdf ?? null,
      link_xml: resultado.link_xml ?? null,
      mensagem_erro: resultado.mensagem_erro ?? null,
      data_emissao: resultado.status === 'autorizado' ? new Date().toISOString() : null,
    }).eq('id', nota.id);

    resultados[nota.id] = { ...resultado, status: novoStatus };
  }

  return NextResponse.json({ resultados });
}
