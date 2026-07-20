-- Fatia 1 — Fiscal: cota-parte salão/profissional
-- Adiciona coluna consultável que indica o regime jurídico/fiscal do profissional.
-- Derivada do contrato.tipo + presença de cnpj_mei.
-- Execute UMA VEZ no Supabase SQL Editor.

ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS tipo_parceiro text
  CHECK (tipo_parceiro IN ('parceiro_cnpj', 'parceiro_cpf', 'clt', 'pj', 'socio'));

COMMENT ON COLUMN profissionais.tipo_parceiro IS
  'parceiro_cnpj = Lei 13.352/2016 com CNPJ (cota excluída da receita bruta do salão no Simples);
   parceiro_cpf  = Lei 13.352/2016 sem CNPJ (salão tributa valor total);
   clt           = CLT registrado;
   pj            = Prestador PJ avulso;
   socio         = Sócio/Cotista.';

-- Backfill para profissionais já cadastrados:
-- parceiro_cnpj quando cnpj_mei preenchido, parceiro_cpf caso contrário.
UPDATE profissionais
SET tipo_parceiro = CASE
  WHEN cnpj_mei IS NOT NULL AND LENGTH(REGEXP_REPLACE(cnpj_mei, '\D', '', 'g')) = 14
    THEN 'parceiro_cnpj'
  ELSE 'parceiro_cpf'
END
WHERE tipo_parceiro IS NULL;
