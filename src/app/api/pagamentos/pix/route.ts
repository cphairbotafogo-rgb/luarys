import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { salao_id, valor, cliente_nome, servico_nome, agendamento_id } = body;

    if (!salao_id || !valor) {
      return NextResponse.json({ erro: "Dados incompletos para gerar o pagamento." }, { status: 400 });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(salao_id)) {
      return NextResponse.json({ erro: 'ID de salão inválido.' }, { status: 400 });
    }

    // Se há sessão de painel (funcionário), verifica que pertence ao salão
    const bearerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (bearerToken) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(bearerToken);
      if (user) {
        const { data: perfil } = await supabaseAdmin.from('perfis_usuarios').select('salao_id').eq('id', user.id).maybeSingle();
        if (perfil && perfil.salao_id !== salao_id) {
          return NextResponse.json({ erro: 'Não autorizado para este salão.' }, { status: 403 });
        }
      }
    }

    // Sem sessão (chamada do portal): exige agendamento_id para ancorar a cobrança
    if (!bearerToken && (!agendamento_id || !UUID_REGEX.test(agendamento_id))) {
      return NextResponse.json({ erro: 'agendamento_id obrigatório para pagamento via portal.' }, { status: 400 });
    }

    // Se agendamento_id fornecido, confirma que pertence ao salão informado
    if (agendamento_id && UUID_REGEX.test(agendamento_id)) {
      const { data: ag } = await supabaseAdmin.from('agendamentos').select('salao_id').eq('id', agendamento_id).maybeSingle();
      if (!ag || ag.salao_id !== salao_id) {
        return NextResponse.json({ erro: 'Agendamento não pertence a este salão.' }, { status: 403 });
      }
    }

    const { data: salao, error } = await supabaseAdmin
      .from('saloes')
      .select('gateway_pagamento, token_pagamento')
      .eq('id', salao_id)
      .single();

    if (error || !salao || !salao.token_pagamento) {
      return NextResponse.json({ erro: "A unidade não possui configuração financeira ativa." }, { status: 400 });
    }

    const gateway = salao.gateway_pagamento;
    const token = salao.token_pagamento;

    // ─── 🧪 MODO SIMULADOR ───
    if (token.toLowerCase() === 'teste') {
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      return NextResponse.json({
        sucesso: true, gateway: 'simulador',
        copiaECola: '00020101021126360014br.gov.bcb.pix...simulacao',
        qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAADIAAAAyAQMAAAAk8RryAAAABlBMVEX///8AAABVwtN+AAAAAnRSTlMAG/xyzJIAAAAlSURBVCjPY2DABv6hgIFG4D8QYIR6AIw46ocCRhqB/0CAMepHIwDDLjk/r9tB0wAAAABJRU5ErkJggg==',
        idTransacao: 'simulacao_999999'
      });
    }

    // ─── 🟢 INFINITEPAY ───
    if (gateway === 'infinitepay') {
      const valorEmCentavos = Math.round(Number(valor) * 100);
      const handleLojista = token.replace('@', '').replace('$', '').trim();
      const orderNsuGerado = agendamento_id ? `reserva_${agendamento_id}` : `reserva_${Date.now()}`;

      const bodyInfinitePay = {
        handle: handleLojista,
        // 🟢 AQUI ESTÁ A CORREÇÃO MÁGICA: items em vez de itens
        items: [{ quantity: 1, price: valorEmCentavos, description: `Sinal: ${servico_nome} (${cliente_nome || 'Cliente'})` }],
        order_nsu: orderNsuGerado
      };

      const ipResponse = await fetch('https://api.checkout.infinitepay.io/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyInfinitePay)
      });

      const ipData = await ipResponse.json();

      if (!ipResponse.ok) {
        const motivo = ipData.message || JSON.stringify(ipData);
        return NextResponse.json({ erro: `A InfinitePay recusou. Motivo: ${motivo}` }, { status: 400 });
      }

      // FIX: order_nsu e slug (handle) precisam voltar para o frontend —
      // sem eles, /api/pagamentos/verificar nunca consegue checar o status
      // real do pagamento na InfinitePay (payment_check exige esses dados).
      return NextResponse.json({
        sucesso: true,
        gateway: 'infinitepay',
        checkoutUrl: ipData.url || ipData.link,
        orderNsu: orderNsuGerado,
        slug: handleLojista,
      });
    }

    // ─── 🟡 MERCADO PAGO ───
    if (gateway === 'mercadopago') {
      const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() 
        },
        body: JSON.stringify({
          transaction_amount: Number(valor), description: `Sinal de Reserva: ${servico_nome}`, payment_method_id: 'pix',
          payer: { email: 'cliente@portal.com', first_name: cliente_nome || 'Cliente' }
        })
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) return NextResponse.json({ erro: "Falha ao comunicar com o Mercado Pago. Verifique o Token." }, { status: 400 });

      return NextResponse.json({
        sucesso: true, gateway: 'mercadopago',
        copiaECola: mpData.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: mpData.point_of_interaction.transaction_data.qr_code_base64,
        idTransacao: mpData.id
      });
    }

    return NextResponse.json({ erro: "Processador de pagamentos desconhecido." }, { status: 400 });

  } catch (err) {
    console.error("Erro Crítico no Backend:", err);
    return NextResponse.json({ erro: "Erro interno no servidor." }, { status: 500 });
  }
}