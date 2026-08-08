-- Alinha os códigos fiscais dos serviços com as NFS-e que o salão realmente
-- emitiu em produção, pelo padrão nacional, em julho/2026.
--
-- Evidência: cinco DANFSe v2.0 do CNPJ 17.326.293/0001-02 (notas 613, 626, 635,
-- 642 e 644). Todas trazem, sem exceção:
--
--   Cód. Tributação Nacional / Municipal:  06.01.01 / 005
--   Regime Especial de Tributação:         Nenhum
--   Alíquota aplicada:                     0,00 %
--
-- Inclusive a nota 626, que é depilação pura — serviço que a LC 116 colocaria no
-- item 6.02. Isso desfaz a premissa em que este projeto vinha operando: eu
-- classificava por item da LC 116 e criei um segundo grupo em 060201 + 060220.
-- O município classifica pela ATIVIDADE DO SALÃO, e o 005 é o código do
-- salão-parceiro optante pelo Simples (LF 12.592/2012), que abrange
-- "cabeleireiros, barbeiros, manicuros, pedicuros e maquiadores" — a operação
-- inteira. Foi essa divisão indevida que gerou a rejeição E0314 e a caçada ao
-- 060220; nenhum dos dois era necessário.
--
-- O NBS é o único campo que varia entre os serviços:
--   1.2602.10.00 (126021000) — cabelo      (notas 642 e 644)
--   1.2602.20.00 (126022000) — manicure, pedicure e depilação (613, 626, 635)
--
-- ALÍQUOTA: as notas reais saem a 0,00%, mas a contabilidade do salão recomendou
-- manter 5% no cadastro (decisão registrada em 05/08/2026). Por isso este script
-- NÃO mexe em aliquota_iss. Divergência conhecida, não esquecida.

UPDATE servicos
   SET codigo_tributacao_nacional = '060101',
       codigo_municipio           = '005',
       nbs                        = '126022000'
 WHERE codigo_tributacao_nacional = '060201';

UPDATE servicos
   SET codigo_municipio = '005'
 WHERE codigo_municipio = '060104';
