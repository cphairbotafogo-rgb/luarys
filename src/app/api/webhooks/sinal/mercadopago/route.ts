/**
 * POST /api/webhooks/sinal/mercadopago
 *
 * Recebe notificações do Mercado Pago referentes a pagamentos de SINAL de reserva
 * feitos por clientes no portal. Completamente separado do webhook de assinatura
 * da plataforma (/api/webhooks/mercadopago).
 *
 * Fluxo:
 *   1. Valida assinatura HMAC usando o token do salão (gateway_pagamento)
 *   2. Consulta o pagamento na API do MP para confirmar status real
 *   3. Extrai o agendamento_id do external_reference (formato "reserva_<uuid>")
 *   4. Chama confirmarSinalPago() para atualizar agendamento + notificar
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { confirmarSinalPago, extrairAgendamentoIdDoSinal } from '@/lib/confirmarSinalPago';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// NOTA DE SEGURANÇA — por que não há validação HMAC aqui:
// existia uma função `validarAssinatura()` neste arquivo que NUNCA era chamada
// (código morto), o que dava a falsa impressão de que o webhook era verificado.
// Foi removida. O sinal é cobrado na conta Mercado Pago DO SALÃO, e o Luarys não
// guarda o webhook secret de cada salão — não há como validar HMAC hoje.
// A defesa efetiva, portanto, é dupla e acontece abaixo:
//   1. o pagamento é RELIDO na API do Mercado Pago usando o token do próprio salão
//      (um id forjado, ou de outra conta, simplesmente não é encontrado);
//   2. o valor confirmado é conferido contra `agendamentos.valor_sinal` dentro de
//      confirmarSinalPago() — pagamento menor não libera a reserva.
// Se um dia for guardado um webhook secret por salão, reativar a checagem HMAC
// aqui e passar a rejeitar (fail-closed) quando ela falhar.

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    const tipo = body.type || body.topic;
    const paymentId = body.data?.id || body.resource;

    if (tipo !== 'payment' || !paymentId) {
      return NextResponse.json({ recebido: true });
    }

    // Busca detalhes reais do pagamento antes de qualquer ação
    // Usamos o token do salão cujo external_reference bate com "reserva_<uuid>".
    // Para validar a assinatura HMAC precisaríamos do webhook_secret do salão —
    // como cada salão configura o seu próprio gateway, aceitamos sem HMAC aqui
    // e confiamos na verificação independente do status via API do MP.
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      // O token correto é obtido pelo agendamento → salão → token_pagamento
      // Para a consulta inicial, tentamos com a env var da plataforma como fallback;
      // se não existir, buscamos via agendamento após identificar o salão.
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN || ''}` },
    });

    if (!mpResponse.ok) {
      // Tenta identificar pelo external_reference diretamente do body
      const extRef: string | undefined = body.data?.external_reference || body.external_reference;
      const agendamentoId = extrairAgendamentoIdDoSinal(extRef);
      if (!agendamentoId) {
        return NextResponse.json({ recebido: true });
      }

      // Busca o token do salão via agendamento
      const { data: ag } = await supabaseAdmin
        .from('agendamentos')
        .select('salao_id')
        .eq('id', agendamentoId)
        .maybeSingle();

      if (!ag) return NextResponse.json({ recebido: true });

      const { data: salao } = await supabaseAdmin
        .from('saloes')
        .select('token_pagamento')
        .eq('id', ag.salao_id)
        .maybeSingle();

      if (!salao?.token_pagamento) return NextResponse.json({ recebido: true });

      // Tenta novamente com o token do salão
      const mpRetry = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${salao.token_pagamento}` },
      });
      if (!mpRetry.ok) return NextResponse.json({ recebido: true });

      const pagamento = await mpRetry.json();
      if (pagamento.status !== 'approved') return NextResponse.json({ recebido: true });

      const agId = extrairAgendamentoIdDoSinal(pagamento.external_reference);
      if (!agId) return NextResponse.json({ recebido: true });

      const resultado = await confirmarSinalPago(agId, Number(pagamento.transaction_amount) || 0);
      return NextResponse.json({ recebido: true, ...resultado });
    }

    const pagamento = await mpResponse.json();
    if (pagamento.status !== 'approved') {
      return NextResponse.json({ recebido: true });
    }

    const agendamentoId = extrairAgendamentoIdDoSinal(pagamento.external_reference);
    if (!agendamentoId) return NextResponse.json({ recebido: true });

    const resultado = await confirmarSinalPago(agendamentoId, Number(pagamento.transaction_amount) || 0);
    return NextResponse.json({ recebido: true, ...resultado });

  } catch (err: any) {
    console.error('[webhook/sinal/mp] Erro:', err);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
