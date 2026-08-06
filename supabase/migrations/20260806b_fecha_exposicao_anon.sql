-- URGENTE — fecha leitura anônima de dados sensíveis.
--
-- Verificado em 06/08/2026 com a chave pública (anon), sem sessão nenhuma:
--
--   saloes         5 linhas, 84 colunas — incluindo config_fiscal com o
--                  brasilnfe_company_token do salão piloto (108 caracteres),
--                  que emite nota fiscal em nome do CNPJ. Também cnpj,
--                  responsavel_cpf, email_contador, token_pagamento, a1_path
--                  e a1_senha_enc.
--   profissionais  8 linhas, 20 colunas — percentual_comissao, cnpj_mei,
--                  comissao_produtos.
--
-- A correção de `saloes` JÁ EXISTE no repositório desde 17/07/2026
-- (20260717_c1_rls_saloes_anon.sql) e não está em vigor no banco. Não há
-- migration posterior que reconceda: ou aquela nunca rodou, ou foi desfeita
-- fora do versionamento. Esta refaz e estende.
--
-- O desenho é o mesmo e é correto: policy com USING (true) + GRANT por COLUNA.
-- A policy decide quais LINHAS; o grant decide quais COLUNAS. Uma sem a outra
-- não protege — foi exatamente o que aconteceu aqui.

BEGIN;

-- ── saloes ──────────────────────────────────────────────────────────────────
-- Colunas conferidas contra o que o portal realmente lê sem sessão:
-- portal/page.tsx, TelaSelecaoSalao.tsx e mobile/PortalMobile.tsx selecionam
-- id, nome_fantasia, slug, bairro, cidade, estado, telefone, cobrar_sinal e
-- porcentagem_sinal. TelaInicialMobile lê vitrine_liberada. As rotas de API
-- usam service_role e não dependem deste grant.
REVOKE ALL ON saloes FROM anon;

GRANT SELECT (
  id,
  nome_fantasia,
  slug,
  bairro,
  cidade,
  estado,
  telefone,
  cobrar_sinal,
  porcentagem_sinal,
  prazo_sinal_minutos,
  vitrine_liberada,
  horarios_funcionamento
) ON saloes TO anon;

DROP POLICY IF EXISTS "portal_anon_le_saloes" ON saloes;
DROP POLICY IF EXISTS "portal_anon_le_saloes_publico" ON saloes;
CREATE POLICY "portal_anon_le_saloes_publico" ON saloes
  FOR SELECT TO anon USING (true);

-- ── profissionais ───────────────────────────────────────────────────────────
-- Nenhum componente público lê esta tabela direto: o fluxo de agendamento
-- busca os profissionais em /api/portal/dados-agendamento, que usa
-- service_role. Então anon não precisa de acesso nenhum aqui.
REVOKE ALL ON profissionais FROM anon;

DROP POLICY IF EXISTS "anon_le_profissionais" ON profissionais;
DROP POLICY IF EXISTS "portal_anon_le_profissionais" ON profissionais;

COMMIT;

-- ── Conferência (rodar depois e comparar) ───────────────────────────────────
-- Deve devolver SOMENTE as 12 colunas concedidas acima para saloes, e NENHUMA
-- linha para profissionais:
--
--   SELECT table_name, column_name
--     FROM information_schema.column_privileges
--    WHERE grantee = 'anon' AND table_name IN ('saloes', 'profissionais')
--    ORDER BY table_name, column_name;
--
--   SELECT grantee, privilege_type
--     FROM information_schema.table_privileges
--    WHERE grantee = 'anon' AND table_name IN ('saloes', 'profissionais');
