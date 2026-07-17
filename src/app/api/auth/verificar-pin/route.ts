/**
 * POST /api/auth/verificar-pin
 *
 * A1: Valida o PIN do gerente server-side — o PIN nunca trafega para o cliente.
 * Requer sessão autenticada. Retorna { valido: boolean } sem expor o PIN.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const bearer = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!bearer) {
      return NextResponse.json({ erro: 'Autenticação necessária.' }, { status: 401 });
    }

    const { data: { user } } = await admin.auth.getUser(bearer);
    if (!user) {
      return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 401 });
    }

    const { salao_id, pin } = await req.json();

    if (!salao_id || !UUID_RE.test(salao_id) || !pin) {
      return NextResponse.json({ erro: 'Parâmetros inválidos.' }, { status: 400 });
    }

    // Confirma que o usuário pertence ao salão solicitado
    const { data: perfil } = await admin
      .from('perfis_usuarios')
      .select('salao_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!perfil || perfil.salao_id !== salao_id) {
      return NextResponse.json({ erro: 'Não autorizado.' }, { status: 403 });
    }

    const { data: salao } = await admin
      .from('saloes')
      .select('pin_gerente')
      .eq('id', salao_id)
      .maybeSingle();

    if (!salao) {
      return NextResponse.json({ erro: 'Salão não encontrado.' }, { status: 404 });
    }

    if (!salao.pin_gerente) {
      return NextResponse.json({ valido: false, semPin: true });
    }

    const valido = String(pin) === String(salao.pin_gerente);
    return NextResponse.json({ valido });

  } catch (err) {
    console.error('[verificar-pin] Erro:', err);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
