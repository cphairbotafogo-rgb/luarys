/**
 * POST /api/assinatura/webhook
 *
 * Webhook interno para atualização manual de plano/status por admin
 * (ou chamada de ferramentas externas como N8N).
 * NÃO é o webhook dos gateways de pagamento — para isso use
 * /api/webhooks/mercadopago, /api/webhooks/infinitepay, /api/webhooks/cielo.
 *
 * Segurança: valida X-Luarys-Webhook-Secret contra WEBHOOK_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-luarys-webhook-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: 'Payload inválido.' }, { status: 400 }); }

  const {
    salao_id,
    plano_chave,
    status_assinatura,
    valor_mensalidade,
    assinatura_inicio,
    assinatura_fim,
    renovar,    // boolean — se true, renova o plano pelo período informado
    periodo,    // 'mensal' | 'anual' — usado junto com renovar
  } = body;

  if (!salao_id) {
    return NextResponse.json({ erro: 'salao_id obrigatório.' }, { status: 400 });
  }

  const update: Record<string, any> = {};

  if (plano_chave !== undefined) {
    // Busca o plano no banco para sincronizar limite_profissionais
    const { data: plano } = await supabaseAdmin
      .from('planos')
      .select('nome, limite_profissionais')
      .eq('chave', plano_chave)
      .maybeSingle();

    update.plano_chave = plano_chave || null;

    if (plano?.limite_profissionais != null) {
      update.limite_profissionais = plano.limite_profissionais;
    }
  }

  if (status_assinatura)  update.status_assinatura = status_assinatura;
  if (assinatura_inicio)  update.assinatura_inicio  = assinatura_inicio;
  if (assinatura_fim)     update.assinatura_fim      = assinatura_fim;
  if (valor_mensalidade != null) update.valor_mensalidade = Number(valor_mensalidade);

  if (renovar) {
    const renovacaoEm = new Date();
    if (periodo === 'anual') {
      renovacaoEm.setFullYear(renovacaoEm.getFullYear() + 1);
    } else {
      renovacaoEm.setDate(renovacaoEm.getDate() + 30);
    }
    update.plano_renovacao_em      = renovacaoEm.toISOString();
    update.plano_aviso_enviado_em  = null;
    update.plano_periodo           = periodo || 'mensal';
    update.status_assinatura       = 'ativo';
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ erro: 'Nenhum campo para atualizar.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('saloes')
    .update(update)
    .eq('id', salao_id);

  if (error) {
    console.error('[webhook/assinatura] erro supabase:', error);
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  console.log('[webhook/assinatura] atualizado:', salao_id, update);
  return NextResponse.json({ sucesso: true, salao_id, atualizado: update });
}
