-- Serviços que NÃO participam do desconto por pontos de fidelidade.
-- O dono configura em Configurações → Fidelidade → Serviços sem desconto.

CREATE TABLE IF NOT EXISTS fidelidade_servicos_bloqueados (
  salao_id   UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  PRIMARY KEY (salao_id, servico_id)
);

ALTER TABLE fidelidade_servicos_bloqueados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salao_proprio_fidelidade_bloqueios"
  ON fidelidade_servicos_bloqueados
  FOR ALL
  USING (auth_salao_id() = salao_id);
