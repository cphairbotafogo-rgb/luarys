/**
 * Rate limiter em memória para rotas de API críticas.
 * Sem dependências externas — adequado para instância única (Vercel Serverless Functions).
 * Para multi-instância em produção, substituir por Redis/KV.
 */

interface Janela {
  contador: number;
  resetEm: number;
}

const janelas = new Map<string, Janela>();

/**
 * Verifica se a chave (ex: IP) excedeu o limite no período.
 * @returns true se deve bloquear, false se deve permitir
 */
export function rateLimitExcedido(chave: string, limite: number, janelaSeg: number): boolean {
  const agora = Date.now();
  const entrada = janelas.get(chave);

  if (!entrada || agora > entrada.resetEm) {
    janelas.set(chave, { contador: 1, resetEm: agora + janelaSeg * 1000 });
    return false;
  }

  entrada.contador++;
  if (entrada.contador > limite) return true;
  return false;
}

/** Extrai o IP real da requisição (considera proxies como Vercel/Cloudflare). */
export function obterIp(req: Request): string {
  const headers = (req as any).headers;
  return (
    headers.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get?.('x-real-ip') ||
    'desconhecido'
  );
}
