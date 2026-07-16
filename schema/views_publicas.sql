-- =============================================================================
-- VIEWS PÚBLICAS — colunas seguras para exposição ao Portal do Cliente (anon)
-- Projeto: Luarys
-- Data: 2026-06-21
--
-- Contexto: RLS do Postgres filtra LINHAS, não COLUNAS. Tabelas operacionais
-- como `servicos` e `profissionais` têm colunas sensíveis (custo_operacional,
-- comissao_padrao, permissoes, servicos_comissoes) que não devem aparecer
-- em nenhuma resposta pública, mesmo que a linha em si seja pública.
-- A solução é apontar o Portal para estas views, não para as tabelas base.
--
-- O Portal já usa /api/portal/dados-agendamento (que aplica select de colunas
-- seguras via service_role). Estas views existem como camada adicional de
-- defesa e para uso em queries diretas futuras do lado do cliente.
-- =============================================================================

-- =============================================================================
-- VIEW: servicos_publico
-- Expõe apenas as colunas que um cliente pode ver ao escolher um serviço.
-- NUNCA incluir: custo_operacional, comissao_padrao, tipo_despesa,
--                valor_despesa, nbs, codigo_municipio, aliquota_iss
-- =============================================================================
CREATE OR REPLACE VIEW servicos_publico AS
SELECT
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
FROM servicos
WHERE exibir_online = true;

GRANT SELECT ON servicos_publico TO anon, authenticated;

-- =============================================================================
-- VIEW: profissionais_publico
-- Expõe apenas as colunas necessárias para o Portal mostrar a equipe e
-- calcular disponibilidade de horário.
-- NUNCA incluir: permissoes, servicos_comissoes, comissao_produtos,
--                cpf, rg, dados_bancarios
-- =============================================================================
CREATE OR REPLACE VIEW profissionais_publico AS
SELECT
  id,
  salao_id,
  nome,
  foto_url,
  ativo,
  produtivo,
  perfil_avancado
  -- horarios ficam em perfil_avancado->>'horarios' (não é coluna separada)
  -- servicos_habilitados não existe como coluna
FROM profissionais
WHERE ativo = true AND produtivo = true;

GRANT SELECT ON profissionais_publico TO anon, authenticated;

-- =============================================================================
-- VIEW: saloes_publico
-- Expõe apenas as colunas operacionais necessárias para o Portal do Cliente.
-- NUNCA incluir: pin_gerente, config_fiscal, cnpj, inscricao_municipal,
--                acesso_total, limite_profissionais, preco_legado, plano_chave,
--                ambiente_demo, api_whatsapp_liberada, modulo_fiscal_liberado
-- =============================================================================
CREATE OR REPLACE VIEW saloes_publico AS
SELECT
  id,
  slug,
  nome_fantasia,
  telefone,
  horarios_funcionamento,
  cobrar_sinal,
  porcentagem_sinal,
  logradouro,
  numero,
  complemento,
  bairro,
  cidade,
  estado,
  cep,
  sobre_nos,
  politica_cancelamento,
  instagram,
  site
FROM saloes;

GRANT SELECT ON saloes_publico TO anon, authenticated;
