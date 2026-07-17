-- C3-B: Revogar EXECUTE (de PUBLIC) das RPCs operacionais SECURITY DEFINER que
-- NÃO precisam ser chamadas por visitantes anônimos.
--
-- Mesma causa raiz do C3: o EXECUTE vem de PUBLIC, não de anon/authenticated
-- nominais. Revogamos de PUBLIC + anon + authenticated e re-concedemos apenas
-- aos papéis que realmente chamam cada função.
--
-- Classificação verificada no código:
--   horarios_ocupados_salao → client ANON (agendamento do portal)  → MANTIDO anon
--   baixar_estoque_vitrine  → service_role em /api/pagamentos/vitrine → sem anon
--   resgate de fidelidade    → só painel do lojista (authenticated)   → sem anon

-- GRUPO 1: só service_role (backend).
DO $$
DECLARE r RECORD;
  funcs TEXT[] := ARRAY[
    'fechar_conta_atomico','debitar_credito_whatsapp','restaurar_credito_whatsapp',
    'registrar_certificado_fiscal','validar_certificado_fiscal','baixar_estoque_vitrine',
    'mesclar_clientes_duplicados','mesclar_produtos_duplicados','mesclar_servicos_duplicados',
    'expirar_modulos_vencidos','expirar_planos_vencidos','limpar_aguardando_pagamento',
    'registrar_conversa_whatsapp','registrar_auditoria_financeiro',
    'registrar_auditoria_cancelamento_agendamento','set_comissao_data_evento',
    'fn_fidelidade_creditar_pontos'
  ];
  fname TEXT;
BEGIN
  FOREACH fname IN ARRAY funcs LOOP
    FOR r IN SELECT p.oid::regprocedure::text AS sig FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=fname LOOP
      BEGIN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION '||r.sig||' FROM PUBLIC';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION '||r.sig||' FROM anon';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION '||r.sig||' FROM authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION '||r.sig||' TO service_role';
      EXCEPTION WHEN others THEN RAISE NOTICE 'G1 ignorado: %', r.sig; END;
    END LOOP;
  END LOOP;
END $$;

-- GRUPO 2: painel do lojista (authenticated) + backend. Revoga só de anon/PUBLIC.
DO $$
DECLARE r RECORD;
  funcs TEXT[] := ARRAY['resgatar_credito_fidelidade','resgatar_premio_fidelidade','gerar_numero_os'];
  fname TEXT;
BEGIN
  FOREACH fname IN ARRAY funcs LOOP
    FOR r IN SELECT p.oid::regprocedure::text AS sig FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=fname LOOP
      BEGIN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION '||r.sig||' FROM PUBLIC';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION '||r.sig||' FROM anon';
        EXECUTE 'GRANT EXECUTE ON FUNCTION '||r.sig||' TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION '||r.sig||' TO service_role';
      EXCEPTION WHEN others THEN RAISE NOTICE 'G2 ignorado: %', r.sig; END;
    END LOOP;
  END LOOP;
END $$;

-- GRUPO 3 (mantidas para anon de propósito, sem ação):
--   horarios_ocupados_salao, auth_salao_id, portal_cliente_ids_do_usuario,
--   bloquear_encaixe_via_portal
