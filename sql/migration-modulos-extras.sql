-- ============================================================
-- Migration: Módulos extras no catálogo
-- Rodar no Supabase > SQL Editor
-- ============================================================

INSERT INTO modulos_catalogo (chave, nome, descricao, preco_mensal, ativo)
VALUES
  ('comunicacao',      'Central de Comunicação',    'Campanhas de WhatsApp e e-mail, automações de aniversário e textos padrões.',   39.90, true),
  ('precificacao',     'Luarys Precifica',           'Calculadora de precificação com base em custos reais, comissão e margem.',        29.90, true),
  ('no_show',         'Garantia de Reserva',        'Taxa de reserva antecipada para reduzir faltas e cancelamentos de última hora.',  29.90, true),
  ('lembrete_premium','Lembrete Premium',            'Lembretes automáticos por WhatsApp com confirmação de presença antes do horário.',19.90, true)
ON CONFLICT (chave) DO UPDATE SET
  nome      = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  ativo     = true;
