-- notas_fiscais.item_lista_servico: troca o NBS pelo item da LC 116.
--
-- Sintoma: toda NFS-e transmitida voltava recusada com
--   "The 'nfse:cTribNac' element is invalid - The value '126021000' is invalid
--    according to its datatype 'nfse:TSCodTribNac' - The Pattern constraint failed."
--
-- Causa: o fechamento de conta gravava em item_lista_servico o NBS do servico
-- (9 digitos), mas o campo alimenta o cTribNac, que exige o item da Lei
-- Complementar 116 no formato "06.01". Sao taxonomias diferentes. Ironia do
-- caso: nota SEM codigo passava (caia no padrao 06.01) e nota COM codigo
-- falhava.
--
-- Mapeamento (mesma tabela de src/lib/nfse/lc116.ts):
--   126021000 cabelo          -> 06.01  "barbearia, cabeleireiros, manicuros,
--   126022000 unhas           -> 06.01   pedicuros e congeneres"
--   126023000 estetica facial -> 06.02  "esteticistas, tratamento de pele,
--                                        depilacao e congeneres"
--
-- ATENCAO: o mapeamento NBS->LC116 foi deduzido dos nomes dos servicos
-- cadastrados; nao existe correspondencia normativa entre as duas tabelas.
-- Confirmar com o contador antes de emitir em producao.

-- 1) Notas ainda nao emitidas: converte o que da para converter.
UPDATE notas_fiscais
   SET item_lista_servico = '06.01'
 WHERE status IN ('Não Emitido', 'Erro')
   AND regexp_replace(coalesce(item_lista_servico, ''), '\D', '', 'g') IN ('126021000', '126022000');

UPDATE notas_fiscais
   SET item_lista_servico = '06.02'
 WHERE status IN ('Não Emitido', 'Erro')
   AND regexp_replace(coalesce(item_lista_servico, ''), '\D', '', 'g') = '126023000';

-- 2) Qualquer outro codigo fora do formato vira NULL: o emissor entao aplica o
-- padrao 06.01, que e aceito. Melhor cair no padrao do que ser recusado.
UPDATE notas_fiscais
   SET item_lista_servico = NULL
 WHERE status IN ('Não Emitido', 'Erro')
   AND item_lista_servico IS NOT NULL
   AND item_lista_servico !~ '^\d{2}\.\d{2}$';

-- 3) Notas ja emitidas NAO sao tocadas de proposito: representam documento
-- fiscal ja transmitido: reescrever o codigo aqui divergiria do XML autorizado.
