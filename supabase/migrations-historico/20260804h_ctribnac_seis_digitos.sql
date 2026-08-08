-- cTribNac: o Codigo de Tributacao Nacional tem 6 digitos, sem ponto.
--
-- Segunda correcao do mesmo campo. Historico:
--   1) gravavamos o NBS ("126021000") -> o XSD recusava:
--      "cTribNac ... TSCodTribNac ... Pattern constraint failed"
--   2) trocamos pelo item da LC 116 com ponto ("06.01") -> passou no XSD, mas a
--      prefeitura devolveu "E0310 - O codigo de tributacao nacional informado
--      nao existe conforme a lista de servicos nacional do Sistema Nacional
--      NFS-e"
-- O formato correto e item(2)+subitem(2)+desdobro(2), tudo junto: 060101.
--
-- Codigos conferidos na lista nacional em 04/08/2026:
--   060101  Barbearia, cabeleireiros, manicuros, pedicuros e congeneres
--   060201  Esteticistas, tratamento de pele, depilacao e congeneres
--
-- ATENCAO: o agrupamento por NBS foi deduzido dos nomes dos servicos
-- cadastrados; nao existe correspondencia normativa entre NBS e a lista
-- nacional. Confirmar com o contador antes de emitir em producao.

-- 1) Coluna por servico. O codigo passa a sair do cadastro do servico
-- (Servicos -> Tributacao de Servico), nao de um mapeamento no codigo.
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS codigo_tributacao_nacional TEXT;

COMMENT ON COLUMN servicos.codigo_tributacao_nacional IS
  'cTribNac da NFS-e Nacional: 6 digitos sem ponto (ex: 060101). Nao confundir com nbs nem com codigo_municipio.';

-- 2) Backfill a partir do NBS ja cadastrado.
UPDATE servicos SET codigo_tributacao_nacional = '060101'
 WHERE codigo_tributacao_nacional IS NULL AND nbs IN ('126021000', '126022000');

UPDATE servicos SET codigo_tributacao_nacional = '060201'
 WHERE codigo_tributacao_nacional IS NULL AND nbs IN ('126023000', '126029000');

-- Servico sem NBS: cai no codigo de salao mais comum.
UPDATE servicos SET codigo_tributacao_nacional = '060101'
 WHERE codigo_tributacao_nacional IS NULL;

-- 3) Notas ainda nao emitidas: converte o "06.01"/"06.02" gravado na tentativa
-- anterior para o formato de 6 digitos.
UPDATE notas_fiscais SET item_lista_servico = '060101'
 WHERE status IN ('Não Emitido', 'Erro')
   AND regexp_replace(coalesce(item_lista_servico, ''), '\D', '', 'g') IN ('0601', '126021000', '126022000');

UPDATE notas_fiscais SET item_lista_servico = '060201'
 WHERE status IN ('Não Emitido', 'Erro')
   AND regexp_replace(coalesce(item_lista_servico, ''), '\D', '', 'g') IN ('0602', '126023000', '126029000');

-- Qualquer resto fora do formato vira NULL -> o emissor aplica o padrao 060101.
UPDATE notas_fiscais SET item_lista_servico = NULL
 WHERE status IN ('Não Emitido', 'Erro')
   AND item_lista_servico IS NOT NULL
   AND item_lista_servico !~ '^\d{6}$';

-- Notas ja emitidas nao sao tocadas: representam documento fiscal transmitido.
