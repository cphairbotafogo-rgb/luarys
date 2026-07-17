import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifica assinatura HMAC-SHA256 de um webhook.
 * Usa timingSafeEqual para prevenir timing attacks.
 * Retorna false se a assinatura ou o secret forem vazios.
 */
export function verificarHmacSha256(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const sigBuf  = Buffer.from(signature.toLowerCase().replace(/^sha256=/, ''));
    const expBuf  = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Comparação de tokens com timingSafeEqual.
 * Substitui comparação direta (===) que vaza timing.
 */
export function tokenValido(recebido: string, esperado: string): boolean {
  if (!recebido || !esperado) return false;
  try {
    const a = Buffer.from(recebido);
    const b = Buffer.from(esperado);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
