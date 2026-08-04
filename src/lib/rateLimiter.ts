/**
 * Rate limiter compartilhado para rotas de API críticas.
 *
 * Usa Vercel KV / Upstash Redis via REST quando as env vars estão presentes —
 * necessário em produção multi-instância, já que Vercel Serverless Functions
 * não compartilham memória entre invocações/instâncias (cada uma teria sua
 * própria janela, na prática enfraquecendo o limite). Sem essas env vars, cai
 * para um Map em memória — funciona em desenvolvimento e numa instância única.
 *
 * Para ativar o modo compartilhado: adicione a integração "Vercel KV" ao
 * projeto (Storage → Create Database → KV) ou configure Upstash direto. As
 * env vars KV_REST_API_URL/KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_URL/
 * UPSTASH_REDIS_REST_TOKEN) são detectadas automaticamente — nenhuma chamada
 * existente a rateLimitExcedido() precisa mudar.
 */

interface Janela {
  contador: number;
  resetEm: number;
}

const janelas = new Map<string, Janela>();

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function rateLimitExcedidoMemoria(chave: string, limite: number, janelaSeg: number): boolean {
  const agora = Date.now();
  const entrada = janelas.get(chave);

  if (!entrada || agora > entrada.resetEm) {
    janelas.set(chave, { contador: 1, resetEm: agora + janelaSeg * 1000 });
    return false;
  }

  entrada.contador++;
  return entrada.contador > limite;
}

async function rateLimitExcedidoKv(chave: string, limite: number, janelaSeg: number): Promise<boolean> {
  const chaveRedis = `ratelimit:${chave}`;
  try {
    // Pipeline: as duas instruções vão numa ÚNICA requisição, na ordem.
    //
    // Antes eram dois fetch separados (INCR e, se contador===1, EXPIRE). Se o
    // primeiro desse certo e o segundo falhasse — rede, timeout, 5xx — a chave
    // ficava SEM TTL, ou seja, para sempre. Como o plano free do Redis tem
    // storage limitado, cada falha dessas era um vazamento permanente.
    //
    // SET ... EX ttl NX cria a chave já com validade e só se ela ainda não
    // existir; o INCR seguinte apenas soma. Assim a janela é fixa (não desliza a
    // cada requisição, o que faria um usuário lento nunca ter o contador zerado)
    // e nenhuma chave sobrevive sem expiração. SET com EX/NX funciona em
    // qualquer versão relevante do Redis — não depende do EXPIRE ... NX, que só
    // existe do Redis 7 em diante.
    const resp = await fetch(`${KV_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['SET', chaveRedis, '0', 'EX', String(janelaSeg), 'NX'],
        ['INCR', chaveRedis],
      ]),
    });

    if (!resp.ok) throw new Error(`Redis HTTP ${resp.status}`);

    // A resposta do pipeline é um array na ordem dos comandos; o contador é o 2º.
    const resultados = await resp.json();
    const contador = Number(resultados?.[1]?.result);
    if (!Number.isFinite(contador)) throw new Error('Resposta inesperada do Redis no pipeline');

    return contador > limite;
  } catch (erro) {
    // Falha do KV não deve derrubar a rota inteira — o rate limit é uma
    // camada de defesa extra, não a autenticação em si. Fail-open aqui,
    // fail-closed continua valendo nas checagens de auth/PIN/assinatura.
    console.error('[rateLimiter] Erro ao consultar KV, permitindo a requisição:', erro);
    return false;
  }
}

/**
 * Verifica se a chave (ex: IP, user id) excedeu o limite no período.
 * @returns true se deve bloquear, false se deve permitir
 */
// Alerta único por instância. Sem isto, a queda para o modo memória em produção
// é COMPLETAMENTE silenciosa: as rotas continuam respondendo normalmente e o
// limite parece ativo, mas cada invocação serverless tem o próprio Map — na
// prática, sem rate limit. Foi assim que passou despercebido até a auditoria.
let avisoMemoriaEmitido = false;

export async function rateLimitExcedido(chave: string, limite: number, janelaSeg: number): Promise<boolean> {
  if (KV_URL && KV_TOKEN) return rateLimitExcedidoKv(chave, limite, janelaSeg);

  if (!avisoMemoriaEmitido && process.env.NODE_ENV === 'production') {
    avisoMemoriaEmitido = true;
    console.error(
      '[rateLimiter] SEM BACKEND COMPARTILHADO EM PRODUÇÃO — usando Map em memória, ' +
      'que não é compartilhado entre invocações serverless. Na prática não há rate limit. ' +
      'Configure KV_REST_API_URL + KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_URL + ' +
      'UPSTASH_REDIS_REST_TOKEN) — Vercel → Storage → integração Redis/Upstash. ' +
      'Atenção: a integração precisa expor a API REST; um REDIS_URL (TCP) sozinho ' +
      'não é detectado aqui e cairia neste mesmo modo.',
    );
  }

  return rateLimitExcedidoMemoria(chave, limite, janelaSeg);
}

/**
 * Diagnóstico do rate limiter, para checar a configuração sem depender de ler log.
 * Usado por /api/admin/rodar-cron e por qualquer tela de status que precise saber
 * se a proteção está de fato ativa.
 */
export function statusRateLimiter(): { compartilhado: boolean; origem: string } {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return { compartilhado: true, origem: 'KV_REST_API_* (Vercel/Upstash)' };
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { compartilhado: true, origem: 'UPSTASH_REDIS_REST_* (Upstash direto)' };
  }
  return { compartilhado: false, origem: 'memória (sem proteção real em serverless)' };
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
