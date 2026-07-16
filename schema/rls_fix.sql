-- =============================================================================
-- CORREÇÃO DE RLS POLICIES — ISOLAMENTO POR SALÃO
-- Projeto: Luarys
-- Data: 2026-06-21
--
-- ESTRATÉGIA:
--   Função auxiliar auth_salao_id() cobre dois tipos de usuário:
--     - Donos/gerentes: têm linha em perfis_usuarios
--     - Profissionais:  têm linha em profissionais
--
-- COMO RODAR:
--   1. Abrir o SQL Editor no painel do Supabase
--   2. Colar este arquivo inteiro
--   3. Clicar em Run
--   4. Verificar que não houve erros antes do COMMIT
--
-- ATENÇÃO: Os DROP POLICY usam os nomes que aparecem em pg_policies.
--   Se algum DROP falhar com "policy not found", ajuste o nome conforme
--   o que aparece no painel Authentication > Policies do Supabase.
-- =============================================================================

BEGIN;

-- =============================================================================
-- HELPER: função auxiliar — retorna o salao_id do usuário autenticado
-- Cobre tanto donos (perfis_usuarios) quanto profissionais (profissionais)
-- =============================================================================
CREATE OR REPLACE FUNCTION auth_salao_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT salao_id FROM perfis_usuarios WHERE id = auth.uid()
  UNION
  SELECT salao_id FROM profissionais WHERE id = auth.uid()
  LIMIT 1
$$;

-- =============================================================================
-- 1. TABELA: agendamentos
-- =============================================================================
DROP POLICY IF EXISTS "Acesso agendamentos" ON agendamentos;

CREATE POLICY "agendamentos_select_proprio_salao"
  ON agendamentos FOR SELECT TO authenticated
  USING (salao_id = auth_salao_id());

CREATE POLICY "agendamentos_select_portal"
  ON agendamentos FOR SELECT TO anon
  USING (true);

CREATE POLICY "agendamentos_insert_proprio_salao"
  ON agendamentos FOR INSERT TO authenticated
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "agendamentos_insert_portal"
  ON agendamentos FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "agendamentos_update_proprio_salao"
  ON agendamentos FOR UPDATE TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "agendamentos_delete_proprio_salao"
  ON agendamentos FOR DELETE TO authenticated
  USING (salao_id = auth_salao_id());

-- =============================================================================
-- 2. TABELA: clientes
-- =============================================================================
DROP POLICY IF EXISTS "Acesso clientes" ON clientes;
DROP POLICY IF EXISTS "clientes_atualizacao_vinculada" ON clientes;
DROP POLICY IF EXISTS "clientes_insercao_autenticada" ON clientes;
DROP POLICY IF EXISTS "clientes_leitura_global" ON clientes;

CREATE POLICY "clientes_select_proprio_salao"
  ON clientes FOR SELECT TO authenticated
  USING (salao_id = auth_salao_id());

CREATE POLICY "clientes_select_portal"
  ON clientes FOR SELECT TO anon
  USING (true);

CREATE POLICY "clientes_insert_proprio_salao"
  ON clientes FOR INSERT TO authenticated
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "clientes_insert_portal"
  ON clientes FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "clientes_update_proprio_salao"
  ON clientes FOR UPDATE TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "clientes_update_portal"
  ON clientes FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "clientes_delete_proprio_salao"
  ON clientes FOR DELETE TO authenticated
  USING (salao_id = auth_salao_id());

-- =============================================================================
-- 3. TABELA: comissoes
-- =============================================================================
DROP POLICY IF EXISTS "Acesso comissoes" ON comissoes;

CREATE POLICY "comissoes_select_proprio_salao"
  ON comissoes FOR SELECT TO authenticated
  USING (salao_id = auth_salao_id());

CREATE POLICY "comissoes_insert_proprio_salao"
  ON comissoes FOR INSERT TO authenticated
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "comissoes_update_proprio_salao"
  ON comissoes FOR UPDATE TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "comissoes_delete_proprio_salao"
  ON comissoes FOR DELETE TO authenticated
  USING (salao_id = auth_salao_id());

-- =============================================================================
-- 4. TABELA: financeiro
-- =============================================================================
DROP POLICY IF EXISTS "Acesso financeiro" ON financeiro;

CREATE POLICY "financeiro_select_proprio_salao"
  ON financeiro FOR SELECT TO authenticated
  USING (salao_id = auth_salao_id());

CREATE POLICY "financeiro_insert_proprio_salao"
  ON financeiro FOR INSERT TO authenticated
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "financeiro_update_proprio_salao"
  ON financeiro FOR UPDATE TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "financeiro_delete_proprio_salao"
  ON financeiro FOR DELETE TO authenticated
  USING (salao_id = auth_salao_id());

-- =============================================================================
-- 5. TABELA: funcoes  (catálogo global — sem salao_id)
-- =============================================================================
DROP POLICY IF EXISTS "Acesso funcoes" ON funcoes;

CREATE POLICY "funcoes_select_authenticated"
  ON funcoes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "funcoes_write_authenticated"
  ON funcoes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =============================================================================
-- 6. TABELA: profissionais
-- =============================================================================
DROP POLICY IF EXISTS "Acesso profissionais" ON profissionais;

CREATE POLICY "profissionais_select_proprio_salao"
  ON profissionais FOR SELECT TO authenticated
  USING (salao_id = auth_salao_id());

