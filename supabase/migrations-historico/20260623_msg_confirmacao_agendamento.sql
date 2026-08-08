-- ============================================================
-- MIGRATION: Template de confirmação de agendamento por salão
-- Data: 2026-06-23
-- ============================================================

-- Cada salão pode personalizar a mensagem de confirmação
-- enviada ao cliente diretamente da agenda (tooltip → WhatsApp).
-- Se NULL, o sistema usa o template padrão embutido no código.
ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS msg_confirmacao_agendamento TEXT;

COMMENT ON COLUMN saloes.msg_confirmacao_agendamento IS
  'Template personalizável de confirmação de agendamento. Suporta placeholders: {nome_do_cliente}, {data}, {horario}, {servico}, {profissional}, {nome_salao}. NULL = usar padrão do sistema.';
