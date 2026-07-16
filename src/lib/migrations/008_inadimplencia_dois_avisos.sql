-- ============================================================================
-- 008_inadimplencia_dois_avisos.sql
-- Fluxo de inadimplência com dois avisos antes da suspensão:
--   D+0  → primeiro aviso  (pagamento_atrasado)
--   D+7  → segundo aviso   (segundo_aviso_atraso)
--   D+10 → suspensão       (74h após o segundo aviso)
-- ============================================================================

-- Coluna para registrar quando o segundo aviso foi enviado ao salão (plano base)
alter table public.saloes
  add column if not exists plano_segundo_aviso_enviado_em timestamptz;

-- Coluna equivalente para módulos avulsos
alter table public.salao_modulos
  add column if not exists segundo_aviso_enviado_em timestamptz;
