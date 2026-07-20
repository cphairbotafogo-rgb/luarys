-- Fatia 2 — Fiscal: cnpj e tipo_parceiro do profissional na nota fiscal
-- Permite discriminar corretamente no campo gDed (NFS-e) a cota do profissional
-- e saber se é tratamento de dedução de CNPJ (parceiro_cnpj) ou RPA (parceiro_cpf).
-- Execute UMA VEZ no Supabase SQL Editor.

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS cnpj_profissional text,
  ADD COLUMN IF NOT EXISTS tipo_parceiro     text
    CHECK (tipo_parceiro IS NULL OR tipo_parceiro IN ('parceiro_cnpj', 'parceiro_cpf', 'clt', 'pj', 'socio'));

COMMENT ON COLUMN notas_fiscais.cnpj_profissional IS
  'CNPJ/MEI do profissional parceiro (campo gDed do NFS-e). Nulo para CLT/PJ sem dedução.';

COMMENT ON COLUMN notas_fiscais.tipo_parceiro IS
  'Regime fiscal do profissional: parceiro_cnpj (deduz receita bruta), parceiro_cpf (RPA+INSS 11%), etc.';
