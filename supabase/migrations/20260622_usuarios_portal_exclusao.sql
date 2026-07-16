-- Rastreia solicitações de exclusão de conta (LGPD art. 18, VI)
ALTER TABLE usuarios_portal
  ADD COLUMN IF NOT EXISTS solicitacao_exclusao_em TIMESTAMPTZ;

COMMENT ON COLUMN usuarios_portal.solicitacao_exclusao_em
  IS 'Data em que o titular solicitou exclusão da conta — LGPD art. 18 VI. Null = sem solicitação pendente.';
