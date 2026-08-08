-- ============================================================
-- MIGRAÇÃO: Políticas RLS para o Portal do Cliente
-- Executar no SQL Editor do Supabase Dashboard
-- ============================================================

-- ─── 1. SALÕES — leitura pública para o portal ────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saloes' AND policyname = 'portal_anon_le_saloes'
  ) THEN
    CREATE POLICY "portal_anon_le_saloes" ON saloes
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- ─── 2. CLIENTES — portal user gerencia seu próprio vínculo ───────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clientes' AND policyname = 'portal_le_proprio_clientes'
  ) THEN
    CREATE POLICY "portal_le_proprio_clientes" ON clientes
      FOR SELECT TO authenticated
      USING (usuario_portal_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clientes' AND policyname = 'portal_insere_proprio_clientes'
  ) THEN
    CREATE POLICY "portal_insere_proprio_clientes" ON clientes
      FOR INSERT TO authenticated
      WITH CHECK (usuario_portal_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clientes' AND policyname = 'portal_atualiza_proprio_clientes'
  ) THEN
    CREATE POLICY "portal_atualiza_proprio_clientes" ON clientes
      FOR UPDATE TO authenticated
      USING (usuario_portal_id = auth.uid())
      WITH CHECK (usuario_portal_id = auth.uid());
  END IF;
END $$;

-- ─── 3. USUÁRIOS_PORTAL — leitura e atualização de perfil próprio ─────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usuarios_portal' AND policyname = 'portal_le_proprio_usuario'
  ) THEN
    CREATE POLICY "portal_le_proprio_usuario" ON usuarios_portal
      FOR SELECT TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usuarios_portal' AND policyname = 'portal_atualiza_proprio_usuario'
  ) THEN
    CREATE POLICY "portal_atualiza_proprio_usuario" ON usuarios_portal
      FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- ─── 4. AGENDAMENTOS — portal user vê e gerencia os próprios ─────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agendamentos' AND policyname = 'portal_le_agendamentos_proprios'
  ) THEN
    CREATE POLICY "portal_le_agendamentos_proprios" ON agendamentos
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM clientes
          WHERE clientes.id = agendamentos.cliente_id
            AND clientes.usuario_portal_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agendamentos' AND policyname = 'portal_insere_agendamento_proprio'
  ) THEN
    CREATE POLICY "portal_insere_agendamento_proprio" ON agendamentos
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM clientes
          WHERE clientes.id = agendamentos.cliente_id
            AND clientes.usuario_portal_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agendamentos' AND policyname = 'portal_atualiza_agendamento_proprio'
  ) THEN
    CREATE POLICY "portal_atualiza_agendamento_proprio" ON agendamentos
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM clientes
          WHERE clientes.id = agendamentos.cliente_id
            AND clientes.usuario_portal_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ─── 5. NOTIFICAÇÕES — portal insere notif de novo agendamento ───────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notificacoes' AND policyname = 'portal_insere_notificacao'
  ) THEN
    CREATE POLICY "portal_insere_notificacao" ON notificacoes
      FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- RESULTADO ESPERADO: todas as instruções retornam "DO" sem erros.
-- Se a tabela "notificacoes" não existir, remova o bloco 5 acima.
-- ============================================================
