-- Adiciona colunas de plano e status de assinatura à tabela saloes.
-- Compatível com as colunas legacy (modulo_fiscal_liberado, api_whatsapp_liberada, acesso_total).
-- Essas colunas legacy continuam funcionando como override manual.

ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS plano_assinatura       TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS status_assinatura      TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS assinatura_inicio      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assinatura_fim         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valor_mensalidade      NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS gateway_assinatura_id  TEXT;  -- ID externo (MP subscription_id, etc.)

-- Comentários para documentar os valores esperados
COMMENT ON COLUMN saloes.plano_assinatura  IS 'trial | basico | profissional | premium';
COMMENT ON COLUMN saloes.status_assinatura IS 'trial | ativo | suspenso | cancelado';

-- Índice para queries do painel admin (listar por plano/status)
CREATE INDEX IF NOT EXISTS idx_saloes_assinatura
  ON saloes (plano_assinatura, status_assinatura);

-- Salões existentes que já têm modulo_fiscal_liberado=true → migrar para premium
UPDATE saloes
   SET plano_assinatura  = 'premium',
       status_assinatura = 'ativo'
 WHERE modulo_fiscal_liberado = true
   AND plano_assinatura = 'trial';

-- Salões existentes com api_whatsapp_liberada=true (sem fiscal) → profissional
UPDATE saloes
   SET plano_assinatura  = 'profissional',
       status_assinatura = 'ativo'
 WHERE api_whatsapp_liberada = true
   AND modulo_fiscal_liberado IS NOT TRUE
   AND plano_assinatura = 'trial';
