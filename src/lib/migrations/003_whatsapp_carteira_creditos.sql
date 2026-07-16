-- ============================================================================
-- Módulo: Carteira de Créditos WhatsApp (pré-pago, modelo Plano A)
-- Rodar no Supabase → SQL Editor
-- ============================================================================

-- 1) Carteira de créditos por salão -------------------------------------------
create table if not exists public.whatsapp_carteira_creditos (
  salao_id            uuid primary key references public.saloes(id) on delete cascade,
  saldo_atendimento   integer not null default 0,
  saldo_campanha      integer not null default 0,
  atualizado_em       timestamptz not null default now()
);

-- 2) Catálogo de pacotes -------------------------------------------------------
create table if not exists public.whatsapp_pacotes (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('atendimento', 'campanha')),
  quantidade  integer not null,
  preco       numeric(10,2) not null,
  ativo       boolean not null default true
);

-- Índice único necessário para que ON CONFLICT funcione: a PK é gen_random_uuid()
-- e nunca conflita. Sem este índice, cada re-execução da migration duplicaria os pacotes.
create unique index if not exists uq_whatsapp_pacotes_tipo_qtd
  on public.whatsapp_pacotes (tipo, quantidade);

insert into public.whatsapp_pacotes (tipo, quantidade, preco) values
  ('atendimento', 500,  35.00),
  ('atendimento', 1000, 70.00),
  ('atendimento', 3000, 210.00),
  ('campanha',    100,  55.00),
  ('campanha',    500,  275.00)
on conflict (tipo, quantidade) do nothing;

-- 3) Histórico de compras ------------------------------------------------------
create table if not exists public.whatsapp_compras_creditos (
  id              uuid primary key default gen_random_uuid(),
  salao_id        uuid not null references public.saloes(id) on delete cascade,
  pacote_id       uuid not null references public.whatsapp_pacotes(id),
  quantidade      integer not null,
  preco_pago      numeric(10,2) not null,
  meio_pagamento  text not null check (meio_pagamento in ('pix', 'cartao_credito', 'cartao_debito')),
  criado_em       timestamptz not null default now()
);

-- 4) Log de mensagens ----------------------------------------------------------
create table if not exists public.whatsapp_mensagens_log (
  id                   uuid primary key default gen_random_uuid(),
  salao_id             uuid not null references public.saloes(id) on delete cascade,
  sub_waba_id          text not null,
  categoria            text not null check (categoria in ('servico', 'utilidade', 'marketing', 'autenticacao')),
  categoria_solicitada text,
  origem               text not null default 'atendimento' check (origem in ('atendimento', 'campanha', 'automatico')),
  custo_unitario       numeric(10,4) not null,
  meta_message_id      text,
  cliente_id           uuid references public.clientes(id) on delete set null,
  campanha_id          uuid,
  criado_em            timestamptz not null default now()
);

create index if not exists idx_whatsapp_log_salao_mes
  on public.whatsapp_mensagens_log (salao_id, criado_em desc);

-- 5) RLS -----------------------------------------------------------------------
alter table public.whatsapp_carteira_creditos  enable row level security;
alter table public.whatsapp_compras_creditos   enable row level security;
alter table public.whatsapp_mensagens_log      enable row level security;
alter table public.whatsapp_pacotes            enable row level security;

drop policy if exists "salao_le_propria_carteira"  on public.whatsapp_carteira_creditos;
create policy "salao_le_propria_carteira"
  on public.whatsapp_carteira_creditos for select
  using (salao_id = auth_salao_id());

drop policy if exists "salao_le_propria_compras" on public.whatsapp_compras_creditos;
create policy "salao_le_propria_compras"
  on public.whatsapp_compras_creditos for select
  using (salao_id = auth_salao_id());

drop policy if exists "salao_le_proprio_log" on public.whatsapp_mensagens_log;
create policy "salao_le_proprio_log"
  on public.whatsapp_mensagens_log for select
  using (salao_id = auth_salao_id());

drop policy if exists "todos_leem_pacotes_ativos" on public.whatsapp_pacotes;
create policy "todos_leem_pacotes_ativos"
  on public.whatsapp_pacotes for select
  using (ativo = true);

