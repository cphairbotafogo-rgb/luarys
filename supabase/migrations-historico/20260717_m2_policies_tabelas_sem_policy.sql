-- M2: policies nas 8 tabelas com RLS ligado e zero policies.
-- Com RLS on + sem policy o Postgres NEGA tudo para anon/authenticated — o app
-- recebia lista vazia dessas tabelas (Lista de Espera, Histórico de Estoque, telas
-- de admin da plataforma). Cada tabela recebe a regra do seu caso.
-- Usa (select auth_salao_id()) — já no padrão de performance P1 (avaliado 1x).

-- GRUPO A: por salão
DO $$
DECLARE t TEXT; tabs TEXT[] := ARRAY['historico_estoque','lista_espera','log_auditoria_acoes','whatsapp_config'];
BEGIN
  FOREACH t IN ARRAY tabs LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %I ON public.%I;
      CREATE POLICY %I ON public.%I
        FOR ALL TO authenticated
        USING (salao_id = (select auth_salao_id()))
        WITH CHECK (salao_id = (select auth_salao_id()));
    $f$, t||'_isolado_salao', t, t||'_isolado_salao', t);
  END LOOP;
END $$;

-- log_auditoria_acoes: lojista só LÊ (escrita é via triggers service_role)
DROP POLICY IF EXISTS log_auditoria_acoes_isolado_salao ON public.log_auditoria_acoes;
DROP POLICY IF EXISTS log_auditoria_acoes_le_salao ON public.log_auditoria_acoes;
CREATE POLICY log_auditoria_acoes_le_salao ON public.log_auditoria_acoes
  FOR SELECT TO authenticated
  USING (salao_id = (select auth_salao_id()));

-- GRUPO B: notas_fiscais_itens isola via join na nota pai
DROP POLICY IF EXISTS notas_fiscais_itens_via_nota ON public.notas_fiscais_itens;
CREATE POLICY notas_fiscais_itens_via_nota ON public.notas_fiscais_itens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notas_fiscais nf
    WHERE nf.id = notas_fiscais_itens.nota_fiscal_id AND nf.salao_id = (select auth_salao_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.notas_fiscais nf
    WHERE nf.id = notas_fiscais_itens.nota_fiscal_id AND nf.salao_id = (select auth_salao_id())));

-- GRUPO C: tabelas da plataforma — só is_plataforma_admin
DO $$
DECLARE t TEXT; tabs TEXT[] := ARRAY['plataforma_config_financeira','plataforma_despesas','plataforma_nfse_config'];
BEGIN
  FOREACH t IN ARRAY tabs LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %I ON public.%I;
      CREATE POLICY %I ON public.%I
        FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM public.perfis_usuarios pu
                       WHERE pu.id = (select auth.uid()) AND pu.is_plataforma_admin = true))
        WITH CHECK (EXISTS (SELECT 1 FROM public.perfis_usuarios pu
                            WHERE pu.id = (select auth.uid()) AND pu.is_plataforma_admin = true));
    $f$, t||'_admin_plataforma', t, t||'_admin_plataforma', t);
  END LOOP;
END $$;
