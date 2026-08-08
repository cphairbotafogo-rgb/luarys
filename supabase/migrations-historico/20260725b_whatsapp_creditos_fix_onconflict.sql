-- Corrige creditar_pacote_whatsapp_pago (20260725_whatsapp_creditos_asaas.sql):
-- o índice único em pagamento_externo_id é PARCIAL (WHERE ... IS NOT NULL),
-- e o Postgres só usa um índice parcial como alvo de ON CONFLICT se a mesma
-- cláusula WHERE for repetida ali — sem isso dá "42P10 no unique or
-- exclusion constraint matching the ON CONFLICT specification" mesmo com o
-- índice existindo. Reproduzido ao vivo: pagamento confirmado no Asaas mas
-- o crédito nunca foi aplicado por causa desse erro.

create or replace function public.creditar_pacote_whatsapp_pago(
  p_salao_id            uuid,
  p_pacote_id           uuid,
  p_meio_pagamento      text,
  p_pagamento_externo_id text
)
returns table (saldo_atendimento integer, saldo_campanha integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pacote  record;
  v_novo_id uuid;
begin
  select * into v_pacote from public.whatsapp_pacotes where id = p_pacote_id and ativo = true;
  if not found then
    raise exception 'Pacote não encontrado ou inativo';
  end if;

  insert into public.whatsapp_carteira_creditos (salao_id, saldo_atendimento, saldo_campanha)
  values (p_salao_id, 0, 0)
  on conflict (salao_id) do nothing;

  insert into public.whatsapp_compras_creditos
    (salao_id, pacote_id, quantidade, preco_pago, meio_pagamento, pagamento_externo_id)
  values
    (p_salao_id, p_pacote_id, v_pacote.quantidade, v_pacote.preco, p_meio_pagamento, p_pagamento_externo_id)
  on conflict (pagamento_externo_id) where pagamento_externo_id is not null do nothing
  returning id into v_novo_id;

  if v_novo_id is not null then
    if v_pacote.tipo = 'atendimento' then
      update public.whatsapp_carteira_creditos
        set saldo_atendimento = saldo_atendimento + v_pacote.quantidade, atualizado_em = now()
        where salao_id = p_salao_id;
    else
      update public.whatsapp_carteira_creditos
        set saldo_campanha = saldo_campanha + v_pacote.quantidade, atualizado_em = now()
        where salao_id = p_salao_id;
    end if;
  end if;

  return query
    select c.saldo_atendimento, c.saldo_campanha
    from public.whatsapp_carteira_creditos c
    where c.salao_id = p_salao_id;
end;
$$;

revoke all on function public.creditar_pacote_whatsapp_pago(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.creditar_pacote_whatsapp_pago(uuid, uuid, text, text) to service_role;
