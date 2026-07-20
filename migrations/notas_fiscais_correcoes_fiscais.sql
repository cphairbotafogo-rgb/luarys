-- Correções fiscais — rodar APÓS notas_fiscais_cota_fiscal.sql
-- Execute UMA VEZ no Supabase SQL Editor.

-- ── 1. data_movimentacao em notas_fiscais ────────────────────────────────────
-- Permite filtrar relatórios pela competência real do atendimento (não pelo
-- momento de criação da nota), alinhado com data_movimentacao do financeiro.
ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS data_movimentacao timestamptz;

-- Backfill: notas já existentes usam data_emissao como proxy (notas_fiscais não tem created_at).
-- Novas notas recebem a data real do atendimento ao fechar conta.
UPDATE notas_fiscais
SET data_movimentacao = COALESCE(data_emissao, NOW())
WHERE data_movimentacao IS NULL;

-- ── 2. Backfill retroativo de tipo_parceiro nas notas já emitidas ────────────
-- Notas criadas antes da Fatia 2 têm tipo_parceiro = NULL.
-- Propaga o valor de profissionais.tipo_parceiro via nome+salao_id.
UPDATE notas_fiscais nf
SET
  tipo_parceiro     = p.tipo_parceiro,
  cnpj_profissional = COALESCE(nf.cnpj_profissional, p.cnpj_mei)
FROM profissionais p
WHERE nf.profissional_nome = p.nome
  AND nf.salao_id           = p.salao_id
  AND nf.tipo_parceiro      IS NULL
  AND p.tipo_parceiro        IS NOT NULL;

-- ── 3. Corrigir profissionais CLT/PJ/Sócio classificados indevidamente ───────
-- O backfill inicial (profissionais_tipo_parceiro.sql) não tinha acesso ao
-- tipo de contrato e classificou TODOS os sem-CNPJ como 'parceiro_cpf'.
-- Este passo corrige usando perfil_avancado->contrato->tipo.
UPDATE profissionais
SET tipo_parceiro = CASE
  WHEN LOWER(perfil_avancado->'contrato'->>'tipo') LIKE '%clt%'                     THEN 'clt'
  WHEN LOWER(perfil_avancado->'contrato'->>'tipo') LIKE '%pj%'
    OR LOWER(perfil_avancado->'contrato'->>'tipo') LIKE '%prestador%'
    OR LOWER(perfil_avancado->'contrato'->>'tipo') LIKE '%mei%'                      THEN 'pj'
  WHEN LOWER(perfil_avancado->'contrato'->>'tipo') LIKE '%sociedade%'               THEN 'socio'
  ELSE tipo_parceiro
END
WHERE perfil_avancado IS NOT NULL
  AND perfil_avancado->'contrato' IS NOT NULL
  AND perfil_avancado->'contrato'->>'tipo' IS NOT NULL
  AND LOWER(perfil_avancado->'contrato'->>'tipo') NOT LIKE '%parceiro%'
  AND tipo_parceiro IN ('parceiro_cnpj', 'parceiro_cpf');
