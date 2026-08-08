-- 20260708_cobrancas_assinatura.sql
--
-- Fatia 3 do Clube: cobrança recorrente mensal com baixa manual.
-- Espelha o padrão de pagamentos_aluguel (contratos_aluguel/pagamentos_aluguel).
-- Uma linha por assinatura por mês de referência. Ao marcar como pago, o app
-- lança a receita no financeiro (categoria "Assinaturas").

CREATE TABLE IF NOT EXISTS cobrancas_assinatura (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id               UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  assinatura_id          UUID NOT NULL REFERENCES assinaturas_cliente(id) ON DELETE CASCADE,
  mes_referencia         DATE NOT NULL,
  valor                  NUMERIC(10,2) NOT NULL,
  data_pagamento         DATE,
  status                 TEXT NOT NULL DEFAULT 'pendente',   -- pendente | pago
  forma_pagamento        TEXT,
  observacao             TEXT,
  lancado_no_financeiro  BOOLEAN DEFAULT false,
  criado_em              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assinatura_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_cobrancas_assinatura_salao_mes
  ON cobrancas_assinatura(salao_id, mes_referencia);

ALTER TABLE cobrancas_assinatura ENABLE ROW LEVEL SECURITY;
CREATE POLICY cobrancas_assinatura_proprio_salao ON cobrancas_assinatura
  FOR ALL TO authenticated USING (salao_id = auth_salao_id()) WITH CHECK (salao_id = auth_salao_id());
