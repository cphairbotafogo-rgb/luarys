-- C4: Remove as policies TO anon USING(true) de agendamentos e clientes
-- criadas por schema/rls_fix.sql (2026-06-21).
--
-- PROBLEMA: schema/rls_fix.sql criou, entre outras, estas policies:
--   agendamentos_select_portal  FOR SELECT TO anon USING (true)
--   agendamentos_insert_portal  FOR INSERT TO anon WITH CHECK (true)
--   clientes_select_portal      FOR SELECT TO anon USING (true)
--   clientes_insert_portal      FOR INSERT TO anon WITH CHECK (true)
--   clientes_update_portal      FOR UPDATE TO anon USING (true) WITH CHECK (true)
-- Isso libera leitura/escrita de TODOS os salões (nome, telefone, CPF,
-- agendamentos) para qualquer visitante anônimo via REST API, sem login.
-- É exatamente o padrão que .claude/commands/references/portal_padroes.md
-- já documenta como proibido (seção "Nunca").
--
-- Nenhuma migration posterior remove essas 5 policies pelo nome — as
-- migrations 20260621_rls_portal_cliente.sql e
-- 20260622_fix_recursao_rls_agendamentos.sql adicionam as policies corretas
-- (portal_le_proprio_clientes, portal_le_agendamentos_proprios, etc., todas
-- restritas por usuario_portal_id/cliente_id) mas não removem as antigas.
-- Se schema/rls_fix.sql chegou a ser executado no SQL Editor em algum
-- momento, essas 5 policies abertas ainda estão ativas hoje em produção.
--
-- SOLUÇÃO: DROP POLICY IF EXISTS é idempotente — seguro rodar independente
-- de essas policies existirem ou não no banco atual.

DROP POLICY IF EXISTS "agendamentos_select_portal" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_insert_portal" ON agendamentos;
DROP POLICY IF EXISTS "clientes_select_portal" ON clientes;
DROP POLICY IF EXISTS "clientes_insert_portal" ON clientes;
DROP POLICY IF EXISTS "clientes_update_portal" ON clientes;

-- VERIFICAÇÃO PÓS-EXECUÇÃO — não deve retornar nenhuma linha:
-- SELECT policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE tablename IN ('agendamentos','clientes') AND roles::text LIKE '%anon%';
