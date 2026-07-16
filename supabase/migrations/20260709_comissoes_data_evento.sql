-- 20260709_comissoes_data_evento.sql
--
-- COMPETÊNCIA das comissões = DATA DO SERVIÇO (data_evento), não created_at (dia do
-- fechamento). Sem isto, fechar hoje um atendimento de março joga a comissão em julho,
-- enquanto a receita (data_movimentacao) conta em março → dashboard/DRE não batem.
--
-- Solução SEGURA (sem reescrever a RPC): um trigger BEFORE INSERT em `comissoes`
-- preenche data_evento a partir da data do agendamento vinculado (fallback: hoje).
-- Vale para QUALQUER origem (RPC de fechamento, avulso, etc.). Depois, o backfill
-- acerta as comissões que já existem.

-- 1) Função do trigger
CREATE OR REPLACE FUNCTION public.set_comissao_data_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_data date;
BEGIN
  -- SEMPRE deriva da data do agendamento (competência = data do serviço),
  -- sobrepondo qualquer DEFAULT da coluna (que era = dia do insert e bagunçava
  -- a competência). Só cai no fallback quando não há agendamento vinculado.
  IF NEW.agendamento_id IS NOT NULL THEN
    SELECT data INTO v_data FROM agendamentos WHERE id = NEW.agendamento_id;
    IF v_data IS NOT NULL THEN
      NEW.data_evento := v_data;
    END IF;
  END IF;
  IF NEW.data_evento IS NULL THEN
    NEW.data_evento := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Trigger
DROP TRIGGER IF EXISTS trg_comissao_data_evento ON comissoes;
CREATE TRIGGER trg_comissao_data_evento
  BEFORE INSERT ON comissoes
  FOR EACH ROW EXECUTE FUNCTION public.set_comissao_data_evento();

-- 3) Backfill das comissões existentes
--    a) as que têm agendamento → data do agendamento. FORÇA a data (IS DISTINCT FROM),
--       pois o DEFAULT da coluna já tinha preenchido data_evento com o dia do insert.
UPDATE comissoes c
SET data_evento = a.data
FROM agendamentos a
WHERE c.agendamento_id = a.id
  AND a.data IS NOT NULL
  AND c.data_evento IS DISTINCT FROM a.data;
--    b) as avulsas (sem agendamento) → data de criação
UPDATE comissoes
SET data_evento = created_at::date
WHERE data_evento IS NULL;

-- Verificação (deve voltar 0):
-- SELECT count(*) FROM comissoes WHERE data_evento IS NULL;
