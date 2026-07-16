/**
 * src/app/api/webhooks/infinitepay/route.ts
 *
 * Recebe notificações da InfinitePay para pagamentos de ASSINATURA da
 * plataforma.
 *
 * SEGURANÇA: o corpo da notificação NUNCA é confiado diretamente — ele só
 * diz "olha esse pedido aí". Antes de liberar qualquer módulo/plano,
 * confirmamos o status REAL na API da InfinitePay via `payment_check`.
 *
 * Validação de entrada: se infinitepay_webhook_token estiver configurado
 * na conta ativa (ou na env INFINITEPAY_WEBHOOK_TOKEN), o header
 * Authorization da requisição deve bater. Confirmar na documentação da
 * InfinitePay qual header exato eles enviam.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { registrarPagamentoAssinatura, parseReferencia } from '@/lib/assinaturas';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Conta ativa — usada para token de validação e para o payment_check
    const { data: contaAtiva } = await supabaseAdmin
      .from('plataforma_contas_recebimento')
      .select('gateway, infinitepay_handle, infinitepay_webhook_token')
      .eq('ativa', true)
      .maybeSingle();

    // Rejeita silenciosamente se o gateway ativo não for InfinitePay
    if (contaAtiva && contaAtiva.gateway !== 'infinitepay') {
      return NextResponse.json({ recebido: true });
    }

    // Validação de token — obrigatória. Se não configurado, rejeitamos toda requisição.
    const webhookToken = contaAtiva?.infinitepay_webhook_token || process.env.INFINITEPAY_WEBHOOK_TOKEN;
    if (!webhookToken) {
      console.warn('Webhook InfinitePay recebido mas INFINITEPAY_WEBHOOK_TOKEN não está configurado — rejeitando.');
      return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
    }
    const authHeader = request.headers.get('authorization') || request.headers.get('x-webhook-token') || '';
    const tokenRecebido = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (tokenRecebido !== webhookToken) {
      return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
    }

    // order_nsu é o que enviamos como "salaoId::moduloChave" ao criar o link
    const orderNsu: string | undefined = body.order_nsu;
    const referencia = parseReferencia(orderNsu);

    if (!referencia) {
      // Não é um pagamento de assinatura nosso (ou order_nsu ausente) — só confirma recebimento
      return NextResponse.json({ recebido: true });
    }

    const handle = (contaAtiva?.infinitepay_handle || process.env.INFINITEPAY_PLATFORM_HANDLE || '').replace('@', '').replace('$', '').trim();
    if (!handle) {
      console.error('Nenhum handle InfinitePay configurado — não é possível confirmar o pagamento.');
      return NextResponse.json({ erro: 'Configuração ausente.' }, { status: 500 });
    }

    // ─── CONFIRMA O PAGAMENTO NA API DA INFINITEPAY (não confia no body recebido) ───
    const checkResponse = await fetch('https://api.checkout.infinitepay.io/payment_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        order_nsu: orderNsu,
        transaction_nsu: body.transaction_nsu,
        slug: body.slug,
      }),
    });

    const checkData = await checkResponse.json();

    if (!checkResponse.ok || checkData?.success !== true) {
      console.error('payment_check da InfinitePay não confirmou o pagamento:', JSON.stringify(checkData));
      return NextResponse.json({ recebido: true, confirmado: false });
    }

    const aprovado = checkData.paid === true;
    const valor = checkData.paid_amount != null ? Number(checkData.paid_amount) / 100 : (checkData.amount != null ? Number(checkData.amount) / 100 : 0);
    const pagamentoExternoId = body.transaction_nsu || body.slug || orderNsu;

    const resultado = await registrarPagamentoAssinatura({
      salaoId: referencia.salaoId,
      moduloChave: referencia.moduloChave,
      valor,
      status: aprovado ? 'approved' : 'pending',
      gateway: 'infinitepay',
      pagamentoExternoId,
    });

    return NextResponse.json({ recebido: true, ...resultado });

  } catch (err: any) {
    console.error('Erro no webhook InfinitePay:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
