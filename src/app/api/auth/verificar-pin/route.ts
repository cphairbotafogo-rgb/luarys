/**
 * POST /api/auth/verificar-pin
 *
 * A1: Valida o PIN do gerente server-side — o PIN nunca trafega para o cliente.
 * Requer sessão autenticada. Retorna { valido: boolean } sem expor o PIN.
 *
 * Segurança: o ameaçador aqui é um funcionário comum autenticado no mesmo
 * salão tentando descobrir o PIN do gerente por força bruta — rate limit por
 * usuário (não só por IP, já que é o mesmo computador/wifi do salão) e
 * comparação timing-safe, mesmo padrão de /api/admin/verify-key.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { rateLimitExcedido, obterIp } from '@/lib/rateLimiter';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pinConfere(informado: string, correto: string): boolean {
  const a = Buffer.from(informado);
  const b = Buffer.from(correto);
  return a.length === b.length && timingSafeEqual(a, b);
}

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

    // 5 tentativas por usuário a cada 15 minutos
    if (await rateLimitExcedido(`verificar-pin:${user.id}`, 5, 900)) {
      return NextResponse.json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }
    // Camada extra por IP, caso o ataque venha de múltiplas contas na mesma rede
    if (await rateLimitExcedido(`verificar-pin-ip:${obterIp(req as any)}`, 15, 900)) {
      return NextResponse.json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
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

    const valido = pinConfere(String(pin), String(salao.pin_gerente));
    return NextResponse.json({ valido });

  } catch (err) {
    console.error('[verificar-pin] Erro:', err);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
