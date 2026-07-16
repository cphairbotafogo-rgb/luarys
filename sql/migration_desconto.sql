-- Adiciona colunas de desconto nas tabelas agendamentos e financeiro
-- Executar no Supabase SQL Editor

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS desconto      numeric     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo_desconto text        DEFAULT NULL;

ALTER TABLE financeiro
  ADD COLUMN IF NOT EXISTS desconto      numeric     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo_desconto text        DEFAULT NULL;