-- 6) RPC: comprar pacote (chamada do cliente — usa auth_salao_id() internamente)
-- Sem p_salao_id para evitar que o cliente manipule o saldo de outro salão.
create or replace function public.comprar_pacote_whatsapp(
  p_pacote_id      uuid,
  p_meio_pagamento text
)
returns table (saldo_atendimento integer, saldo_campanha integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salao_id uuid := auth_salao_id();
  v_pacote   record;
begin
  if v_salao_id is null then
    raise exception 'Sessão inválida';
  end if;

  select * into v_pacote from public.whatsapp_pacotes where id = p_pacote_id and ativo = true;
  if not found then
    raise exception 'Pacote não encontrado ou inativo';
  end if;

  insert into public.whatsapp_carteira_creditos (salao_id, saldo_atendimento, saldo_campanha)
  values (v_salao_id, 0, 0)
  on conflict (salao_id) do nothing;

  if v_pacote.tipo = 'atendimento' then
    update public.whatsapp_carteira_creditos
      set saldo_atendimento = saldo_atendimento + v_pacote.quantidade, atualizado_em = now()
      where salao_id = v_salao_id;
  else
    update public.whatsapp_carteira_creditos
      set saldo_campanha = saldo_campanha + v_pacote.quantidade, atualizado_em = now()
      where salao_id = v_salao_id;
  end if;

  insert into public.whatsapp_compras_creditos (salao_id, pacote_id, quantidade, preco_pago, meio_pagamento)
  values (v_salao_id, p_pacote_id, v_pacote.quantidade, v_pacote.preco, p_meio_pagamento);

  return query
    select c.saldo_atendimento, c.saldo_campanha
    from public.whatsapp_carteira_creditos c
    where c.salao_id = v_salao_id;
end;
$$;

-- 7) RPC: debitar crédito (chamada do backend com service role — mantém p_salao_id)
create or replace function public.debitar_credito_whatsapp(
  p_salao_id           uuid,
  p_sub_waba_id        text,
  p_categoria          text,
  p_origem             text,
  p_custo_unitario     numeric,
  p_categoria_solicitada text default null,
  p_meta_message_id    text default null,
  p_cliente_id         uuid default null,
  p_campanha_id        uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carteira record;
  v_coluna   text := case when p_origem = 'campanha' then 'saldo_campanha' else 'saldo_atendimento' end;
begin
  select * into v_carteira from public.whatsapp_carteira_creditos where salao_id = p_salao_id for update;

  if not found
    or (v_coluna = 'saldo_atendimento' and v_carteira.saldo_atendimento <= 0)
    or (v_coluna = 'saldo_campanha'    and v_carteira.saldo_campanha    <= 0)
  then
    return false;
  end if;

  if v_coluna = 'saldo_atendimento' then
    update public.whatsapp_carteira_creditos
      set saldo_atendimento = saldo_atendimento - 1, atualizado_em = now()
      where salao_id = p_salao_id;
  else
    update public.whatsapp_carteira_creditos
      set saldo_campanha = saldo_campanha - 1, atualizado_em = now()
      where salao_id = p_salao_id;
  end if;

  insert into public.whatsapp_mensagens_log (
    salao_id, sub_waba_id, categoria, categoria_solicitada,
    origem, custo_unitario, meta_message_id, cliente_id, campanha_id
  ) values (
    p_salao_id, p_sub_waba_id, p_categoria, p_categoria_solicitada,
    p_origem, p_custo_unitario, p_meta_message_id, p_cliente_id, p_campanha_id
  );

  return true;
end;
$$;

-- 8) RPCs de consulta (client-side, security invoker) -------------------------
create or replace function public.obter_saldo_whatsapp()
returns table (saldo_atendimento integer, saldo_campanha integer)
language sql stable security invoker set search_path = public
as $$
  select coalesce(saldo_atendimento, 0), coalesce(saldo_campanha, 0)
  from public.whatsapp_carteira_creditos
  where salao_id = auth_salao_id();
$$;

create or replace function public.obter_consumo_whatsapp_mes(
  p_mes date default date_trunc('month', now())::date
)
returns table (categoria text, origem text, quantidade bigint, custo_total numeric)
language sql stable security invoker set search_path = public
as $$
  select categoria, origem, count(*), sum(custo_unitario)
  from public.whatsapp_mensagens_log
  where salao_id = auth_salao_id()
    and criado_em >= p_mes
    and criado_em < (p_mes + interval '1 month')
  group by categoria, origem
  order by categoria, origem;
$$;
