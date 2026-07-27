-- 20260727_nfce_numero_atomico_persistencia.sql
--
-- Corrige dois erros graves do fluxo de NFC-e:
--
-- 1. NUMERAÇÃO NÃO ATÔMICA: a rota /api/nfce/emitir lia proximo_numero e
--    depois gravava numero + 1 em dois passos. Duas emissões simultâneas
--    (dois caixas fechando conta ao mesmo tempo) recebiam o MESMO número —
--    duplicidade de numeração é rejeição garantida na SEFAZ e bagunça a
--    sequência fiscal do salão. A RPC abaixo faz UPDATE ... RETURNING numa
--    única instrução: cada chamada recebe um número exclusivo, sem corrida.
--
-- 2. EMISSÃO SEM REGISTRO LOCAL: o resultado da emissão (chave de acesso,
--    número, links do XML/DANFE) só voltava na resposta HTTP — nada era
--    gravado no banco. Se o navegador fechasse, existia nota autorizada na
--    SEFAZ sem nenhum rastro no Luarys (o XML precisa ficar recuperável por
--    5 anos). A tabela nfce_emissoes registra TODA tentativa: a rota insere
--    com status 'processando' ANTES de chamar a Focus NFe e atualiza depois.
--    Nota: NÃO usar a tabela notas_fiscais para isso — ela é do fluxo de
--    NFS-e e alimenta a cota mensal de 150 notas do módulo de serviço.

-- ─── 1. RPC atômica de numeração ────────────────────────────────────────────

create or replace function public.obter_proximo_numero_nfce(p_salao_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.configuracoes_nfce_produtos
     set proximo_numero = coalesce(proximo_numero, 1) + 1
   where salao_id = p_salao_id
   returning coalesce(proximo_numero, 2) - 1;
$$;

comment on function public.obter_proximo_numero_nfce(uuid) is
  'Reserva e devolve o próximo número sequencial de NFC-e do salão de forma atômica. Retorna NULL se o salão não tiver linha em configuracoes_nfce_produtos.';

-- Só o servidor (service_role) pode reservar número — cliente nunca chama direto.
revoke all on function public.obter_proximo_numero_nfce(uuid) from public, anon, authenticated;
grant execute on function public.obter_proximo_numero_nfce(uuid) to service_role;

-- ─── 2. Persistência das emissões de NFC-e ──────────────────────────────────

create table if not exists public.nfce_emissoes (
  id             uuid primary key default gen_random_uuid(),
  salao_id       uuid not null references public.saloes(id) on delete cascade,
  referencia     text not null unique,          -- ref enviada à Focus NFe ("nfce-<salao>-<numero>")
  numero         integer not null,
  serie          text,
  status         text not null default 'processando',
                 -- 'processando' | 'autorizado' | 'erro' | 'cancelado'
  chave_acesso   text,                          -- 44 caracteres [A-Z0-9] (CNPJ alfanumérico!)
  link_danfe     text,
  link_xml       text,
  mensagem_erro  text,
  valor_total    numeric(12,2),
  payload        jsonb,                         -- payload enviado à Focus (auditoria/reprocesso)
  os_numero      text,                          -- vínculo com a O.S. do fechamento, quando houver
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

comment on table public.nfce_emissoes is
  'Registro de toda tentativa de emissão de NFC-e (PDV/produtos). Inserido antes da chamada à Focus NFe e atualizado com o resultado — nunca deve existir NFC-e autorizada na SEFAZ sem linha aqui.';
comment on column public.nfce_emissoes.chave_acesso is
  'Chave de acesso de 44 caracteres. TEXT de propósito: desde 01/07/2026 aceita letras (CNPJ alfanumérico) — nunca converter para tipo numérico.';

-- Duplicidade de numeração barrada também no banco (última linha de defesa).
create unique index if not exists nfce_emissoes_salao_serie_numero_uidx
  on public.nfce_emissoes (salao_id, coalesce(serie, '1'), numero);

create index if not exists nfce_emissoes_salao_status_idx
  on public.nfce_emissoes (salao_id, status);

-- ─── 3. RLS: salão lê as próprias notas; só o servidor escreve ──────────────

alter table public.nfce_emissoes enable row level security;

drop policy if exists nfce_emissoes_select_proprio_salao on public.nfce_emissoes;
create policy nfce_emissoes_select_proprio_salao
  on public.nfce_emissoes
  for select
  to authenticated
  using (salao_id = public.auth_salao_id());

-- Nenhuma policy de INSERT/UPDATE/DELETE para authenticated/anon:
-- escrita acontece apenas via service_role nas rotas de API.

-- ─── 4. Trigger de atualizado_em ────────────────────────────────────────────

create or replace function public.nfce_emissoes_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_nfce_emissoes_touch on public.nfce_emissoes;
create trigger trg_nfce_emissoes_touch
  before update on public.nfce_emissoes
  for each row execute function public.nfce_emissoes_touch();
