-- Remove da configuração dos salões dois valores que não são mais usados na
-- emissão e que carregam informação errada.
--
-- `item_lista_servico` guardava "06.01" — formato com ponto, que a prefeitura
-- recusa com E0310. Estava em 4 dos 5 salões, herdado do padrão de cadastro
-- (CFG_INICIAL), sem nunca ter entrado numa nota: o código de tributação vem da
-- ficha de cada serviço desde 04/08/2026. Ficar ali só espera que alguma rotina
-- nova o leia por engano.
--
-- `codigo_tributacao_municipio` no nível do salão é pior: guardava "005", que é
-- o desdobro do salão-parceiro DO RIO DE JANEIRO. O Luarys atende o país
-- inteiro; um código municipal só faz sentido por serviço e por município, e é
-- assim que ele já funciona (ver 20260806a, tabela codigos_municipais_aceitos).
--
-- Nenhum dos dois é lido por src/lib/nfse/payload.ts — a remoção não muda o que
-- é enviado hoje. O que muda é que deixa de existir valor errado à espera de
-- leitor.

UPDATE saloes
   SET config_fiscal = (config_fiscal::jsonb - 'item_lista_servico' - 'codigo_tributacao_municipio')
 WHERE config_fiscal ? 'item_lista_servico'
    OR config_fiscal ? 'codigo_tributacao_municipio';

-- Conferência — deve devolver zero linhas:
--   SELECT nome_fantasia FROM saloes
--    WHERE config_fiscal ? 'item_lista_servico'
--       OR config_fiscal ? 'codigo_tributacao_municipio';
