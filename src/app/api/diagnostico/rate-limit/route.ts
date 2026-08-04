/**
 * GET /api/diagnostico/rate-limit
 *
 * Responde se o rate limiter está REALMENTE ativo em produção.
 *
 * Por que existe: a falha do rate limiter é silenciosa por natureza. Sem backend
 * compartilhado, as rotas continuam respondendo 200 normalmente e o limite
 * "parece" ativo — mas cada invocação serverless tem o próprio Map em memória,
 * então na prática não há limite nenhum. Foi assim que passou despercebido até a
 * auditoria. Conferir isso pelo log depende de esperar o alerta aparecer; aqui a
 * resposta é imediata e afirmativa.
 *
 * Não basta checar se as env vars existem — uma URL certa com token errado
 * passaria nessa checagem e falharia em toda requisição real (o catch faz
 * fail-open e engole o erro). Por isso a rota faz um round-trip de verdade
 * contra o Redis, numa chave descartável com TTL curto, e reporta o resultado.
 *
 * Fail-closed no CRON_SECRET, mesmo padrão de /api/cron/resumo-diario: sem o
 * segredo, qualquer um na internet leria detalhes da infraestrutura.
 *
 * Uso:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://www.luarys.com.br/api/diagnostico/rate-limit
 */
import { NextRequest, NextResponse } from 'next/server';
import { statusRateLimiter, rateLimitExcedido } from '@/lib/rateLimiter';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ erro: 'Configuração ausente.' }, { status: 503 });
  }
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (token !== cronSecret) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const status = statusRateLimiter();

  // Round-trip real. A chave leva timestamp + aleatório para nunca colidir com
  // tráfego legítimo, e TTL de 10s para não deixar resíduo no storage.
  const chaveTeste = `diagnostico:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  let funcionando = false;
  let detalhe = '';

  try {
    // Limite 1: a 1ª chamada tem de passar (contador 1) e a 2ª tem de bloquear
    // (contador 2 > 1). Se as duas devolverem false, o contador não está sendo
    // partilhado — é o Map em memória ou o Redis está engolindo erro.
    const primeira = await rateLimitExcedido(chaveTeste, 1, 10);
    const segunda  = await rateLimitExcedido(chaveTeste, 1, 10);

    funcionando = primeira === false && segunda === true;
    detalhe = funcionando
      ? 'Contador incrementou e bloqueou corretamente no round-trip.'
      : `Contador não bloqueou como esperado (1ª=${primeira}, 2ª=${segunda}).`;
  } catch (e: any) {
    detalhe = 'Erro no round-trip: ' + (e?.message || String(e));
  }

  // Só é seguro dizer que está protegido se o backend for compartilhado E o
  // round-trip tiver funcionado. Um dos dois sozinho não prova nada.
  const protegido = status.compartilhado && funcionando;

  return NextResponse.json({
    protegido,
    backend_compartilhado: status.compartilhado,
    origem: status.origem,
    round_trip_ok: funcionando,
    detalhe,
    recomendacao: protegido
      ? 'Rate limiter ativo e verificado.'
      : 'SEM PROTEÇÃO REAL. Confira UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN ' +
        '(ou KV_REST_API_*) e redeploy — env var nova só vale em deployment novo. ' +
        'Atenção: REDIS_URL (TCP) sozinha não serve, o código usa a API REST.',
  });
}
