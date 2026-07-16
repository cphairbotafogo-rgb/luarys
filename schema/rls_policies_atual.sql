-- =============================================================================
-- SNAPSHOT DAS RLS POLICIES ATUAIS — exportado em 2026-06-21
-- Fonte: SELECT * FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- =============================================================================

-- agendamentos
-- PROBLEMA: policy "Acesso agendamentos" usa auth.role()='authenticated' sem filtro de salao_id
-- Qualquer usuário autenticado pode ler/alterar agendamentos de qualquer salão.

-- clientes
-- PROBLEMA: mesma situação — sem filtro de salao_id

-- comissoes, financeiro, profissionais, servicos
-- PROBLEMA: mesma situação

-- saloes
-- PROBLEMA: policy "Ver saloes" FOR ALL sem filtro — qualquer autenticado pode UPDATE em qualquer salão

-- configuracoes_nfse, configuracoes_nfce, configuracoes_fiscais_profissionais, notas_fiscais
-- PROBLEMA: qual = true FOR ALL TO authenticated — completamente aberto

-- notificacoes
-- PROBLEMA: true para SELECT, INSERT e UPDATE — sem qualquer restrição

-- carteira_clientes
-- PROBLEMA: policy usa profissionais.salao_id mas donos estão em perfis_usuarios, não em profissionais
-- Donos ficam sem acesso à carteira de clientes

-- AÇÃO REQUERIDA: rodar schema/rls_fix.sql no SQL Editor do Supabase
