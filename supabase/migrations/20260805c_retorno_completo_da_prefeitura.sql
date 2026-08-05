-- Guarda o que a prefeitura devolve na emissão e que vinha sendo descartado.
--
-- O adaptador da Brasil NFe lia só NumeroNFSe e os arquivos base64. Chave de
-- acesso, número do RPS, protocolo, código de verificação e os valores apurados
-- vinham na mesma resposta e eram jogados fora. Resultado, nas 487 notas do
-- piloto: chave_acesso 0/487, protocolo_sefaz 0/487, rps_numero 2/487.
--
-- A chave é a que importa mais: é ela que abre a nota no portal nacional
-- (nfse.gov.br/ConsultaPublica/?tpc=1&chave=...), que é a fonte oficial — vale
-- mais que um PDF guardado, e é exatamente o que a plataforma anterior oferecia
-- ao salão.
--
-- Os valores apurados servem para conferência: a prefeitura devolve a base de
-- cálculo, o ISS e a alíquota que ELA aplicou. Guardar isso permite comparar com
-- o que mandamos e detectar divergência de enquadramento sem depender de abrir
-- nota por nota. As colunas de chave/protocolo/RPS já existiam.

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS codigo_verificacao TEXT,
  ADD COLUMN IF NOT EXISTS base_calculo       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS valor_iss          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS aliquota_apurada   NUMERIC(7,4);

COMMENT ON COLUMN notas_fiscais.chave_acesso IS
  'Chave de acesso da NFS-e. Abre a nota no portal nacional: nfse.gov.br/ConsultaPublica/?tpc=1&chave=<chave>';
COMMENT ON COLUMN notas_fiscais.aliquota_apurada IS
  'Alíquota que a prefeitura aplicou, não a que enviamos. Divergência entre as duas indica enquadramento errado.';
