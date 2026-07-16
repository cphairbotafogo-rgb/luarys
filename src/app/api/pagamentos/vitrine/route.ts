import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usa service_role para criar o pedido e verificar o salão —
// o token nunca vai para o cliente, fica só no servidor.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { salao_id, cliente_id, itens, cliente_nome } = body;

    // ── Validação de entrada ─────────────────────────────────
    if (!salao_id || !cliente_id || !itens) {
      return NextResponse.json({ erro: 'Dados incompletos para processar o pedido.' }, { status: 400 });
    }
    if (!UUID_REGEX.test(salao_id) || !UUID_REGEX.test(cliente_id)) {
      return NextResponse.json({ erro: 'IDs inválidos.' }, { status: 400 });
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ erro: 'O pedido não contém itens.' }, { status: 400 });
    }

    // ── Recalcula o total no servidor — nunca confia no valor do cliente ────
    const produtosIds = itens.map((i: any) => i.produto_id).filter(Boolean);
    const { data: produtosBanco, error: erroProds } = await supabaseAdmin
      .from('produtos')
      .select('id, preco_venda, quantidade_atual')
      .in('id', produtosIds)
      .eq('salao_id', salao_id);

    if (erroProds || !produtosBanco) {
      return NextResponse.json({ erro: 'Erro ao verificar produtos.' }, { status: 500 });
    }

    let totalReal = 0;
    for (const item of itens) {
      const prod = produtosBanco.find((p: any) => p.id === item.produto_id);
      if (!prod) return NextResponse.json({ erro: `Produto não encontrado: ${item.produto_id}` }, { status: 400 });
      const qtd = Number(item.quantidade) || 1;
      if (prod.quantidade_atual < qtd) {
        return NextResponse.json({ erro: `Estoque insuficiente para "${item.nome || item.produto_id}".` }, { status: 400 });
      }
      totalReal += prod.preco_venda * qtd;
    }

    if (totalReal <= 0) {
      return NextResponse.json({ erro: 'Total calculado inválido.' }, { status: 400 });
    }

    // ── Busca configuração de pagamento do salão ─────────────
    const { data: salao, error: erroSalao } = await supabaseAdmin
      .from('saloes')
      .select('gateway_pagamento, token_pagamento')
      .eq('id', salao_id)
      .single();

    if (erroSalao || !salao?.token_pagamento) {
      return NextResponse.json({ erro: 'Esta unidade não tem pagamento online configurado.' }, { status: 400 });
    }

    // ── Cria o pedido em estado "pendente" com o total calculado no servidor ─
    const { data: pedido, error: erroPedido } = await supabaseAdmin
      .from('pedidos_vitrine')
      .insert([{
        salao_id,
        cliente_id,
        itens,
        total: totalReal,
        status: 'pendente',
        gateway: salao.gateway_pagamento,
      }])
      .select('id')
      .single();

    if (erroPedido || !pedido) {
      return NextResponse.json({ erro: 'Erro ao registrar pedido. Tente novamente.' }, { status: 500 });
    }

    const pedidoId = pedido.id;
    const gateway = salao.gateway_pagamento;
    const token = salao.token_pagamento;
    const descricao = `Vitrine — ${itens.length} item(ns) — ${cliente_nome || 'Cliente'}`;

    // ── MODO SIMULADOR ───────────────────────────────────────
    if (token.toLowerCase() === 'teste') {
      await new Promise(r => setTimeout(r, 800));
      return NextResponse.json({
        sucesso: true, gateway: 'simulador', pedido_id: pedidoId,
        copiaECola: '00020101021126360014br.gov.bcb.pix...simulacao',
        qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAADIAAAAyAQMAAAAk8RryAAAABlBMVEX///8AAABVwtN+AAAAAnRSTlMAG/xyzJIAAAAlSURBVCjPY2DABv6hgIFG4D8QYIR6AIw46ocCRhqB/0CAMepHIwDDLjk/r9tB0wAAAABJRU5ErkJggg==',
        idTransacao: 'simulacao_vitrine_' + pedidoId,
      });
    }

    // ── INFINITEPAY ──────────────────────────────────────────
    if (gateway === 'infinitepay') {
      const valorEmCentavos = Math.round(totalReal * 100);
      const handle = token.replace('@', '').replace('$', '').trim();
      const orderNsu = `vitrine_${pedidoId}`;

      const ipRes = await fetch('https://api.checkout.infinitepay.io/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          items: [{ quantity: 1, price: valorEmCentavos, description: descricao }],
          order_nsu: orderNsu,
        }),
      });

      const ipData = await ipRes.json();
      if (!ipRes.ok) {
        return NextResponse.json({ erro: `InfinitePay recusou: ${ipData.message || JSON.stringify(ipData)}` }, { status: 400 });
      }

      return NextResponse.json({
        sucesso: true, gateway: 'infinitepay', pedido_id: pedidoId,
        checkoutUrl: ipData.url || ipData.link,
        orderNsu,
        slug: handle,
      });
    }

    // ── MERCADO PAGO ─────────────────────────────────────────
    if (gateway === 'mercadopago') {
      const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': pedidoId,
        },
        body: JSON.stringify({
          transaction_amount: totalReal,
          description: descricao,
          payment_method_id: 'pix',
          payer: { email: 'cliente@portal.com', first_name: cliente_nome || 'Cliente' },
        }),
      });

      const mpData = await mpRes.json();
      if (!mpRes.ok) {
        return NextResponse.json({ erro: 'Falha ao comunicar com o Mercado Pago.' }, { status: 400 });
      }

      return NextResponse.json({
        sucesso: true, gateway: 'mercadopago', pedido_id: pedidoId,
        copiaECola: mpData.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: mpData.point_of_interaction.transaction_data.qr_code_base64,
        idTransacao: mpData.id,
      });
    }

    return NextResponse.json({ erro: 'Gateway de pagamento não configurado.' }, { status: 400 });

  } catch (err) {
    console.error('Erro em /api/pagamentos/vitrine:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}

// ── Confirmação de pagamento pelo cliente ─────────────────────
// Chamado pelo portal após o gateway confirmar o pagamento.
// Usa service_role para acionar a RPC de baixa de estoque.
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { pedido_id, gateway, id_transacao, order_nsu, transaction_nsu, slug } = body;

    if (!pedido_id || !UUID_REGEX.test(pedido_id)) {
      return NextResponse.json({ erro: 'ID de pedido inválido.' }, { status: 400 });
    }

    // Busca o pedido para confirmar que é real e está pendente
    const { data: pedido } = await supabaseAdmin
      .from('pedidos_vitrine')
      .select('id, salao_id, itens, status, total, cliente_id')
      .eq('id', pedido_id)
      .eq('status', 'pendente')
      .single();

    if (!pedido) {
      return NextResponse.json({ erro: 'Pedido não encontrado ou já processado.' }, { status: 400 });
    }

    // Se há sessão de portal, verifica que o cliente_id do pedido pertence ao usuário
    const bearerConfirm = (request as any).headers?.get?.('authorization')?.replace('Bearer ', '');
    if (bearerConfirm) {
      const { data: { user: userConfirm } } = await supabaseAdmin.auth.getUser(bearerConfirm);
      if (userConfirm) {
        const { data: clienteSession } = await supabaseAdmin.from('clientes').select('id').eq('usuario_portal_id', userConfirm.id).eq('salao_id', pedido.salao_id).maybeSingle();
        if (!clienteSession || clienteSession.id !== pedido.cliente_id) {
          return NextResponse.json({ erro: 'Pedido não pertence a este usuário.' }, { status: 403 });
        }
      }
    }

    // Verifica o pagamento direto no gateway (nunca confia só no frontend)
    let aprovado = false;

    if (gateway === 'simulador') {
      aprovado = true;
    } else if (gateway === 'mercadopago' && id_transacao) {
      const idNumerico = parseInt(String(id_transacao), 10);
      if (!idNumerico || idNumerico <= 0 || String(idNumerico) !== String(id_transacao)) {
        return NextResponse.json({ erro: 'id_transacao inválido.' }, { status: 400 });
      }
      const { data: salao } = await supabaseAdmin.from('saloes').select('token_pagamento').eq('id', pedido.salao_id).single();
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${idNumerico}`, {
        headers: { Authorization: `Bearer ${salao?.token_pagamento}` },
      });
      const mpData = await mpRes.json();
      aprovado = mpData.status === 'approved';
    } else if (gateway === 'infinitepay' && order_nsu) {
      const { data: salao } = await supabaseAdmin.from('saloes').select('token_pagamento').eq('id', pedido.salao_id).single();
      const handle = (salao?.token_pagamento || '').replace('@', '').replace('$', '').trim();
      const ipRes = await fetch('https://api.checkout.infinitepay.io/payment_check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, order_nsu, transaction_nsu, slug }),
      });
      const ipData = await ipRes.json();
      aprovado = ipData.success === true && ipData.paid === true;
    }

    if (!aprovado) {
      return NextResponse.json({ aprovado: false });
    }

    // Baixa atômica de estoque via RPC
    const { error: erroRpc } = await supabaseAdmin.rpc('baixar_estoque_vitrine', {
      p_salao_id: pedido.salao_id,
      p_pedido_id: pedido.id,
      p_itens: pedido.itens,
    });

    if (erroRpc) {
      console.error('Erro na baixa de estoque:', erroRpc);
      // Marca como pago mesmo assim — melhor contabilizar e ajustar o estoque
      // manualmente do que perder o registro do pagamento real
    }

    // Atualiza o pedido para "pago"
    await supabaseAdmin
      .from('pedidos_vitrine')
      .update({ status: 'pago', gateway_tx_id: id_transacao || order_nsu || null, pago_em: new Date().toISOString() })
      .eq('id', pedido_id);

    return NextResponse.json({ aprovado: true, pedido_id });

  } catch (err) {
    console.error('Erro em PATCH /api/pagamentos/vitrine:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}
