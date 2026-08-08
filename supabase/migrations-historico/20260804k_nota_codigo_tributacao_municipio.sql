-- notas_fiscais.codigo_tributacao_municipio — o codigo da prefeitura nunca era
-- enviado.
--
-- Sintoma: rejeicao E0312 "O codigo de tributacao nacional informado nao esta
-- administrado pelo municipio de incidencia do ISSQN na data de competencia".
--
-- O cadastro de servicos ja pede o "Codigo Municipal" (servicos.codigo_municipio,
-- preenchido com 06.01 nos 317 servicos do piloto) e o adaptador ja repassa
-- servico.codigo_tributario_municipio ao provedor — mas buildPayloadNFSe nunca
-- preenchia esse campo, entao ele saia undefined em toda nota.
--
-- Na NFS-e Nacional o enquadramento e a soma dos dois: cTribNac (6 digitos,
-- nacional) + cTribMun (complemento municipal). Mandar so o nacional deixa a
-- prefeitura sem o codigo dela para reconhecer o servico.
--
-- ATENCAO: isto corrige uma omissao real, mas nao ha garantia de que sozinho
-- resolva a E0312 — essa rejeicao depende de quais codigos o municipio
-- efetivamente administra no Portal da NFS-e Nacional. Confirmar com a
-- contabilidade ou a prefeitura qual o codigo correto do salao.

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS codigo_tributacao_municipio TEXT;

COMMENT ON COLUMN notas_fiscais.codigo_tributacao_municipio IS
  'Codigo de tributacao da prefeitura (cTribMun), complementar ao cTribNac. Vem de servicos.codigo_municipio no fechamento.';

-- Backfill das notas ainda nao emitidas, pelo servico correspondente.
-- Casa pela descricao, unico vinculo disponivel (a nota nao guarda servico_id).
UPDATE notas_fiscais n
   SET codigo_tributacao_municipio = s.codigo_municipio
  FROM servicos s
 WHERE n.codigo_tributacao_municipio IS NULL
   AND n.status IN ('Não Emitido', 'Erro')
   AND s.salao_id = n.salao_id
   AND s.codigo_municipio IS NOT NULL
   AND s.codigo_municipio <> ''
   AND n.descricao_servico = s.nome_servico;

-- Notas ja emitidas nao sao tocadas.
