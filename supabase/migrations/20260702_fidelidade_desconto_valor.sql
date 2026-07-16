-- Adiciona resgate de pontos como desconto em reais.
-- Duas novas colunas em fidelidade_config + RPC atômica de resgate.

ALTER TABLE fidelidade_config
  ADD COLUMN IF NOT EXISTS permite_desconto_valor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_por_ponto        NUMERIC(10,4) NOT NULL DEFAULT 0.01;

-- RPC: verifica saldo, debita pontos e retorna o valor em R$.
-- Chamada por ExtratoCliente via tipos.resgatarCreditoValor().
CREATE OR REPLACE FUNCTION resgatar_credito_fidelidade(
  p_salao_id   UUID,
  p_cliente_id UUID,
  p_pontos     INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo           INTEGER;
  v_valor_por_ponto NUMERIC;
  v_valor_reais     NUMERIC;
BEGIN
  SELECT valor_por_ponto INTO v_valor_por_ponto
  FROM fidelidade_config
  WHERE salao_id = p_salao_id
    AND ativo = true
    AND permite_desconto_valor = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate em valor não habilitado para este salão.';
  END IF;

  IF p_pontos <= 0 THEN
    RAISE EXCEPTION 'A quantidade de pontos deve ser maior que zero.';
  END IF;

  SELECT COALESCE(SUM(pontos), 0) INTO v_saldo
  FROM fidelidade_transacoes
  WHERE salao_id = p_salao_id AND cliente_id = p_cliente_id;

  IF v_saldo < p_pontos THEN
    RAISE EXCEPTION 'Saldo insuficiente. O cliente tem % pontos.', v_saldo;
  END IF;

  v_valor_reais := ROUND((p_pontos * v_valor_por_ponto)::NUMERIC, 2);

  INSERT INTO fidelidade_transacoes (salao_id, cliente_id, tipo, pontos, descricao)
  VALUES (
    p_salao_id,
    p_cliente_id,
    'resgate',
    -p_pontos,
    'Desconto em reais (' || p_pontos || ' pts)'
  );

  RETURN v_valor_reais;
END;
$$;
