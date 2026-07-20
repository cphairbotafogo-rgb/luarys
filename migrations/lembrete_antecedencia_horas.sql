-- Adiciona campo para configurar com quantas horas de antecedência
-- o lembrete de horário é enviado (24, 12 ou 6 horas antes).
-- Padrão: 24h (véspera).
-- Execute UMA VEZ no Supabase SQL Editor.

ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS confirmacao_antecedencia_horas integer NOT NULL DEFAULT 24
  CHECK (confirmacao_antecedencia_horas IN (6, 12, 24));
