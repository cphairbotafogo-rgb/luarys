-- Tabela de auditoria para uploads de certificado digital A1 (.pfx/.p12)
-- O certificado em si NUNCA é armazenado aqui — apenas metadados de quem enviou e quando.
-- A chave privada trafega diretamente ao provedor (Focus NFe / Brasil NFe) via HTTPS.

CREATE TABLE IF NOT EXISTS auditoria_certificados (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  salao_id        UUID        NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  usuario_id      UUID        NOT NULL REFERENCES auth.users(id),
  provedor        TEXT        NOT NULL CHECK (provedor IN ('focusnfe', 'brasilnfe')),
  nome_arquivo    TEXT        NOT NULL,
  tamanho_bytes   INT         NOT NULL,
  ip_origem       TEXT,
  sucesso         BOOLEAN     NOT NULL,
  mensagem_erro   TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consulta por salão e por data (relatórios de auditoria)
CREATE INDEX IF NOT EXISTS auditoria_certificados_salao_id_idx ON auditoria_certificados (salao_id);
CREATE INDEX IF NOT EXISTS auditoria_certificados_criado_em_idx ON auditoria_certificados (criado_em DESC);

-- RLS: apenas admins do próprio salão podem ver os registros
ALTER TABLE auditoria_certificados ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário autenticado vê apenas logs do seu salão
CREATE POLICY "auditoria_certificados_leitura"
  ON auditoria_certificados
  FOR SELECT
  USING (salao_id = auth_salao_id());

-- Inserção: feita exclusivamente pelo service_role (a partir da route.ts)
-- Nenhum usuário anon ou autenticado pode inserir diretamente
CREATE POLICY "auditoria_certificados_insercao_service"
  ON auditoria_certificados
  FOR INSERT
  WITH CHECK (false); -- bloqueado para todos via client anon/auth; service_role ignora RLS

COMMENT ON TABLE auditoria_certificados IS
  'Trilha de auditoria de uploads de certificado A1. '
  'O arquivo (.pfx/.p12) nunca é armazenado — só metadados. '
  'Inserções feitas exclusivamente pelo backend (service_role).';
