-- Dados fiscais obrigatórios para emissão de NFS-e pelo próprio salão.
-- inscricao_municipal → número de inscrição na prefeitura (prestador)
-- codigo_ibge         → código IBGE do município do salão (roteamento para a prefeitura correta)

ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
  ADD COLUMN IF NOT EXISTS codigo_ibge         TEXT;
