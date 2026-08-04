-- Controle mensal dos documentos do profissional-parceiro (Lei 13.352/2016).
--
-- Falha apontada na auditoria: o salao ja exclui a cota-parte da receita bruta
-- (deducao no PGDAS-D e gDed na NFS-e), mas nada no sistema comprovava o
-- lastro dessa exclusao. O GavetaRepasse apenas ORIENTAVA por texto que o
-- parceiro deve emitir nota ao salao — sem registrar se ela chegou.
--
-- Dois documentos por competencia:
--   * nota fiscal do parceiro ao salao, pela cota-parte recebida (e o que
--     sustenta a exclusao da receita bruta);
--   * comprovante do DAS, que demonstra que o parceiro esta regular perante o
--     Fisco — requisito do art. 1o-A, par. 10, VII.
--
-- Desde 2026 o cruzamento NFS-e Nacional x PGDAS e imediato: exclusao sem
-- documento e o que descaracteriza a parceria numa fiscalizacao.

CREATE TABLE IF NOT EXISTS parceiro_documentos_mensais (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id         UUID NOT NULL REFERENCES saloes(id) ON DELETE CASCADE,
  profissional_id  UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,

  -- Competencia normalizada no dia 1 do mes, para o UNIQUE funcionar.
  competencia      DATE NOT NULL,

  -- Nota fiscal do parceiro -> salao
  nota_recebida    BOOLEAN NOT NULL DEFAULT FALSE,
  nota_numero      TEXT,
  nota_valor       NUMERIC(12,2),
  nota_data        DATE,

  -- Comprovante do DAS (MEI ou Simples do parceiro)
  das_comprovado   BOOLEAN NOT NULL DEFAULT FALSE,
  das_data         DATE,

  observacao       TEXT,
  registrado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  registrado_por   UUID,

  -- Um registro por parceiro por mes: evita duplicar controle da mesma
  -- competencia quando duas pessoas conferem o repasse ao mesmo tempo.
  CONSTRAINT parceiro_documentos_unicos UNIQUE (salao_id, profissional_id, competencia),
  -- Competencia sempre no dia 1: sem isto, "2026-08-01" e "2026-08-15" seriam
  -- competencias distintas e o UNIQUE nao serviria de nada.
  CONSTRAINT competencia_no_primeiro_dia CHECK (EXTRACT(DAY FROM competencia) = 1)
);

CREATE INDEX IF NOT EXISTS idx_parceiro_docs_salao_competencia
  ON parceiro_documentos_mensais (salao_id, competencia DESC);

ALTER TABLE parceiro_documentos_mensais ENABLE ROW LEVEL SECURITY;

-- Mesmo padrao de isolamento multi-tenant das demais tabelas: o salao so
-- enxerga e altera os proprios registros.
DROP POLICY IF EXISTS parceiro_docs_do_salao ON parceiro_documentos_mensais;
CREATE POLICY parceiro_docs_do_salao ON parceiro_documentos_mensais
  FOR ALL
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

COMMENT ON TABLE parceiro_documentos_mensais IS
  'Lastro documental da exclusao da cota-parte da receita bruta: nota fiscal do parceiro ao salao e comprovante do DAS, por competencia.';
