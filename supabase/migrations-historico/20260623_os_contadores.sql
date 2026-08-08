-- ============================================================
-- MIGRATION: Numeração sequencial de OS por salão/mês
-- Formato: MM/YY-N  (ex: 06/26-1, 06/26-2 … zera no mês seguinte)
-- ============================================================

-- ── 1. Tabela de contadores ─────────────────────────────────
CREATE TABLE IF NOT EXISTS os_contadores (
  salao_id  UUID    NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  mes_ano   TEXT    NOT NULL,        -- 'MM/YY'
  proximo   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (salao_id, mes_ano)
);

ALTER TABLE os_contadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_contadores_salao_proprio" ON os_contadores
  FOR ALL
  TO authenticated
  USING  (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

-- ── 2. Colunas novas ────────────────────────────────────────
-- Número de OS em financeiro (fechamentos via GavetaPDV da agenda)
ALTER TABLE financeiro
  ADD COLUMN IF NOT EXISTS os_numero TEXT;

-- Bandeira do cartão em caixa_transacoes (lançamentos manuais PDV)
ALTER TABLE caixa_transacoes
  ADD COLUMN IF NOT EXISTS bandeira_cartao TEXT;

-- ── 3. Função geradora ──────────────────────────────────────
-- Upsert atômico: primeiro acesso do mês → devolve 1, contador fica em 2.
-- Acessos seguintes: incrementa e devolve o número anterior.
-- SECURITY DEFINER para bypassar RLS em os_contadores e garantir
-- atomicidade mesmo com múltiplos operadores simultâneos.
CREATE OR REPLACE FUNCTION gerar_numero_os(p_salao_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes_ano TEXT;
  v_numero  INTEGER;
BEGIN
  -- Valida que o chamador pertence ao salão solicitado
  IF p_salao_id IS DISTINCT FROM auth_salao_id() THEN
    RAISE EXCEPTION 'Acesso negado: salao_id não corresponde ao token';
  END IF;

  v_mes_ano := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'MM/YY');

  -- Primeiro acesso do mês: insere com proximo=2 e devolve 1
  -- Demais acessos: incrementa e devolve o valor anterior
  INSERT INTO os_contadores (salao_id, mes_ano, proximo)
  VALUES (p_salao_id, v_mes_ano, 2)
  ON CONFLICT (salao_id, mes_ano)
  DO UPDATE SET proximo = os_contadores.proximo + 1
  RETURNING proximo - 1 INTO v_numero;

  RETURN v_mes_ano || '-' || v_numero::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION gerar_numero_os(UUID) TO authenticated;
