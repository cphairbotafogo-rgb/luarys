-- ─── 1. Preço customizado por módulo por salão ───────────────────────────────
ALTER TABLE salao_modulos
  ADD COLUMN IF NOT EXISTS preco_customizado NUMERIC(10,2);

COMMENT ON COLUMN salao_modulos.preco_customizado
  IS 'Preço mensal individual para este salão. NULL = usa o preço padrão do catálogo.';

-- ─── 2. Campos fiscais complementares em saloes ───────────────────────────────
ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS email_fiscal      TEXT,
  ADD COLUMN IF NOT EXISTS regime_tributario TEXT;

COMMENT ON COLUMN saloes.email_fiscal
  IS 'E-mail para envio de NFS-e (pode ser diferente do email_contato).';
COMMENT ON COLUMN saloes.regime_tributario
  IS 'Simples Nacional | Lucro Presumido | Lucro Real | MEI';

-- ─── 3. Documentos da plataforma (regras + contrato) ─────────────────────────
CREATE TABLE IF NOT EXISTS plataforma_documentos (
  id          SERIAL PRIMARY KEY,
  tipo        TEXT NOT NULL CHECK (tipo IN ('regras', 'contrato')),
  titulo      TEXT NOT NULL,
  conteudo    TEXT NOT NULL DEFAULT '',
  versao      INTEGER NOT NULL DEFAULT 1,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE plataforma_documentos
  IS 'Regras de uso e contratos da plataforma Luarys. Versão incrementada a cada atualização.';

-- Garante no máximo um documento ativo por tipo
CREATE UNIQUE INDEX IF NOT EXISTS idx_plataforma_documentos_tipo_ativo
  ON plataforma_documentos (tipo) WHERE ativo = true;

-- ─── 4. Registro de aceites de contrato por salão ────────────────────────────
CREATE TABLE IF NOT EXISTS aceites_contrato (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id        UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL,
  documento_id    INTEGER NOT NULL REFERENCES plataforma_documentos(id),
  versao_aceita   INTEGER NOT NULL,
  aceito_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_aceite       TEXT
);

CREATE INDEX IF NOT EXISTS idx_aceites_contrato_salao
  ON aceites_contrato (salao_id, documento_id, versao_aceita);

COMMENT ON TABLE aceites_contrato
  IS 'Registro de aceite de cada versão de contrato por salão (Marco Civil: IP + timestamp obrigatórios).';

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE plataforma_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE aceites_contrato ENABLE ROW LEVEL SECURITY;

-- Documentos: qualquer autenticado pode ler (para exibir no sistema do salão)
CREATE POLICY "documentos_leitura_autenticado"
  ON plataforma_documentos FOR SELECT TO authenticated
  USING (true);

-- Aceites: cada salão lê/insere só os próprios
CREATE POLICY "aceites_select_proprio_salao"
  ON aceites_contrato FOR SELECT TO authenticated
  USING (salao_id = auth_salao_id());

CREATE POLICY "aceites_insert_proprio_salao"
  ON aceites_contrato FOR INSERT TO authenticated
  WITH CHECK (salao_id = auth_salao_id());
