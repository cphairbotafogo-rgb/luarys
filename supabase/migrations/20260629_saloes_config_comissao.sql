-- Adiciona colunas que ainda não existem em saloes
-- Verificado via information_schema em 2026-06-29

-- Configurações de comissão (parcialmente existem: nomenclatura e custo_op já foram adicionados)
ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS config_comissao_taxa_op_modo      TEXT    DEFAULT 'nao_descontar',
  ADD COLUMN IF NOT EXISTS config_comissao_taxa_op_percentual NUMERIC DEFAULT 0;

-- Configurações fiscais (não existe nenhuma coluna config_fiscal ainda)
ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS config_fiscal JSONB DEFAULT '{}'::jsonb;
