/**
 * GET /api/portal/salao-por-slug?slug=<slug>
 * Retorna o salao_id (UUID) a partir de um slug público.
 */
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const slug = req.nextUrl.searchParams.get('slug')?.trim();
  if (!slug) return NextResponse.json({ erro: 'slug ausente.' }, { status: 400 });

  const { data } = await admin
    .from('saloes')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return NextResponse.json({ erro: 'Salão não encontrado.' }, { status: 404 });
  return NextResponse.json({ salao_id: data.id });
}
