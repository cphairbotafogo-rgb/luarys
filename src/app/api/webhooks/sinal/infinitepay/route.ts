/**
 * POST /api/webhooks/sinal/infinitepay
 *
 * Recebe notificações da InfinitePay referentes a pagamentos de SINAL de reserva
 * feitos por clientes no portal. Separado do webhook de assinatura da plataforma.
 *
 * Fluxo:
 *   1. Extrai agendamento_id do order_nsu (formato "reserva_<uuid>")
 *   2. Busca o handle do salão para fazer payment_check
 *   3. Confirma status real via API da InfinitePay
 *   4. Chama confirmarSinalPago() para atualizar agendamento + notificar
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { confirmarSinalPago, extrairAgendamentoIdDoSinal } from '@/lib/confirmarSinalPago';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderNsu: string | undefined = body.order_nsu;

    const agendamentoId = extrairAgendamentoIdDoSinal(orderNsu);
    if (!agendamentoId) {
      // Não é um pagamento de sinal nosso — ignora
      return NextResponse.json({ recebido: true });
    }

    // Busca salão via agendamento para obter o handle do salão
    const { data: ag } = await supabaseAdmin
      .from('agendamentos')
      .select('salao_id')
      .eq('id', agendamentoId)
      .maybeSingle();

    if (!ag) return NextResponse.json({ recebido: true });

    const { data: salao } = await supabaseAdmin
      .from('saloes')
      .select('token_pagamento, gateway_pagamento')
      .eq('id', ag.salao_id)
      .maybeSingle();

    if (!salao || salao.gateway_pagamento !== 'infinitepay' || !salao.token_pagamento) {
      return NextResponse.json({ recebido: true });
    }

    // O handle da InfinitePay é o token_pagamento sem @ ou $
    const handle = salao.token_pagamento.replace('@', '').replace('$', '').trim();

    // Confirma o pagamento na API da InfinitePay (nunca confia no body recebido)
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

    if (!checkResponse.ok || checkData?.paid !== true) {
      return NextResponse.json({ recebido: true, confirmado: false });
    }

    const resultado = await confirmarSinalPago(agendamentoId);
    return NextResponse.json({ recebido: true, ...resultado });

  } catch (err: any) {
    console.error('[webhook/sinal/infinitepay] Erro:', err);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
