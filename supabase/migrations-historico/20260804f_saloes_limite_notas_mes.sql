-- saloes.limite_notas_mes — coluna que o codigo ja usava mas nunca existiu.
--
-- Sintoma: emitir NFS-e devolvia "CNPJ nao cadastrado. Configure em Dados da
-- Empresa." mesmo com o CNPJ preenchido. A rota /api/nfse/emitir pede essa
-- coluna no select; como ela nao existe, o PostgREST derruba a consulta INTEIRA
-- ("column saloes.limite_notas_mes does not exist"), o erro era descartado e o
-- codigo caia no if seguinte, culpando o CNPJ. Nenhum salao conseguia emitir.
--
-- A tela de admin (AbaEmpresas) tambem pede a coluna no select e no update, ou
-- seja, a listagem de empresas falhava pelo mesmo motivo.
--
-- 150 e a cota mensal ja assumida pelo codigo (`salao?.limite_notas_mes ?? 150`
-- em /api/nfse/emitir e `defaultValue={s.limite_notas_mes ?? 150}` no admin),
-- entao o default aqui mantem o comportamento atual — nenhum salao muda de cota
-- ao rodar esta migration.

ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS limite_notas_mes INTEGER NOT NULL DEFAULT 150;

COMMENT ON COLUMN saloes.limite_notas_mes IS
  'Cota de NFS-e por mes incluida no modulo fiscal. Salao com acesso_total=true ignora a trava.';
