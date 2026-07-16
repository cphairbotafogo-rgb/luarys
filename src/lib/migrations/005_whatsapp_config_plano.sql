-- ============================================================================
-- Módulo WhatsApp: tabela de planos e credenciais por salão
-- Suporta Plano A (Turnkey Pré-pago) e Plano B (Gestão Meta).
-- Rodar no Supabase → SQL Editor
-- ============================================================================

-- Registra qual plano cada salão escolheu e as credenciais de provisionamento.
-- token_criptografado: nunca em texto puro. Criptografado na camada Next.js
--   (AES-256-GCM, chave em WHATSAPP_TOKEN_ENCRYPTION_KEY) antes de salvar.
create table if not exists public.whatsapp_config_plano (
  salao_id uuid primary key references public.saloes(id) on delete cascade,

  -- 'turnkey_prepago' = Plano A (requer Solution Partner Meta — crédito compartilhado)
  -- 'gestao_meta'     = Plano B (token próprio do salão, Meta cobra o salão direto)
  plano text not null check (plano in ('turnkey_prepago', 'gestao_meta')),

  -- Credenciais do sub-WABA do salão (preenchidas após provisionamento)
  waba_id         text,
  phone_number_id text,

  -- Token criptografado na aplicação (formato: iv:authTag:ciphertext, todos em hex).
  -- Nunca expor ao front-end. Descriptografar somente nas rotas de API server-side.
  token_criptografado text,

  -- Plano A: true quando a linha de crédito do Luarys está compartilhada com o sub-WABA.
  -- Plano B: sempre false (o salão tem cartão próprio na Meta).
  linha_credito_compartilhada boolean not null default false,

  -- Plano B: mensalidade cobrada pelo Luarys (R$) pela gestão do sub-WABA.
  mensalidade_gestao numeric(10,2),

  ativo         boolean not null default true,
  provisionado_em timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on column public.whatsapp_config_plano.token_criptografado is
  'Token de System User permanente do salão, criptografado com AES-256-GCM. '
  'Descriptografar somente no servidor (nunca expor ao browser).';

comment on column public.whatsapp_config_plano.linha_credito_compartilhada is
  'true somente no Plano A após aprovação da Luarys como Solution Partner da Meta. '
  'Plano B mantém sempre false — o salão paga a Meta diretamente.';

-- RLS: salão só lê/altera a própria linha
alter table public.whatsapp_config_plano enable row level security;

drop policy if exists "salao_le_proprio_plano" on public.whatsapp_config_plano;
create policy "salao_le_proprio_plano"
  on public.whatsapp_config_plano for select
  using (salao_id = auth_salao_id());

-- Escrita (insert/update) somente via backend com service role.
-- Nenhuma policy de write para o cliente — evita manipulação direta de credenciais.
