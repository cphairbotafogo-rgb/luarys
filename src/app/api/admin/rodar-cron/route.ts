/**
 * POST /api/admin/rodar-cron
 * Dispara processar-vencimentos manualmente a partir do painel admin.
 * Requer Bearer token de usuário com is_plataforma_admin = true.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (!bearer) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(bearer);
  if (!user) return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 401 });

  const { data: perfil } = await supabaseAdmin
    .from('perfis_usuarios')
    .select('is_plataforma_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil?.is_plataforma_admin) {
    return NextResponse.json({ erro: 'Sem permissão de administrador.' }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${appUrl}/api/assinatura/processar-vencimentos`, {
    method: 'POST',
    headers: { 'x-cron-secret': process.env.CRON_SECRET || '' },
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ erro: data.erro || 'Erro no cron.' }, { status: 502 });
  return NextResponse.json(data);
}
