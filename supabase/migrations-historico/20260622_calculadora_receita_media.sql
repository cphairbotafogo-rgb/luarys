-- Adiciona campo de custo de oportunidade na calculadora de estações
ALTER TABLE custos_fixos_salao
  ADD COLUMN IF NOT EXISTS receita_media_mensal NUMERIC(10,2) NOT NULL DEFAULT 0;
