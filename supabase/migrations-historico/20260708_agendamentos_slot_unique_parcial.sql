-- 20260708_agendamentos_slot_unique_parcial.sql
--
-- PROBLEMA: a unique de slot `agendamentos_slot_unique` (salao_id, profissional_id,
-- data, inicio) travava DOIS casos legítimos:
--   1. ENCAIXE (eh_encaixe = true) — que, por definição, divide o horário de outro
--      atendimento. Adicionar um serviço avulso no Fechamento (marcado como encaixe)
--      estourava `duplicate key ... agendamentos_slot_unique` (23505).
--   2. Histórico duplicado no mesmo slot com status Cancelado/Finalizado (ex.: cliente
--      remarcado, ou 2 serviços na mesma visita importados como 2 linhas).
--
-- SOLUÇÃO: unique PARCIAL — a regra "1 por slot" vale apenas para agendamentos
-- ATIVOS e NÃO-encaixe. Assim:
--   - encaixe pode compartilhar slot;
--   - cancelado/finalizado/faltou não ocupam o slot (podem coexistir);
--   - dois agendamentos ativos normais no mesmo horário continuam bloqueados
--     (que é o duplo-agendamento acidental que a regra deve impedir).
--
-- Idempotente. Antes de aplicar, garantir que não há 2+ ativos não-encaixe no mesmo
-- slot (checagem no comentário abaixo — deve voltar 0 linhas).

-- SELECT salao_id, profissional_id, data, inicio, count(*)
-- FROM agendamentos
-- WHERE eh_encaixe IS NOT TRUE
--   AND status IN ('Agendado','Confirmado','Aguardando','Em Atendimento')
-- GROUP BY salao_id, profissional_id, data, inicio
-- HAVING count(*) > 1;

ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_slot_unique;
DROP INDEX IF EXISTS agendamentos_slot_unique;

CREATE UNIQUE INDEX agendamentos_slot_unique
  ON agendamentos (salao_id, profissional_id, data, inicio)
  WHERE eh_encaixe IS NOT TRUE
    AND status IN ('Agendado', 'Confirmado', 'Aguardando', 'Em Atendimento');
