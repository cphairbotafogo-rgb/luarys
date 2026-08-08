-- 20260708_backfill_clientes_salao_id.sql
--
-- PROBLEMA: uma importação criou o vínculo em `crm_clientes` (cadastro principal
-- do CRM do salão), mas deixou `clientes.salao_id = NULL` no registro global.
-- Consequência: a RLS de `clientes` (salao_id = auth_salao_id()) bloqueia a leitura
-- desses clientes, então eles apareciam no CRM como "CL" / "Sem telefone" e não
-- eram encontrados na busca — apesar de terem nome e vínculo corretos.
--
-- REGRA (Ari): todo cliente vinculado ao crm_clientes de um salão DEVE pertencer a
-- esse salão. Aqui atribuímos o salao_id que faltava, usando o vínculo já existente
-- como fonte de verdade. Escopo restrito: só toca em clientes com salao_id NULL que
-- têm vínculo com ESTE salão — nunca rouba cliente de outro salão. Idempotente.

UPDATE clientes c
SET salao_id = cc.salao_id
FROM crm_clientes cc
WHERE cc.cliente_id = c.id
  AND c.salao_id IS NULL
  AND cc.salao_id IS NOT NULL;

-- Verificação pós-execução (deve voltar 0):
-- SELECT count(*) FROM clientes c
-- JOIN crm_clientes cc ON cc.cliente_id = c.id
-- WHERE c.salao_id IS NULL;
