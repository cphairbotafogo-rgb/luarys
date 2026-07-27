/**
 * POST /api/webhooks/sinal/infinitepay
 *
 * Recebe notificações da InfinitePay referentes a pagamentos de SINAL de reserva
 * feitos por clientes no portal. Separado do webhook de assinatura da plataforma.
 *
 * SEM ASSINATURA POR DESIGN: confirmado com o suporte da InfinitePay (protocolo
 * 2607271011228) que o Checkout Integrado não tem signing secret — a API só
 * identifica o estabelecimento pela InfiniteTag, que é pública. A orientação
 * oficial deles (e a que este arquivo segue) é: NUNCA agir de forma irreversível
 * só por ter recebido o webhook — sempre confirmar via POST /payment_check
 * conferindo order_nsu, valor e forma de pagamento antes de liberar algo.
 * Por isso este endpoint não valida assinatura nenhuma; a segurança real está
 * inteira na dupla checagem abaixo (status pago + valor batendo).
 *
 * Fluxo:
 *   1. Extrai agendamento_id do order_nsu (formato "reserva_<uuid>")
 *   2. Busca o handle do salão E o valor_sinal esperado do agendamento
 *   3. Confirma status real via API da InfinitePay (payment_check)
 *   4. Só chama confirmarSinalPago() se pago E valor bater com o esperado
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
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);
    const orderNsu: string | undefined = body.order_nsu;

    const agendamentoId = extrairAgendamentoIdDoSinal(orderNsu);
    if (!agendamentoId) {
      // Não é um pagamento de sinal nosso — ignora
      return NextResponse.json({ recebido: true });
    }

    // Busca salão via agendamento para obter o handle do salão + valor esperado do sinal
    const { data: ag } = await supabaseAdmin
      .from('agendamentos')
      .select('salao_id, valor_sinal')
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

    // Confere o valor realmente pago contra o valor_sinal esperado do agendamento
    // (recomendação oficial da InfinitePay, já que não há assinatura pra validar).
    const valorPago = checkData.paid_amount != null
      ? Number(checkData.paid_amount) / 100
      : (checkData.amount != null ? Number(checkData.amount) / 100 : 0);
    const valorEsperado = Number(ag.valor_sinal || 0);

    if (valorEsperado > 0 && Math.abs(valorPago - valorEsperado) > 0.01) {
      console.error(
        `[webhook/sinal/infinitepay] Valor pago (${valorPago}) não bate com o valor_sinal esperado (${valorEsperado}) — agendamento ${agendamentoId}.`
      );
      return NextResponse.json({ recebido: true, confirmado: false, motivo: 'valor_divergente' });
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
