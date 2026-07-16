-- ============================================================================
-- Módulos fiscais separados: NFS-e e NFC-e como produtos independentes
-- Rodar no Supabase → SQL Editor
-- ============================================================================

-- 1) Garante unicidade de chave no catálogo (idempotente)
create unique index if not exists uq_modulos_catalogo_chave
  on public.modulos_catalogo (chave);

-- 2) Desativa o módulo fiscal combinado (pacote_fiscal) que será substituído pelos dois abaixo
update public.modulos_catalogo
  set ativo = false
  where chave = 'pacote_fiscal';

-- 3) Insere NFS-e e NFC-e como módulos independentes no catálogo
insert into public.modulos_catalogo (chave, nome, descricao, preco_mensal, ativo)
values
  ('nfse', 'NFS-e — Nota Fiscal de Serviço',
   'Emissão automática de NFS-e ao finalizar agendamentos de serviço.',
   49.90, true),
  ('nfce', 'NFC-e — Nota Fiscal de Produto (PDV)',
   'Emissão de NFC-e na venda de produtos pela Vitrine / PDV do salão.',
   39.90, true)
on conflict (chave) do nothing;

-- 4) RPC administrativa para ativar NFS-e e/ou NFC-e de forma independente.
--    Security definer: o admin chama via Supabase client (RLS não bloqueia).
--    Atualiza nfe_config_empresa E mantém saloes.status_fiscal em sincronia.
create or replace function public.admin_ativar_modulo_fiscal(
  p_salao_id     uuid,
  p_nfse         boolean,
  p_nfce         boolean,
  p_company_token text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cnpj text;
begin
  select coalesce(cnpj, '') into v_cnpj from public.saloes where id = p_salao_id;

  if not found then
    raise exception 'Salão não encontrado (id=%)', p_salao_id;
  end if;

  -- Upsert em nfe_config_empresa mantendo company_token existente se não for fornecido
  insert into public.nfe_config_empresa (
    salao_id, cnpj, nfse_ativo, nfce_ativo, company_token,
    certificado_status, atualizado_em
  )
  values (
    p_salao_id, v_cnpj, p_nfse, p_nfce,
    p_company_token,
    'pendente', now()
  )
  on conflict (salao_id) do update
    set nfse_ativo    = p_nfse,
        nfce_ativo    = p_nfce,
        company_token = coalesce(p_company_token, public.nfe_config_empresa.company_token),
        atualizado_em = now();

  -- Mantém saloes.status_fiscal em sincronia (compatibilidade com código existente)
  update public.saloes
    set status_fiscal     = case when p_nfse or p_nfce then 'ativo' else 'inativo' end,
        token_nfse_salao  = coalesce(p_company_token, token_nfse_salao),
        fiscal_ativado_em = case when p_nfse or p_nfce then now() else fiscal_ativado_em end
    where id = p_salao_id;
end;
$$;
