-- Armazena assinaturas Web Push dos clientes do portal.
-- Uma assinatura representa um dispositivo/browser específico.
-- Um cliente pode ter múltiplos dispositivos.

CREATE TABLE IF NOT EXISTS portal_push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuarios_portal(id) ON DELETE CASCADE,
  endpoint      text NOT NULL,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  criado_em     timestamptz DEFAULT now(),
  UNIQUE (usuario_id, endpoint)
);

-- Índice para busca rápida por usuário
CREATE INDEX IF NOT EXISTS idx_push_subs_usuario ON portal_push_subscriptions(usuario_id);

-- RLS: service role tem acesso total (push é disparado pelo backend)
ALTER TABLE portal_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Apenas o service_role (backend) pode ler/escrever — nenhum cliente acessa diretamente
CREATE POLICY "push_subs_service_role"
  ON portal_push_subscriptions
  TO service_role
  USING (true)
  WITH CHECK (true);
