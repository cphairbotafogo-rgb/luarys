-- Segunda tentativa de corrigir creditar_pacote_whatsapp_pago. A 20260725b
-- tentou resolver com "ON CONFLICT (col) WHERE col IS NOT NULL DO NOTHING"
-- pra casar com o índice parcial — mas mesmo com sintaxe válida, o Postgres
-- continuou sem inferir o índice como alvo (42P10) na prática.
--
-- Simplifica trocando o índice parcial por um índice único comum: em
-- Postgres, UNIQUE sem WHERE já permite múltiplos NULL (não conflitam entre
-- si), então não havia necessidade real do WHERE — só complicou a
-- inferência do ON CONFLICT. Com índice comum, "ON CONFLICT (col) DO
-- NOTHING" simples funciona sem ambiguidade.

drop index if exists whatsapp_compras_creditos_pagamento_externo_id_key;

create unique index if not exists whatsapp_compras_creditos_pagamento_externo_id_key
  on whatsapp_compras_creditos (pagamento_externo_id);

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
  on conflict (pagamento_externo_id) do nothing
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
