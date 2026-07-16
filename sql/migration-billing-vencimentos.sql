-- ============================================================
-- Migration: billing de vencimentos + plano mensal/anual
-- Rodar no Supabase > SQL Editor
-- ============================================================

-- 1. Colunas na tabela saloes
ALTER TABLE saloes ADD COLUMN IF NOT EXISTS plano_renovacao_em     timestamptz;
ALTER TABLE saloes ADD COLUMN IF NOT EXISTS plano_aviso_enviado_em timestamptz;
ALTER TABLE saloes ADD COLUMN IF NOT EXISTS plano_periodo          text DEFAULT 'mensal'
  CHECK (plano_periodo IN ('mensal', 'anual'));

-- 2. Colunas na tabela salao_modulos
ALTER TABLE salao_modulos ADD COLUMN IF NOT EXISTS aviso_enviado_em timestamptz;
ALTER TABLE salao_modulos ADD COLUMN IF NOT EXISTS periodo          text DEFAULT 'mensal'
  CHECK (periodo IN ('mensal', 'anual'));

-- 3. Preço anual nos catálogos
ALTER TABLE planos           ADD COLUMN IF NOT EXISTS preco_anual numeric(10,2);
ALTER TABLE modulos_catalogo ADD COLUMN IF NOT EXISTS preco_anual numeric(10,2);

-- 3. Trial de 30 dias: garante que novos salões recebam trial_expiracao
--    (Se a coluna ainda não existir, descomente:)
-- ALTER TABLE saloes ADD COLUMN IF NOT EXISTS trial_expiracao timestamptz;

-- 4. Índices para a query diária do cron (performance)
CREATE INDEX IF NOT EXISTS idx_saloes_plano_renovacao_em
  ON saloes (plano_renovacao_em)
  WHERE plano_renovacao_em IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_salao_modulos_renovacao_em
  ON salao_modulos (renovacao_em)
  WHERE renovacao_em IS NOT NULL AND ativo = true;

-- ============================================================
-- Cron via pg_cron (opcional — requer extensão habilitada)
-- Ativa em: Supabase > Database > Extensions > pg_cron
--
-- Depois habilitar, rodar:
-- ============================================================
/*
SELECT cron.schedule(
  'luarys-processar-vencimentos',
  '0 8 * * *',           -- todo dia às 08h00 (UTC)
  $$
  SELECT net.http_post(
    url  := 'https://SEU-DOMINIO.vercel.app/api/assinatura/processar-vencimentos',
    headers := jsonb_build_object('x-cron-secret', 'SEU_CRON_SECRET'),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
*/

-- Para verificar jobs agendados:
-- SELECT * FROM cron.job;

-- Para remover (se precisar recriar):
-- SELECT cron.unschedule('luarys-processar-vencimentos');
