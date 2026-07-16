-- Adiciona colunas de segredo de webhook na tabela de contas de recebimento da plataforma.
-- Após rodar este script, configure os segredos pelo painel admin em vez de variáveis de ambiente.
-- Os webhooks leem o banco primeiro e caem no env var como fallback durante a transição.

ALTER TABLE plataforma_contas_recebimento
  ADD COLUMN IF NOT EXISTS mercadopago_webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS infinitepay_webhook_token  TEXT;

COMMENT ON COLUMN plataforma_contas_recebimento.mercadopago_webhook_secret
  IS 'Segredo HMAC configurado no painel do Mercado Pago para validar assinatura dos webhooks.';

COMMENT ON COLUMN plataforma_contas_recebimento.infinitepay_webhook_token
  IS 'Token compartilhado enviado pela InfinitePay no header Authorization dos webhooks.';
