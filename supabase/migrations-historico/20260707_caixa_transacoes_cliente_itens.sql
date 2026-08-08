-- 20260707_caixa_transacoes_cliente_itens.sql
--
-- Permite mostrar no CRM "o que o cliente comprou". Até aqui a venda de balcão
-- (produtos) gravava só o total em caixa_transacoes, sem vínculo com o cliente
-- nem a lista de itens.
--
--  - cliente_id: liga a transação ao cliente global (clientes.id), preenchido
--    quando o operador seleciona o cliente no CRM durante a venda.
--  - itens: JSON com os produtos vendidos [{ nome, qtd, preco }], para exibir
--    a compra itemizada no histórico do cliente.

ALTER TABLE caixa_transacoes
  ADD COLUMN IF NOT EXISTS cliente_id uuid;

ALTER TABLE caixa_transacoes
  ADD COLUMN IF NOT EXISTS itens jsonb;

-- Consulta do CRM: compras de um cliente, do mais recente para o mais antigo.
CREATE INDEX IF NOT EXISTS idx_caixa_transacoes_salao_cliente
  ON caixa_transacoes(salao_id, cliente_id);
