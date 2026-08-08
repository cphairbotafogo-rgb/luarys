-- Migration: setores_salao
-- Cria tabela de setores por salão e migra dados existentes da coluna servicos.setor
-- Execute no SQL Editor do Supabase. Não apaga nenhum dado existente.

create table if not exists setores_salao (
  id         uuid primary key default gen_random_uuid(),
  salao_id   uuid not null references saloes(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique(salao_id, nome)
);

alter table setores_salao enable row level security;

drop policy if exists "setores_salao_proprio" on setores_salao;
create policy "setores_salao_proprio" on setores_salao
  using  (salao_id = auth_salao_id())
  with check (salao_id = auth_salao_id());

-- Importa todos os setores que já existem nos serviços (preserva dados históricos)
insert into setores_salao (salao_id, nome)
select distinct salao_id, trim(setor)
from   servicos
where  setor is not null and trim(setor) <> ''
on conflict (salao_id, nome) do nothing;
