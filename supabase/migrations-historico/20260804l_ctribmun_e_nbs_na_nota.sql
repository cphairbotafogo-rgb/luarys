-- Codigo de tributacao do municipio (cTribMun) e NBS na nota.
--
-- Origem: a configuracao que o Ari usa hoje na Trinks, que emite com sucesso
-- para este salao no Rio, mostra "Codigo de Tributacao Municipio = 005" —
-- TRES digitos. Nosso servicos.codigo_municipio esta com "06.01", que e o item
-- da lista de servicos, nao o codigo de tributacao do municipio. Sao campos
-- diferentes que estavam sendo confundidos.
--
-- Na NFS-e Nacional o enquadramento e cTribNac (6 digitos, nacional) +
-- cTribMun (3 digitos, do municipio). Mandavamos so o nacional, e a rejeicao
-- E0312 diz exatamente que o municipio nao reconhece o codigo — e coerente com
-- faltar a parte municipal.
--
-- Tambem passa a viajar o NBS, que o provedor aceita em campo proprio
-- (Lei da Transparencia 12.741/12) e ja estava cadastrado nos servicos.

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS nbs TEXT;

COMMENT ON COLUMN notas_fiscais.nbs IS
  'NBS do servico (Lei da Transparencia). Congelado no fechamento, como aliquota_iss e cTribNac.';

-- 1) Corrige o codigo de tributacao municipal dos servicos.
-- So mexe onde esta com o valor do item da lista ("06.01"/"06.02"), que nunca
-- foi um cTribMun valido. Servico com codigo proprio ja preenchido nao e tocado.
UPDATE servicos
   SET codigo_municipio = '005'
 WHERE codigo_municipio IN ('06.01', '06.02', '0601', '0602');

-- 2) Notas ainda nao emitidas herdam o codigo corrigido e o NBS do servico.
UPDATE notas_fiscais n
   SET codigo_tributacao_municipio = s.codigo_municipio,
       nbs = COALESCE(n.nbs, s.nbs)
  FROM servicos s
 WHERE n.status IN ('Não Emitido', 'Erro')
   AND s.salao_id = n.salao_id
   AND n.descricao_servico = s.nome_servico;

-- Onde nao casou pela descricao, ao menos o codigo municipal fica correto:
-- todos os servicos do piloto compartilham o mesmo cTribMun.
UPDATE notas_fiscais
   SET codigo_tributacao_municipio = '005'
 WHERE status IN ('Não Emitido', 'Erro')
   AND (codigo_tributacao_municipio IS NULL
        OR codigo_tributacao_municipio IN ('06.01', '06.02', '0601', '0602'));

-- Notas ja emitidas nao sao tocadas.
