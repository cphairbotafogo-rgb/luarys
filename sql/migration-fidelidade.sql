-- ============================================================
-- Migration: Programa de Fidelidade (Fase 1)
-- Rodar no Supabase > SQL Editor
-- ============================================================

-- 1. Configuração do programa por salão
CREATE TABLE IF NOT EXISTS fidelidade_config (
  salao_id         uuid PRIMARY KEY REFERENCES saloes(id) ON DELETE CASCADE,
  ativo            boolean NOT NULL DEFAULT false,
  pontos_por_real  numeric(10, 2) NOT NULL DEFAULT 1,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE fidelidade_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salao_propria_config" ON fidelidade_config
  USING (salao_id = auth_salao_id());

-- 2. Catálogo de prêmios resgatáveis
CREATE TABLE IF NOT EXISTS fidelidade_premios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id    uuid NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  servico_id  uuid REFERENCES servicos(id) ON DELETE SET NULL,
  custo_pontos integer NOT NULL CHECK (custo_pontos > 0),
  valor_real  numeric(10, 2) NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE fidelidade_premios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salao_proprio_premio" ON fidelidade_premios
  USING (salao_id = auth_salao_id());

CREATE INDEX IF NOT EXISTS idx_fidelidade_premios_salao ON fidelidade_premios(salao_id) WHERE ativo = true;

-- 3. Transações de pontos por cliente
CREATE TABLE IF NOT EXISTS fidelidade_transacoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id       uuid NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  cliente_id     uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo           text NOT NULL CHECK (tipo IN ('ganho', 'resgate', 'ajuste')),
  pontos         integer NOT NULL,           -- positivo = ganho, negativo = resgate/débito
  descricao      text,
  agendamento_id uuid REFERENCES agendamentos(id) ON DELETE SET NULL,
  premio_id      uuid REFERENCES fidelidade_premios(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE fidelidade_transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salao_propria_transacao" ON fidelidade_transacoes
  USING (salao_id = auth_salao_id());

CREATE INDEX IF NOT EXISTS idx_fidelidade_transacoes_cliente ON fidelidade_transacoes(salao_id, cliente_id);

-- ============================================================
-- 4. Função: creditar pontos ao finalizar atendimento
--    Chamada pelo trigger de finalização do caixa ou
--    manualmente via RPC após fechar conta.
-- ============================================================

CREATE OR REPLACE FUNCTION creditar_pontos_fidelidade(
  p_salao_id      uuid,
  p_cliente_id    uuid,
  p_agendamento_id uuid,
  p_valor_total   numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_config fidelidade_config%ROWTYPE;
  v_pontos integer;
BEGIN
  SELECT * INTO v_config FROM fidelidade_config
  WHERE salao_id = p_salao_id AND ativo = true;

  IF NOT FOUND THEN RETURN; END IF;

  v_pontos := FLOOR(p_valor_total * v_config.pontos_por_real);
  IF v_pontos <= 0 THEN RETURN; END IF;

  INSERT INTO fidelidade_transacoes
    (salao_id, cliente_id, tipo, pontos, descricao, agendamento_id)
  VALUES
    (p_salao_id, p_cliente_id, 'ganho', v_pontos,
     'Pontos por atendimento — R$ ' || p_valor_total::text,
     p_agendamento_id);
END;
$$;

-- ============================================================
-- 5. Função: resgatar prêmio (atômica — verifica saldo + cria agendamento)
-- ============================================================

CREATE OR REPLACE FUNCTION resgatar_premio_fidelidade(
  p_salao_id       uuid,
  p_cliente_id     uuid,
  p_premio_id      uuid,
  p_profissional_id uuid,
  p_data           date,
  p_inicio         time
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_premio       fidelidade_premios%ROWTYPE;
  v_saldo        integer;
  v_agendamento  uuid;
BEGIN
  SELECT * INTO v_premio FROM fidelidade_premios
  WHERE id = p_premio_id AND salao_id = p_salao_id AND ativo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prêmio não encontrado.'; END IF;

  SELECT COALESCE(SUM(pontos), 0) INTO v_saldo
  FROM fidelidade_transacoes
  WHERE salao_id = p_salao_id AND cliente_id = p_cliente_id;

  IF v_saldo < v_premio.custo_pontos THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo atual: % pts, necessário: % pts.', v_saldo, v_premio.custo_pontos;
  END IF;

  -- Cria o agendamento de resgate
  INSERT INTO agendamentos
    (salao_id, cliente_id, profissional_id, servico_id, data, inicio, status, origem)
  VALUES
    (p_salao_id, p_cliente_id, p_profissional_id, v_premio.servico_id,
     p_data, p_inicio, 'Agendado', 'resgate_fidelidade')
  RETURNING id INTO v_agendamento;

  -- Debita os pontos
  INSERT INTO fidelidade_transacoes
    (salao_id, cliente_id, tipo, pontos, descricao, agendamento_id, premio_id)
  VALUES
    (p_salao_id, p_cliente_id, 'resgate', -v_premio.custo_pontos,
     'Resgate: ' || v_premio.nome, v_agendamento, p_premio_id);

  RETURN v_agendamento;
END;
$$;

-- ============================================================
-- 6. Registrar "fidelidade" no catálogo de módulos
--    (ajuste o preco_mensal conforme sua estratégia comercial)
-- ============================================================

INSERT INTO modulos_catalogo (chave, nome, descricao, preco_mensal, ativo)
VALUES (
  'fidelidade',
  'Programa de Fidelidade',
  'Fidelize clientes com pontos automáticos, catálogo de prêmios e extrato individual.',
  49.00,
  true
)
ON CONFLICT (chave) DO UPDATE SET
  nome      = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  ativo     = true;
