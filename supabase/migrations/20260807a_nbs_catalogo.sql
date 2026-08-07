-- Catálogo NBS oficial dentro do sistema, para o salão escolher em vez de digitar.
--
-- Até aqui a lista vivia fixa no código, em ModalServicos.tsx, com quatro linhas
-- e dois erros: "Estética, Bem-estar e Depilação" apontava para 126022000 (mas
-- bem-estar é 126023000 e depilação é 126029000) e "Maquiagem e Outros" apontava
-- para 126029000 (maquiagem é tratamento cosmético, 126022000). O código
-- 126023000 sequer aparecia para escolher. Como estava no bundle, corrigir
-- exigia deploy — e nenhum salão tinha como saber que estava errado.
--
-- FONTE OFICIAL, conferida por Ari em 07/08/2026:
--   · Portaria Conjunta RFB/SCS nº 1.820/2013 (DOU 19/12/2013) — NBS 1.1, MDIC
--     https://www.gov.br/mdic/pt-br/assuntos/sdic/comercio-e-servicos/
--     nbs-nomenclatura-brasileira-de-servicos
--   · Notas Explicativas (NEBS)
--   · Anexo VIII do Portal NFS-e — correlação item LC 116 × NBS × cClassTrib
--     (IBS/CBS)
--
-- Só entram códigos com fonte à vista. Item da NBS que eu não consiga confirmar
-- no documento oficial NÃO é adicionado aqui "por analogia" — foi assim que
-- depilação foi parar em 126023000 e precisou ser corrigida em 70 cadastros.

CREATE TABLE IF NOT EXISTS nbs_catalogo (
  codigo        TEXT PRIMARY KEY,              -- 9 dígitos, sem pontos
  codigo_exibe  TEXT NOT NULL,                 -- 1.2602.10.00, como no documento
  descricao     TEXT NOT NULL,                 -- redação oficial
  rotulo        TEXT NOT NULL,                 -- como o salão reconhece
  exemplos      TEXT,                          -- serviços típicos, para desempate
  ctribnac      TEXT,                          -- cTribNac sugerido (LC 116)
  grupo         TEXT NOT NULL DEFAULT '1.2602',
  ordem         INT  NOT NULL DEFAULT 0,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  fonte         TEXT NOT NULL DEFAULT 'Portaria Conjunta RFB/SCS 1.820/2013 (NBS 1.1) — MDIC',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE nbs_catalogo IS
  'NBS oficial (MDIC) para o enquadramento IBS/CBS. Referência nacional, igual para todos os salões — não confundir com o código MUNICIPAL, que é por prefeitura e mora em codigos_municipais_aceitos.';
COMMENT ON COLUMN nbs_catalogo.ctribnac IS
  'cTribNac sugerido para o item. É federal, mas o salão pode ajustar por orientação da contabilidade dele.';

INSERT INTO nbs_catalogo (codigo, codigo_exibe, descricao, rotulo, exemplos, ctribnac, ordem) VALUES
  ('126021000', '1.2602.10.00',
   'Serviços de cabeleireiros e barbeiros',
   'Cabeleireiros e Barbeiros',
   'Corte, coloração, mechas, escova, tratamento capilar, penteado, barba, mega hair',
   '060101', 1),

  ('126022000', '1.2602.20.00',
   'Serviços de manicure, pedicure e de tratamento cosmético',
   'Manicure, Pedicure e Tratamento Cosmético',
   'Manicure, pedicure, esmaltação, alongamento de unhas, podologia estética, design de sobrancelha, henna, micropigmentação, maquiagem, limpeza de pele, estética facial',
   '060101', 2),

  ('126023000', '1.2602.30.00',
   'Serviços de bem-estar físico',
   'Bem-estar (spa, sauna, massagem)',
   'Spa, sauna, banho turco, massagem relaxante não terapêutica',
   '060101', 3),

  ('126029000', '1.2602.90.00',
   'Outros serviços de tratamento de beleza',
   'Depilação e Outros Tratamentos de Beleza',
   'Depilação com cera, com linha, a laser, tricotomia',
   '060101', 4)
ON CONFLICT (codigo) DO UPDATE SET
  codigo_exibe  = EXCLUDED.codigo_exibe,
  descricao     = EXCLUDED.descricao,
  rotulo        = EXCLUDED.rotulo,
  exemplos      = EXCLUDED.exemplos,
  ctribnac      = EXCLUDED.ctribnac,
  ordem         = EXCLUDED.ordem,
  atualizado_em = now();

-- Tabela de referência pública: todo salão logado lê, ninguém escreve pelo app.
-- Manter é da plataforma, quando o órgão publicar versão nova.
ALTER TABLE nbs_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nbs_catalogo_leitura ON nbs_catalogo;
CREATE POLICY nbs_catalogo_leitura ON nbs_catalogo
  FOR SELECT TO authenticated USING (ativo);

REVOKE ALL ON nbs_catalogo FROM anon;
GRANT SELECT ON nbs_catalogo TO authenticated;