CREATE POLICY "profissionais_select_portal"
  ON profissionais FOR SELECT TO anon
  USING (ativo = true);

CREATE POLICY "profissionais_update_proprio_salao"
  ON profissionais FOR UPDATE TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "profissionais_delete_proprio_salao"
  ON profissionais FOR DELETE TO authenticated
  USING (salao_id = auth_salao_id());

-- =============================================================================
-- 7. TABELA: servicos  (SELECT público — portal de agendamento online)
-- =============================================================================
DROP POLICY IF EXISTS "Ver servicos" ON servicos;

CREATE POLICY "servicos_select_publico"
  ON servicos FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "servicos_insert_proprio_salao"
  ON servicos FOR INSERT TO authenticated
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "servicos_update_proprio_salao"
  ON servicos FOR UPDATE TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "servicos_delete_proprio_salao"
  ON servicos FOR DELETE TO authenticated
  USING (salao_id = auth_salao_id());

-- =============================================================================
-- 8. TABELA: saloes  (SELECT público — portal busca o salão pelo ID)
-- =============================================================================
DROP POLICY IF EXISTS "Ver saloes" ON saloes;

-- SELECT já coberto pelas policies existentes "Permitir leitura publica de saloes"
-- Adicionamos apenas a restrição de escrita:
CREATE POLICY "saloes_update_proprio_salao"
  ON saloes FOR UPDATE TO authenticated
  USING (id = (SELECT salao_id FROM perfis_usuarios WHERE id = auth.uid() LIMIT 1))
  WITH CHECK (id = (SELECT salao_id FROM perfis_usuarios WHERE id = auth.uid() LIMIT 1));

-- =============================================================================
-- 9. TABELA: configuracoes_nfse
-- =============================================================================
DROP POLICY IF EXISTS "Acesso seguro as configuracoes" ON configuracoes_nfse;

CREATE POLICY "configuracoes_nfse_proprio_salao"
  ON configuracoes_nfse FOR ALL TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

-- =============================================================================
-- 10. TABELA: configuracoes_nfce
-- =============================================================================
DROP POLICY IF EXISTS "Acesso seguro config nfce por salao" ON configuracoes_nfce;

CREATE POLICY "configuracoes_nfce_proprio_salao"
  ON configuracoes_nfce FOR ALL TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

-- =============================================================================
-- 11. TABELA: configuracoes_fiscais_profissionais
--     Não tem salao_id direto — isolamento via profissional_id → salao_id
-- =============================================================================
DROP POLICY IF EXISTS "Acesso seguro profissionais por salao" ON configuracoes_fiscais_profissionais;

CREATE POLICY "cfg_fiscal_prof_proprio_salao"
  ON configuracoes_fiscais_profissionais FOR ALL TO authenticated
  USING (
    profissional_id IN (
      SELECT id FROM profissionais WHERE salao_id = auth_salao_id()
    )
  )
  WITH CHECK (
    profissional_id IN (
      SELECT id FROM profissionais WHERE salao_id = auth_salao_id()
    )
  );

-- =============================================================================
-- 12. TABELA: notas_fiscais
-- =============================================================================
DROP POLICY IF EXISTS "Acesso seguro as notas fiscais" ON notas_fiscais;

CREATE POLICY "notas_fiscais_select_proprio_salao"
  ON notas_fiscais FOR SELECT TO authenticated
  USING (salao_id = auth_salao_id());

CREATE POLICY "notas_fiscais_insert_proprio_salao"
  ON notas_fiscais FOR INSERT TO authenticated
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "notas_fiscais_insert_portal"
  ON notas_fiscais FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "notas_fiscais_update_proprio_salao"
  ON notas_fiscais FOR UPDATE TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "notas_fiscais_delete_proprio_salao"
  ON notas_fiscais FOR DELETE TO authenticated
  USING (salao_id = auth_salao_id());

-- =============================================================================
-- 13. TABELA: notificacoes
-- =============================================================================
DROP POLICY IF EXISTS "Permitir atualizar notificacoes" ON notificacoes;
DROP POLICY IF EXISTS "Permitir envio de notificacoes" ON notificacoes;
DROP POLICY IF EXISTS "Permitir leitura de notificacoes" ON notificacoes;

CREATE POLICY "notificacoes_select_proprio_salao"
  ON notificacoes FOR SELECT TO authenticated
  USING (salao_id = auth_salao_id());

CREATE POLICY "notificacoes_insert_proprio_salao"
  ON notificacoes FOR INSERT TO authenticated
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "notificacoes_insert_portal"
  ON notificacoes FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "notificacoes_update_proprio_salao"
  ON notificacoes FOR UPDATE TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "notificacoes_delete_proprio_salao"
  ON notificacoes FOR DELETE TO authenticated
  USING (salao_id = auth_salao_id());

-- =============================================================================
-- 14. TABELA: carteira_clientes
--     CORREÇÃO DO BUG: policy antiga usava profissionais.salao_id,
--     o que bloqueava donos (que ficam em perfis_usuarios, não em profissionais)
-- =============================================================================
DROP POLICY IF EXISTS "salao_propria_carteira" ON carteira_clientes;

CREATE POLICY "carteira_clientes_proprio_salao"
  ON carteira_clientes FOR ALL TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

COMMIT;
