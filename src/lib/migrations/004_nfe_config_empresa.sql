-- ============================================================================
-- Módulo: Emissão Fiscal (NFS-e / NFC-e) via Brasil NF-e — multi-tenant
-- Rodar no Supabase → SQL Editor
-- Substitui a lógica de saloes.status_fiscal + certificados-a1 (storage)
-- quando a migração estiver completa.
-- ============================================================================

-- 1) Configuração fiscal por salão -------------------------------------------
create table if not exists public.nfe_config_empresa (
  salao_id uuid primary key references public.saloes(id) on delete cascade,
  cnpj     text not null,

  -- CompanyToken criptografado na aplicação (nunca em texto puro no banco)
  company_token text,
  ambiente      text not null default 'homologacao'
    check (ambiente in ('homologacao', 'producao')),

  -- NFS-e (serviços/agendamentos)
  nfse_ativo       boolean not null default false,
  nfse_faturamento text check (nfse_faturamento in ('direto', 'centralizado')),
  nfse_ativado_em  timestamptz,

  -- NFC-e (balcão/PDV — Vitrine de Produtos)
  nfce_ativo       boolean not null default false,
  nfce_faturamento text check (nfce_faturamento in ('direto', 'centralizado')),
  nfce_ativado_em  timestamptz,

  -- Certificado digital A1 (obrigatório para os dois tipos de nota)
  certificado_status    text not null default 'pendente'
    check (certificado_status in ('pendente', 'enviado', 'valido', 'expirado', 'invalido')),
  certificado_validade   date,
  certificado_enviado_em timestamptz,

  atualizado_em timestamptz not null default now()
);

comment on table public.nfe_config_empresa is
  'Configuração fiscal de cada salão junto ao provedor Brasil NF-e. Um registro por CNPJ (salão).';

-- 2) Log de emissões (auditoria) ---------------------------------------------
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

-- 3) RLS ----------------------------------------------------------------------
alter table public.nfe_config_empresa  enable row level security;
alter table public.nfe_emissoes_log    enable row level security;

-- SELECT direto removido: company_token ficaria exposto ao browser.
-- Leitura do client vai pela RPC obter_status_fiscal (security invoker),
-- que retorna apenas as colunas sem segredo.

drop policy if exists "salao_le_proprio_log_fiscal" on public.nfe_emissoes_log;
create policy "salao_le_proprio_log_fiscal"
  on public.nfe_emissoes_log for select
  using (salao_id = auth_salao_id());

-- Sem policy de insert/update direto — toda escrita passa pelo backend
-- (service role), que é quem fala com a API do provedor.

-- 4) RPC: registrar status do certificado (chamada do backend) ---------------
create or replace function public.registrar_certificado_fiscal(
  p_salao_id uuid,
  p_validade  date
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

-- 5) RPC: marcar certificado como válido (chamada do backend após provedor confirmar)
create or replace function public.validar_certificado_fiscal(
  p_salao_id uuid,
  p_validade  date
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

-- 6) RPC: consultar status fiscal do salão logado (client-side) --------------
create or replace function public.obter_status_fiscal()
returns table (
  cnpj                   text,
  ambiente               text,
  nfse_ativo             boolean,
  nfse_faturamento       text,
  nfce_ativo             boolean,
  nfce_faturamento       text,
  certificado_status     text,
  certificado_validade   date
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    cnpj, ambiente,
    nfse_ativo, nfse_faturamento,
    nfce_ativo, nfce_faturamento,
    certificado_status, certificado_validade
  from public.nfe_config_empresa
  where salao_id = auth_salao_id();
$$;

-- 7) RPC: ativar produção (chamada do backend após validação completa) --------
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
