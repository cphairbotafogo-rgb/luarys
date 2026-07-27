-- 20260728e_resgatar_premio_lock_concorrencia.sql
--
-- CONSOLIDAÇÃO FINAL de resgatar_premio_fidelidade (verificada contra o banco
-- vivo em 28/07/2026). Duas correções foram feitas em paralelo e a segunda
-- sobrescreveu a primeira:
--   • Versão A (migration 20260728c): advisory lock contra resgates simultâneos
--   • Versão B (Claude Code, a que está no banco): auth_salao_id() como fonte
--     de verdade + validação de pertencimento de cliente e profissional
--     (fecha fraude cross-tenant) — porém SEM a trava de concorrência.
--
-- Esta versão une as duas: corpo da Versão B intacto + a trava da Versão A
-- (mesma chave do H1 — as duas formas de resgate disputam o MESMO saldo).
-- Substitui e torna obsoleta a 20260728c.
--
-- ACHADO ADICIONAL (durante a verificação ao vivo desta migration): o INSERT
-- em agendamentos gravava p_inicio (text) direto na coluna inicio (time sem
-- fuso) sem cast — Postgres não faz esse cast implícito nesse contexto, então
-- TODA chamada falhava com "column inicio is of type time without time zone
-- but expression is of type text", em qualquer formato de horário testado.
-- Bug pré-existente (estava assim antes desta consolidação, preservado
-- verbatim das duas versões anteriores) — resgate de prêmio nunca completou
-- de verdade em produção até este fix. Corrigido com p_inicio::time.

CREATE OR REPLACE FUNCTION public.resgatar_premio_fidelidade(p_salao_id uuid, p_cliente_id uuid, p_premio_id uuid, p_profissional_id uuid, p_data date, p_inicio text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_salao_id uuid := auth_salao_id();  -- fonte de verdade: sessão autenticada, nunca o parâmetro
  v_premio fidelidade_premios%rowtype;
  v_saldo integer;
  v_cliente_nome text;
  v_profissional_nome text;
  v_porcentagem numeric;
  v_valor_comissao numeric;
  v_agendamento_id uuid;
begin
  if v_salao_id is null then
    raise exception 'Sessão sem salão associado.';
  end if;

  -- Trava do H1: serializa resgates simultâneos do mesmo cliente no mesmo
  -- salão (clique duplo, duas abas). Sem ela, ambos leem o mesmo saldo,
  -- ambos passam na checagem e o cliente resgata em dobro com pontos que
  -- não tem. Liberada automaticamente ao fim da transação. Mesma chave da
  -- resgatar_credito_fidelidade — as duas disputam o MESMO saldo de pontos.
  perform pg_advisory_xact_lock(
    hashtext(v_salao_id::text || ':' || p_cliente_id::text)
  );

  select * into v_premio from fidelidade_premios
    where id = p_premio_id and salao_id = v_salao_id and ativo = true;
  if v_premio.id is null then
    raise exception 'Prêmio não encontrado ou inativo.';
  end if;

  select coalesce(sum(pontos), 0) into v_saldo
    from fidelidade_transacoes
    where salao_id = v_salao_id and cliente_id = p_cliente_id;
  if v_saldo < v_premio.custo_pontos then
    raise exception 'Saldo de pontos insuficiente. Saldo atual: %, necessário: %', v_saldo, v_premio.custo_pontos;
  end if;

  select nome_completo into v_cliente_nome
    from clientes where id = p_cliente_id and salao_id = v_salao_id;
  if v_cliente_nome is null then
    raise exception 'Cliente não encontrado neste salão.';
  end if;

  select nome, servicos_comissoes->>(v_premio.servico_id::text) into v_profissional_nome, v_porcentagem
    from profissionais where id = p_profissional_id and salao_id = v_salao_id;
  if v_profissional_nome is null then
    raise exception 'Profissional não encontrado neste salão.';
  end if;

  v_porcentagem := coalesce(v_porcentagem, 0);
  v_valor_comissao := round(v_premio.valor_real * v_porcentagem / 100, 2);

  insert into fidelidade_transacoes
    (salao_id, cliente_id, tipo, pontos, premio_id, descricao)
  values
    (v_salao_id, p_cliente_id, 'resgate', -v_premio.custo_pontos, p_premio_id,
     'Resgate: ' || v_premio.nome);

  insert into agendamentos
    (salao_id, cliente_id, cliente_nome, profissional_id, servico_id,
     data, inicio, duracao_min, valor_final, status, cor, observacao)
  values
    (v_salao_id, p_cliente_id, v_cliente_nome, p_profissional_id, v_premio.servico_id,
     p_data, p_inicio::time, 60, 0, 'Confirmado', '#D4AF37',
     '🎁 Resgate Fidelidade: ' || v_premio.nome)
  returning id into v_agendamento_id;

  insert into despesas
    (salao_id, categoria, valor, data_vencimento, forma_pagamento, descricao)
  values
    (v_salao_id, 'Marketing — Fidelidade', v_valor_comissao, p_data, 'Interno',
     'Comissão de resgate: ' || v_premio.nome || ' (' || coalesce(v_profissional_nome, 'Equipe') || ')');

  if v_valor_comissao > 0 then
    insert into comissoes
      (salao_id, profissional_id, agendamento_id, status, servico_nome,
       valor_servico, porcentagem_comissao, valor_comissao)
    values
      (v_salao_id, p_profissional_id, v_agendamento_id, 'Pendente', v_premio.nome,
       v_premio.valor_real, v_porcentagem, v_valor_comissao);
  end if;

  return v_agendamento_id;
end;
$function$;

COMMENT ON FUNCTION public.resgatar_premio_fidelidade(uuid, uuid, uuid, uuid, date, text) IS
  'Resgate de prêmio de fidelidade. Salão vem de auth_salao_id() (o parâmetro p_salao_id é ignorado — mantido só por compatibilidade de assinatura). Cliente e profissional validados como pertencentes ao salão. Advisory lock por (salão, cliente) impede resgate em dobro por concorrência.';

REVOKE ALL ON FUNCTION public.resgatar_premio_fidelidade(uuid, uuid, uuid, uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resgatar_premio_fidelidade(uuid, uuid, uuid, uuid, date, text) TO authenticated, service_role;
