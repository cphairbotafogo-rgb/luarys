-- Funções SECURITY DEFINER para promoções globais de módulos.
-- Chamadas pelo painel admin via supabase.rpc().

-- Lança promoção: insere salao_modulos para todos os salões ativos/trial.
-- p_dias = NULL → sem prazo (fica ativo até revogar manualmente).
-- p_dias > 0   → expira automaticamente via expirar_modulos_vencidos().
-- ON CONFLICT DO NOTHING → não sobrescreve assinaturas pagas existentes.
CREATE OR REPLACE FUNCTION admin_liberar_modulo_global(
  p_modulo_chave TEXT,
  p_dias         INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_renovacao    TIMESTAMPTZ;
  v_cancelamento BOOLEAN;
  v_count        INTEGER;
BEGIN
  IF p_dias IS NOT NULL AND p_dias > 0 THEN
    v_renovacao    := now() + (p_dias || ' days')::INTERVAL;
    v_cancelamento := true;
  ELSE
    v_renovacao    := NULL;
    v_cancelamento := false;
  END IF;

  INSERT INTO salao_modulos
    (salao_id, modulo_chave, ativo, origem, ativado_em, renovacao_em, cancelamento_agendado)
  SELECT
    id, p_modulo_chave, true, 'promocao_global', now(), v_renovacao, v_cancelamento
  FROM saloes
  WHERE status_assinatura IN ('ativo', 'trial')
  ON CONFLICT (salao_id, modulo_chave) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Revoga promoção: desativa apenas entradas de origem 'promocao_global'.
-- Assinaturas pagas (origem = 'pagamento' ou 'admin') não são afetadas.
CREATE OR REPLACE FUNCTION admin_revogar_promocao_global(p_modulo_chave TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE salao_modulos
  SET ativo = false
  WHERE modulo_chave = p_modulo_chave
    AND origem       = 'promocao_global';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Lista promoções ativas agrupadas por módulo (para exibir no painel admin).
CREATE OR REPLACE FUNCTION admin_listar_promocoes_ativas()
RETURNS TABLE(
  modulo_chave TEXT,
  nome_modulo  TEXT,
  total_saloes BIGINT,
  expira_em    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.modulo_chave,
    COALESCE(mc.nome, sm.modulo_chave),
    COUNT(DISTINCT sm.salao_id)::BIGINT,
    MAX(sm.renovacao_em)
  FROM salao_modulos sm
  LEFT JOIN modulos_catalogo mc ON mc.chave = sm.modulo_chave
  WHERE sm.origem = 'promocao_global' AND sm.ativo = true
  GROUP BY sm.modulo_chave, mc.nome;
END;
$$;
