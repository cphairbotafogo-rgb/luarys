-- 20260708_backfill_crm_clientes.sql
--
-- REGRA: todo cliente do salão deve ter vínculo em crm_clientes (é o cadastro
-- principal do CRM). Cadastro manual e importação já criam esse vínculo — mas
-- clientes LEGADOS (dados antigos) ficaram só em `clientes`, sem crm_clientes,
-- e por isso não apareciam na lista/busca do CRM.
--
-- Este backfill cria o vínculo que faltava, preservando o gasto/visitas/última
-- visita que já estavam na linha global. Idempotente (o NOT EXISTS evita duplicar);
-- pode rodar quantas vezes quiser.

INSERT INTO crm_clientes (cliente_id, salao_id, ativo, total_gasto, total_visitas, data_ultima_visita)
SELECT c.id, c.salao_id, true,
       COALESCE(c.total_gasto, 0), COALESCE(c.total_visitas, 0), c.data_ultima_visita
FROM clientes c
WHERE c.salao_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM crm_clientes cc
    WHERE cc.cliente_id = c.id AND cc.salao_id = c.salao_id
  );
