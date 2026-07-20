-- Adiciona campos de forma de pagamento do sinal nos agendamentos
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS forma_pagamento_sinal text,
  ADD COLUMN IF NOT EXISTS parcelas_sinal integer;
