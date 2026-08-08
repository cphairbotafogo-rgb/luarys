-- ============================================================
-- MIGRAÇÃO: Tabela de solicitações de exclusão LGPD
-- Art. 18, VI — Direito de exclusão de dados pessoais
-- Executar no SQL Editor do Supabase Dashboard
-- ============================================================

-- ─── 1. Criar tabela de solicitações de exclusão ─────────────────────────────
-- Rastreia cada pedido de exclusão desde a solicitação até o processamento,
-- cumprindo o prazo de 15 dias exigido pela LGPD (Art. 18 §3º).
-- Não tem coluna salao_id porque uma solicitação de exclusão é do titular
-- (usuario_portal_id) e afeta todos os salões onde ele tem vínculo.
CREATE TABLE IF NOT EXISTS lgpd_solicitacoes_exclusao (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação do titular
  usuario_portal_id     UUID NOT NULL,    -- auth.users.id do portal
  usuario_email         TEXT,             -- e-mail no momento da solicitação
                                          -- (gravado aqui porque será apagado do Auth após execução)

  -- Ciclo de vida da solicitação
  status                TEXT NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente', 'confirmada', 'processada', 'cancelada')),

  -- Confirmação por e-mail (prova de identidade do titular)
  token_confirmacao     UUID,             -- UUID v4 gerado no servidor; null após uso
  token_expira_em       TIMESTAMPTZ,      -- token expira em 24h

  -- Rastreabilidade de prazo (LGPD Art. 18 §3º — 15 dias para responder)
  solicitado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  prazo_resposta_em     TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 days'),
  processado_em         TIMESTAMPTZ,      -- preenchido quando status = 'processada'

  -- Auditoria
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE lgpd_solicitacoes_exclusao IS
  'Rastreia solicitações de exclusão de conta do portal. '
  'LGPD Art. 18, VI — o titular tem direito de solicitar exclusão de dados '
  'tratados com base no consentimento. Prazo de resposta: 15 dias (Art. 18 §3º). '
  'O fluxo é: solicitado_em → confirmação por e-mail → processado_em.';

COMMENT ON COLUMN lgpd_solicitacoes_exclusao.usuario_email IS
  'E-mail gravado no momento da solicitação porque será apagado do Auth após execução.';

COMMENT ON COLUMN lgpd_solicitacoes_exclusao.token_confirmacao IS
  'UUID v4 gerado no servidor. Enviado por e-mail ao titular para provar identidade. '
  'Expira em 24h. Zerado (null) após uso para evitar reuso.';

COMMENT ON COLUMN lgpd_solicitacoes_exclusao.prazo_resposta_em IS
  'solicitado_em + 15 dias — prazo legal LGPD Art. 18 §3º. Gerado automaticamente.';

-- ─── 2. Índice para busca por token (confirmação via link de e-mail) ──────────
CREATE INDEX IF NOT EXISTS idx_lgpd_exclusao_token
  ON lgpd_solicitacoes_exclusao (token_confirmacao)
  WHERE token_confirmacao IS NOT NULL AND status = 'pendente';

-- ─── 3. Índice para busca por usuário (evitar duplicatas, dashboard admin) ────
CREATE INDEX IF NOT EXISTS idx_lgpd_exclusao_usuario
  ON lgpd_solicitacoes_exclusao (usuario_portal_id, status);

-- ─── 4. Índice para monitorar prazo LGPD (alertas de solicitações vencendo) ───
CREATE INDEX IF NOT EXISTS idx_lgpd_exclusao_prazo
  ON lgpd_solicitacoes_exclusao (prazo_resposta_em)
  WHERE status = 'pendente';

-- ─── 5. RLS — titular vê apenas as próprias solicitações ─────────────────────
ALTER TABLE lgpd_solicitacoes_exclusao ENABLE ROW LEVEL SECURITY;

-- Titular autenticado lê apenas as próprias solicitações
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lgpd_solicitacoes_exclusao'
      AND policyname = 'lgpd_exclusao_titular_le_proprio'
  ) THEN
    CREATE POLICY "lgpd_exclusao_titular_le_proprio"
      ON lgpd_solicitacoes_exclusao
      FOR SELECT TO authenticated
      USING (usuario_portal_id = auth.uid());
  END IF;
END $$;

-- Inserção só é feita pelo service_role (via API route) — sem policy de INSERT
-- para authenticated/anon. Isso evita que o titular manipule o registro diretamente.
-- O service_role bypassa RLS por definição.

-- Nenhuma policy de UPDATE/DELETE para roles públicas —
-- atualizações só via service_role na API route.

-- ─── 6. Garantir que a coluna solicitacao_exclusao_em existe em usuarios_portal ─
-- (criada na migration 20260622_usuarios_portal_exclusao.sql — garantia de
-- idempotência caso esta migration seja aplicada em ambiente sem aquela)
ALTER TABLE usuarios_portal
  ADD COLUMN IF NOT EXISTS solicitacao_exclusao_em TIMESTAMPTZ;

COMMENT ON COLUMN usuarios_portal.solicitacao_exclusao_em IS
  'Data em que o titular solicitou exclusão da conta — LGPD Art. 18, VI. '
  'Null = sem solicitação pendente. '
  'Preenchido pelo endpoint /api/portal/solicitar-exclusao.';

-- ============================================================
-- RESULTADO ESPERADO:
--   - Tabela lgpd_solicitacoes_exclusao criada com 3 índices
--   - RLS habilitado com policy de leitura para o titular
--   - Coluna solicitacao_exclusao_em garantida em usuarios_portal
-- ============================================================
