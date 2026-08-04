-- notas_fiscais.aliquota_iss — a NFS-e passa a usar o ISS do servico prestado.
--
-- Achado: os 317 servicos do salao piloto tem aliquota_iss = 5, mas toda nota
-- saia com 6% (config_fiscal.aliquota_padrao do salao). O percentual cadastrado
-- por servico, que a propria tela pede em Servicos -> Tributacao de Servico,
-- nunca era lido na emissao.
--
-- Isso nao e cosmetico: a aliquota vai declarada no XML e define o ISS devido.
-- Emitir a 6% um servico tributado a 5% e declaracao incorreta ao municipio.
--
-- A coluna guarda a aliquota vigente no momento do fechamento. Congelar o valor
-- na nota (em vez de reler do servico na hora de emitir) e proposital: se o
-- salao mudar a aliquota do servico depois, as notas antigas continuam
-- refletindo o que valia quando o servico foi prestado.

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS aliquota_iss NUMERIC;

COMMENT ON COLUMN notas_fiscais.aliquota_iss IS
  'ISS (%) do servico no momento do fechamento. NULL = usa config_fiscal.aliquota_padrao do salao.';

-- Backfill das notas ainda nao emitidas, a partir do servico correspondente.
-- Casa pela descricao do servico, que e o unico vinculo disponivel (a nota nao
-- guarda servico_id). Onde nao casar, fica NULL e cai no padrao do salao — o
-- mesmo comportamento de hoje, sem piorar nada.
UPDATE notas_fiscais n
   SET aliquota_iss = s.aliquota_iss
  FROM servicos s
 WHERE n.aliquota_iss IS NULL
   AND n.status IN ('Não Emitido', 'Erro')
   AND s.salao_id = n.salao_id
   AND s.aliquota_iss IS NOT NULL
   AND n.descricao_servico = s.nome_servico;

-- Notas ja emitidas nao sao tocadas: representam documento fiscal transmitido.
