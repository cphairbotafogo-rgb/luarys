-- Adiciona coluna pin_gerente na tabela saloes
-- Usada para confirmar ações financeiras sensíveis (estornos, exclusões)

ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS pin_gerente TEXT;
