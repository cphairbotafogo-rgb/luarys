-- 20260708_consumos_assinatura.sql
--
-- Fatia 4 do Clube: controle de consumo dos serviços inclusos por ciclo.
-- Cada vez que o cliente usa um serviço incluso (com o profissional designado
-- e dentro do limite do mês), grava-se uma linha aqui. A contagem por
-- (assinatura, serviço, mês) diz quantos ainda restam ("3 cortes/mês").
--
-- O saldo "zera" naturalmente ao virar o mês_referencia — não precisa apagar
-- nada; a contagem é sempre feita dentro do mês corrente.

CREATE TABLE IF NOT EXISTS consumos_assinatura (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id        UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  assinatura_id   UUID NOT NULL REFERENCES assinaturas_cliente(id) ON DELETE CASCADE,
  servico_id      UUID,
  mes_referencia  DATE NOT NULL,            -- primeiro dia do mês do consumo
  agendamento_id  UUID,                     -- vínculo opcional com o atendimento
  profissional_id UUID,                     -- quem executou (o designado)
  valor_cheio     NUMERIC(10,2),            -- preço cheio do serviço no consumo
  criado_em       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumos_assinatura_saldo
  ON consumos_assinatura(assinatura_id, servico_id, mes_referencia);

ALTER TABLE consumos_assinatura ENABLE ROW LEVEL SECURITY;
CREATE POLICY consumos_assinatura_proprio_salao ON consumos_assinatura
  FOR ALL TO authenticated USING (salao_id = auth_salao_id()) WITH CHECK (salao_id = auth_salao_id());
