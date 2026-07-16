-- Reorganização: planos definem vagas, módulos definem funcionalidades.
-- Insere todos os módulos no catálogo (preços a definir via painel admin).
-- Migra salões ativos para que não percam acesso existente.

-- ── 1. Garante que a tabela tem coluna "origem" para rastrear de onde veio ──
ALTER TABLE salao_modulos
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'pagamento';

-- ── 2. Insere todos os módulos no catálogo ────────────────────────────────
INSERT INTO modulos_catalogo (chave, nome, descricao, preco_mensal, preco_anual, ativo)
VALUES
  ('fiscal',       'Módulo Fiscal',         'Emissão de NFS-e e NFC-e integrada ao salão.',                       0, NULL, true),
  ('comunicacao',  'Módulo Comunicação',    'Automações WhatsApp: confirmações, lembretes e campanhas.',           0, NULL, true),
  ('crescimento',  'Luarys Cresce',         'Painel de metas, análise de desempenho e crescimento do salão.',      0, NULL, true),
  ('precificacao', 'Luarys Precifica',      'Calculadora de precificação e diagnóstico de lucratividade.',         0, NULL, true),
  ('financeiro',   'Módulo Financeiro',     'DRE, fluxo de caixa, lançamentos manuais e conciliação.',            0, NULL, true),
  ('relatorios',   'Módulo Relatórios',     'Relatórios avançados de atendimentos, faturamento e equipe.',        0, NULL, true),
  ('estoque',      'Módulo Estoque',        'Controle de produtos, compras e alertas de estoque mínimo.',         0, NULL, true),
  ('fidelidade',   'Programa de Fidelidade','Sistema de pontos e recompensas para fidelizar clientes.',           0, NULL, false)
ON CONFLICT (chave) DO NOTHING;

-- ── 3. Migração de salões ativos: mantém acesso que já tinham ────────────
-- Salões com plano ativo recebem todos os módulos padrão (retrocompatibilidade).
INSERT INTO salao_modulos (salao_id, modulo_chave, ativo, origem, ativado_em)
SELECT s.id, m.chave, true, 'migracao_plano', now()
FROM saloes s
CROSS JOIN (
  VALUES ('financeiro'), ('relatorios'), ('estoque'), ('crescimento'), ('precificacao')
) AS m(chave)
WHERE s.status_assinatura = 'ativo'
ON CONFLICT (salao_id, modulo_chave) DO NOTHING;

-- Salões com módulo fiscal legado → módulo fiscal
INSERT INTO salao_modulos (salao_id, modulo_chave, ativo, origem, ativado_em)
SELECT id, 'fiscal', true, 'migracao_legado', now()
FROM saloes
WHERE modulo_fiscal_liberado = true
ON CONFLICT (salao_id, modulo_chave) DO NOTHING;

-- Salões com WhatsApp legado → módulo comunicação
INSERT INTO salao_modulos (salao_id, modulo_chave, ativo, origem, ativado_em)
SELECT id, 'comunicacao', true, 'migracao_legado', now()
FROM saloes
WHERE api_whatsapp_liberada = true
ON CONFLICT (salao_id, modulo_chave) DO NOTHING;

-- Salões ativo com plano que já incluía comunicação (profissional, premium, escala, enterprise)
INSERT INTO salao_modulos (salao_id, modulo_chave, ativo, origem, ativado_em)
SELECT id, 'comunicacao', true, 'migracao_plano', now()
FROM saloes
WHERE status_assinatura = 'ativo'
  AND plano_chave IN ('profissional', 'premium', 'escala', 'enterprise')
ON CONFLICT (salao_id, modulo_chave) DO NOTHING;

-- Salões ativo com plano que já incluía fiscal (premium, escala, enterprise)
INSERT INTO salao_modulos (salao_id, modulo_chave, ativo, origem, ativado_em)
SELECT id, 'fiscal', true, 'migracao_plano', now()
FROM saloes
WHERE status_assinatura = 'ativo'
  AND plano_chave IN ('premium', 'escala', 'enterprise')
ON CONFLICT (salao_id, modulo_chave) DO NOTHING;
