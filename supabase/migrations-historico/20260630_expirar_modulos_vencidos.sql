-- Expiração automática de módulos com cancelamento agendado
-- Deve ser chamada diariamente (pg_cron ou Supabase Scheduler).
-- Desativa módulos onde cancelamento_agendado = true e renovacao_em já passou.

CREATE OR REPLACE FUNCTION expirar_modulos_vencidos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  qtd INTEGER;
BEGIN
  UPDATE salao_modulos
  SET ativo = false
  WHERE ativo = true
    AND cancelamento_agendado = true
    AND renovacao_em IS NOT NULL
    AND renovacao_em < now();

  GET DIAGNOSTICS qtd = ROW_COUNT;
  RETURN qtd;
END;
$$;

-- Tenta agendar com pg_cron. Falha silenciosamente se a extensão não estiver ativa.
-- Para ativar: Supabase Dashboard → Database → Extensions → pg_cron → Enable
-- Depois execute manualmente: SELECT cron.schedule('expirar-modulos-diario','0 3 * * *','SELECT expirar_modulos_vencidos()');
DO $$
BEGIN
  PERFORM cron.schedule(
    'expirar-modulos-diario',
    '0 3 * * *',
    'SELECT expirar_modulos_vencidos()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron não disponível — agende manualmente após ativar a extensão.';
END;
$$;
