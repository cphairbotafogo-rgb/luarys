# Webhooks de pagamento — padrão de segurança do Luarys

Toda rota de webhook que processa pagamento (`src/app/api/webhooks/*/route.ts`)
segue duas defesas, nesta ordem:

## 1. Nunca confiar no payload — sempre re-consultar o status real na API do gateway

Um webhook é só uma notificação "olha, algo aconteceu" — não é prova de
que o pagamento realmente foi aprovado. Qualquer pessoa pode fazer um POST
forjado para a URL do webhook dizendo `"status": "approved"`. A defesa é
sempre buscar o dado real:

```ts
// Recebe o webhook, pega só o ID do pagamento
const paymentId = body.data?.id;

// NUNCA confia no body.status — busca o real na API do gateway
const resposta = await fetch(`https://api.gateway.com/v1/payments/${paymentId}`, {
  headers: { Authorization: `Bearer ${tokenDaPlataforma}` },
});
const pagamentoReal = await resposta.json();
// só processa com base em pagamentoReal.status, nunca em body.status
```

Ver implementação real em `src/app/api/webhooks/mercadopago/route.ts` e
`src/app/api/webhooks/infinitepay/route.ts`.

## 2. Validar a assinatura do webhook, quando o gateway oferece

Gateways que assinam a notificação (ex: Mercado Pago com header
`x-signature`) permitem confirmar que a notificação realmente veio deles,
antes mesmo de gastar uma chamada de API consultando o pagamento.

### Padrão Mercado Pago (HMAC-SHA256)

```ts
import { createHmac, timingSafeEqual } from 'crypto';

function validarAssinaturaMP(request: NextRequest): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[webhook] secret nao configurado - validacao ignorada.');
    return true; // backward-compatible: avisa mas nao derruba producao
  }

  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');
  const dataId = new URL(request.url).searchParams.get('data.id')
    || xSignature?.match(/id=([^,]+)/)?.[1];

  if (!xSignature) return false;

  const ts = xSignature.match(/ts=(\d+)/)?.[1];
  const hash = xSignature.match(/v1=([a-f0-9]+)/)?.[1];
  if (!ts || !hash) return false;

  const partes: string[] = [];
  if (dataId) partes.push(`id:${dataId}`);
  if (xRequestId) partes.push(`request-id:${xRequestId}`);
  partes.push(`ts:${ts}`);
  const mensagem = partes.join(';') + ';';

  const hmac = createHmac('sha256', secret).update(mensagem).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(hmac), Buffer.from(hash));
  } catch {
    return false;
  }
}
```

Sempre usar `timingSafeEqual` para comparar hashes, nunca `===` — comparação
direta de string é vulneravel a timing attack (um atacante consegue
adivinhar o hash certo, byte a byte, medindo quanto tempo a comparacao leva).

**Lembrete operacional:** essa validacao so e real depois que a variavel
de ambiente (`MERCADOPAGO_WEBHOOK_SECRET`) esta configurada em producao -
sem ela, o codigo avisa no log mas deixa passar. Conferir isso antes de
qualquer lancamento que envolva cobranca real.

### Gateways sem assinatura (ex: InfinitePay)

Nem todo gateway oferece HMAC. Quando nao oferece, a defesa #1
(re-consultar o status real, nunca confiar no payload) ja e suficiente -
nao existe lacuna adicional a cobrir so porque falta assinatura, desde
que a re-consulta esteja implementada corretamente.

## Checklist ao adicionar um gateway de pagamento novo

1. O webhook re-consulta o pagamento na API do gateway antes de processar? (obrigatorio)
2. O gateway oferece validacao de assinatura? Se sim, implementar.
3. O webhook loga o payload bruto recebido? Se sim, conferir que nao ha
   dado sensivel nele (numero de cartao, CVV - nao deveria nunca vir num
   payload de webhook bem desenhado, mas vale checar a documentacao do
   gateway especifico) antes de deixar esse log em producao.
4. Em caso de erro/excecao, a rota responde com status apropriado
   (nao 200) para o gateway saber que precisa reenviar a notificacao depois?
