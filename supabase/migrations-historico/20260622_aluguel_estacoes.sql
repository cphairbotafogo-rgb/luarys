-- Módulo: Aluguel de Estações / Cadeiras

-- 1. Calculadora de custos fixos
CREATE TABLE IF NOT EXISTS custos_fixos_salao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id        UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  total_estacoes  INTEGER NOT NULL DEFAULT 1,
  margem_lucro    NUMERIC(5,2) NOT NULL DEFAULT 30,
  itens           JSONB NOT NULL DEFAULT '[]',
  atualizado_em   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(salao_id)
);

-- 2. Locatários (profissionais autônomos que alugam estações)
CREATE TABLE IF NOT EXISTS locatarios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id     UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  cpf          TEXT,
  telefone     TEXT,
  email        TEXT,
  especialidade TEXT,
  ativo        BOOLEAN DEFAULT true,
  criado_em    TIMESTAMPTZ DEFAULT now()
);

-- 3. Contratos de aluguel
CREATE TABLE IF NOT EXISTS contratos_aluguel (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id         UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  locatario_id     UUID NOT NULL REFERENCES locatarios(id) ON DELETE CASCADE,
  numero_estacao   TEXT,
  valor_mensal     NUMERIC(10,2) NOT NULL,
  dia_vencimento   INTEGER NOT NULL DEFAULT 5,
  data_inicio      DATE NOT NULL,
  data_fim         DATE,
  ativo            BOOLEAN DEFAULT true,
  observacoes      TEXT,
  criado_em        TIMESTAMPTZ DEFAULT now()
);

-- 4. Pagamentos mensais de aluguel
CREATE TABLE IF NOT EXISTS pagamentos_aluguel (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id                UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  contrato_id             UUID NOT NULL REFERENCES contratos_aluguel(id) ON DELETE CASCADE,
  mes_referencia          DATE NOT NULL,
  valor                   NUMERIC(10,2) NOT NULL,
  data_pagamento          DATE,
  status                  TEXT NOT NULL DEFAULT 'pendente',
  forma_pagamento         TEXT,
  observacao              TEXT,
  lancado_no_financeiro   BOOLEAN DEFAULT false,
  criado_em               TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contrato_id, mes_referencia)
);

-- 5. Modelo de contrato com variáveis
CREATE TABLE IF NOT EXISTS modelos_contrato_aluguel (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id     UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL DEFAULT 'Contrato Padrão',
  conteudo     TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(salao_id)
);

-- RLS
ALTER TABLE custos_fixos_salao        ENABLE ROW LEVEL SECURITY;
ALTER TABLE locatarios                ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_aluguel         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos_aluguel        ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_contrato_aluguel  ENABLE ROW LEVEL SECURITY;

CREATE POLICY custos_fixos_proprio_salao       ON custos_fixos_salao        FOR ALL TO authenticated USING (salao_id = auth_salao_id()) WITH CHECK (salao_id = auth_salao_id());
CREATE POLICY locatarios_proprio_salao         ON locatarios                FOR ALL TO authenticated USING (salao_id = auth_salao_id()) WITH CHECK (salao_id = auth_salao_id());
CREATE POLICY contratos_aluguel_proprio_salao  ON contratos_aluguel         FOR ALL TO authenticated USING (salao_id = auth_salao_id()) WITH CHECK (salao_id = auth_salao_id());
CREATE POLICY pagamentos_aluguel_proprio_salao ON pagamentos_aluguel        FOR ALL TO authenticated USING (salao_id = auth_salao_id()) WITH CHECK (salao_id = auth_salao_id());
CREATE POLICY modelos_contrato_proprio_salao   ON modelos_contrato_aluguel  FOR ALL TO authenticated USING (salao_id = auth_salao_id()) WITH CHECK (salao_id = auth_salao_id());
