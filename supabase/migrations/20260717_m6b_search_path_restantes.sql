-- M6-B: fixa search_path nas 4 funções que escaparam da migração M6 original.
DO $$
DECLARE r RECORD;
  funcs TEXT[] := ARRAY[
    'verificar_limite_profissionais','verificar_elegibilidade_comissao',
    'atualizar_atualizado_em','set_updated_at'
  ];
  fname TEXT;
BEGIN
  FOREACH fname IN ARRAY funcs LOOP
    FOR r IN SELECT p.oid::regprocedure::text AS sig FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=fname LOOP
      BEGIN
        EXECUTE 'ALTER FUNCTION '||r.sig||' SET search_path = public, pg_temp';
      EXCEPTION WHEN others THEN RAISE NOTICE 'ignorado: %', r.sig; END;
    END LOOP;
  END LOOP;
END $$;
