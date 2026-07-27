import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatarFormaPagamentoIP(data: any): string {
  if (!data) return 'InfinitePay';
  const method = (data.payment_method || '').toLowerCase();
  const brand  = data.brand ? ` (${data.brand})` : '';
  if (method === 'credit') return `Crédito${brand}`;
  if (method === 'debit')  return `Débito${brand}`;
  if (method === 'pix')    return 'PIX';
  return `InfinitePay${brand}`;
}

async function salvarFormaPagamento(agendamentoId: string, salaoId: string, formaPagamento: string, parcelas: number) {
  if (!agendamentoId || !UUID_REGEX.test(agendamentoId)) return;
  await supabaseAdmin
    .from('agendamentos')
    .update({ forma_pagamento_sinal: formaPagamento, parcelas_sinal: parcelas })
    .eq('id', agendamentoId)
    .eq('salao_id', salaoId);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { salao_id, gateway, id_transacao, agendamento_id } = body;

    if (!salao_id || !gateway) {
      return NextResponse.json({ erro: 'Dados insuficientes para verificar o pagamento.' }, { status: 400 });
    }
    if (!UUID_REGEX.test(salao_id)) {
      return NextResponse.json({ erro: 'ID de salão inválido.' }, { status: 400 });
    }

    // Busca a configuração de pagamento do salão ANTES de decidir qualquer
    // branch — o `gateway` do body é só o que o front ACHA que está usando;
    // quem manda é o que está configurado no banco para este salao_id.
    const { data: salao, error } = await supabaseAdmin
      .from('saloes')
      .select('token_pagamento, gateway_pagamento')
      .eq('id', salao_id)
      .single();

    if (error || !salao?.token_pagamento) {
      return NextResponse.json({ erro: 'Configuração de pagamento não encontrada.' }, { status: 400 });
    }

    const token = salao.token_pagamento;
    const emModoTeste = token.toLowerCase() === 'teste';

    // ─── SIMULADOR ────────────────────────────────────────────────────────────
    // Só existe de verdade quando o PRÓPRIO salão está com token_pagamento='teste'
    // (mesma condição usada em /api/pagamentos/pix para decidir o modo simulado).
    // Sem esta checagem, qualquer chamada com gateway:'simulador' e um salao_id
    // real marcava o sinal como pago sem checar pagamento nenhum.
    if (gateway === 'simulador') {
      if (!emModoTeste) {
        return NextResponse.json({ erro: 'Este salão não está em modo de teste.' }, { status: 403 });
      }
      await salvarFormaPagamento(agendamento_id, salao_id, 'Simulador (PIX)', 1);
      return NextResponse.json({ aprovado: true, formaPagamento: 'Simulador (PIX)', parcelas: 1 });
    }

    if (emModoTeste) {
      return NextResponse.json({ erro: 'Este salão está em modo de teste — use gateway "simulador".' }, { status: 400 });
    }

    // O gateway informado precisa bater com o que está de fato configurado
    // para o salão — nunca decidir a rota de verificação pelo que o body pede.
    if (gateway !== salao.gateway_pagamento) {
      return NextResponse.json({ erro: 'Gateway informado não corresponde à configuração deste salão.' }, { status: 400 });
    }

    // ─── MERCADO PAGO ─────────────────────────────────────────────────────────
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
      const aprovado = mpData.status === 'approved';

      // MP neste fluxo é sempre PIX (payment_method_id: 'pix')
      const formaPagamento = 'PIX';
      const parcelas = 1;

      if (aprovado) {
        await salvarFormaPagamento(agendamento_id, salao_id, formaPagamento, parcelas);
      }

      return NextResponse.json({ aprovado, formaPagamento, parcelas });
    }

    // ─── INFINITEPAY ──────────────────────────────────────────────────────────
    if (gateway === 'infinitepay') {
      if (!agendamento_id || !UUID_REGEX.test(agendamento_id)) {
        return NextResponse.json({ erro: 'agendamento_id obrigatório para InfinitePay.' }, { status: 400 });
      }

      const { data: ag } = await supabaseAdmin
        .from('agendamentos')
        .select('salao_id, valor_sinal')
        .eq('id', agendamento_id)
        .maybeSingle();

      if (!ag || ag.salao_id !== salao_id) {
        return NextResponse.json({ erro: 'Agendamento não pertence a este salão.' }, { status: 403 });
      }

      const handle   = token.replace('@', '').replace('$', '').trim();
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
      let aprovado  = checkData.success === true && checkData.paid === true;

      // InfinitePay não assina o webhook/payment_check (confirmado com o suporte
      // deles, protocolo 2607271011228) — a única defesa real contra um valor
      // divergente é conferir o pago contra o valor_sinal esperado aqui.
      if (aprovado) {
        const valorPago = checkData.paid_amount != null
          ? Number(checkData.paid_amount) / 100
          : (checkData.amount != null ? Number(checkData.amount) / 100 : 0);
        const valorEsperado = Number(ag.valor_sinal || 0);
        if (valorEsperado > 0 && Math.abs(valorPago - valorEsperado) > 0.01) {
          console.error(`[pagamentos/verificar] Valor pago (${valorPago}) não bate com valor_sinal (${valorEsperado}) — agendamento ${agendamento_id}.`);
          aprovado = false;
        }
      }

      const formaPagamento = formatarFormaPagamentoIP(checkData);
      const parcelas       = checkData.installments ?? 1;

      if (aprovado) {
        await salvarFormaPagamento(agendamento_id, salao_id, formaPagamento, parcelas);
      }

      return NextResponse.json({ aprovado, formaPagamento, parcelas });
    }

    return NextResponse.json({ erro: 'Gateway desconhecido.' }, { status: 400 });

  } catch (err) {
    console.error('Erro em /api/pagamentos/verificar:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}
