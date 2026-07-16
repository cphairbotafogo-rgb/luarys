-- 20260708_clube_assinaturas.sql
--
-- Clube de Assinaturas (mensalidade recorrente do salão para seus clientes).
-- Fatia 1: apenas o modelo de dados. Nada aqui toca o fechamento de caixa nem
-- o RLS existente — são tabelas novas, isoladas, escopadas por salao_id via
-- auth_salao_id() (mesmo padrão do módulo de Aluguel de Estações).
--
--  - planos_assinatura_cliente: os planos que o salão oferece.
--  - assinaturas_cliente: qual cliente assina qual plano (usado a partir da fatia 2).

CREATE TABLE IF NOT EXISTS planos_assinatura_cliente (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id            UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  nome                TEXT NOT NULL,
  descricao           TEXT,
  preco_mensal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto_percentual NUMERIC(5,2)  NOT NULL DEFAULT 0,   -- % off geral em serviços/produtos
  servicos_inclusos   JSONB         NOT NULL DEFAULT '[]', -- [{ servico_id, nome, qtd_mes }]
  cor                 TEXT DEFAULT '#D4AF37',
  ativo               BOOLEAN NOT NULL DEFAULT true,
  criado_em           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assinaturas_cliente (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id          UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  cliente_id        UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  plano_id          UUID NOT NULL REFERENCES planos_assinatura_cliente(id) ON DELETE RESTRICT,
  status            TEXT NOT NULL DEFAULT 'ativa',        -- ativa | pausada | cancelada
  data_inicio       DATE NOT NULL DEFAULT CURRENT_DATE,
  dia_vencimento    INTEGER NOT NULL DEFAULT 5,
  proxima_cobranca  DATE,
  observacoes       TEXT,
  criado_em         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assinaturas_cliente_salao  ON assinaturas_cliente(salao_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_cliente_status ON assinaturas_cliente(salao_id, status);

-- RLS — escopo por salão (mesmo padrão do projeto)
ALTER TABLE planos_assinatura_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas_cliente       ENABLE ROW LEVEL SECURITY;

CREATE POLICY planos_assinatura_proprio_salao   ON planos_assinatura_cliente FOR ALL TO authenticated USING (salao_id = auth_salao_id()) WITH CHECK (salao_id = auth_salao_id());
CREATE POLICY assinaturas_cliente_proprio_salao ON assinaturas_cliente       FOR ALL TO authenticated USING (salao_id = auth_salao_id()) WITH CHECK (salao_id = auth_salao_id());
