-- C3: Revogar EXECUTE de funções administrativas SECURITY DEFINER.
--
-- CAUSA RAIZ: o EXECUTE dessas funções vinha de PUBLIC (pseudo-papel que
-- engloba anon + authenticated + todos), não dos papéis nominais. Toda função
-- no Postgres nasce com EXECUTE concedido a PUBLIC por padrão. Por isso a
-- versão anterior desta migration (REVOKE ... FROM anon, authenticated) não
-- teve efeito — o ACL {=X/postgres} indica grant a PUBLIC, e revogar de anon
-- não remove o que foi dado a PUBLIC.
--
-- SOLUÇÃO: revogar de PUBLIC e re-conceder apenas a service_role (usado pelas
-- rotas de API server-side que chamam essas funções legitimamente).

DO $$
DECLARE
  r RECORD;
  funcs TEXT[] := ARRAY[
    'admin_liberar_modulo_global',
    'admin_revogar_promocao_global',
    'admin_listar_promocoes_ativas',
    'admin_ativar_modulo_fiscal',
    'admin_ativar_modulo',
    'ativar_producao_fiscal',
    'comprar_pacote_whatsapp',
    'admin_conceder_acesso_total',
    'admin_revogar_acesso_total'
  ];
  fname TEXT;
BEGIN
  FOREACH fname IN ARRAY funcs LOOP
    FOR r IN
      SELECT p.oid::regprocedure::text AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fname
    LOOP
      BEGIN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM PUBLIC';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM anon';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO service_role';
        RAISE NOTICE 'Corrigido: %', r.sig;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Ignorado (nao encontrado): %', r.sig;
      END;
    END LOOP;
  END LOOP;
END;
$$;

-- Verificacao (deve retornar todos FALSE para anon/authenticated):
-- SELECT has_function_privilege('anon','public.admin_liberar_modulo_global(text,integer)','EXECUTE');