-- URGENTE — a coluna da chave de acesso não cabe a chave da NFS-e.
--
-- `chave_acesso` era varchar(44), tamanho da chave de NF-e/NFC-e. A chave da
-- NFS-e nacional tem 50 caracteres:
--
--   33045572217326293000102000000000052226089212127631   (50)
--
-- Descoberto em 06/08/2026 testando a gravação do retorno da prefeitura numa
-- nota já emitida: "value too long for type character varying(44)".
--
-- O efeito seria pior que perder a chave. A rota de emissão grava status,
-- número da nota, caminhos de arquivo e a chave NUM ÚNICO UPDATE. Falhando por
-- tamanho, o update inteiro é rejeitado: a nota fica em "Não Emitido" no nosso
-- banco tendo sido autorizada na prefeitura. Alguém veria a pendência e mandaria
-- de novo — nota duplicada, e a duplicidade só se resolve com cancelamento
-- dentro do prazo.
--
-- Ninguém tinha esbarrado nisso porque a gravação da chave é de ontem
-- (20260805c); antes dela o campo nunca era preenchido.
--
-- TEXT em vez de varchar(50): o CNPJ alfanumérico entra em 2026 e o layout da
-- NFS-e nacional ainda está em evolução. Não há ganho em limitar o tamanho de um
-- identificador que o emissor não controla.

ALTER TABLE notas_fiscais
  ALTER COLUMN chave_acesso TYPE TEXT;

COMMENT ON COLUMN notas_fiscais.chave_acesso IS
  'Chave de acesso. NFS-e nacional tem 50 caracteres; NF-e/NFC-e, 44. Abre a nota em nfse.gov.br/ConsultaPublica/?tpc=1&chave=<chave>';
