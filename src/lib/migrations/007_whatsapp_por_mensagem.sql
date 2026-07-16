-- ============================================================================
-- 007_whatsapp_por_mensagem.sql
-- Adaptação ao modelo por mensagem da Meta (vigente desde julho/2025).
--
-- O sistema antigo (salao_whatsapp_pacote + whatsapp_conversas + whatsapp_uso)
-- é mantido por compatibilidade histórica mas não é mais lido pelo código.
-- O sistema novo usa whatsapp_carteira_creditos (migration 003).
--
-- Esta migration apenas adiciona a RPC de restauração de crédito,
-- necessária quando a Meta reporta falha na entrega via webhook.
-- ============================================================================

create or replace function public.restaurar_credito_whatsapp(
  p_wamid text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log record;
begin
  select salao_id, origem
    into v_log
    from public.whatsapp_mensagens_log
    where meta_message_id = p_wamid
    limit 1;

  if not found then return false; end if;

  if v_log.origem = 'campanha' then
    update public.whatsapp_carteira_creditos
      set saldo_campanha = saldo_campanha + 1, atualizado_em = now()
      where salao_id = v_log.salao_id;
  else
    update public.whatsapp_carteira_creditos
      set saldo_atendimento = saldo_atendimento + 1, atualizado_em = now()
      where salao_id = v_log.salao_id;
  end if;

  delete from public.whatsapp_mensagens_log where meta_message_id = p_wamid;

  return true;
end;
$$;
