import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verifica o header X-Hub-Signature-256 que a Meta envia em todo POST do
 * webhook (HMAC-SHA256 do corpo bruto usando o App Secret do app da Meta).
 * Sem isso, qualquer pessoa pode forjar um evento "status: failed" com o
 * wamid de uma mensagem alheia e disparar restaurar_credito_whatsapp,
 * devolvendo crédito de uma mensagem que na verdade foi entregue.
 * Fail-closed: sem WHATSAPP_APP_SECRET configurado, todo POST é rejeitado.
 */
function assinaturaValida(corpoBruto: string, header: string | null): boolean {
  const segredo = process.env.WHATSAPP_APP_SECRET;
  if (!segredo || !header) return false;

  const esperado = 'sha256=' + crypto.createHmac('sha256', segredo).update(corpoBruto, 'utf8').digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * GET /api/whatsapp/webhook — verificação do webhook pela Meta (challenge).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 });
  }

  return NextResponse.json({ erro: 'Token inválido' }, { status: 403 });
}

/**
 * POST /api/whatsapp/webhook — recebe eventos da Meta.
 *
 * status: failed → restaura o crédito debitado (RPC restaurar_credito_whatsapp).
 * Mensagens recebidas de clientes não exigem mais tratamento aqui:
 * no modelo por mensagem (Meta jul/2025) não há janela de serviço com
 * impacto direto no saldo — texto livre de resposta é sempre gratuito.
 */
export async function POST(req: NextRequest) {
  const corpoBruto = await req.text();

  if (!assinaturaValida(corpoBruto, req.headers.get('x-hub-signature-256'))) {
    console.error('[whatsapp/webhook] Assinatura ausente ou inválida — requisição rejeitada.');
    return NextResponse.json({ erro: 'Assinatura inválida' }, { status: 401 });
  }

  let body: any = {};
  try { body = JSON.parse(corpoBruto || '{}'); } catch { /* corpo inválido, segue com {} */ }

  const value = body?.entry?.[0]?.changes?.[0]?.value;
  if (!value) return NextResponse.json({ ok: true });

  const statuses = value?.statuses as any[] | undefined;

  if (statuses?.length) {
    for (const status of statuses) {
      if (status.status === 'failed' && status.id) {
        await supabaseAdmin.rpc('restaurar_credito_whatsapp', { p_wamid: status.id });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
