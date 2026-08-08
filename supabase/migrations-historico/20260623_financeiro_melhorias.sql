-- ============================================================
-- MIGRATION: Melhorias no módulo Financeiro
-- Data: 2026-06-23
-- ============================================================

-- ── 1. TABELA financeiro ────────────────────────────────────
-- tipo_custo: usado pelo Lançamento Avulso e pelo módulo de
--   Aluguel de Estações para classificar Fixo/Variável.
--   O Dashboard e a aba Despesas precisam desta coluna.
ALTER TABLE financeiro
  ADD COLUMN IF NOT EXISTS tipo_custo TEXT;          -- 'Fixo' | 'Variável' | NULL

-- relacao_id: vínculo opcional com profissional ou fornecedor,
--   salvo pelo modal "Lançamento Avulso" em AbaFinanceiro.
ALTER TABLE financeiro
  ADD COLUMN IF NOT EXISTS relacao_id UUID;

-- agendamento_ids: array de UUIDs vinculando a receita a um ou mais
--   agendamentos fechados via PDV (GavetaPDV). Usado no Relatório
--   de Atendimentos para correlacionar forma de pagamento por serviço.
ALTER TABLE financeiro
  ADD COLUMN IF NOT EXISTS agendamento_ids UUID[] DEFAULT '{}';

-- status: garantir que a coluna aceita 'Pendente' além de 'Pago'.
--   Se a coluna já existia só com 'Pago' como valor padrão,
--   isso é um no-op. Se não existia (improvável), cria com default.
ALTER TABLE financeiro
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pago';

-- ── 2. TABELA despesas ──────────────────────────────────────
-- Garante que todos os campos usados pelo código existem.
ALTER TABLE despesas
  ADD COLUMN IF NOT EXISTS tipo_custo      TEXT;     -- 'Fixo' | 'Variável'
ALTER TABLE despesas
  ADD COLUMN IF NOT EXISTS data_pagamento  DATE;     -- data efetiva do pagamento
ALTER TABLE despesas
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE despesas
  ADD COLUMN IF NOT EXISTS observacao      TEXT;     -- usado para nota de estorno
ALTER TABLE despesas
  ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'Pendente'; -- 'Pendente' | 'Pago' | 'Estornado'

-- ── 3. ÍNDICES DE PERFORMANCE ───────────────────────────────
-- AbaFinanceiro agora faz duas queries em paralelo para despesas:
--   uma por data_vencimento e outra por data_pagamento.
--   Sem índices, cada query faz full-scan em tabelas grandes.

CREATE INDEX IF NOT EXISTS idx_despesas_salao_vencimento
  ON despesas(salao_id, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_despesas_salao_pagamento
  ON despesas(salao_id, data_pagamento);

-- financeiro também se beneficia de índice composto
CREATE INDEX IF NOT EXISTS idx_financeiro_salao_data
  ON financeiro(salao_id, data_movimentacao);

-- índice para filtros por status (estorno, pendente)
CREATE INDEX IF NOT EXISTS idx_financeiro_status
  ON financeiro(salao_id, status);

CREATE INDEX IF NOT EXISTS idx_despesas_status
  ON despesas(salao_id, status);

-- ── 4. MIGRATION PENDENTE: custos_fixos_salao ───────────────
-- Coluna criada em 20260622_calculadora_receita_media.sql
-- Incluída aqui para garantir idempotência caso a anterior não
-- tenha sido executada ainda.
ALTER TABLE custos_fixos_salao
  ADD COLUMN IF NOT EXISTS receita_media_mensal NUMERIC(10,2) NOT NULL DEFAULT 0;

-- ── 5. DOCUMENTAÇÃO (comentários nos status) ────────────────
COMMENT ON COLUMN financeiro.status IS
  'Valores: Pago | Pendente | Estornado';

COMMENT ON COLUMN despesas.status IS
  'Valores: Pendente | Pago | Estornado';

COMMENT ON COLUMN pagamentos_aluguel.status IS
  'Valores: pendente | pago | estornado  (minúsculas por convenção do módulo de aluguel)';

COMMENT ON COLUMN financeiro.tipo_custo IS
  'Classificação da saída: Fixo | Variável | NULL (para entradas)';

COMMENT ON COLUMN despesas.tipo_custo IS
  'Classificação: Fixo | Variável | NULL (sem classificação = exibido na coluna Sem Classificação)';
