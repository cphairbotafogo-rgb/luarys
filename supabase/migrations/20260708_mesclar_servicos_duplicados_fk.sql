-- 20260708_mesclar_servicos_duplicados_fk.sql
--
-- Mantém a lógica especial (repoint de agendamentos + dedup/repoint de ficha
-- técnica + merge da comissão JSON por profissional + fidelidade_premios) e
-- ADICIONA um catch-all dinâmico: reponteia qualquer OUTRA FK que aponte para
-- servicos.id antes do DELETE. Cobre tabelas novas como consumos_assinatura
-- (Clube), que a versão antiga não tratava → foreign key violation (23503).

CREATE OR REPLACE FUNCTION public.mesclar_servicos_duplicados(
  p_salao_id uuid, p_manter_id uuid, p_remover_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_prof          record;
  v_valor_remover jsonb;
  v_fk            record;
begin
  if p_manter_id = p_remover_id then
    raise exception 'Não é possível mesclar um serviço com ele mesmo.';
  end if;

  -- 1. Histórico de agendamentos
  update agendamentos set servico_id = p_manter_id
    where servico_id = p_remover_id and salao_id = p_salao_id;

  -- 2. ficha_tecnica: remove insumo duplicado (mesmo produto já nos dois
  --    serviços) e reponteia o resto
  delete from ficha_tecnica ft_remover
    where ft_remover.servico_id = p_remover_id
      and exists (
        select 1 from ficha_tecnica ft_manter
        where ft_manter.servico_id = p_manter_id
          and ft_manter.produto_id = ft_remover.produto_id
      );
  update ficha_tecnica set servico_id = p_manter_id where servico_id = p_remover_id;

  -- 3. Comissão configurada (JSON por profissional). Cast para jsonb (a coluna
  --    pode ser `json` antigo, sem os operadores ? / - / ||) e de volta para
  --    json ao salvar. Só copia a chave se o mantido ainda não tiver comissão
  --    definida para este serviço.
  for v_prof in
    select id, servicos_comissoes::jsonb as comissoes from profissionais
    where salao_id = p_salao_id and servicos_comissoes::jsonb ? p_remover_id::text
  loop
    v_valor_remover := v_prof.comissoes -> p_remover_id::text;
    if not (v_prof.comissoes ? p_manter_id::text) then
      update profissionais
        set servicos_comissoes = (
          (v_prof.comissoes - p_remover_id::text) || jsonb_build_object(p_manter_id::text, v_valor_remover)
        )::json
        where id = v_prof.id;
    else
      update profissionais
        set servicos_comissoes = (v_prof.comissoes - p_remover_id::text)::json
        where id = v_prof.id;
    end if;
  end loop;

  -- 3b. Catálogo de prêmios de fidelidade — bloco explícito (a coluna pode NÃO
  --     ser FK formal, então o catch-all dinâmico abaixo não a pegaria).
  if to_regclass('public.fidelidade_premios') is not null then
    execute format(
      'update fidelidade_premios set servico_id = %L where servico_id = %L and salao_id = %L',
      p_manter_id, p_remover_id, p_salao_id
    );
  end if;

  -- 4. Catch-all dinâmico: qualquer OUTRA FK para servicos.id (agendamentos e
  --    ficha_tecnica já tratados acima → excluídos). Cobre consumos_assinatura
  --    e o que mais surgir.
  for v_fk in
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_name = 'servicos' and ccu.column_name = 'id'
      and tc.table_name not in ('agendamentos', 'ficha_tecnica')
  loop
    begin
      execute format(
        'update public.%I set %I = %L where %I = %L',
        v_fk.table_name, v_fk.column_name, p_manter_id, v_fk.column_name, p_remover_id
      );
    exception when unique_violation then
      -- Conflito de unique (o mantido já tem a linha única) → o sobrevivente
      -- vence, descartamos as linhas do removido nessa tabela.
      execute format(
        'delete from public.%I where %I = %L',
        v_fk.table_name, v_fk.column_name, p_remover_id
      );
    end;
  end loop;

  -- 5. Apagar o serviço duplicado
  delete from servicos where id = p_remover_id;
end;
$function$;
