import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const { usuario_id, subscription } = await request.json();

    if (!usuario_id || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ erro: 'Dados incompletos.' }, { status: 400 });
    }

    // Upsert: atualiza se o mesmo endpoint já existir para este usuário
    const { error } = await supabaseAdmin
      .from('portal_push_subscriptions')
      .upsert({
        usuario_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }, { onConflict: 'usuario_id,endpoint' });

    if (error) {
      console.error('[push-subscribe] Erro ao salvar:', error.message);
      return NextResponse.json({ erro: 'Erro ao salvar assinatura.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[push-subscribe] Erro:', err);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
