-- Adiciona campo para e-mail do escritório de contabilidade
ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS email_contador TEXT DEFAULT NULL;
