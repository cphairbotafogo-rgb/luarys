-- 20260727_versionar_rpcs_legado_e_permissoes.sql
--
-- CONTEXTO: 9 funções existiam apenas no banco ao vivo, sem fonte de verdade
-- reproduzível em supabase/migrations/ (6 delas tinham um registro em
-- src/lib/migrations/*.sql — pasta legada, anterior à convenção atual, que o
-- Supabase CLI não lê; 3 nunca tiveram nenhum arquivo). Esta migration:
--   1. Versiona as 9 (create or replace — idempotente, não muda dado nenhum).
--   2. Corrige 2 falhas de segurança encontradas ao auditar essas funções.
--   3. Corrige 1 risco de corrida (crédito de WhatsApp em duplicidade).
--
-- ═══ ACHADO CRÍTICO 1 — vazamento de PII sem autenticação ═══════════════════
-- buscar_agendamentos_para_lembrete estava executável pelo papel `anon` — ou
-- seja, por qualquer pessoa na internet usando só a anon key pública do site,
-- sem login nenhum. Testado ao vivo nesta auditoria: retornou 397 linhas reais
-- (nome completo, telefone, serviço, horário) cruzando TODOS os salões da
-- plataforma, incluindo o piloto real (Concept Prime Hair). A query em si está
-- correta (é assim mesmo que o cron precisa ver todos os salões) — o problema
-- é só permissão. Fix: revoke de anon/authenticated/public, grant só a
-- service_role — mesmo padrão já usado em obter_proximo_numero_nfce.
--
-- ═══ ACHADO CRÍTICO 2 — resgate de fidelidade entre salões (IDOR) ═══════════
-- resgatar_premio_fidelidade confiava no p_salao_id recebido do CLIENTE
-- (chamada direta do navegador em src/modules/fidelidade/tipos.ts, função
-- resgatarPremio). Testado ao vivo com um usuário autenticado comum, sem
-- nenhum vínculo com qualquer salão: a função executou normalmente (só não
-- achou o prêmio forjado). Ou seja, qualquer conta autenticada na plataforma
-- — de qualquer salão — pode tentar resgatar prêmio de OUTRO salão se souber
-- (ou adivinhar) os UUIDs de prêmio/cliente/profissional: cria agendamento
-- "Confirmado" de graça, mais despesa e comissão real, tudo no salão alheio.
-- Mesma regra que já vale para toda rota de API do projeto (CLAUDE.md:
-- "salao_id vem sempre do perfil autenticado no servidor, nunca do body") —
-- aqui vale para RPC também. Fix: o salão agora vem de auth_salao_id(), nunca
-- do parâmetro (mantido só por compatibilidade de assinatura); cliente_id e
-- profissional_id passam a ser conferidos contra esse mesmo salão.
--
-- ═══ ACHADO 3 — corrida em restaurar_credito_whatsapp ═══════════════════════
-- Duas chamadas concorrentes (reentrega de webhook da Meta, comum em
-- integrações WhatsApp) para o mesmo wamid podiam passar as duas pelo
-- "if not found" antes de qualquer uma apagar a linha de log — creditando
-- 2x o mesmo crédito de volta. Fix: SELECT ... FOR UPDATE trava a linha; a
-- segunda chamada concorrente espera a primeira commitar (e apagar a linha),
-- e então corretamente não encontra mais nada a restaurar.

-- ─── 1. resgatar_premio_fidelidade — salão vem da sessão, não do body ───────

create or replace function public.resgatar_premio_fidelidade(
  p_salao_id uuid,          -- mantido só para não quebrar a assinatura já chamada pelo front; IGNORADO abaixo
  p_cliente_id uuid,
  p_premio_id uuid,
  p_profissional_id uuid,
  p_data date,
  p_inicio text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  -- cliente e profissional precisam pertencer ao MESMO salão do prêmio —
  -- sem isso, um id de outro salão passava batido e só corrompia o nome exibido.
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

  -- 2. Debita os pontos
  insert into fidelidade_transacoes
    (salao_id, cliente_id, tipo, pontos, premio_id, descricao)
  values
    (v_salao_id, p_cliente_id, 'resgate', -v_premio.custo_pontos, p_premio_id,
     'Resgate: ' || v_premio.nome);

  -- 3. Cria o agendamento gratuito
  insert into agendamentos
    (salao_id, cliente_id, cliente_nome, profissional_id, servico_id,
     data, inicio, duracao_min, valor_final, status, cor, observacao)
  values
    (v_salao_id, p_cliente_id, v_cliente_nome, p_profissional_id, v_premio.servico_id,
     p_data, p_inicio, 60, 0, 'Confirmado', '#D4AF37',
     '🎁 Resgate Fidelidade: ' || v_premio.nome)
  returning id into v_agendamento_id;

  -- 4. Despesa de marketing — categoria isolada, fora do Custo Fixo da Precificação
  insert into despesas
    (salao_id, categoria, valor, data_vencimento, forma_pagamento, descricao)
  values
    (v_salao_id, 'Marketing — Fidelidade', v_valor_comissao, p_data, 'Interno',
     'Comissão de resgate: ' || v_premio.nome || ' (' || coalesce(v_profissional_nome, 'Equipe') || ')');

  -- 5. Credita a comissão do profissional, como se o cliente tivesse pago o valor cheio
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

comment on function public.resgatar_premio_fidelidade(uuid, uuid, uuid, uuid, date, text) is
  'Resgata prêmio de fidelidade. p_salao_id é ignorado por segurança — o salão real vem sempre de auth_salao_id() (sessão autenticada), nunca do parâmetro recebido do cliente.';

-- ─── 2. restaurar_credito_whatsapp — trava a linha para não creditar 2x ─────

create or replace function public.restaurar_credito_whatsapp(p_wamid text)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_log record;
begin
  select salao_id, origem
    into v_log
    from public.whatsapp_mensagens_log
    where meta_message_id = p_wamid
    for update                     -- trava a linha: 2ª chamada concorrente espera e não encontra mais nada
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
$function$;

-- ─── 3. As demais 7 — versionadas como já estão ao vivo, sem mudança ────────

create or replace function public.debitar_credito_whatsapp(
  p_salao_id uuid, p_sub_waba_id text, p_categoria text, p_origem text, p_custo_unitario numeric,
  p_categoria_solicitada text default null::text, p_meta_message_id text default null::text,
  p_cliente_id uuid default null::uuid, p_campanha_id uuid default null::uuid
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_carteira record;
  v_coluna   text := case when p_origem = 'campanha' then 'saldo_campanha' else 'saldo_atendimento' end;
begin
  select * into v_carteira from public.whatsapp_carteira_creditos where salao_id = p_salao_id for update;

  if not found
    or (v_coluna = 'saldo_atendimento' and v_carteira.saldo_atendimento <= 0)
    or (v_coluna = 'saldo_campanha'    and v_carteira.saldo_campanha    <= 0)
  then
    return false;
  end if;

  if v_coluna = 'saldo_atendimento' then
    update public.whatsapp_carteira_creditos
      set saldo_atendimento = saldo_atendimento - 1, atualizado_em = now()
      where salao_id = p_salao_id;
  else
    update public.whatsapp_carteira_creditos
      set saldo_campanha = saldo_campanha - 1, atualizado_em = now()
      where salao_id = p_salao_id;
  end if;

  insert into public.whatsapp_mensagens_log (
    salao_id, sub_waba_id, categoria, categoria_solicitada,
    origem, custo_unitario, meta_message_id, cliente_id, campanha_id
  ) values (
    p_salao_id, p_sub_waba_id, p_categoria, p_categoria_solicitada,
    p_origem, p_custo_unitario, p_meta_message_id, p_cliente_id, p_campanha_id
  );

  return true;
end;
$function$;

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
begin
  select coalesce(cnpj, '') into v_cnpj from public.saloes where id = p_salao_id;

  if not found then
    raise exception 'Salão não encontrado (id=%)', p_salao_id;
  end if;

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

  update public.saloes
    set status_fiscal     = case when p_nfse or p_nfce then 'ativo' else 'inativo' end,
        token_nfse_salao  = coalesce(p_company_token, token_nfse_salao),
        fiscal_ativado_em = case when p_nfse or p_nfce then now() else fiscal_ativado_em end
    where id = p_salao_id;
end;
$function$;

create or replace function public.baixar_estoque_vitrine(p_salao_id uuid, p_pedido_id uuid, p_itens jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  item      jsonb;
  prod_id   uuid;
  qtd       integer;
  qtd_atual integer;
begin
  for item in select * from jsonb_array_elements(p_itens) loop
    prod_id := (item->>'produto_id')::uuid;
    qtd     := (item->>'quantidade')::integer;

    select quantidade_atual into qtd_atual
    from produtos
    where id = prod_id and salao_id = p_salao_id
    for update;

    if qtd_atual is null then
      raise exception 'Produto % não encontrado.', prod_id;
    end if;

    if qtd_atual < qtd then
      raise exception 'Estoque insuficiente para o produto %.', prod_id;
    end if;

    update produtos
    set quantidade_atual = quantidade_atual - qtd
    where id = prod_id and salao_id = p_salao_id;

    insert into historico_estoque (salao_id, produto_id, tipo, quantidade, motivo)
    values (p_salao_id, prod_id, 'Saída', qtd, 'Venda Portal — Pedido ' || p_pedido_id::text);
  end loop;
end;
$function$;

create or replace function public.buscar_agendamentos_para_lembrete(p_janela_min integer default 35)
returns table(
  ag_id uuid, salao_id uuid, salao_nome text, msg_template text, antecedencia_horas integer,
  data_hora_inicio timestamp with time zone, cliente_nome text, telefone text,
  nome_servico text, nome_profissional text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    ag.id                                              as ag_id,
    s.id                                                as salao_id,
    coalesce(s.nome_fantasia, s.razao_social, '')       as salao_nome,
    coalesce(s.msg_confirmacao_agendamento, '')         as msg_template,
    coalesce(s.confirmacao_antecedencia_horas, 24)      as antecedencia_horas,
    ag.data_hora_inicio,
    coalesce(cl.nome_completo, ag.cliente_nome, '')     as cliente_nome,
    cl.telefone_whatsapp                                as telefone,
    coalesce(sv.nome_servico, '')                       as nome_servico,
    coalesce(pr.nome, '')                               as nome_profissional
  from agendamentos ag
  join saloes s on s.id = ag.salao_id
  left join clientes cl        on cl.id = ag.cliente_id
  left join servicos sv        on sv.id = ag.servico_id
  left join profissionais pr   on pr.id = ag.profissional_id
  where ag.lembrete_enviado_em is null
    and ag.status not in ('Cancelado', 'Faltou', 'Bloqueado')
    and cl.telefone_whatsapp is not null
    and ag.data_hora_inicio >=
          now()
          + make_interval(hours => coalesce(s.confirmacao_antecedencia_horas, 24))
          - make_interval(mins  => p_janela_min)
    and ag.data_hora_inicio <=
          now()
          + make_interval(hours => coalesce(s.confirmacao_antecedencia_horas, 24))
          + make_interval(mins  => p_janela_min);
$function$;

create or replace function public.obter_status_fiscal()
returns table(
  cnpj text, ambiente text, nfse_ativo boolean, nfse_faturamento text,
  nfce_ativo boolean, nfce_faturamento text, certificado_status text, certificado_validade date
)
language sql
stable
set search_path to 'public'
as $function$
  select
    cnpj, ambiente,
    nfse_ativo, nfse_faturamento,
    nfce_ativo, nfce_faturamento,
    certificado_status, certificado_validade
  from public.nfe_config_empresa
  where salao_id = auth_salao_id();
$function$;

create or replace function public.obter_saldo_whatsapp()
returns table(saldo_atendimento integer, saldo_campanha integer)
language sql
stable
set search_path to 'public'
as $function$
  select coalesce(saldo_atendimento, 0), coalesce(saldo_campanha, 0)
  from public.whatsapp_carteira_creditos
  where salao_id = auth_salao_id();
$function$;

create or replace function public.obter_consumo_whatsapp_mes(p_mes date default (date_trunc('month'::text, now()))::date)
returns table(categoria text, origem text, quantidade bigint, custo_total numeric)
language sql
stable
set search_path to 'public'
as $function$
  select categoria, origem, count(*), sum(custo_unitario)
  from public.whatsapp_mensagens_log
  where salao_id = auth_salao_id()
    and criado_em >= p_mes
    and criado_em < (p_mes + interval '1 month')
  group by categoria, origem
  order by categoria, origem;
$function$;

-- ─── 4. Permissões — só service_role chama as funções que recebem salao_id ──
-- por parâmetro solto (nunca o cliente direto). Mesmo padrão de
-- obter_proximo_numero_nfce (migration 20260727_nfce_numero_atomico_persistencia.sql).
-- Reforça de forma explícita e reproduzível o que hoje já é verdade na maioria
-- destas — e FECHA de vez o vazamento de buscar_agendamentos_para_lembrete,
-- que estava aberto para `anon` sem nenhum registro do porquê.

revoke all on function public.debitar_credito_whatsapp(uuid, text, text, text, numeric, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.debitar_credito_whatsapp(uuid, text, text, text, numeric, text, text, uuid, uuid) to service_role;

revoke all on function public.restaurar_credito_whatsapp(text) from public, anon, authenticated;
grant execute on function public.restaurar_credito_whatsapp(text) to service_role;

revoke all on function public.admin_ativar_modulo_fiscal(uuid, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_ativar_modulo_fiscal(uuid, boolean, boolean, text) to service_role;

revoke all on function public.baixar_estoque_vitrine(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.baixar_estoque_vitrine(uuid, uuid, jsonb) to service_role;

revoke all on function public.buscar_agendamentos_para_lembrete(integer) from public, anon, authenticated;
grant execute on function public.buscar_agendamentos_para_lembrete(integer) to service_role;

-- resgatar_premio_fidelidade continua chamável por `authenticated` de propósito
-- (o front chama direto do navegador) — a segurança agora vem de dentro da
-- função (auth_salao_id()), não de bloquear o acesso.
grant execute on function public.resgatar_premio_fidelidade(uuid, uuid, uuid, uuid, date, text) to authenticated;

-- obter_status_fiscal / obter_saldo_whatsapp / obter_consumo_whatsapp_mes:
-- já corretamente escopadas por auth_salao_id() — sem mudança de permissão.
