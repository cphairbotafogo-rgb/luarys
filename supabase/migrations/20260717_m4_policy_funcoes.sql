-- M4: Corrigir policy ALL USING(true) na tabela funcoes
-- PROBLEMA: "funcoes_write_authenticated" permite que qualquer autenticado
-- leia e escreva em funcoes (cargos/permissões) de qualquer salão.
-- SOLUÇÃO: se a tabela tiver salao_id, aplica policies restritas ao salão.
--          Se não tiver (tabela global de referência), mantém só leitura aberta.

DO $$
DECLARE
  tem_salao_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'funcoes'
      AND column_name  = 'salao_id'
  ) INTO tem_salao_id;

  -- Remove policies antigas em qualquer caso
  EXECUTE 'DROP POLICY IF EXISTS "funcoes_write_authenticated" ON funcoes';
  EXECUTE 'DROP POLICY IF EXISTS "funcoes_read_authenticated"  ON funcoes';
  EXECUTE 'DROP POLICY IF EXISTS "funcoes_le_proprio_salao"    ON funcoes';
  EXECUTE 'DROP POLICY IF EXISTS "funcoes_escreve_proprio_salao" ON funcoes';

  IF tem_salao_id THEN
    -- tabela é multi-tenant: restringir por salão
    EXECUTE '
      CREATE POLICY "funcoes_le_proprio_salao" ON funcoes
        FOR SELECT TO authenticated
        USING (salao_id = auth_salao_id())
    ';
    EXECUTE '
      CREATE POLICY "funcoes_escreve_proprio_salao" ON funcoes
        FOR ALL TO authenticated
        USING  (salao_id = auth_salao_id())
        WITH CHECK (salao_id = auth_salao_id())
    ';
    RAISE NOTICE 'funcoes: policies multi-tenant criadas com salao_id';
  ELSE
    -- tabela é referência global (sem salao_id): apenas leitura para autenticados
    EXECUTE '
      CREATE POLICY "funcoes_leitura_autenticado" ON funcoes
        FOR SELECT TO authenticated
        USING (true)
    ';
    RAISE NOTICE 'funcoes: sem coluna salao_id — criada policy de leitura global';
  END IF;
END;
$$;
