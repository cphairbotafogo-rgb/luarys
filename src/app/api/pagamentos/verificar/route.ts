import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { salao_id, gateway, id_transacao, agendamento_id } = body;

    if (!salao_id || !gateway) {
      return NextResponse.json({ erro: 'Dados insuficientes para verificar o pagamento.' }, { status: 400 });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(salao_id)) {
      return NextResponse.json({ erro: 'ID de salão inválido.' }, { status: 400 });
    }

    // ─── SIMULADOR: aprovado diretamente ───
    if (gateway === 'simulador') {
      return NextResponse.json({ aprovado: true });
    }

    const { data: salao, error } = await supabaseAdmin
      .from('saloes')
      .select('token_pagamento, gateway_pagamento')
      .eq('id', salao_id)
      .single();

    if (error || !salao?.token_pagamento) {
      return NextResponse.json({ erro: 'Configuração de pagamento não encontrada.' }, { status: 400 });
    }

    const token = salao.token_pagamento;

    // ─── MERCADO PAGO ───
    if (gateway === 'mercadopago') {
      if (!id_transacao) {
        return NextResponse.json({ erro: 'ID da transação não informado.' }, { status: 400 });
      }
      const idNumerico = parseInt(String(id_transacao), 10);
      if (!idNumerico || idNumerico <= 0 || String(idNumerico) !== String(id_transacao)) {
        return NextResponse.json({ erro: 'id_transacao inválido.' }, { status: 400 });
      }
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${idNumerico}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!mpRes.ok) {
        return NextResponse.json({ erro: 'Falha ao consultar Mercado Pago.' }, { status: 400 });
      }
      const mpData = await mpRes.json();
      return NextResponse.json({ aprovado: mpData.status === 'approved' });
    }

    // ─── INFINITEPAY ───
    // C2: order_nsu e slug derivados server-side — nunca vindos do cliente
    // Isso impede que um usuário mal-intencionado substitua o order_nsu por
    // um de uma transação real de outra pessoa e confirme sem pagar.
    if (gateway === 'infinitepay') {
      if (!agendamento_id || !UUID_REGEX.test(agendamento_id)) {
        return NextResponse.json({ erro: 'agendamento_id obrigatório para InfinitePay.' }, { status: 400 });
      }

      // Confirma que o agendamento pertence ao salão informado
      const { data: ag } = await supabaseAdmin
        .from('agendamentos')
        .select('salao_id')
        .eq('id', agendamento_id)
        .maybeSingle();

      if (!ag || ag.salao_id !== salao_id) {
        return NextResponse.json({ erro: 'Agendamento não pertence a este salão.' }, { status: 403 });
      }

      const handle = token.replace('@', '').replace('$', '').trim();
      const orderNsu = `reserva_${agendamento_id}`;

      const checkRes = await fetch('https://api.checkout.infinitepay.io/payment_check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, order_nsu: orderNsu, slug: handle }),
      });
      if (!checkRes.ok) {
        return NextResponse.json({ erro: 'Falha ao consultar InfinitePay.' }, { status: 400 });
      }
      const checkData = await checkRes.json();
      return NextResponse.json({ aprovado: checkData.success === true && checkData.paid === true });
    }

    return NextResponse.json({ erro: 'Gateway desconhecido.' }, { status: 400 });

  } catch (err) {
    console.error('Erro em /api/pagamentos/verificar:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}
