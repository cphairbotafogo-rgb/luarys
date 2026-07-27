-- 20260728f_nfe_config_empresa_versionar.sql
--
-- Fecha a última ponta solta da auditoria de RPCs órfãs (20260727): a
-- migration anterior versionou admin_ativar_modulo_fiscal/obter_status_fiscal,
-- mas NÃO a tabela nfe_config_empresa que essas funções leem/escrevem — nem
-- nfe_emissoes_log, nem as 3 RPCs de certificado que também dependem dela
-- (registrar_certificado_fiscal, validar_certificado_fiscal,
-- ativar_producao_fiscal). Tudo isso só existia em src/lib/migrations/004 e
-- 006 — pasta legada, que o Supabase CLI não lê. Sem esta migration, recriar
-- o banco só a partir de supabase/migrations/ deixaria as RPCs fiscais já
-- versionadas quebradas (tabela referenciada não existiria).

-- ─── 1. Configuração fiscal por salão ────────────────────────────────────────
create table if not exists public.nfe_config_empresa (
  salao_id uuid primary key references public.saloes(id) on delete cascade,
  cnpj     text not null,

  -- CompanyToken criptografado na aplicação (nunca em texto puro no banco)
  company_token text,
  ambiente      text not null default 'homologacao'
    check (ambiente in ('homologacao', 'producao')),

  nfse_ativo       boolean not null default false,
  nfse_faturamento text check (nfse_faturamento in ('direto', 'centralizado')),
  nfse_ativado_em  timestamptz,

  nfce_ativo       boolean not null default false,
  nfce_faturamento text check (nfce_faturamento in ('direto', 'centralizado')),
  nfce_ativado_em  timestamptz,

  certificado_status    text not null default 'pendente'
    check (certificado_status in ('pendente', 'enviado', 'valido', 'expirado', 'invalido')),
  certificado_validade   date,
  certificado_enviado_em timestamptz,

  atualizado_em timestamptz not null default now()
);

comment on table public.nfe_config_empresa is
  'Configuração fiscal de cada salão junto ao provedor Brasil NF-e. Um registro por CNPJ (salão).';

-- ─── 2. Log de emissões (auditoria NFS-e/NFC-e) ──────────────────────────────
-- Distinto de nfce_emissoes (20260727_nfce_numero_atomico_persistencia.sql):
-- aquela é o registro operacional por tentativa de emissão de NFC-e com
-- numeração atômica; esta é o log de auditoria histórico dos dois tipos.
create table if not exists public.nfe_emissoes_log (
  id               uuid primary key default gen_random_uuid(),
  salao_id         uuid not null references public.saloes(id) on delete cascade,
  tipo             text not null check (tipo in ('nfse', 'nfce')),
  numero_documento text,
  chave_acesso     text,
  status           text not null check (status in ('emitida', 'rejeitada', 'cancelada')),
  valor            numeric(10,2),
  agendamento_id   uuid references public.agendamentos(id) on delete set null,
  venda_vitrine_id uuid,
  criado_em        timestamptz not null default now()
);

create index if not exists idx_nfe_emissoes_salao
  on public.nfe_emissoes_log (salao_id, criado_em desc);

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────
alter table public.nfe_config_empresa enable row level security;
alter table public.nfe_emissoes_log   enable row level security;

-- SELECT direto em nfe_config_empresa fica sem policy de propósito:
-- company_token ficaria exposto ao browser. Leitura do client passa pela RPC
-- obter_status_fiscal (security invoker, só devolve colunas sem segredo).

drop policy if exists "salao_le_proprio_log_fiscal" on public.nfe_emissoes_log;
create policy "salao_le_proprio_log_fiscal"
  on public.nfe_emissoes_log for select
  using (salao_id = auth_salao_id());

-- Sem policy de insert/update direto — toda escrita passa pelo backend
-- (service role), que é quem fala com a API do provedor.

-- ─── 4. RPCs de certificado A1 (chamadas só pelo backend) ───────────────────

create or replace function public.registrar_certificado_fiscal(
  p_salao_id uuid,
  p_validade date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.nfe_config_empresa where salao_id = p_salao_id) then
    raise exception 'Configuração fiscal não encontrada para este salão (salao_id=%)', p_salao_id;
  end if;

  update public.nfe_config_empresa
    set certificado_status     = 'enviado',
        certificado_validade   = p_validade,
        certificado_enviado_em = now(),
        atualizado_em          = now()
    where salao_id = p_salao_id;
end;
$$;

create or replace function public.validar_certificado_fiscal(
  p_salao_id uuid,
  p_validade date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.nfe_config_empresa where salao_id = p_salao_id) then
    raise exception 'Configuração fiscal não encontrada para este salão (salao_id=%)', p_salao_id;
  end if;

  update public.nfe_config_empresa
    set certificado_status   = 'valido',
        certificado_validade = p_validade,
        atualizado_em        = now()
    where salao_id = p_salao_id;
end;
$$;

create or replace function public.ativar_producao_fiscal(
  p_salao_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config record;
begin
  select * into v_config from public.nfe_config_empresa where salao_id = p_salao_id;

  if not found then
    raise exception 'Configuração fiscal não encontrada para este salão';
  end if;

  if v_config.certificado_status != 'valido' then
    raise exception 'Certificado A1 deve estar válido antes de ativar produção';
  end if;

  update public.nfe_config_empresa
    set ambiente = 'producao', atualizado_em = now()
    where salao_id = p_salao_id;
end;
$$;

-- Só o backend (service_role) chama estas 3 — nunca o cliente direto.
revoke all on function public.registrar_certificado_fiscal(uuid, date) from public, anon, authenticated;
grant execute on function public.registrar_certificado_fiscal(uuid, date) to service_role;

revoke all on function public.validar_certificado_fiscal(uuid, date) from public, anon, authenticated;
grant execute on function public.validar_certificado_fiscal(uuid, date) to service_role;

revoke all on function public.ativar_producao_fiscal(uuid) from public, anon, authenticated;
grant execute on function public.ativar_producao_fiscal(uuid) to service_role;

-- ─── 5. Catálogo NFS-e/NFC-e como módulos independentes (idempotente) ───────
create unique index if not exists uq_modulos_catalogo_chave
  on public.modulos_catalogo (chave);

update public.modulos_catalogo
  set ativo = false
  where chave = 'pacote_fiscal';

insert into public.modulos_catalogo (chave, nome, descricao, preco_mensal, ativo)
values
  ('nfse', 'NFS-e — Nota Fiscal de Serviço',
   'Emissão automática de NFS-e ao finalizar agendamentos de serviço.',
   49.90, true),
  ('nfce', 'NFC-e — Nota Fiscal de Produto (PDV)',
   'Emissão de NFC-e na venda de produtos pela Vitrine / PDV do salão.',
   39.90, true)
on conflict (chave) do nothing;
