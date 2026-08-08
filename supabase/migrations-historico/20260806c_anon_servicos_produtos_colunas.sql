-- Fecha a segunda metade da exposição anônima: custo e margem.
--
-- A varredura de 06/08/2026 com a chave pública mostrou que, além de `saloes` e
-- `profissionais` (fechados em 20260806b), duas tabelas devolviam LINHAS de
-- verdade para quem não está logado:
--
--   servicos   336 linhas, 32 colunas — custo_operacional, custo_produto,
--              custo_produto_prof, custo_descartaveis, custo_fixo_operacional,
--              custo_op_estabelecimento, custo_op_profissional, valor_despesa,
--              comissao_padrao, preco_promocional.
--   produtos     1 linha, 21 colunas — custo_medio.
--
-- Ou seja: a estrutura de custo e a margem de cada salão, legíveis por qualquer
-- pessoa com a chave pública. Preço o cliente precisa ver; quanto o salão gasta
-- para entregar aquilo, e quanto paga de comissão, não.
--
-- As demais tabelas da varredura (clientes, agendamentos, financeiro,
-- notas_fiscais, comissoes, perfis_usuarios, plataforma_nfse_config, despesas)
-- responderam com ZERO linhas: o RLS já filtra corretamente ali. Não se mexe
-- no que está certo.
--
-- Mesmo desenho de 20260806b: a policy decide as LINHAS, o GRANT decide as
-- COLUNAS. Uma sem a outra não protege.

BEGIN;

-- ── servicos ────────────────────────────────────────────────────────────────
-- Colunas conferidas contra /api/portal/dados-agendamento, que é o que o
-- cliente vê ao agendar. Aquela rota usa service_role e não depende deste
-- grant; ele existe para qualquer leitura pública direta do catálogo.
REVOKE ALL ON servicos FROM anon;

GRANT SELECT (
  id,
  salao_id,
  nome_servico,
  descricao,
  preco_padrao,
  tipo_preco,
  duracao_minutos,
  categoria,
  setor,
  exibir_online
) ON servicos TO anon;

-- ── produtos ────────────────────────────────────────────────────────────────
-- PortalVitrine.tsx lê esta tabela direto no navegador do cliente. Precisa das
-- colunas da vitrine e de `visivel_vitrine`/`quantidade_atual`/`preco_venda`,
-- que entram no WHERE — no Postgres, filtrar por uma coluna exige privilégio de
-- leitura nela. Fica de fora o que é do salão: custo_medio, estoque_minimo e os
-- campos fiscais (ncm, cfop_padrao, csosn_padrao, cest, origem).
REVOKE ALL ON produtos FROM anon;

GRANT SELECT (
  id,
  salao_id,
  nome_produto,
  categoria,
  subcategoria,
  preco_venda,
  quantidade_atual,
  unidade_medida,
  imagem_url,
  descricao_vitrine,
  visivel_vitrine
) ON produtos TO anon;

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT table_name, column_name
--     FROM information_schema.column_privileges
--    WHERE grantee = 'anon' AND table_name IN ('servicos', 'produtos')
--    ORDER BY table_name, column_name;
--
-- Nenhuma coluna com "custo" ou "comissao" pode aparecer no resultado.
