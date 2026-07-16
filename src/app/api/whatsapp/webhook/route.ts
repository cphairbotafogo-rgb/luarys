import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const body = await req.json().catch(() => ({}));

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
