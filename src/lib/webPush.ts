import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? 'contato@luarys.com.br'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface PayloadPush {
  titulo: string;
  corpo: string;
  tag?: string;
  url?: string;
}

/**
 * Envia Web Push para todos os dispositivos registrados de um usuário do portal.
 * Falhas individuais de envio (subscription expirada etc.) são ignoradas silenciosamente.
 */
export async function enviarPushPortal(usuarioId: string, payload: PayloadPush): Promise<void> {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('[webPush] Chaves VAPID não configuradas — Web Push desativado.');
    return;
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: subscriptions } = await supabaseAdmin
    .from('portal_push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('usuario_id', usuarioId);

  if (!subscriptions?.length) return;

  const expiradas: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        // 410 Gone = subscription expirada/cancelada pelo browser → remove do banco
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiradas.push(sub.id);
        }
      }
    })
  );

  if (expiradas.length) {
    await supabaseAdmin
      .from('portal_push_subscriptions')
      .delete()
      .in('id', expiradas);
  }
}
