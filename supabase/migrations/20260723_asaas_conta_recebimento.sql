-- 20260723_asaas_conta_recebimento.sql
--
-- src/app/api/assinatura/criar-checkout/route.ts e
-- src/app/api/webhooks/asaas/route.ts já selecionam asaas_api_key e
-- asaas_environment de plataforma_contas_recebimento, mas nenhuma migration
-- criava essas colunas — a query falhava silenciosamente e o sistema caía
-- no fallback de env vars/gateway padrão, ignorando a conta configurada no
-- admin. Isso destrava o cadastro do Asaas pelo painel Admin → Catálogo &
-- Planos → Configuração de Recebimento.

ALTER TABLE plataforma_contas_recebimento
  ADD COLUMN IF NOT EXISTS asaas_api_key     TEXT,
  ADD COLUMN IF NOT EXISTS asaas_environment TEXT;

COMMENT ON COLUMN plataforma_contas_recebimento.asaas_api_key
  IS 'Chave de API (access_token) da conta Asaas usada para cobrar assinatura/módulos dos salões.';
COMMENT ON COLUMN plataforma_contas_recebimento.asaas_environment
  IS '"sandbox" ou "production" (padrão production quando nulo) — ver ASAAS_ENVIRONMENT em criar-checkout/route.ts e webhooks/asaas/route.ts.';
