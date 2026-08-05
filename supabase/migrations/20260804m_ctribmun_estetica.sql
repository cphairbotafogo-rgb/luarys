-- cTribMun do item 6.02 (estetica) no Rio: 060220, nao 005.
--
-- A migration 20260804l escreveu "005" em TODOS os servicos, com o comentario
-- "todos os servicos do piloto compartilham o mesmo cTribMun". Era suposicao
-- minha, e estava errada: cada item da LC 116 tem o seu codigo no municipio.
-- Servico de estetica passou a ser recusado com E0314 ("codigo de tributacao
-- municipal informado nao existe ou nao esta administrado pelo municipio").
--
-- Valor confirmado empiricamente contra a API em homologacao, nao deduzido:
--   060101 + 005      -> aceito  (cabeleireiros/manicure — ja vinha emitindo)
--   060201 + 005      -> E0314
--   060201 + 020      -> E0314
--   060201 + 060220   -> aceito
--
-- Note que os dois codigos municipais tem formatos diferentes (3 e 6 digitos).
-- Nao ha regra a inferir dai — e como o Rio cadastrou. Por isso o campo segue
-- por servico e editavel, em vez de calculado.

UPDATE servicos
   SET codigo_municipio = '060220'
 WHERE codigo_tributacao_nacional = '060201';

-- Notas ainda nao emitidas seguem o servico.
UPDATE notas_fiscais
   SET codigo_tributacao_municipio = '060220'
 WHERE status IN ('Não Emitido', 'Erro')
   AND item_lista_servico = '060201';

-- Notas ja emitidas nao sao tocadas: documento fiscal transmitido.
