-- Preferência de canal de notificação por cliente (confirmação de
-- agendamento, cadastro, etc). Padrão "whatsapp" — é o canal que já existe
-- de fato hoje; "email" é a alternativa nova (ver src/lib/notificarAgendamento.ts).
alter table clientes
  add column if not exists canal_notificacao_preferido text not null default 'whatsapp';
