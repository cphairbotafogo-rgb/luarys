/**
 * src/app/api/webhooks/mercadopago/route.ts
 *
 * Recebe notificações do Mercado Pago para pagamentos de ASSINATURA
 * da plataforma (PLATFORM_GATEWAY=mercadopago).
 *
 * O segredo HMAC é lido da conta ativa em plataforma_contas_recebimento
 * (campo mercadopago_webhook_secret). Se não estiver no banco, cai para
 * a variável de ambiente MERCADOPAGO_WEBHOOK_SECRET como fallback.
 * Se nenhum dos dois estiver configurado, a requisição é bloqueada.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { registrarPagamentoAssinatura, parseReferencia } from '@/lib/assinaturas';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function validarAssinaturaMP(request: NextRequest, secret: string): boolean {
  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');
  const dataId = new URL(request.url).searchParams.get('data.id') ||
    request.headers.get('x-signature')?.match(/id=([^,]+)/)?.[1];

  if (!xSignature) {
    console.warn('[webhook/mp] Header x-signature ausente.');
    return false;
  }

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

    // Lê o secret do banco (conta ativa); fallback para env var
    const { data: contaAtiva } = await supabaseAdmin
      .from('plataforma_contas_recebimento')
      .select('gateway, mercadopago_access_token, mercadopago_webhook_secret')
      .eq('ativa', true)
      .maybeSingle();

    // Rejeita silenciosamente se o gateway ativo não for Mercado Pago
    if (contaAtiva && contaAtiva.gateway !== 'mercadopago') {
      return NextResponse.json({ recebido: true });
    }

    const secret = contaAtiva?.mercadopago_webhook_secret || process.env.MERCADOPAGO_WEBHOOK_SECRET;

    if (!secret) {
      console.error('[webhook/mp] Nenhum segredo HMAC configurado (banco nem env) — requisição bloqueada. Configure mercadopago_webhook_secret na conta ativa em /admin.');
      return NextResponse.json({ erro: 'Configuração ausente.' }, { status: 500 });
    }

    if (!validarAssinaturaMP(request, secret)) {
      console.error('[webhook/mp] Assinatura inválida — requisição rejeitada.');
      return NextResponse.json({ erro: 'Assinatura inválida.' }, { status: 401 });
    }

    const tipo = body.type || body.topic;
    const paymentId = body.data?.id || body.resource;

    if (tipo !== 'payment' || !paymentId) {
      return NextResponse.json({ recebido: true });
    }

    const platformToken = contaAtiva?.mercadopago_access_token || process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN;
    if (!platformToken) {
      console.error('Nenhuma conta de recebimento Mercado Pago configurada.');
      return NextResponse.json({ erro: 'Configuração ausente.' }, { status: 500 });
    }

    // Busca os detalhes reais do pagamento (nunca confie no payload do webhook sozinho)
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${platformToken}` },
    });

    if (!mpResponse.ok) {
      return NextResponse.json({ erro: 'Não foi possível consultar o pagamento no Mercado Pago.' }, { status: 400 });
    }

    const pagamento = await mpResponse.json();
    const referencia = parseReferencia(pagamento.external_reference);
    const status: string = pagamento.status;

    if (!referencia) {
      return NextResponse.json({ recebido: true });
    }

    const resultado = await registrarPagamentoAssinatura({
      salaoId: referencia.salaoId,
      moduloChave: referencia.moduloChave,
      valor: pagamento.transaction_amount,
      status: status === 'approved' ? 'approved' : (status === 'rejected' ? 'rejected' : 'pending'),
      gateway: 'mercadopago',
      pagamentoExternoId: String(paymentId),
    });

    return NextResponse.json({ recebido: true, ...resultado });

  } catch (err: any) {
    console.error('Erro no webhook Mercado Pago:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}

// Mercado Pago às vezes faz GET para validar a URL do webhook
export async function GET() {
  return NextResponse.json({ ok: true });
}
