-- M6: Fixar search_path em funções SECURITY DEFINER
-- PROBLEMA: funções SECURITY DEFINER sem search_path fixo são vulneráveis a
-- search_path hijacking — um schema malicioso no path pode sequestrar chamadas.
-- SOLUÇÃO: ALTER FUNCTION ... SET search_path = public, pg_temp

-- Funções encontradas nas migrations do projeto:
DO $$
DECLARE
  funcs TEXT[] := ARRAY[
    'admin_liberar_modulo_global',
    'admin_listar_promocoes_ativas',
    'admin_revogar_promocao_global',
    'auth_salao_id',
    'desativar_outras_contas_recebimento',
    'expirar_modulos_vencidos',
    'expirar_planos_vencidos',
    'fechar_conta_atomico',
    'gerar_numero_os',
    'horarios_ocupados_salao',
    'mesclar_clientes_duplicados',
    'mesclar_produtos_duplicados',
    'mesclar_servicos_duplicados',
    'portal_cliente_ids_do_usuario',
    'resgatar_credito_fidelidade',
    'set_comissao_data_evento'
  ];
  fname TEXT;
  r RECORD;
BEGIN
  FOREACH fname IN ARRAY funcs LOOP
    FOR r IN
      SELECT p.oid::regprocedure::text AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fname
    LOOP
      BEGIN
        EXECUTE format(
          'ALTER FUNCTION %s SET search_path = public, pg_temp',
          r.sig
        );
        RAISE NOTICE 'search_path fixado: %', r.sig;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Ignorado: % — %', r.sig, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END;
$$;

-- Aplica também a todas as funções restantes do schema public que forem
-- SECURITY DEFINER e ainda não tenham search_path configurado.
-- Nota: pg_proc_config não existe nessa versão — usa p.proconfig (array) direto.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true  -- SECURITY DEFINER
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) AS cfg
          WHERE cfg LIKE 'search_path%'
        )
      )
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = public, pg_temp',
        r.sig
      );
      RAISE NOTICE 'search_path fixado (varredura): %', r.sig;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Ignorado (varredura): %', r.sig;
    END;
  END LOOP;
END;
$$;
