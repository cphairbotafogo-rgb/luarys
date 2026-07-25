-- 20260724_asaas_subscription_recorrente.sql
--
-- Suporte a cobrança recorrente automática via Asaas Subscriptions (só cartão
-- de crédito, sem parcelamento) para assinatura da plataforma/módulos.
-- Guarda o id da subscription do Asaas para permitir cancelar quando o salão
-- desativar o módulo/plano — sem isso, o salão continuaria sendo cobrado
-- automaticamente por algo que já cancelou.

ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

ALTER TABLE salao_modulos
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

COMMENT ON COLUMN saloes.asaas_subscription_id
  IS 'ID da subscription no Asaas (cobrança recorrente do plano base). Usado para cancelar a recorrência no Asaas quando o salão troca/cancela de plano.';
COMMENT ON COLUMN salao_modulos.asaas_subscription_id
  IS 'ID da subscription no Asaas (cobrança recorrente deste módulo). Usado para cancelar a recorrência no Asaas quando o salão desativa o módulo.';
