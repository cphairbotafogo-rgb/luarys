-- 20260708_clube_modulo_catalogo.sql
--
-- Registra o Clube de Assinaturas como MÓDULO liberável pelo admin.
-- O painel admin (AbaCatalogo + ModalModulosSalao) lê modulos_catalogo
-- dinamicamente, então só inserir a chave aqui já faz o módulo aparecer:
--   - no editor de catálogo (nome/descrição/preço)
--   - no toggle "módulos deste salão" por empresa
--
-- Fica desligado por padrão em cada salão (nada em salao_modulos), então o
-- Clube só aparece pro dono depois que o admin liberar (ou o salão contratar).
-- Preço inicial 0 — ajustar no painel admin.

INSERT INTO modulos_catalogo (chave, nome, descricao, preco_mensal, preco_anual, ativo)
VALUES
  ('clube_assinaturas', 'Clube de Assinaturas',
   'Planos de mensalidade recorrente para fidelizar clientes (serviços inclusos e descontos).',
   0, NULL, true)
ON CONFLICT (chave) DO NOTHING;
