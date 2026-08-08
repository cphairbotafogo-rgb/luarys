-- Adiciona controle de vencimento do plano base ao salão.
-- Quando um pagamento de plano é aprovado, plano_renovacao_em = now() + 30 dias.
-- A função expirar_saloes_com_plano_vencido() limpa o plano_chave ao vencer.

ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS plano_renovacao_em TIMESTAMPTZ;

-- Função que expira planos base vencidos (sem pagamento renovado)
CREATE OR REPLACE FUNCTION expirar_planos_vencidos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  qtd INTEGER;
BEGIN
  UPDATE saloes
  SET plano_chave = NULL,
      plano_renovacao_em = NULL
  WHERE plano_chave IS NOT NULL
    AND acesso_total = false
    AND plano_renovacao_em IS NOT NULL
    AND plano_renovacao_em < now();

  GET DIAGNOSTICS qtd = ROW_COUNT;
  RETURN qtd;
END;
$$;

-- Agenda expiração de planos junto com módulos (3h UTC)
DO $$
BEGIN
  PERFORM cron.schedule(
    'expirar-planos-diario',
    '5 3 * * *',
    'SELECT expirar_planos_vencidos()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron não disponível — agende manualmente após ativar a extensão.';
END;
$$;
