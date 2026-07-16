-- ============================================================
-- FIX: Recursão infinita nas policies RLS de agendamentos
-- ============================================================
-- PROBLEMA:
--   As policies de agendamentos fazem EXISTS (SELECT 1 FROM clientes WHERE ...)
--   enquanto a tabela clientes também tem RLS ativa. O Postgres avalia a
--   policy de clientes dentro da subquery, que por sua vez pode referenciar
--   agendamentos — causando loop de avaliação que bloqueia edições/consultas.
--
-- SOLUÇÃO:
--   Funções SECURITY DEFINER executam com permissões elevadas e bypassam
--   o RLS internamente. Usá-las nas policies quebra o ciclo sem abrir dados.
--
-- COMO EXECUTAR:
--   Cole no SQL Editor do Supabase Dashboard e clique em RUN.
-- ============================================================

-- ─── 1. Função auxiliar: retorna os IDs de cliente vinculados ao usuário ────
-- SECURITY DEFINER: bypassa RLS na consulta a clientes, quebrando a recursão.
CREATE OR REPLACE FUNCTION portal_cliente_ids_do_usuario(p_uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM clientes WHERE usuario_portal_id = p_uid;
$$;

-- ─── 2. Função auxiliar: retorna o salao_id do usuário autenticado ───────────
-- Usada por policies do painel interno (profissionais, donos de salão).
CREATE OR REPLACE FUNCTION auth_salao_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT salao_id FROM perfis_usuarios WHERE id = auth.uid() LIMIT 1;
$$;

-- ─── 3. Recria as policies de agendamentos do portal usando a função ─────────

-- Remove as policies antigas que causam recursão
DROP POLICY IF EXISTS "portal_le_agendamentos_proprios"    ON agendamentos;
DROP POLICY IF EXISTS "portal_insere_agendamento_proprio"  ON agendamentos;
DROP POLICY IF EXISTS "portal_atualiza_agendamento_proprio" ON agendamentos;

-- SELECT: cliente portal vê apenas seus próprios agendamentos
CREATE POLICY "portal_le_agendamentos_proprios" ON agendamentos
  FOR SELECT TO authenticated
  USING (
    cliente_id IN (SELECT portal_cliente_ids_do_usuario(auth.uid()))
  );

-- INSERT: cliente portal cria agendamento apenas para si mesmo
CREATE POLICY "portal_insere_agendamento_proprio" ON agendamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    cliente_id IN (SELECT portal_cliente_ids_do_usuario(auth.uid()))
  );

-- UPDATE: cliente portal altera apenas seus próprios agendamentos
CREATE POLICY "portal_atualiza_agendamento_proprio" ON agendamentos
  FOR UPDATE TO authenticated
  USING (
    cliente_id IN (SELECT portal_cliente_ids_do_usuario(auth.uid()))
  )
  WITH CHECK (
    cliente_id IN (SELECT portal_cliente_ids_do_usuario(auth.uid()))
  );

-- ─── 4. Garante que a policy do painel (dono/profissional) também existe ─────
-- Se já existia uma policy para authenticated que filtra por salao_id, mantém.
-- Se não existia, cria usando auth_salao_id() para evitar o mesmo padrão.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agendamentos'
      AND policyname = 'painel_le_agendamentos_do_salao'
  ) THEN
    CREATE POLICY "painel_le_agendamentos_do_salao" ON agendamentos
      FOR SELECT TO authenticated
      USING (salao_id = auth_salao_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agendamentos'
      AND policyname = 'painel_escreve_agendamentos_do_salao'
  ) THEN
    CREATE POLICY "painel_escreve_agendamentos_do_salao" ON agendamentos
      FOR ALL TO authenticated
      USING (salao_id = auth_salao_id())
      WITH CHECK (salao_id = auth_salao_id());
  END IF;
END $$;

-- ============================================================
-- VERIFICAÇÃO PÓS-EXECUÇÃO
-- Execute a query abaixo para confirmar que as policies foram criadas:
--
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename = 'agendamentos'
-- ORDER BY policyname;
--
-- Esperado: 5 policies — 3 portal_* + 2 painel_*
-- ============================================================
