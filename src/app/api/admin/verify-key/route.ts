import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { rateLimitExcedido, obterIp } from '@/lib/rateLimiter';

export async function POST(req: NextRequest) {
  // 5 tentativas por IP a cada 15 minutos
  if (rateLimitExcedido(obterIp(req), 5, 900)) {
    return NextResponse.json({ ok: false, erro: 'Muitas tentativas. Aguarde.' }, { status: 429 });
  }

  const { key } = await req.json();
  const correta = process.env.ADMIN_PLATFORM_KEY;

  if (!correta || !key) return NextResponse.json({ ok: false }, { status: 401 });

  const bufKey = Buffer.from(key);
  const bufCorreta = Buffer.from(correta);

  if (bufKey.length !== bufCorreta.length || !timingSafeEqual(bufKey, bufCorreta)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
