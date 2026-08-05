-- Normaliza notas_fiscais.status para um vocabulário único.
--
-- Havia três grafias para "emitida" convivendo no banco — 'Emitida' (485),
-- 'Emitido' (18) e 'AUTORIZADA' (2) — sobra de versões anteriores do módulo.
-- Cada leitura precisava lembrar das três, e as que não lembravam ficaram
-- erradas em silêncio:
--   · a cota mensal de 150 notas conta só 'Emitida', então nota em status
--     legado não era cobrada do salão (api/nfse/emitir, trava de cota);
--   · o estorno só cancela a nota se ela estiver 'Emitida' — em status legado
--     a venda era estornada e a nota continuava valendo;
--   · a exportação de XML precisava listar as três à mão.
--
-- A conversão olha EVIDÊNCIA de autorização, não o rótulo. Uma nota só vira
-- 'Emitida' se tiver número, chave ou id externo do provedor. As 18 linhas
-- 'Emitido' do piloto não têm nenhum dos três: nunca chegaram a ser
-- transmitidas, são resto da fase de construção do módulo. Chamá-las de
-- emitidas seria repetir a mentira que essa migration existe para desfazer.

BEGIN;

UPDATE notas_fiscais
   SET status = 'Emitida'
 WHERE status IN ('Emitido', 'AUTORIZADA')
   AND (numero_nota IS NOT NULL OR chave_acesso IS NOT NULL OR id_externo IS NOT NULL);

UPDATE notas_fiscais
   SET status = 'Não Emitido'
 WHERE status IN ('Emitido', 'AUTORIZADA');

-- Trava para o problema não voltar. Sem isto, qualquer rota nova pode inventar
-- uma quarta grafia e ninguém percebe até o filtro errar de novo.
ALTER TABLE notas_fiscais
  DROP CONSTRAINT IF EXISTS notas_fiscais_status_valido;

ALTER TABLE notas_fiscais
  ADD CONSTRAINT notas_fiscais_status_valido CHECK (
    status IN (
      'Não Emitido',  -- criada no fechamento, ainda não transmitida
      'Pendente',     -- transmitida, prefeitura ainda processando o lote
      'Emitida',      -- autorizada pela prefeitura
      'Erro',         -- recusada; pode ser corrigida e retransmitida
      'Cancelada',    -- cancelada junto à prefeitura ou por estorno
      'Dispensada',   -- serviço sem receita (cortesia, pacote já pago)
      'Histórico'     -- competência declarada em outro sistema; nunca transmitir
    )
  );

-- 'Histórico' existe por um risco concreto, não por elegância: no dia em que um
-- salão liga a produção, a fila de transmissão ainda contém as notas das
-- competências que ele declarou no sistema anterior. Um "selecionar tudo" as
-- envia de verdade, em duplicidade, e cada uma precisa ser cancelada no prazo.
-- 'Dispensada' não serve para isso — ela já significa serviço sem receita, e
-- misturar as duas esconderia o motivo real. A nota em 'Histórico' continua
-- visível no histórico do cliente; só não é alcançável pela transmissão.

COMMIT;
