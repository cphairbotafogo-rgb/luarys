/**
 * POST /api/portal/criar-agendamento
 *
 * Cria um agendamento pelo portal do cliente. Se o salão tiver
 * cobrar_sinal=true, o agendamento é criado com status "Aguardando Pagamento"
 * e um QR Code PIX é retornado para o cliente pagar o sinal.
 * Só após a confirmação do gateway (webhook /api/webhooks/sinal/*) o
 * status muda para "Agendado".
 *
 * Autenticação: requer token JWT do portal (usuário_portal logado).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    // ── Autenticação ──────────────────────────────────────────────────────────
    const bearer = request.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!bearer) {
      return NextResponse.json({ erro: 'Autenticação necessária.' }, { status: 401 });
    }

    const { data: { user }, error: erroAuth } = await supabaseAdmin.auth.getUser(bearer);
    if (erroAuth || !user) {
      return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 401 });
    }

    // ── Payload ───────────────────────────────────────────────────────────────
    const body = await request.json();
    const { salao_id, cliente_id, servico_id, profissional_id, data, inicio } = body;

    if (!salao_id || !cliente_id || !servico_id || !profissional_id || !data || !inicio) {
      return NextResponse.json({ erro: 'Campos obrigatórios ausentes.' }, { status: 400 });
    }

    for (const [campo, val] of Object.entries({ salao_id, cliente_id, servico_id, profissional_id })) {
      if (!UUID_RE.test(String(val))) {
        return NextResponse.json({ erro: `${campo} inválido.` }, { status: 400 });
      }
    }

    // ── Garante que o cliente pertence ao usuário logado ──────────────────────
    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('id, nome_completo, usuario_portal_id')
      .eq('id', cliente_id)
      .eq('salao_id', salao_id)
      .maybeSingle();

    if (!cliente || cliente.usuario_portal_id !== user.id) {
      return NextResponse.json({ erro: 'Não autorizado para este cliente.' }, { status: 403 });
    }

    // ── Busca dados do salão e serviço ────────────────────────────────────────
    const [resSalao, resServico] = await Promise.all([
      supabaseAdmin
        .from('saloes')
        .select('cobrar_sinal, porcentagem_sinal, gateway_pagamento, token_pagamento')
        .eq('id', salao_id)
        .single(),
      supabaseAdmin
        .from('servicos')
        .select('id, nome_servico, preco_padrao, duracao_minutos')
        .eq('id', servico_id)
        .eq('salao_id', salao_id)
        .eq('exibir_online', true)
        .maybeSingle(),
    ]);

    if (resSalao.error || !resSalao.data) {
      return NextResponse.json({ erro: 'Salão não encontrado.' }, { status: 404 });
    }
    if (!resServico.data) {
      return NextResponse.json({ erro: 'Serviço não disponível.' }, { status: 404 });
    }

    const salao = resSalao.data;
    const servico = resServico.data;

    // ── Verifica conflito de horário: bloqueio ou outro cliente já neste slot ──
    const { data: conflito } = await supabaseAdmin
      .from('agendamentos')
      .select('id')
      .eq('profissional_id', profissional_id)
      .eq('data', data)
      .eq('inicio', inicio)
      .not('status', 'in', '("Cancelado","Faltou")')
      .maybeSingle();

    if (conflito) {
      return NextResponse.json(
        { erro: 'Este horário não está mais disponível. Escolha outro horário.' },
        { status: 409 },
      );
    }

    // ── Calcula sinal ─────────────────────────────────────────────────────────
    const cobrarSinal = !!salao.cobrar_sinal;
    const porcentagem = Number(salao.porcentagem_sinal) || 0;
    const precoServico = Number(servico.preco_padrao) || 0;
    const valorSinal = cobrarSinal && porcentagem > 0
      ? Math.round(precoServico * (porcentagem / 100) * 100) / 100
      : 0;

    // ── Cria o agendamento ────────────────────────────────────────────────────
    const statusInicial = cobrarSinal && valorSinal > 0 ? 'Aguardando Pagamento' : 'Agendado';

    const { data: agendamento, error: erroAg } = await supabaseAdmin
      .from('agendamentos')
      .insert({
        salao_id,
        cliente_id,
        profissional_id,
        servico_id,
        data,
        inicio,
        duracao_minutos: servico.duracao_minutos,
        status: statusInicial,
        valor_final: precoServico,
        valor_sinal: valorSinal > 0 ? valorSinal : null,
        sinal_pago: false,
        origem: 'portal',
        cliente_nome: cliente.nome_completo,
        servico: servico.nome_servico,
      })
      .select('id')
      .single();

    if (erroAg || !agendamento) {
      if (erroAg?.code === '23505') {
        return NextResponse.json(
          { erro: 'Este horário foi reservado agora por outro cliente. Escolha outro horário.' },
          { status: 409 },
        );
      }
      console.error('[portal/criar-agendamento] Erro ao inserir:', erroAg);
      return NextResponse.json({ erro: 'Não foi possível criar o agendamento.' }, { status: 500 });
    }

    const agendamentoId = agendamento.id;

    // ── Notifica o salão sobre o novo agendamento ─────────────────────────────
    const dataFormatada = new Date(data + 'T12:00:00')
      .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    await supabaseAdmin.from('notificacoes').insert({
      salao_id,
      destinatario_tipo: 'salao',
      destinatario_id: salao_id,
      tipo: 'novo_agendamento',
      titulo: cobrarSinal ? 'Novo agendamento — aguardando sinal' : 'Novo agendamento pelo portal',
      mensagem: `${cliente.nome_completo} agendou ${servico.nome_servico} para ${dataFormatada} às ${inicio}.`,
      agendamento_id: agendamentoId,
    });

    // ── Se não cobra sinal, retorna agendamento confirmado ────────────────────
    if (!cobrarSinal || valorSinal <= 0) {
      return NextResponse.json({ agendamentoId, status: 'Agendado', sinalNecessario: false });
    }

    // ── Gera link de pagamento do sinal ───────────────────────────────────────
    if (!salao.token_pagamento) {
      // Sem gateway configurado: confirma sem cobrar sinal
      await supabaseAdmin
        .from('agendamentos')
        .update({ status: 'Agendado', valor_sinal: null, sinal_pago: false })
        .eq('id', agendamentoId);

      return NextResponse.json({ agendamentoId, status: 'Agendado', sinalNecessario: false });
    }

    const orderNsu = `reserva_${agendamentoId}`;
    const gateway = salao.gateway_pagamento;
    const token = salao.token_pagamento;

    // Modo simulador
    if (token.toLowerCase() === 'teste') {
      // Marca automaticamente como pago (ambiente de testes)
      await supabaseAdmin
        .from('agendamentos')
        .update({ sinal_pago: true, status: 'Agendado' })
        .eq('id', agendamentoId);

      return NextResponse.json({
        agendamentoId,
        status: 'Agendado',
        sinalNecessario: false,
        simulador: true,
      });
    }

    // InfinitePay
    if (gateway === 'infinitepay') {
      const handle = token.replace('@', '').replace('$', '').trim();
      const valorCentavos = Math.round(valorSinal * 100);

      const ipResp = await fetch('https://api.checkout.infinitepay.io/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          items: [{ quantity: 1, price: valorCentavos, description: `Sinal: ${servico.nome_servico}` }],
          order_nsu: orderNsu,
        }),
      });

      const ipData = await ipResp.json();
      if (!ipResp.ok) {
        console.error('[portal/criar-agendamento] InfinitePay recusou:', ipData);
        return NextResponse.json({ erro: 'Falha ao gerar link de pagamento.' }, { status: 502 });
      }

      return NextResponse.json({
        agendamentoId,
        status: 'Aguardando Pagamento',
        sinalNecessario: true,
        valorSinal,
        gateway: 'infinitepay',
        checkoutUrl: ipData.url || ipData.link,
        orderNsu,
        slug: handle,
      });
    }

    // Mercado Pago
    if (gateway === 'mercadopago') {
      const mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          transaction_amount: valorSinal,
          description: `Sinal de reserva: ${servico.nome_servico}`,
          payment_method_id: 'pix',
          external_reference: orderNsu,
          payer: {
            email: user.email || 'cliente@portal.com',
            first_name: cliente.nome_completo,
          },
        }),
      });

      const mpData = await mpResp.json();
      if (!mpResp.ok) {
        console.error('[portal/criar-agendamento] Mercado Pago recusou:', mpData);
        return NextResponse.json({ erro: 'Falha ao gerar QR Code PIX.' }, { status: 502 });
      }

      return NextResponse.json({
        agendamentoId,
        status: 'Aguardando Pagamento',
        sinalNecessario: true,
        valorSinal,
        gateway: 'mercadopago',
        copiaECola: mpData.point_of_interaction?.transaction_data?.qr_code,
        qrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
        idTransacao: mpData.id,
      });
    }

    return NextResponse.json({ erro: 'Gateway de pagamento não suportado.' }, { status: 400 });

  } catch (err: any) {
    console.error('[portal/criar-agendamento] Erro interno:', err);
    return NextResponse.json({ erro: 'Erro interno do servidor.' }, { status: 500 });
  }
}
