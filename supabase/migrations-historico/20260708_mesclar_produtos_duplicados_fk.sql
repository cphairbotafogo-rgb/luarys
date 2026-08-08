-- 20260708_mesclar_produtos_duplicados_fk.sql
--
-- Mantém a lógica especial (soma de estoque físico + dedup/repoint de ficha
-- técnica + histórico de estoque) e ADICIONA um catch-all dinâmico: reponteia
-- qualquer OUTRA FK que aponte para produtos.id antes do DELETE, evitando
-- foreign key violation (23503) quando surgem tabelas novas com produto_id.

CREATE OR REPLACE FUNCTION public.mesclar_produtos_duplicados(
  p_salao_id uuid, p_manter_id uuid, p_remover_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_qtd_manter  numeric;
  v_qtd_remover numeric;
  v_fk          record;
begin
  if p_manter_id = p_remover_id then
    raise exception 'Não é possível mesclar um produto com ele mesmo.';
  end if;

  -- 1. Somar estoque físico antes de apagar o duplicado
  select quantidade_atual into v_qtd_manter  from produtos where id = p_manter_id;
  select quantidade_atual into v_qtd_remover from produtos where id = p_remover_id;
  update produtos
    set quantidade_atual = coalesce(v_qtd_manter, 0) + coalesce(v_qtd_remover, 0)
    where id = p_manter_id;

  -- 2. ficha_tecnica: remove duplicidade (mesmo serviço já usando os dois
  --    produtos) e reponteia o resto
  delete from ficha_tecnica ft_remover
    where ft_remover.produto_id = p_remover_id
      and exists (
        select 1 from ficha_tecnica ft_manter
        where ft_manter.produto_id = p_manter_id
          and ft_manter.servico_id = ft_remover.servico_id
      );
  update ficha_tecnica set produto_id = p_manter_id where produto_id = p_remover_id;

  -- 3. histórico de movimentações de estoque
  update historico_estoque set produto_id = p_manter_id
    where produto_id = p_remover_id and salao_id = p_salao_id;

  -- 4. Catch-all dinâmico: qualquer OUTRA FK para produtos.id (ficha_tecnica e
  --    historico_estoque já tratados acima → excluídos).
  for v_fk in
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_name = 'produtos' and ccu.column_name = 'id'
      and tc.table_name not in ('ficha_tecnica', 'historico_estoque')
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

  -- 5. Apagar o produto duplicado
  delete from produtos where id = p_remover_id;
end;
$function$;
