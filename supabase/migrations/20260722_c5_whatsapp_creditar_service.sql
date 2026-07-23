-- C5: RPC de crédito de teste do WhatsApp, chamável apenas por service_role.
--
-- CONTEXTO: comprar_pacote_whatsapp() usa auth_salao_id()/auth.uid() e só
-- funciona com o JWT do próprio usuário logado. A migration
-- 20260717_c3_revoke_admin_rpcs.sql revogou EXECUTE dela de
-- authenticated/anon (correto: ela creditava saldo sem confirmar pagamento
-- real, e qualquer usuário logado podia chamá-la pelo console do navegador
-- para ganhar créditos de graça). Isso fechou a brecha mas também deixou o
-- painel de créditos (ainda sem gateway real integrado) sem nenhum caminho
-- funcional — nem para o uso de teste legítimo.
--
-- Esta função replica a mesma lógica de comprar_pacote_whatsapp, mas recebe
-- p_salao_id explícito em vez de derivar de auth.uid(). Só é segura porque só
-- pode ser chamada por service_role — na prática, apenas através da rota
-- server-side /api/whatsapp/comprar-creditos-teste, que resolve o salao_id
-- do lado do servidor (via autenticarRota, nunca do body do cliente) e exige
-- a env var WHATSAPP_CREDITO_TESTE_HABILITADO=true (fail-closed por padrão).
-- Não habilitar essa env var em produção com salões reais antes de existir
-- um gateway de pagamento real integrado.

create or replace function public.creditar_pacote_whatsapp_service(
  p_salao_id       uuid,
  p_pacote_id      uuid,
  p_meio_pagamento text
)
returns table (saldo_atendimento integer, saldo_campanha integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pacote record;
begin
  select * into v_pacote from public.whatsapp_pacotes where id = p_pacote_id and ativo = true;
  if not found then
    raise exception 'Pacote não encontrado ou inativo';
  end if;

  insert into public.whatsapp_carteira_creditos (salao_id, saldo_atendimento, saldo_campanha)
  values (p_salao_id, 0, 0)
  on conflict (salao_id) do nothing;

  if v_pacote.tipo = 'atendimento' then
    update public.whatsapp_carteira_creditos
      set saldo_atendimento = saldo_atendimento + v_pacote.quantidade, atualizado_em = now()
      where salao_id = p_salao_id;
  else
    update public.whatsapp_carteira_creditos
      set saldo_campanha = saldo_campanha + v_pacote.quantidade, atualizado_em = now()
      where salao_id = p_salao_id;
  end if;

  insert into public.whatsapp_compras_creditos (salao_id, pacote_id, quantidade, preco_pago, meio_pagamento)
  values (p_salao_id, p_pacote_id, v_pacote.quantidade, v_pacote.preco, p_meio_pagamento);

  return query
    select c.saldo_atendimento, c.saldo_campanha
    from public.whatsapp_carteira_creditos c
    where c.salao_id = p_salao_id;
end;
$$;

revoke all on function public.creditar_pacote_whatsapp_service(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.creditar_pacote_whatsapp_service(uuid, uuid, text) to service_role;
