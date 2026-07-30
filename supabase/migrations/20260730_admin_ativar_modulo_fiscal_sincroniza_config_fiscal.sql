-- admin_ativar_modulo_fiscal gravava o CompanyToken só em saloes.token_nfse_salao
-- e nfe_config_empresa.company_token — mas a emissão real de NFS-e/NFC-e
-- (src/lib/nfse/index.ts resolverToken, src/lib/fiscal/shared.ts) sempre leu
-- de saloes.config_fiscal->>'brasilnfe_company_token', um campo diferente.
-- Resultado: mesmo depois de "ativar" um salão nessa tela, a emissão não
-- achava o token. Corrigido para os dois lados ficarem sincronizados:
--   - Se p_company_token vier preenchido (colagem manual), grava nos três lugares.
--   - Se vier vazio, tenta usar o token que já está em config_fiscal (cadastro
--     automático via /api/admin/brasilnfe/cadastrar já preenche esse campo).
create or replace function public.admin_ativar_modulo_fiscal(
  p_salao_id uuid, p_nfse boolean, p_nfce boolean, p_company_token text default null::text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cnpj text;
  v_token text;
begin
  select coalesce(cnpj, ''), config_fiscal->>'brasilnfe_company_token'
    into v_cnpj, v_token
    from public.saloes where id = p_salao_id;

  if not found then
    raise exception 'Salão não encontrado (id=%)', p_salao_id;
  end if;

  v_token := coalesce(nullif(p_company_token, ''), v_token);

  insert into public.nfe_config_empresa (
    salao_id, cnpj, nfse_ativo, nfce_ativo, company_token,
    certificado_status, atualizado_em
  )
  values (
    p_salao_id, v_cnpj, p_nfse, p_nfce,
    v_token,
    'pendente', now()
  )
  on conflict (salao_id) do update
    set nfse_ativo    = p_nfse,
        nfce_ativo    = p_nfce,
        company_token = coalesce(v_token, public.nfe_config_empresa.company_token),
        atualizado_em = now();

  update public.saloes
    set status_fiscal     = case when p_nfse or p_nfce then 'ativo' else 'inativo' end,
        token_nfse_salao  = coalesce(v_token, token_nfse_salao),
        fiscal_ativado_em = case when p_nfse or p_nfce then now() else fiscal_ativado_em end,
        config_fiscal     = coalesce(config_fiscal, '{}'::jsonb)
                             || jsonb_build_object('brasilnfe_company_token', coalesce(v_token, config_fiscal->>'brasilnfe_company_token'))
    where id = p_salao_id;
end;
$function$;

revoke all on function public.admin_ativar_modulo_fiscal(uuid, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_ativar_modulo_fiscal(uuid, boolean, boolean, text) to service_role;
