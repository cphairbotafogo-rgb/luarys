-- ============================================================
-- Migration: Garantia de Reserva / No-Show
-- Rodar no Supabase > SQL Editor
-- ============================================================

-- 1. Coluna sinal_pago em agendamentos
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS sinal_pago boolean NOT NULL DEFAULT false;

-- 2. Tabela de notificações (sininho do portal + salão)
CREATE TABLE IF NOT EXISTS notificacoes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id          uuid NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  destinatario_tipo text NOT NULL CHECK (destinatario_tipo IN ('salao', 'cliente')),
  destinatario_id   uuid,       -- usuario_portal_id quando tipo='cliente'
  tipo              text NOT NULL,  -- 'sinal_pendente' | 'sinal_confirmado' | 'novo_agendamento'
  titulo            text NOT NULL,
  mensagem          text,
  agendamento_id    uuid REFERENCES agendamentos(id) ON DELETE SET NULL,
  lida              boolean NOT NULL DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Salão lê suas próprias notificações
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notificacoes' AND policyname='salao_le_notificacoes') THEN
    CREATE POLICY "salao_le_notificacoes" ON notificacoes
      FOR SELECT USING (salao_id = auth_salao_id() AND destinatario_tipo = 'salao');
  END IF;
END $$;

-- Salão marca notificações como lidas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notificacoes' AND policyname='salao_atualiza_notificacoes') THEN
    CREATE POLICY "salao_atualiza_notificacoes" ON notificacoes
      FOR UPDATE USING (salao_id = auth_salao_id() AND destinatario_tipo = 'salao');
  END IF;
END $$;

-- Portal: cliente lê suas próprias notificações
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notificacoes' AND policyname='portal_le_notificacoes_cliente') THEN
    CREATE POLICY "portal_le_notificacoes_cliente" ON notificacoes
      FOR SELECT TO authenticated
      USING (destinatario_tipo = 'cliente' AND destinatario_id = auth.uid());
  END IF;
END $$;

-- Portal: cliente marca como lida
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notificacoes' AND policyname='portal_atualiza_notificacoes_cliente') THEN
    CREATE POLICY "portal_atualiza_notificacoes_cliente" ON notificacoes
      FOR UPDATE TO authenticated
      USING (destinatario_tipo = 'cliente' AND destinatario_id = auth.uid());
  END IF;
END $$;

-- Portal e service_role podem inserir (webhook insere notif do salão)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notificacoes' AND policyname='portal_insere_notificacao') THEN
    CREATE POLICY "portal_insere_notificacao" ON notificacoes
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notificacoes_salao   ON notificacoes(salao_id, lida) WHERE destinatario_tipo = 'salao';
CREATE INDEX IF NOT EXISTS idx_notificacoes_cliente ON notificacoes(destinatario_id, lida) WHERE destinatario_tipo = 'cliente';

-- 3. Adicionar tipo 'no_show' na tabela comissoes (se houver CHECK constraint)
-- Se a tabela comissoes tiver CHECK (tipo IN (...)), execute:
-- ALTER TABLE comissoes DROP CONSTRAINT IF EXISTS comissoes_tipo_check;
-- ALTER TABLE comissoes ADD CONSTRAINT comissoes_tipo_check
--   CHECK (tipo IN ('servico', 'produto', 'ajuste', 'no_show'));
-- Se não tiver constraint ou já incluir 'no_show', ignore este bloco.
