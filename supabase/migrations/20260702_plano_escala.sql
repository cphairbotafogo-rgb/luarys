-- Novo plano "Escala" — entre o Growth (profissional) e o Enterprise.
-- Ideal para salões com equipe maior que já precisam de mais vagas mas
-- ainda não justificam um plano enterprise sob consulta.

-- Garante que o Enterprise fica sempre no final da lista
UPDATE planos SET ordem = 999 WHERE chave = 'enterprise';

-- Insere o plano Escala logo antes do Enterprise
INSERT INTO planos (chave, nome, descricao, limite_profissionais, preco_mensal, preco_anual, ativo, ordem)
VALUES (
  'escala',
  'Escala',
  'Para salões em crescimento — até 8 profissionais, todos os recursos de gestão incluídos.',
  8,       -- vagas de profissionais
  199.00,  -- R$ / mês
  1990.00, -- R$ / ano (aprox. 17% de desconto)
  true,
  (SELECT COALESCE(MAX(ordem), 10) + 10 FROM planos WHERE chave != 'enterprise')
)
ON CONFLICT (chave) DO NOTHING;
