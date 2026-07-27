-- Créditos WhatsApp: agora o salão pode escolher entre pagamento único
-- (já existia) ou assinatura mensal recorrente (novo — mesma faixa de
-- créditos, cobrada e creditada automaticamente todo mês, igual ao Trinks).
--
-- Essa tabela rastreia a subscription ativa no Asaas por salão+pacote —
-- necessária pra: (1) impedir criar uma segunda assinatura duplicada pro
-- mesmo pacote, (2) permitir cancelar a recorrência depois. O crédito em si
-- continua sendo feito pelo webhook por pagamento_externo_id (idempotente),
-- sem mudança — cada fatura mensal tem um id novo, então credita de novo a
-- cada ciclo naturalmente.
create table if not exists whatsapp_assinaturas_creditos (
  id uuid primary key default gen_random_uuid(),
  salao_id uuid not null references saloes(id) on delete cascade,
  pacote_id uuid not null references whatsapp_pacotes(id),
  asaas_subscription_id text not null unique,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  cancelada_em timestamptz
);

create index if not exists whatsapp_assinaturas_creditos_salao_idx
  on whatsapp_assinaturas_creditos (salao_id, pacote_id)
  where ativa = true;

alter table whatsapp_assinaturas_creditos enable row level security;

-- Mesmo padrão de acesso das outras tabelas de créditos: só service_role
-- (rotas server-side) lê/escreve; o salão nunca acessa direto pelo client.
drop policy if exists "service_role_all" on whatsapp_assinaturas_creditos;
create policy "service_role_all" on whatsapp_assinaturas_creditos
  for all to service_role using (true) with check (true);
