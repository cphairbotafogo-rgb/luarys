-- Portal do Cliente: permite leitura pública dos dados básicos dos salões
-- Necessário para a tela de seleção de salão funcionar sem sessão autenticada.
-- Execute UMA VEZ no Supabase SQL Editor.

-- Policy de leitura pública na tabela saloes (apenas SELECT)
-- Exposição intencional: nome, localização e slug são dados de descoberta pública.
CREATE POLICY "saloes_portal_leitura_publica"
  ON saloes
  FOR SELECT
  USING (true);

-- Permite também que o anon role leia a tabela (caso o client use a chave anon)
GRANT SELECT ON saloes TO anon;
