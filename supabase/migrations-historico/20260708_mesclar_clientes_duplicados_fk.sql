-- 20260708_mesclar_clientes_duplicados_fk.sql
--
-- PROBLEMA: a RPC mesclar_clientes_duplicados reponteava só agendamentos,
-- fidelidade_transacoes e crm_clientes antes de apagar o cliente duplicado.
-- Outras tabelas passaram a referenciar cliente_id (caixa_transacoes,
-- assinaturas_cliente, etc.) e ficaram de fora → o DELETE final batia em
-- foreign key violation (23503) e a mesclagem falhava. Além disso, o repoint
-- de agendamentos filtrava por salao_id, deixando linhas de outros salões
-- apontando para o cliente apagado (clientes é tabela GLOBAL).
--
-- SOLUÇÃO: reponteamento DINÂMICO — descobre no catálogo todas as FKs que
-- referenciam clientes.id e reponteia cada uma do removido para o mantido,
-- em TODOS os salões (o cliente global é único). crm_clientes é tratado à
-- parte por causa da unique (cliente_id, salao_id). À prova de futuro: novas
-- tabelas com FK para clientes.id passam a ser cobertas automaticamente.

CREATE OR REPLACE FUNCTION public.mesclar_clientes_duplicados(
  p_salao_id uuid, p_manter_id uuid, p_remover_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_crm_manter  record;
  v_crm_remover record;
  v_fk          record;
begin
  if p_manter_id = p_remover_id then
    raise exception 'Não é possível mesclar um cliente com ele mesmo.';
  end if;

  -- 1. Reponteia TODAS as FKs que apontam para clientes.id (exceto crm_clientes),
  --    em todos os salões. Dinâmico: cobre tabelas novas sem editar esta função.
  for v_fk in
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_name = 'clientes'
      and ccu.column_name = 'id'
      and tc.table_name <> 'crm_clientes'
  loop
    begin
      execute format(
        'update public.%I set %I = %L where %I = %L',
        v_fk.table_name, v_fk.column_name, p_manter_id, v_fk.column_name, p_remover_id
      );
    exception when unique_violation then
      -- O mantido já tem a linha "única" desta tabela para este cliente (ex.:
      -- carteira_clientes com UNIQUE(cliente_id)). Repontar violaria a unique →
      -- semântica de merge: o sobrevivente vence, descartamos as linhas do
      -- removido nessa tabela.
      execute format(
        'delete from public.%I where %I = %L',
        v_fk.table_name, v_fk.column_name, p_remover_id
      );
    end;
  end loop;

  -- 1b. caixa_transacoes tem cliente_id SEM FK formal → o loop acima não a pega,
  --     e o delete não é bloqueado, mas o histórico de compras do CRM ficaria
  --     órfão. Reponteia explicitamente (guardado por existência da coluna).
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'caixa_transacoes' and column_name = 'cliente_id'
  ) then
    update caixa_transacoes set cliente_id = p_manter_id where cliente_id = p_remover_id;
  end if;

  -- 2. crm_clientes do salão atual: se os dois têm vínculo, funde os campos no
  --    mantido e apaga o do removido; se só o removido tem, reponteia.
  select * into v_crm_manter  from crm_clientes where cliente_id = p_manter_id  and salao_id = p_salao_id;
  select * into v_crm_remover from crm_clientes where cliente_id = p_remover_id and salao_id = p_salao_id;

  if v_crm_manter.id is not null and v_crm_remover.id is not null then
    update crm_clientes set
      data_ultima_visita = greatest(
        coalesce(v_crm_manter.data_ultima_visita,  '1900-01-01'::date),
        coalesce(v_crm_remover.data_ultima_visita, '1900-01-01'::date)
      ),
      aceita_campanhas    = coalesce(v_crm_manter.aceita_campanhas, false)    or coalesce(v_crm_remover.aceita_campanhas, false),
      aceita_notificacoes = coalesce(v_crm_manter.aceita_notificacoes, false) or coalesce(v_crm_remover.aceita_notificacoes, false)
    where id = v_crm_manter.id;

    delete from crm_clientes where id = v_crm_remover.id;
  elsif v_crm_remover.id is not null and v_crm_manter.id is null then
    update crm_clientes set cliente_id = p_manter_id where id = v_crm_remover.id;
  end if;

  -- 3. Vínculos crm restantes do removido (outros salões): reponteia onde o
  --    mantido ainda não tem vínculo; apaga o resto (mantido já tem lá).
  update crm_clientes cc_rem
    set cliente_id = p_manter_id
    where cc_rem.cliente_id = p_remover_id
      and not exists (
        select 1 from crm_clientes cc_man
        where cc_man.cliente_id = p_manter_id and cc_man.salao_id = cc_rem.salao_id
      );
  delete from crm_clientes where cliente_id = p_remover_id;

  -- 4. Apaga o registro global duplicado (agora sem FKs pendentes).
  delete from clientes where id = p_remover_id;
end;
$function$;
