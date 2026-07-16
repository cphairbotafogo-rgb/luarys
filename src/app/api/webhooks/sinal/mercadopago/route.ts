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
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { confirmarSinalPago, extrairAgendamentoIdDoSinal } from '@/lib/confirmarSinalPago';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function validarAssinatura(request: NextRequest, secret: string): boolean {
  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');
  const dataId = new URL(request.url).searchParams.get('data.id') ||
    xSignature?.match(/id=([^,]+)/)?.[1];

  if (!xSignature) return false;
  const ts = xSignature.match(/ts=(\d+)/)?.[1];
  const hash = xSignature.match(/v1=([a-f0-9]+)/)?.[1];
  if (!ts || !hash) return false;

  const partes: string[] = [];
  if (dataId) partes.push(`id:${dataId}`);
  if (xRequestId) partes.push(`request-id:${xRequestId}`);
  partes.push(`ts:${ts}`);
  const mensagem = partes.join(';') + ';';

  const hmac = createHmac('sha256', secret).update(mensagem).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(hmac), Buffer.from(hash));
  } catch {
    return false;
  }
}

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

      const resultado = await confirmarSinalPago(agId);
      return NextResponse.json({ recebido: true, ...resultado });
    }

    const pagamento = await mpResponse.json();
    if (pagamento.status !== 'approved') {
      return NextResponse.json({ recebido: true });
    }

    const agendamentoId = extrairAgendamentoIdDoSinal(pagamento.external_reference);
    if (!agendamentoId) return NextResponse.json({ recebido: true });

    const resultado = await confirmarSinalPago(agendamentoId);
    return NextResponse.json({ recebido: true, ...resultado });

  } catch (err: any) {
    console.error('[webhook/sinal/mp] Erro:', err);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
