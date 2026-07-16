-- Histórico de mudanças de plano por salão
-- Permite auditoria completa de quando e por quem cada plano foi alterado no admin.

CREATE TABLE IF NOT EXISTS salao_planos_historico (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id       UUID        NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  plano_anterior TEXT,
  plano_novo     TEXT,
  alterado_por   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_historico_salao ON salao_planos_historico(salao_id, criado_em DESC);

-- RLS: apenas admin da plataforma pode consultar/inserir
ALTER TABLE salao_planos_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_plataforma_planos_historico" ON salao_planos_historico
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfis_usuarios
      WHERE id = auth.uid()
        AND is_plataforma_admin = true
    )
  );
