-- C1: Restringir colunas visíveis ao papel anon em saloes
-- PROBLEMA: policy "portal_anon_le_saloes" fazia FOR SELECT TO anon USING(true)
-- sobre a tabela inteira, expondo token_pagamento, pin_gerente, a1_senha_enc,
-- config_fiscal e outros segredos a qualquer pessoa com a chave anon pública.
-- SOLUÇÃO: revogar SELECT total, conceder só colunas públicas, recriar policy.

-- 1. Remove a policy aberta
DROP POLICY IF EXISTS "portal_anon_le_saloes" ON saloes;

-- 2. Revoga SELECT irrestrito do papel anon
REVOKE SELECT ON saloes FROM anon;

-- 3. Concede SELECT apenas nas colunas que o portal realmente precisa
--    (nenhuma delas contém segredos ou dados financeiros do salão)
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

-- 4. Recria a policy — agora limitada pelas colunas concedidas acima
CREATE POLICY "portal_anon_le_saloes_publico" ON saloes
  FOR SELECT
  TO anon
  USING (true);
