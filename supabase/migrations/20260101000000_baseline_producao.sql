


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."admin_ativar_modulo_fiscal"("p_salao_id" "uuid", "p_nfse" boolean, "p_nfce" boolean, "p_company_token" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."admin_ativar_modulo_fiscal"("p_salao_id" "uuid", "p_nfse" boolean, "p_nfce" boolean, "p_company_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_liberar_modulo_global"("p_modulo_chave" "text", "p_dias" integer DEFAULT NULL::integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_renovacao    TIMESTAMPTZ;
  v_cancelamento BOOLEAN;
  v_count        INTEGER;
BEGIN
  IF p_dias IS NOT NULL AND p_dias > 0 THEN
    v_renovacao    := now() + (p_dias || ' days')::INTERVAL;
    v_cancelamento := true;
  ELSE
    v_renovacao    := NULL;
    v_cancelamento := false;
  END IF;

  INSERT INTO salao_modulos
    (salao_id, modulo_chave, ativo, origem, ativado_em, renovacao_em, cancelamento_agendado)
  SELECT
    id, p_modulo_chave, true, 'promocao_global', now(), v_renovacao, v_cancelamento
  FROM saloes
  WHERE status_assinatura IN ('ativo', 'trial')
  ON CONFLICT (salao_id, modulo_chave) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."admin_liberar_modulo_global"("p_modulo_chave" "text", "p_dias" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_listar_promocoes_ativas"() RETURNS TABLE("modulo_chave" "text", "nome_modulo" "text", "total_saloes" bigint, "expira_em" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.modulo_chave,
    COALESCE(mc.nome, sm.modulo_chave),
    COUNT(DISTINCT sm.salao_id)::BIGINT,
    MAX(sm.renovacao_em)
  FROM salao_modulos sm
  LEFT JOIN modulos_catalogo mc ON mc.chave = sm.modulo_chave
  WHERE sm.origem = 'promocao_global' AND sm.ativo = true
  GROUP BY sm.modulo_chave, mc.nome;
END;
$$;


ALTER FUNCTION "public"."admin_listar_promocoes_ativas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_revogar_promocao_global"("p_modulo_chave" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE salao_modulos
  SET ativo = false
  WHERE modulo_chave = p_modulo_chave
    AND origem       = 'promocao_global';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."admin_revogar_promocao_global"("p_modulo_chave" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ajustar_metricas_cliente"("p_cliente_id" "uuid", "p_salao_id" "uuid", "p_delta_gasto" numeric, "p_delta_visitas" integer, "p_data_visita" "date" DEFAULT NULL::"date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Trava multi-tenant: só mexe em cliente do salão do usuário autenticado.
  IF p_salao_id IS NULL OR p_salao_id IS DISTINCT FROM auth_salao_id() THEN
    RAISE EXCEPTION 'Salao invalido para o usuario autenticado';
  END IF;

  UPDATE clientes
     SET total_gasto   = GREATEST(0, COALESCE(total_gasto, 0)   + COALESCE(p_delta_gasto, 0)),
         total_visitas = GREATEST(0, COALESCE(total_visitas, 0) + COALESCE(p_delta_visitas, 0)),
         data_ultima_visita = COALESCE(p_data_visita, data_ultima_visita)
   WHERE id = p_cliente_id
     AND salao_id = p_salao_id;
END;
$$;


ALTER FUNCTION "public"."ajustar_metricas_cliente"("p_cliente_id" "uuid", "p_salao_id" "uuid", "p_delta_gasto" numeric, "p_delta_visitas" integer, "p_data_visita" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ajustar_metricas_cliente"("p_cliente_id" "uuid", "p_salao_id" "uuid", "p_delta_gasto" numeric, "p_delta_visitas" integer, "p_data_visita" "date") IS 'Soma (ou subtrai, com delta negativo) total_gasto/total_visitas de um cliente de forma atômica. Usado pelo fechamento de conta e pelo estorno — substitui o read-modify-write que perdia gravações concorrentes.';



CREATE OR REPLACE FUNCTION "public"."ativar_producao_fiscal"("p_salao_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_config record;
begin
  select * into v_config from public.nfe_config_empresa where salao_id = p_salao_id;

  if not found then
    raise exception 'Configuração fiscal não encontrada para este salão';
  end if;

  if v_config.certificado_status != 'valido' then
    raise exception 'Certificado A1 deve estar válido antes de ativar produção';
  end if;

  update public.nfe_config_empresa
    set ambiente = 'producao', atualizado_em = now()
    where salao_id = p_salao_id;
end;
$$;


ALTER FUNCTION "public"."ativar_producao_fiscal"("p_salao_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_atualizado_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."atualizar_atualizado_em"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_salao_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT salao_id FROM perfis_usuarios WHERE id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."auth_salao_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."baixar_estoque_vitrine"("p_salao_id" "uuid", "p_pedido_id" "uuid", "p_itens" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  item      JSONB;
  prod_id   UUID;
  qtd       INTEGER;
  qtd_atual INTEGER;
BEGIN
  -- Serializa chamadas simultâneas do MESMO pedido (liberado no fim da transação)
  PERFORM pg_advisory_xact_lock(hashtext('vitrine:' || p_pedido_id::text));

  -- Guarda de idempotência: pedido já baixado → segunda chamada é no-op
  IF EXISTS (
    SELECT 1 FROM historico_estoque
    WHERE pedido_id = p_pedido_id AND salao_id = p_salao_id
  ) THEN
    RETURN;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    prod_id := (item->>'produto_id')::UUID;
    qtd     := (item->>'quantidade')::INTEGER;

    -- Trava a linha para evitar concorrência
    SELECT quantidade_atual INTO qtd_atual
    FROM produtos
    WHERE id = prod_id AND salao_id = p_salao_id
    FOR UPDATE;

    IF qtd_atual IS NULL THEN
      RAISE EXCEPTION 'Produto % não encontrado.', prod_id;
    END IF;

    IF qtd_atual < qtd THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %.', prod_id;
    END IF;

    -- Baixa o estoque
    UPDATE produtos
    SET quantidade_atual = quantidade_atual - qtd
    WHERE id = prod_id AND salao_id = p_salao_id;

    -- Registra no histórico (agora com pedido_id rastreável)
    INSERT INTO historico_estoque (salao_id, produto_id, tipo, quantidade, motivo, pedido_id)
    VALUES (p_salao_id, prod_id, 'Saída', qtd, 'Venda Portal — Pedido ' || p_pedido_id::TEXT, p_pedido_id);
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."baixar_estoque_vitrine"("p_salao_id" "uuid", "p_pedido_id" "uuid", "p_itens" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."baixar_estoque_vitrine"("p_salao_id" "uuid", "p_pedido_id" "uuid", "p_itens" "jsonb") IS 'Baixa atômica de estoque de um pedido da Vitrine. Idempotente por pedido: advisory lock + guarda no historico_estoque garantem que retries/cliques duplos nunca baixam o estoque duas vezes.';



CREATE OR REPLACE FUNCTION "public"."bloquear_encaixe_via_portal"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Se quem está fazendo o UPDATE não tem salao_id associado (ou seja,
  -- não é um login do painel interno), ignora qualquer tentativa de
  -- mudar eh_encaixe e mantém o valor antigo.
  IF auth_salao_id() IS NULL THEN
    NEW.eh_encaixe := OLD.eh_encaixe;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bloquear_encaixe_via_portal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buscar_agendamentos_para_lembrete"("p_janela_min" integer DEFAULT 35) RETURNS TABLE("ag_id" "uuid", "salao_id" "uuid", "salao_nome" "text", "msg_template" "text", "antecedencia_horas" integer, "data_hora_inicio" timestamp with time zone, "cliente_nome" "text", "telefone" "text", "nome_servico" "text", "nome_profissional" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    ag.id                                              AS ag_id,
    s.id                                               AS salao_id,
    COALESCE(s.nome_fantasia, s.razao_social, '')      AS salao_nome,
    COALESCE(s.msg_confirmacao_agendamento, '')         AS msg_template,
    COALESCE(s.confirmacao_antecedencia_horas, 24)     AS antecedencia_horas,
    ag.data_hora_inicio,
    COALESCE(cl.nome_completo, ag.cliente_nome, '')    AS cliente_nome,
    cl.telefone_whatsapp                               AS telefone,
    COALESCE(sv.nome_servico, '')                      AS nome_servico,
    COALESCE(pr.nome, '')                              AS nome_profissional
  FROM agendamentos ag
  JOIN saloes s ON s.id = ag.salao_id
  LEFT JOIN clientes cl        ON cl.id = ag.cliente_id
  LEFT JOIN servicos sv        ON sv.id = ag.servico_id
  LEFT JOIN profissionais pr   ON pr.id = ag.profissional_id
  WHERE ag.lembrete_enviado_em IS NULL
    AND ag.status NOT IN ('Cancelado', 'Faltou', 'Bloqueado')
    AND cl.telefone_whatsapp IS NOT NULL
    AND ag.data_hora_inicio >=
          NOW()
          + make_interval(hours => COALESCE(s.confirmacao_antecedencia_horas, 24))
          - make_interval(mins  => p_janela_min)
    AND ag.data_hora_inicio <=
          NOW()
          + make_interval(hours => COALESCE(s.confirmacao_antecedencia_horas, 24))
          + make_interval(mins  => p_janela_min);
$$;


ALTER FUNCTION "public"."buscar_agendamentos_para_lembrete"("p_janela_min" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comprar_pacote_whatsapp"("p_pacote_id" "uuid", "p_meio_pagamento" "text") RETURNS TABLE("saldo_atendimento" integer, "saldo_campanha" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_salao_id uuid := auth_salao_id();
  v_pacote   record;
begin
  if v_salao_id is null then
    raise exception 'Sessão inválida';
  end if;

  select * into v_pacote from public.whatsapp_pacotes where id = p_pacote_id and ativo = true;
  if not found then
    raise exception 'Pacote não encontrado ou inativo';
  end if;

  insert into public.whatsapp_carteira_creditos (salao_id, saldo_atendimento, saldo_campanha)
  values (v_salao_id, 0, 0)
  on conflict (salao_id) do nothing;

  if v_pacote.tipo = 'atendimento' then
    update public.whatsapp_carteira_creditos
      set saldo_atendimento = saldo_atendimento + v_pacote.quantidade, atualizado_em = now()
      where salao_id = v_salao_id;
  else
    update public.whatsapp_carteira_creditos
      set saldo_campanha = saldo_campanha + v_pacote.quantidade, atualizado_em = now()
      where salao_id = v_salao_id;
  end if;

  insert into public.whatsapp_compras_creditos (salao_id, pacote_id, quantidade, preco_pago, meio_pagamento)
  values (v_salao_id, p_pacote_id, v_pacote.quantidade, v_pacote.preco, p_meio_pagamento);

  return query
    select c.saldo_atendimento, c.saldo_campanha
    from public.whatsapp_carteira_creditos c
    where c.salao_id = v_salao_id;
end;
$$;


ALTER FUNCTION "public"."comprar_pacote_whatsapp"("p_pacote_id" "uuid", "p_meio_pagamento" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."creditar_pacote_whatsapp_pago"("p_salao_id" "uuid", "p_pacote_id" "uuid", "p_meio_pagamento" "text", "p_pagamento_externo_id" "text") RETURNS TABLE("saldo_atendimento" integer, "saldo_campanha" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
#variable_conflict use_column
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


ALTER FUNCTION "public"."creditar_pacote_whatsapp_pago"("p_salao_id" "uuid", "p_pacote_id" "uuid", "p_meio_pagamento" "text", "p_pagamento_externo_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."creditar_pacote_whatsapp_service"("p_salao_id" "uuid", "p_pacote_id" "uuid", "p_meio_pagamento" "text") RETURNS TABLE("saldo_atendimento" integer, "saldo_campanha" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."creditar_pacote_whatsapp_service"("p_salao_id" "uuid", "p_pacote_id" "uuid", "p_meio_pagamento" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debitar_credito_whatsapp"("p_salao_id" "uuid", "p_sub_waba_id" "text", "p_categoria" "text", "p_origem" "text", "p_custo_unitario" numeric, "p_categoria_solicitada" "text" DEFAULT NULL::"text", "p_meta_message_id" "text" DEFAULT NULL::"text", "p_cliente_id" "uuid" DEFAULT NULL::"uuid", "p_campanha_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."debitar_credito_whatsapp"("p_salao_id" "uuid", "p_sub_waba_id" "text", "p_categoria" "text", "p_origem" "text", "p_custo_unitario" numeric, "p_categoria_solicitada" "text", "p_meta_message_id" "text", "p_cliente_id" "uuid", "p_campanha_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."desativar_outras_contas_recebimento"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.ativa = TRUE THEN
    UPDATE plataforma_contas_recebimento
    SET ativa = FALSE
    WHERE id <> NEW.id AND ativa = TRUE;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."desativar_outras_contas_recebimento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expirar_modulos_vencidos"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE qtd INTEGER;
BEGIN
  UPDATE salao_modulos SET ativo = false
  WHERE ativo = true AND cancelamento_agendado = true
    AND renovacao_em IS NOT NULL AND renovacao_em < now();
  GET DIAGNOSTICS qtd = ROW_COUNT;
  RETURN qtd;
END;$$;


ALTER FUNCTION "public"."expirar_modulos_vencidos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expirar_planos_vencidos"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  qtd INTEGER;
BEGIN
  UPDATE saloes
  SET plano_chave = NULL,
      plano_renovacao_em = NULL
  WHERE plano_chave IS NOT NULL
    AND acesso_total = false
    AND cancelamento_agendado = true
    AND plano_renovacao_em IS NOT NULL
    AND plano_renovacao_em < now();

  GET DIAGNOSTICS qtd = ROW_COUNT;
  RETURN qtd;
END;
$$;


ALTER FUNCTION "public"."expirar_planos_vencidos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fechar_conta_atomico"("p" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_salao_id  uuid := (p->>'salao_id')::uuid;
  v_fin       jsonb := p->'financeiro';
  v_fin_id    bigint;
  v_ag_ids    uuid[];
  item        jsonb;
  v_afetadas  integer;
  v_existente bigint;
BEGIN
  IF v_salao_id IS NULL OR v_salao_id IS DISTINCT FROM auth_salao_id() THEN
    RAISE EXCEPTION 'Salao invalido para o usuario autenticado';
  END IF;

  IF jsonb_typeof(v_fin->'agendamento_ids') = 'array'
     AND jsonb_array_length(v_fin->'agendamento_ids') > 0 THEN
    SELECT array_agg(value::uuid) INTO v_ag_ids
    FROM jsonb_array_elements_text(v_fin->'agendamento_ids');
  ELSE
    v_ag_ids := NULL;
  END IF;

  -- (a) Guarda de duplicidade — só se a venda está ligada a agendamentos.
  -- Venda de balcão pura (sem agendamento) não tem chave natural: duas vendas
  -- seguidas no PDV são legitimamente distintas, então não há o que comparar.
  IF v_ag_ids IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext('fechar_conta:' || v_salao_id::text || ':' || array_to_string(v_ag_ids, ','))
    );

    SELECT id INTO v_existente
      FROM financeiro
     WHERE salao_id = v_salao_id
       AND status IS DISTINCT FROM 'Estornado'
       AND agendamento_ids && v_ag_ids
     LIMIT 1;

    IF v_existente IS NOT NULL THEN
      RETURN jsonb_build_object('financeiro_id', v_existente, 'duplicado', true);
    END IF;
  END IF;

  -- 1) FINANCEIRO (+ pagamentos)
  INSERT INTO financeiro (
    salao_id, os_numero, cliente_nome, descricao, tipo, categoria, valor,
    metodo_pagamento, forma_pagamento, bandeira_cartao, profissional_nome,
    status, data_movimentacao, agendamento_ids, comentario, desconto, pagamentos
  ) VALUES (
    v_salao_id,
    v_fin->>'os_numero',
    v_fin->>'cliente_nome',
    v_fin->>'descricao',
    COALESCE(v_fin->>'tipo', 'entrada'),
    v_fin->>'categoria',
    (v_fin->>'valor')::numeric,
    v_fin->>'metodo_pagamento',
    v_fin->>'forma_pagamento',
    v_fin->>'bandeira_cartao',
    v_fin->>'profissional_nome',
    v_fin->>'status',
    (v_fin->>'data_movimentacao')::timestamptz,
    v_ag_ids,
    v_fin->>'comentario',
    NULLIF(v_fin->>'desconto', '')::numeric,
    v_fin->'pagamentos'
  )
  RETURNING id INTO v_fin_id;

  -- 2) ESTOQUE — histórico só se a baixa aconteceu, agora com financeiro_id
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p->'estoque', '[]'::jsonb)) LOOP
    UPDATE produtos
       SET quantidade_atual = COALESCE(quantidade_atual, 0) - (item->>'quantidade')::numeric
     WHERE id = (item->>'produto_id')::uuid
       AND salao_id = v_salao_id;

    GET DIAGNOSTICS v_afetadas = ROW_COUNT;

    IF v_afetadas > 0 THEN
      INSERT INTO historico_estoque (salao_id, produto_id, tipo, quantidade, motivo, financeiro_id)
      VALUES (v_salao_id, (item->>'produto_id')::uuid, 'Saida',
              (item->>'quantidade')::numeric, item->>'motivo', v_fin_id);
    ELSE
      RAISE NOTICE 'fechar_conta_atomico: produto % nao encontrado no salao % — baixa e historico ignorados',
        item->>'produto_id', v_salao_id;
    END IF;
  END LOOP;

  -- 3) COMISSOES
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p->'comissoes', '[]'::jsonb)) LOOP
    INSERT INTO comissoes (
      salao_id, id_prof, profissional_id, agendamento_id, status,
      servico_nome, valor_servico, porcentagem_comissao, valor_comissao
    ) VALUES (
      v_salao_id,
      (item->>'id_prof')::uuid,
      (item->>'profissional_id')::uuid,
      NULLIF(item->>'agendamento_id', '')::uuid,
      COALESCE(item->>'status', 'Pendente'),
      item->>'servico_nome',
      (item->>'valor_servico')::numeric,
      (item->>'porcentagem_comissao')::numeric,
      (item->>'valor_comissao')::numeric
    );
  END LOOP;

  -- 4) FINALIZA AGENDAMENTOS
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p->'agendamentos', '[]'::jsonb)) LOOP
    UPDATE agendamentos SET
      status         = 'Finalizado',
      cor            = COALESCE(item->>'cor', cor),
      valor_comissao = (item->>'valor_comissao')::numeric,
      comissao_paga  = false,
      desconto       = NULLIF(item->>'desconto', '')::numeric,
      valor_final    = (item->>'valor_final')::numeric
    WHERE id = (item->>'id')::uuid
      AND salao_id = v_salao_id;
  END LOOP;

  RETURN jsonb_build_object('financeiro_id', v_fin_id, 'duplicado', false);
END;
$$;


ALTER FUNCTION "public"."fechar_conta_atomico"("p" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_fidelidade_creditar_pontos"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_config fidelidade_config%rowtype;
  v_pontos integer;
begin
  if NEW.status = 'Finalizado'
     and (OLD.status is distinct from 'Finalizado')
     and NEW.cliente_id is not null
     and coalesce(NEW.valor_final, 0) > 0 then

    select * into v_config from fidelidade_config
      where salao_id = NEW.salao_id and ativo = true;

    if v_config.salao_id is not null then
      v_pontos := floor(NEW.valor_final * v_config.pontos_por_real);

      if v_pontos > 0 then
        insert into fidelidade_transacoes
          (salao_id, cliente_id, tipo, pontos, origem_agendamento_id, descricao)
        values
          (NEW.salao_id, NEW.cliente_id, 'ganho', v_pontos, NEW.id,
           'Pontos por atendimento finalizado');
      end if;
    end if;
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_fidelidade_creditar_pontos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_numero_os"("p_salao_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_mes_ano TEXT;
  v_numero  INTEGER;
BEGIN
  -- Valida que o chamador pertence ao salão solicitado
  IF p_salao_id IS DISTINCT FROM auth_salao_id() THEN
    RAISE EXCEPTION 'Acesso negado: salao_id não corresponde ao token';
  END IF;

  v_mes_ano := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'MM/YY');

  -- Primeiro acesso do mês: insere com proximo=2 e devolve 1
  -- Demais acessos: incrementa e devolve o valor anterior
  INSERT INTO os_contadores (salao_id, mes_ano, proximo)
  VALUES (p_salao_id, v_mes_ano, 2)
  ON CONFLICT (salao_id, mes_ano)
  DO UPDATE SET proximo = os_contadores.proximo + 1
  RETURNING proximo - 1 INTO v_numero;

  RETURN v_mes_ano || '-' || v_numero::TEXT;
END;
$$;


ALTER FUNCTION "public"."gerar_numero_os"("p_salao_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."horarios_ocupados_salao"("p_salao_id" "uuid", "p_data" "date") RETURNS TABLE("profissional_id" "uuid", "inicio" time without time zone, "duracao_min" integer, "status" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    a.profissional_id,
    a.inicio,
    a.duracao_min,
    a.status
  FROM agendamentos a
  WHERE a.salao_id = p_salao_id
    AND a.data     = p_data
    AND a.status   NOT IN ('Cancelado', 'Faltou');
$$;


ALTER FUNCTION "public"."horarios_ocupados_salao"("p_salao_id" "uuid", "p_data" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."limpar_aguardando_pagamento"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  total_cancelados INTEGER;
BEGIN
  WITH cancelados AS (
    UPDATE agendamentos
    SET
      status     = 'Cancelado',
      observacao = COALESCE(observacao || ' | ', '') ||
                   '[Reserva expirada: sinal não pago. Slot liberado automaticamente em ' ||
                   TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ']'
    WHERE
      status     = 'Aguardando Pagamento'
      AND (sinal_pago IS NULL OR sinal_pago = false)
      AND origem   = 'portal'
      AND created_at < NOW() - INTERVAL '20 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO total_cancelados FROM cancelados;

  IF total_cancelados > 0 THEN
    RAISE LOG '[Luarys] % agendamento(s) com sinal expirado cancelado(s)', total_cancelados;
  END IF;
END;
$$;


ALTER FUNCTION "public"."limpar_aguardando_pagamento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesclar_clientes_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."mesclar_clientes_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesclar_produtos_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
    execute format(
      'update public.%I set %I = %L where %I = %L',
      v_fk.table_name, v_fk.column_name, p_manter_id, v_fk.column_name, p_remover_id
    );
  end loop;

  -- 5. Apagar o produto duplicado
  delete from produtos where id = p_remover_id;
end;
$$;


ALTER FUNCTION "public"."mesclar_produtos_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mesclar_servicos_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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

  -- 4. Catch-all dinâmico: qualquer OUTRA FK para servicos.id (agendamentos e
  --    ficha_tecnica já tratados acima → excluídos). Cobre consumos_assinatura,
  --    fidelidade_premios e o que mais surgir.
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
    execute format(
      'update public.%I set %I = %L where %I = %L',
      v_fk.table_name, v_fk.column_name, p_manter_id, v_fk.column_name, p_remover_id
    );
  end loop;

  -- 5. Apagar o serviço duplicado
  delete from servicos where id = p_remover_id;
end;
$$;


ALTER FUNCTION "public"."mesclar_servicos_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nfce_emissoes_touch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."nfce_emissoes_touch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_consumo_whatsapp_mes"("p_mes" "date" DEFAULT ("date_trunc"('month'::"text", "now"()))::"date") RETURNS TABLE("categoria" "text", "origem" "text", "quantidade" bigint, "custo_total" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select categoria, origem, count(*), sum(custo_unitario)
  from public.whatsapp_mensagens_log
  where salao_id = auth_salao_id()
    and criado_em >= p_mes
    and criado_em < (p_mes + interval '1 month')
  group by categoria, origem
  order by categoria, origem;
$$;


ALTER FUNCTION "public"."obter_consumo_whatsapp_mes"("p_mes" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_proximo_numero_nfce"("p_salao_id" "uuid") RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.configuracoes_nfce_produtos
     set proximo_numero = coalesce(proximo_numero, 1) + 1
   where salao_id = p_salao_id
   returning coalesce(proximo_numero, 2) - 1;
$$;


ALTER FUNCTION "public"."obter_proximo_numero_nfce"("p_salao_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."obter_proximo_numero_nfce"("p_salao_id" "uuid") IS 'Reserva e devolve o próximo número sequencial de NFC-e do salão de forma atômica. Retorna NULL se o salão não tiver linha em configuracoes_nfce_produtos.';



CREATE OR REPLACE FUNCTION "public"."obter_saldo_whatsapp"() RETURNS TABLE("saldo_atendimento" integer, "saldo_campanha" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(saldo_atendimento, 0), coalesce(saldo_campanha, 0)
  from public.whatsapp_carteira_creditos
  where salao_id = auth_salao_id();
$$;


ALTER FUNCTION "public"."obter_saldo_whatsapp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."obter_status_fiscal"() RETURNS TABLE("cnpj" "text", "ambiente" "text", "nfse_ativo" boolean, "nfse_faturamento" "text", "nfce_ativo" boolean, "nfce_faturamento" "text", "certificado_status" "text", "certificado_validade" "date")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    cnpj, ambiente,
    nfse_ativo, nfse_faturamento,
    nfce_ativo, nfce_faturamento,
    certificado_status, certificado_validade
  from public.nfe_config_empresa
  where salao_id = auth_salao_id();
$$;


ALTER FUNCTION "public"."obter_status_fiscal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_cliente_ids_do_usuario"("p_uid" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT id FROM clientes WHERE usuario_portal_id = p_uid;
$$;


ALTER FUNCTION "public"."portal_cliente_ids_do_usuario"("p_uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_auditoria_cancelamento_agendamento"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO auditoria_log (salao_id, tabela, operacao, registro_id, dados_antigos, dados_novos, usuario_id)
  VALUES (NEW.salao_id, 'agendamentos_cancelamento', 'UPDATE', NEW.id::text, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."registrar_auditoria_cancelamento_agendamento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_auditoria_financeiro"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO auditoria_log (salao_id, tabela, operacao, registro_id, dados_antigos, usuario_id)
    VALUES (OLD.salao_id, 'financeiro', 'DELETE', OLD.id::text, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO auditoria_log (salao_id, tabela, operacao, registro_id, dados_antigos, dados_novos, usuario_id)
    VALUES (NEW.salao_id, 'financeiro', 'UPDATE', NEW.id::text, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."registrar_auditoria_financeiro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_certificado_fiscal"("p_salao_id" "uuid", "p_validade" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (select 1 from public.nfe_config_empresa where salao_id = p_salao_id) then
    raise exception 'Configuração fiscal não encontrada para este salão (salao_id=%)', p_salao_id;
  end if;

  update public.nfe_config_empresa
    set certificado_status     = 'enviado',
        certificado_validade   = p_validade,
        certificado_enviado_em = now(),
        atualizado_em          = now()
    where salao_id = p_salao_id;
end;
$$;


ALTER FUNCTION "public"."registrar_certificado_fiscal"("p_salao_id" "uuid", "p_validade" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_conversa_whatsapp"("p_salao_id" "uuid", "p_telefone" "text", "p_tipo" "text" DEFAULT 'utilidade'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_existente UUID;
  v_agora TIMESTAMPTZ := NOW();
  v_mes_ref DATE := DATE_TRUNC('month', v_agora)::DATE;
BEGIN
  -- Verifica se há janela aberta (não expirada) com esse número
  SELECT id INTO v_existente
  FROM whatsapp_conversas
  WHERE salao_id = p_salao_id
    AND telefone_cliente = p_telefone
    AND expira_em > v_agora
  LIMIT 1;

  IF v_existente IS NOT NULL THEN
    RETURN FALSE; -- janela existente, não conta
  END IF;

  -- Abre nova janela de 24h
  INSERT INTO whatsapp_conversas(salao_id, telefone_cliente, tipo, aberta_em, expira_em, mes_ref)
  VALUES (p_salao_id, p_telefone, p_tipo, v_agora, v_agora + INTERVAL '24 hours', v_mes_ref);

  -- Incrementa contador mensal
  INSERT INTO whatsapp_uso(salao_id, mes_ref, enviadas)
  VALUES (p_salao_id, v_mes_ref, 1)
  ON CONFLICT (salao_id, mes_ref)
  DO UPDATE SET enviadas = whatsapp_uso.enviadas + 1;

  RETURN TRUE; -- nova conversa, conta na cota
END;
$$;


ALTER FUNCTION "public"."registrar_conversa_whatsapp"("p_salao_id" "uuid", "p_telefone" "text", "p_tipo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resgatar_credito_fidelidade"("p_salao_id" "uuid", "p_cliente_id" "uuid", "p_pontos" integer, "p_financeiro_id" bigint DEFAULT NULL::bigint) RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_saldo           INTEGER;
  v_valor_por_ponto NUMERIC;
  v_valor_reais     NUMERIC;
BEGIN
  -- H1: serializa resgates simultâneos do mesmo cliente no mesmo salão.
  PERFORM pg_advisory_xact_lock(
    hashtext(p_salao_id::text || ':' || p_cliente_id::text)
  );

  SELECT valor_por_ponto INTO v_valor_por_ponto
  FROM fidelidade_config
  WHERE salao_id = p_salao_id
    AND ativo = true
    AND permite_desconto_valor = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate em valor não habilitado para este salão.';
  END IF;

  IF p_pontos <= 0 THEN
    RAISE EXCEPTION 'A quantidade de pontos deve ser maior que zero.';
  END IF;

  SELECT COALESCE(SUM(pontos), 0) INTO v_saldo
  FROM fidelidade_transacoes
  WHERE salao_id = p_salao_id AND cliente_id = p_cliente_id;

  IF v_saldo < p_pontos THEN
    RAISE EXCEPTION 'Saldo insuficiente. O cliente tem % pontos.', v_saldo;
  END IF;

  v_valor_reais := ROUND((p_pontos * v_valor_por_ponto)::NUMERIC, 2);

  INSERT INTO fidelidade_transacoes (salao_id, cliente_id, tipo, pontos, descricao, financeiro_id)
  VALUES (
    p_salao_id,
    p_cliente_id,
    'resgate',
    -p_pontos,
    'Desconto em reais (' || p_pontos || ' pts)',
    p_financeiro_id
  );

  RETURN v_valor_reais;
END;
$$;


ALTER FUNCTION "public"."resgatar_credito_fidelidade"("p_salao_id" "uuid", "p_cliente_id" "uuid", "p_pontos" integer, "p_financeiro_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resgatar_premio_fidelidade"("p_salao_id" "uuid", "p_cliente_id" "uuid", "p_premio_id" "uuid", "p_profissional_id" "uuid", "p_data" "date", "p_inicio" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."resgatar_premio_fidelidade"("p_salao_id" "uuid", "p_cliente_id" "uuid", "p_premio_id" "uuid", "p_profissional_id" "uuid", "p_data" "date", "p_inicio" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resgatar_premio_fidelidade"("p_salao_id" "uuid", "p_cliente_id" "uuid", "p_premio_id" "uuid", "p_profissional_id" "uuid", "p_data" "date", "p_inicio" "text") IS 'Resgate de prêmio de fidelidade. Salão vem de auth_salao_id() (o parâmetro p_salao_id é ignorado — mantido só por compatibilidade de assinatura). Cliente e profissional validados como pertencentes ao salão. Advisory lock por (salão, cliente) impede resgate em dobro por concorrência.';



CREATE OR REPLACE FUNCTION "public"."restaurar_credito_whatsapp"("p_wamid" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_salao_id uuid;
  v_origem   text;
begin
  -- Reivindicação atômica: deleta E lê na mesma instrução.
  -- Se outra transação concorrente já deletou, nada retorna e saímos sem creditar.
  delete from public.whatsapp_mensagens_log
    where meta_message_id = p_wamid
    returning salao_id, origem
    into v_salao_id, v_origem;

  if v_salao_id is null then
    return false;
  end if;

  if v_origem = 'campanha' then
    update public.whatsapp_carteira_creditos
      set saldo_campanha = saldo_campanha + 1, atualizado_em = now()
      where salao_id = v_salao_id;
  else
    update public.whatsapp_carteira_creditos
      set saldo_atendimento = saldo_atendimento + 1, atualizado_em = now()
      where salao_id = v_salao_id;
  end if;

  return true;
end;
$$;


ALTER FUNCTION "public"."restaurar_credito_whatsapp"("p_wamid" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restaurar_credito_whatsapp"("p_wamid" "text") IS 'Devolve 1 crédito quando a Meta reporta status "failed". Idempotente e à prova de concorrência: o DELETE...RETURNING no log é a reivindicação — só quem deletou credita, então webhooks duplicados/simultâneos da Meta nunca restauram duas vezes.';



CREATE OR REPLACE FUNCTION "public"."reverter_movimentos_venda"("p_financeiro_id" bigint, "p_salao_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  item            RECORD;
  v_itens_devolvidos integer := 0;
  v_pontos_liquidos  integer := 0;
  v_ja_revertido     boolean;
BEGIN
  IF p_salao_id IS NULL OR p_salao_id IS DISTINCT FROM auth_salao_id() THEN
    RAISE EXCEPTION 'Salao invalido para o usuario autenticado';
  END IF;
  IF p_financeiro_id IS NULL THEN
    RETURN jsonb_build_object('revertido', false, 'motivo', 'sem financeiro_id');
  END IF;

  -- Serializa reversões concorrentes da MESMA venda.
  PERFORM pg_advisory_xact_lock(hashtext('reverter_venda:' || p_financeiro_id::text));

  -- Idempotência: se já existe contrapartida gravada para esta venda, não repete.
  SELECT EXISTS (
    SELECT 1 FROM historico_estoque
     WHERE financeiro_id = p_financeiro_id AND salao_id = p_salao_id AND tipo = 'Entrada'
    UNION ALL
    SELECT 1 FROM fidelidade_transacoes
     WHERE financeiro_id = p_financeiro_id AND salao_id = p_salao_id AND tipo = 'estorno'
  ) INTO v_ja_revertido;

  IF v_ja_revertido THEN
    RETURN jsonb_build_object('revertido', false, 'motivo', 'ja revertido');
  END IF;

  -- ── ESTOQUE: só produto revendido volta para a prateleira ──────────────────
  -- Insumo de ficha técnica ('Uso no Serviço: ...') foi consumido de fato e
  -- permanece baixado, por decisão de regra.
  FOR item IN
    SELECT produto_id, quantidade
      FROM historico_estoque
     WHERE financeiro_id = p_financeiro_id
       AND salao_id      = p_salao_id
       AND tipo          = 'Saida'
       AND motivo        = 'Venda no Fechamento'
  LOOP
    UPDATE produtos
       SET quantidade_atual = COALESCE(quantidade_atual, 0) + item.quantidade
     WHERE id = item.produto_id
       AND salao_id = p_salao_id;

    IF FOUND THEN
      INSERT INTO historico_estoque (salao_id, produto_id, tipo, quantidade, motivo, financeiro_id)
      VALUES (p_salao_id, item.produto_id, 'Entrada', item.quantidade,
              'Estorno da venda', p_financeiro_id);
      v_itens_devolvidos := v_itens_devolvidos + 1;
    END IF;
  END LOOP;

  -- ── FIDELIDADE: reverte ganho e resgate de uma vez ─────────────────────────
  -- O saldo do cliente é SUM(pontos). Somando os pontos de TODAS as linhas desta
  -- venda (ganho positivo + resgate negativo) e gravando o oposto, os dois lados
  -- voltam ao estado anterior numa única linha. Saldo pode ficar negativo se o
  -- cliente já gastou o que ganhou — proposital, mantém o extrato fiel.
  SELECT COALESCE(SUM(pontos), 0) INTO v_pontos_liquidos
    FROM fidelidade_transacoes
   WHERE financeiro_id = p_financeiro_id
     AND salao_id      = p_salao_id;

  IF v_pontos_liquidos <> 0 THEN
    INSERT INTO fidelidade_transacoes (salao_id, cliente_id, tipo, pontos, descricao, financeiro_id)
    SELECT p_salao_id, cliente_id, 'estorno', -v_pontos_liquidos,
           'Estorno da venda (' || v_pontos_liquidos || ' pts revertidos)', p_financeiro_id
      FROM fidelidade_transacoes
     WHERE financeiro_id = p_financeiro_id AND salao_id = p_salao_id
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'revertido', true,
    'itens_estoque_devolvidos', v_itens_devolvidos,
    'pontos_revertidos', v_pontos_liquidos
  );
END;
$$;


ALTER FUNCTION "public"."reverter_movimentos_venda"("p_financeiro_id" bigint, "p_salao_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reverter_movimentos_venda"("p_financeiro_id" bigint, "p_salao_id" "uuid") IS 'Desfaz estoque (só produto revendido) e pontos de fidelidade (ganho + resgate) de uma venda estornada. Idempotente.';



CREATE OR REPLACE FUNCTION "public"."set_comissao_data_evento"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_data date;
BEGIN
  IF NEW.agendamento_id IS NOT NULL THEN
    SELECT data INTO v_data FROM agendamentos WHERE id = NEW.agendamento_id;
    IF v_data IS NOT NULL THEN NEW.data_evento := v_data; END IF;
  END IF;
  IF NEW.data_evento IS NULL THEN NEW.data_evento := CURRENT_DATE; END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."set_comissao_data_evento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_certificado_fiscal"("p_salao_id" "uuid", "p_validade" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (select 1 from public.nfe_config_empresa where salao_id = p_salao_id) then
    raise exception 'Configuração fiscal não encontrada para este salão (salao_id=%)', p_salao_id;
  end if;

  update public.nfe_config_empresa
    set certificado_status   = 'valido',
        certificado_validade = p_validade,
        atualizado_em        = now()
    where salao_id = p_salao_id;
end;
$$;


ALTER FUNCTION "public"."validar_certificado_fiscal"("p_salao_id" "uuid", "p_validade" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_elegibilidade_comissao"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_prof RECORD;
BEGIN
  SELECT ativo, produtivo, permite_comissao_produtos INTO v_prof
  FROM profissionais WHERE id = NEW.profissional_id;

  IF v_prof IS NULL THEN
    RAISE EXCEPTION 'COMISSAO_PROFISSIONAL_INVALIDO: profissional não encontrado.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_prof.ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'COMISSAO_PROFISSIONAL_INATIVO: profissional inativo não pode receber comissões.'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.tipo = 'servico' THEN
    IF v_prof.produtivo IS NOT TRUE THEN
      RAISE EXCEPTION 'COMISSAO_SERVICO_NAO_PERMITIDA: este profissional não está na agenda e não pode receber comissão de serviços.'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF NEW.tipo = 'produto' THEN
    IF v_prof.permite_comissao_produtos IS NOT TRUE THEN
      RAISE EXCEPTION 'COMISSAO_PRODUTO_NAO_LIBERADA: este profissional não está liberado para comissão de produtos.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."verificar_elegibilidade_comissao"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_limite_profissionais"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_limite integer;
  v_acesso_total boolean;
  v_contagem integer;
  v_era_produtivo_ativo boolean;
  v_vai_ser_produtivo_ativo boolean;
BEGIN
  v_vai_ser_produtivo_ativo := COALESCE(NEW.ativo, true) AND COALESCE(NEW.produtivo, true);

  IF TG_OP = 'UPDATE' THEN
    v_era_produtivo_ativo := COALESCE(OLD.ativo, true) AND COALESCE(OLD.produtivo, true);
  ELSE
    v_era_produtivo_ativo := false;
  END IF;

  IF v_vai_ser_produtivo_ativo AND NOT v_era_produtivo_ativo THEN
    SELECT acesso_total, limite_profissionais INTO v_acesso_total, v_limite
    FROM saloes WHERE id = NEW.salao_id;

    IF v_acesso_total = true OR v_limite IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_contagem
    FROM profissionais
    WHERE salao_id = NEW.salao_id
      AND ativo = true
      AND produtivo = true
      AND id IS DISTINCT FROM NEW.id;

    IF v_contagem + 1 > v_limite THEN
      RAISE EXCEPTION 'LIMITE_PROFISSIONAIS_EXCEDIDO: seu plano permite até % profissional(is) produtivo(s) ativo(s).', v_limite
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."verificar_limite_profissionais"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."aceites_contrato" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "documento_id" integer NOT NULL,
    "versao_aceita" integer NOT NULL,
    "aceito_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_aceite" "text"
);


ALTER TABLE "public"."aceites_contrato" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agendamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid",
    "cliente_id" "uuid",
    "profissional_id" "uuid",
    "servico_id" "uuid",
    "data_hora_inicio" timestamp with time zone,
    "data_hora_fim" timestamp with time zone,
    "status" "text" DEFAULT 'Pendente'::"text",
    "valor_final" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "cliente_nome" "text",
    "inicio" time without time zone,
    "duracao_min" integer,
    "observacao" "text",
    "cor" "text",
    "etiquetas" "jsonb",
    "data" "date",
    "cancelado_por" "text",
    "cancelado_por_nome" "text",
    "motivo_cancelamento" "text",
    "valor_sinal" numeric DEFAULT 0,
    "comissao_paga" boolean DEFAULT false,
    "valor_comissao" double precision DEFAULT '0'::double precision,
    "recorrencia" "text" DEFAULT 'nao'::"text",
    "criado_por" "text",
    "is_demo" boolean DEFAULT false NOT NULL,
    "preco_editado_manualmente" boolean DEFAULT false,
    "eh_encaixe" boolean DEFAULT false NOT NULL,
    "sinal_pago" boolean DEFAULT false NOT NULL,
    "desconto" numeric,
    "tipo_desconto" "text",
    "lembrete_enviado_em" timestamp with time zone,
    "forma_pagamento_sinal" "text",
    "parcelas_sinal" integer
);


ALTER TABLE "public"."agendamentos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agendamentos"."eh_encaixe" IS 'Marcado manualmente pelo salão quando o agendamento foi um encaixe (fora do fluxo normal). Usado apenas para destaque visual na agenda — não afeta cálculo de horários/conflitos.';



CREATE TABLE IF NOT EXISTS "public"."assinaturas_cliente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "plano_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'ativa'::"text" NOT NULL,
    "data_inicio" "date" DEFAULT CURRENT_DATE NOT NULL,
    "dia_vencimento" integer DEFAULT 5 NOT NULL,
    "proxima_cobranca" "date",
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "profissionais_area" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."assinaturas_cliente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auditoria_certificados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "provedor" "text" NOT NULL,
    "nome_arquivo" "text" NOT NULL,
    "tamanho_bytes" integer NOT NULL,
    "ip_origem" "text",
    "sucesso" boolean NOT NULL,
    "mensagem_erro" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auditoria_certificados_provedor_check" CHECK (("provedor" = ANY (ARRAY['focusnfe'::"text", 'brasilnfe'::"text"])))
);


ALTER TABLE "public"."auditoria_certificados" OWNER TO "postgres";


COMMENT ON TABLE "public"."auditoria_certificados" IS 'Trilha de auditoria de uploads de certificado A1. O arquivo (.pfx/.p12) nunca é armazenado — só metadados. Inserções feitas exclusivamente pelo backend (service_role).';



CREATE TABLE IF NOT EXISTS "public"."auditoria_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "tabela" "text" NOT NULL,
    "operacao" "text" NOT NULL,
    "registro_id" "text" NOT NULL,
    "dados_antigos" "jsonb",
    "dados_novos" "jsonb",
    "usuario_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auditoria_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "gatilho" "text" NOT NULL,
    "dias_inatividade" integer,
    "mensagem_template" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "automacoes_gatilho_check" CHECK (("gatilho" = ANY (ARRAY['aniversario'::"text", 'cliente_inativo'::"text"])))
);


ALTER TABLE "public"."automacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avaliacoes_atendimento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "agendamento_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "profissional_id" "uuid",
    "nota_salao" smallint NOT NULL,
    "nota_profissional" smallint,
    "comentario" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "avaliacoes_atendimento_nota_profissional_check" CHECK ((("nota_profissional" >= 1) AND ("nota_profissional" <= 5))),
    CONSTRAINT "avaliacoes_atendimento_nota_salao_check" CHECK ((("nota_salao" >= 1) AND ("nota_salao" <= 5)))
);


ALTER TABLE "public"."avaliacoes_atendimento" OWNER TO "postgres";


COMMENT ON TABLE "public"."avaliacoes_atendimento" IS 'Avaliações deixadas pelo cliente após atendimento finalizado — via Portal do Cliente.';



CREATE TABLE IF NOT EXISTS "public"."avisos_plataforma" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" "text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "tipo" "text" DEFAULT 'info'::"text" NOT NULL,
    "mostrar_no_sistema" boolean DEFAULT true NOT NULL,
    "enviar_email" boolean DEFAULT false NOT NULL,
    "enviar_whatsapp" boolean DEFAULT false NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "criado_por" "uuid",
    CONSTRAINT "avisos_plataforma_tipo_check" CHECK (("tipo" = ANY (ARRAY['info'::"text", 'manutencao'::"text", 'novidade'::"text", 'urgente'::"text"])))
);


ALTER TABLE "public"."avisos_plataforma" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avisos_visualizacoes" (
    "aviso_id" "uuid" NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "visualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."avisos_visualizacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."caixa_transacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "os_numero" "text",
    "cliente_nome" "text",
    "valor_total" numeric DEFAULT 0,
    "forma_pagamento" "text" NOT NULL,
    "status" "text" DEFAULT 'Concluído'::"text",
    "data_hora" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "bandeira_cartao" "text",
    "cliente_id" "uuid",
    "itens" "jsonb"
);


ALTER TABLE "public"."caixa_transacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carteira_clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "cliente_id" "uuid",
    "cliente_nome" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "descricao" "text",
    "agendamento_id" "uuid",
    "forma_pagamento" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "criado_por" "text",
    CONSTRAINT "carteira_clientes_tipo_check" CHECK (("tipo" = ANY (ARRAY['deposito'::"text", 'uso'::"text", 'estorno'::"text"])))
);


ALTER TABLE "public"."carteira_clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid",
    "nome_completo" "text" NOT NULL,
    "telefone_whatsapp" "text" NOT NULL,
    "data_ultima_visita" timestamp with time zone,
    "total_gasto" numeric(10,2) DEFAULT 0.00,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "genero" "text",
    "cpf" "text",
    "nascimento" "text",
    "instagram" "text",
    "como_conheceu" "text",
    "aceita_notificacoes" "text",
    "aceita_campanhas" "text",
    "email" "text",
    "observacoes" "text",
    "telefones" json,
    "foto_url" "text",
    "ativo" boolean DEFAULT true,
    "anamnese" "text",
    "total_visitas" integer,
    "senha" "text",
    "cep" "text",
    "logradouro" "text",
    "numero" "text",
    "complemento" "text",
    "bairro" "text",
    "cidade" "text",
    "estado" "text",
    "usuario_portal_id" "uuid",
    "aceita_marketing" boolean DEFAULT true NOT NULL,
    "canal_notificacao_preferido" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "tipo_cliente" "text" DEFAULT 'PF'::"text" NOT NULL,
    "cnpj" "text",
    "pais" "text" DEFAULT 'Brasil'::"text" NOT NULL,
    CONSTRAINT "clientes_tipo_cliente_check" CHECK (("tipo_cliente" = ANY (ARRAY['PF'::"text", 'PJ'::"text"])))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clientes"."aceita_marketing" IS 'Preferência de marketing do próprio cliente (opt-out). true = aceita promoções/campanhas. false = recusa. Lembretes de agendamento ignoram este campo.';



COMMENT ON COLUMN "public"."clientes"."tipo_cliente" IS 'Pessoa Física (PF) ou Pessoa Jurídica (PJ) — usado por ModalFichaCliente (Agenda). CPF fica em clientes.cpf, CNPJ em clientes.cnpj (colunas separadas, nunca reaproveitar uma pra outra).';



COMMENT ON COLUMN "public"."clientes"."cnpj" IS 'CNPJ do cliente quando tipo_cliente = PJ. Alfanumérico (IN RFB 2.229/2024) — usar src/lib/cnpj.ts se algum dia ganhar validação/formatação nesta tela.';



CREATE TABLE IF NOT EXISTS "public"."cobrancas_assinatura" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "assinatura_id" "uuid" NOT NULL,
    "mes_referencia" "date" NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "data_pagamento" "date",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "forma_pagamento" "text",
    "observacao" "text",
    "lancado_no_financeiro" boolean DEFAULT false,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cobrancas_assinatura" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."codigos_municipais_aceitos" (
    "codigo_ibge" "text" NOT NULL,
    "ctrib_nac" "text" NOT NULL,
    "ctrib_mun" "text" NOT NULL,
    "ambiente" smallint DEFAULT 2 NOT NULL,
    "aceitos" integer DEFAULT 0 NOT NULL,
    "recusados" integer DEFAULT 0 NOT NULL,
    "ultimo_erro" "text",
    "primeira_vez" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."codigos_municipais_aceitos" OWNER TO "postgres";


COMMENT ON TABLE "public"."codigos_municipais_aceitos" IS 'O que cada prefeitura aceitou como cTribMun. Alimentada pela emissão; sugere código no cadastro de serviço. Sem dado de cliente.';



COMMENT ON COLUMN "public"."codigos_municipais_aceitos"."recusados" IS 'Rejeições (E0314 e afins). Código recusado deixa de ser sugerido mesmo que já tenha sido aceito antes — prefeitura muda tabela.';



CREATE TABLE IF NOT EXISTS "public"."comissao_extras" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "profissional_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "valor" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comissao_extras_tipo_check" CHECK (("tipo" = ANY (ARRAY['recebivel'::"text", 'abatimento'::"text"])))
);


ALTER TABLE "public"."comissao_extras" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comissoes" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "id_prof" "uuid",
    "servico_nome" "text",
    "valor_servico" numeric(10,2),
    "porcentagem_comissao" numeric(5,2),
    "valor_comissao" numeric(10,2),
    "data_evento" "date" DEFAULT CURRENT_DATE,
    "valor_cota_salao" numeric,
    "imposto_calculado_prof" numeric DEFAULT 0,
    "salao_id" "uuid",
    "profissional_id" "uuid",
    "agendamento_id" "uuid",
    "status" "text" DEFAULT 'Pendente'::"text",
    "tipo" "text" DEFAULT 'servico'::"text" NOT NULL,
    CONSTRAINT "comissoes_tipo_check" CHECK (("tipo" = ANY (ARRAY['servico'::"text", 'produto'::"text", 'ajuste'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."comissoes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."comissoes"."profissional_id" IS 'FK para profissionais.id — necessário para join PostgREST no relatório de comissões';



COMMENT ON COLUMN "public"."comissoes"."status" IS 'Valores: Pendente | Pago | Cancelado | Estornado';



COMMENT ON COLUMN "public"."comissoes"."tipo" IS 'Valores: servico | produto';



ALTER TABLE "public"."comissoes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."comissoes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comunicados_salao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "tipo" "text" DEFAULT 'comunicado'::"text" NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "imagem_url" "text",
    "link_acao" "text",
    "texto_botao" "text",
    "valido_ate" "date",
    "ativo" boolean DEFAULT true NOT NULL,
    "ordem" smallint DEFAULT 0 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comunicados_salao_tipo_check" CHECK (("tipo" = ANY (ARRAY['promocao'::"text", 'lancamento'::"text", 'comunicado'::"text"])))
);


ALTER TABLE "public"."comunicados_salao" OWNER TO "postgres";


COMMENT ON TABLE "public"."comunicados_salao" IS 'Promoções, lançamentos e comunicados publicados pelo salão — exibidos no Portal do Cliente.';



CREATE TABLE IF NOT EXISTS "public"."config_taxas" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "salao_id" "uuid",
    "max_parcelas" integer DEFAULT 12,
    "taxa_pix" numeric(10,2) DEFAULT 0.00,
    "taxas_cartoes" "jsonb" DEFAULT '{}'::"jsonb",
    "atualizado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."config_taxas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_fiscais_profissionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid",
    "profissional_id" "uuid" NOT NULL,
    "nome_completo" "text" NOT NULL,
    "cpf_cnpj" "text" NOT NULL,
    "tipo_pessoa" "text" DEFAULT 'FÍSICA'::"text",
    "inscricao_municipal" "text",
    "codigo_servico" "text",
    "aliquota" numeric DEFAULT 0,
    "emite_com_certificado_salao" boolean DEFAULT true,
    "usuario_prefeitura" "text",
    "senha_prefeitura" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."configuracoes_fiscais_profissionais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_nfce" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "inscricao_estadual" "text",
    "serie" "text" DEFAULT '001'::"text",
    "ambiente" "text" DEFAULT '2'::"text",
    "csc_token" "text",
    "csc_id" "text",
    "ultima_nnf" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "crt" character varying(1) DEFAULT '1'::character varying,
    "cep" character varying(8),
    "logradouro" character varying(255),
    "numero" character varying(20),
    "complemento" character varying(100),
    "bairro" character varying(100),
    "municipio" character varying(150),
    "cmun" character varying(7),
    "uf" character varying(2),
    "cert_info" "jsonb"
);


ALTER TABLE "public"."configuracoes_nfce" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_nfce_produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "crt" "text" DEFAULT '1'::"text",
    "serie" "text" DEFAULT '001'::"text",
    "ambiente" "text" DEFAULT '2'::"text",
    "csc_token" "text",
    "csc_id" "text",
    "cert_info" "jsonb",
    "proximo_numero" integer DEFAULT 1 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "modo_emissao" "text" DEFAULT 'Lote Manual'::"text" NOT NULL
);


ALTER TABLE "public"."configuracoes_nfce_produtos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_nfse" (
    "salao_id" "uuid" NOT NULL,
    "nome_fantasia" "text",
    "razao_social" "text",
    "cnpj" "text",
    "inscricao_municipal" "text",
    "codigo_servico" "text",
    "codigo_cnae" "text",
    "aliquota" numeric DEFAULT 0.00,
    "serie" "text" DEFAULT '1'::"text",
    "ultimo_rps" integer DEFAULT 0,
    "ultimo_lote" integer DEFAULT 0,
    "tributacao_municipio" "text",
    "regime_especial" "text",
    "optante_simples" "text" DEFAULT '1'::"text",
    "nao_enviar_cnae" boolean DEFAULT false,
    "considerar_desconto_cota" boolean DEFAULT true,
    "emitir_padrao_nacional" boolean DEFAULT true,
    "senha_prefeitura" "text",
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "cpf_usuario" "text",
    "cmc_prestador" "text",
    "pis" numeric DEFAULT 0,
    "cofins" numeric DEFAULT 0
);


ALTER TABLE "public"."configuracoes_nfse" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contratos_aluguel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "locatario_id" "uuid" NOT NULL,
    "numero_estacao" "text",
    "valor_mensal" numeric(10,2) NOT NULL,
    "dia_vencimento" integer DEFAULT 5 NOT NULL,
    "data_inicio" "date" NOT NULL,
    "data_fim" "date",
    "ativo" boolean DEFAULT true,
    "observacoes" "text",
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contratos_aluguel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ativo" boolean DEFAULT true,
    "observacoes" "text",
    "anamnese" "text",
    "aceita_notificacoes" boolean DEFAULT true,
    "aceita_campanhas" boolean DEFAULT true,
    "total_gasto" numeric DEFAULT 0,
    "total_visitas" integer DEFAULT 0,
    "data_ultima_visita" timestamp with time zone,
    "etiquetas" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."crm_clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custos_fixos_salao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "total_estacoes" integer DEFAULT 1 NOT NULL,
    "margem_lucro" numeric(5,2) DEFAULT 30 NOT NULL,
    "itens" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "receita_media_mensal" numeric(10,2) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."custos_fixos_salao" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."despesas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid",
    "descricao" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "data_vencimento" "date" NOT NULL,
    "data_pagamento" "date",
    "status" "text" DEFAULT 'Pendente'::"text",
    "forma_pagamento" "text",
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tipo_custo" "text"
);


ALTER TABLE "public"."despesas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."despesas"."status" IS 'Valores: Pendente | Pago | Estornado';



COMMENT ON COLUMN "public"."despesas"."tipo_custo" IS 'Classificação: Fixo | Variável | NULL (sem classificação = exibido na coluna Sem Classificação)';



CREATE TABLE IF NOT EXISTS "public"."estoque" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid",
    "nome_produto" "text" NOT NULL,
    "quantidade_atual" numeric DEFAULT 0,
    "estoque_minimo" numeric DEFAULT 5,
    "unidade_medida" "text" DEFAULT 'un'::"text",
    "custo_medio" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."estoque" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."etiquetas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "cor" "text" DEFAULT '#8B5CF6'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."etiquetas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ficha_tecnica" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "servico_id" "uuid",
    "produto_id" "uuid",
    "quantidade" numeric(10,3) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."ficha_tecnica" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fidelidade_config" (
    "salao_id" "uuid" NOT NULL,
    "ativo" boolean DEFAULT false NOT NULL,
    "pontos_por_real" numeric DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "permite_desconto_valor" boolean DEFAULT false NOT NULL,
    "valor_por_ponto" numeric(10,4) DEFAULT 0.01 NOT NULL
);


ALTER TABLE "public"."fidelidade_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fidelidade_premios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "servico_id" "uuid",
    "custo_pontos" integer NOT NULL,
    "valor_real" numeric NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fidelidade_premios_custo_pontos_check" CHECK (("custo_pontos" > 0)),
    CONSTRAINT "fidelidade_premios_valor_real_check" CHECK (("valor_real" >= (0)::numeric))
);


ALTER TABLE "public"."fidelidade_premios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fidelidade_servicos_bloqueados" (
    "salao_id" "uuid" NOT NULL,
    "servico_id" "uuid" NOT NULL
);


ALTER TABLE "public"."fidelidade_servicos_bloqueados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fidelidade_transacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "pontos" integer NOT NULL,
    "origem_agendamento_id" "uuid",
    "premio_id" "uuid",
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "financeiro_id" bigint,
    CONSTRAINT "fidelidade_transacoes_tipo_check" CHECK (("tipo" = ANY (ARRAY['ganho'::"text", 'resgate'::"text", 'ajuste'::"text"])))
);


ALTER TABLE "public"."fidelidade_transacoes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."fidelidade_transacoes"."financeiro_id" IS 'Venda que originou a transação de pontos (financeiro.id). Permite ao estorno reverter ganho e resgate da mesma venda. NULL em lançamentos avulsos.';



CREATE TABLE IF NOT EXISTS "public"."fila_envio" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "automacao_id" "uuid" NOT NULL,
    "cliente_id" "uuid",
    "cliente_nome" "text",
    "telefone" "text",
    "mensagem" "text" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "chave_dedup" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "enviado_em" timestamp with time zone,
    CONSTRAINT "fila_envio_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'enviado'::"text", 'ignorado'::"text"])))
);


ALTER TABLE "public"."fila_envio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financeiro" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "salao_id" "uuid",
    "cliente_nome" "text",
    "descricao" "text",
    "tipo" "text",
    "valor" numeric(10,2),
    "metodo_pagamento" "text",
    "comentario" "text",
    "categoria" "text",
    "data_movimentacao" timestamp with time zone DEFAULT "now"(),
    "forma_pagamento" "text",
    "status" "text" DEFAULT 'Pago'::"text",
    "bandeira_cartao" "text",
    "profissional_nome" "text",
    "tipo_custo" "text",
    "agendamento_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "relacao_id" "uuid",
    "os_numero" "text",
    "desconto" numeric,
    "tipo_desconto" "text",
    "pagamentos" "jsonb"
);


ALTER TABLE "public"."financeiro" OWNER TO "postgres";


COMMENT ON COLUMN "public"."financeiro"."status" IS 'Valores: Pago | Pendente | Estornado';



COMMENT ON COLUMN "public"."financeiro"."tipo_custo" IS 'Classificação da saída: Fixo | Variável | NULL (para entradas)';



COMMENT ON COLUMN "public"."financeiro"."agendamento_ids" IS 'IDs dos agendamentos quitados por este lancamento financeiro. Preenchido no fechamento de caixa (useFechamentoCaixa.ts). Lancamentos antigos (antes desta coluna existir) ficam com array vazio -- nao e possivel reconstruir essa ligacao retroativamente com seguranca.';



ALTER TABLE "public"."financeiro" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."financeiro_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."fornecedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "nome_empresa" "text" NOT NULL,
    "nome_contato" "text",
    "telefone" "text",
    "email" "text",
    "chave_pix" "text",
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "razao_social" "text",
    "is_fabricante" boolean DEFAULT false,
    "cep" "text",
    "tipo_logradouro" "text" DEFAULT 'Rua'::"text",
    "logradouro" "text",
    "numero" "text",
    "complemento" "text",
    "bairro" "text",
    "cidade" "text",
    "estado" "text",
    "cnpj" "text",
    "inscricao_estadual" "text",
    "inscricao_municipal" "text"
);


ALTER TABLE "public"."fornecedores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."funcoes" (
    "id" bigint NOT NULL,
    "nome" "text" NOT NULL
);


ALTER TABLE "public"."funcoes" OWNER TO "postgres";


ALTER TABLE "public"."funcoes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."funcoes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."historico_estoque" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid",
    "produto_id" "uuid",
    "tipo" "text" NOT NULL,
    "quantidade" numeric NOT NULL,
    "motivo" "text",
    "data_movimentacao" timestamp with time zone DEFAULT "now"(),
    "pedido_id" "uuid",
    "financeiro_id" bigint
);


ALTER TABLE "public"."historico_estoque" OWNER TO "postgres";


COMMENT ON COLUMN "public"."historico_estoque"."pedido_id" IS 'Pedido da Vitrine que originou a movimentação (quando aplicável). Usado como guarda de idempotência em baixar_estoque_vitrine.';



COMMENT ON COLUMN "public"."historico_estoque"."financeiro_id" IS 'Venda que originou a movimentação (financeiro.id). Preenchido pelo fechamento de conta; é o que permite ao estorno devolver exatamente o que foi baixado. NULL em movimentações manuais do módulo Estoque.';



CREATE TABLE IF NOT EXISTS "public"."lgpd_solicitacoes_exclusao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_portal_id" "uuid" NOT NULL,
    "usuario_email" "text",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "token_confirmacao" "uuid",
    "token_expira_em" timestamp with time zone,
    "solicitado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prazo_resposta_em" timestamp with time zone DEFAULT ("now"() + '15 days'::interval) NOT NULL,
    "processado_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lgpd_solicitacoes_exclusao_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'confirmada'::"text", 'processada'::"text", 'cancelada'::"text"])))
);


ALTER TABLE "public"."lgpd_solicitacoes_exclusao" OWNER TO "postgres";


COMMENT ON TABLE "public"."lgpd_solicitacoes_exclusao" IS 'Rastreia solicitações de exclusão de conta do portal. LGPD Art. 18, VI — o titular tem direito de solicitar exclusão de dados tratados com base no consentimento. Prazo de resposta: 15 dias (Art. 18 §3º). O fluxo é: solicitado_em → confirmação por e-mail → processado_em.';



COMMENT ON COLUMN "public"."lgpd_solicitacoes_exclusao"."usuario_email" IS 'E-mail gravado no momento da solicitação porque será apagado do Auth após execução.';



COMMENT ON COLUMN "public"."lgpd_solicitacoes_exclusao"."token_confirmacao" IS 'UUID v4 gerado no servidor. Enviado por e-mail ao titular para provar identidade. Expira em 24h. Zerado (null) após uso para evitar reuso.';



COMMENT ON COLUMN "public"."lgpd_solicitacoes_exclusao"."prazo_resposta_em" IS 'solicitado_em + 15 dias — prazo legal LGPD Art. 18 §3º. Gerado automaticamente.';



CREATE TABLE IF NOT EXISTS "public"."lista_espera" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid",
    "cliente_nome" "text" NOT NULL,
    "telefone" "text" NOT NULL,
    "servico_desejado" "text",
    "data_desejada" "date",
    "periodo" "text" DEFAULT 'Qualquer'::"text",
    "status" "text" DEFAULT 'Aguardando'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lista_espera" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locatarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "cpf" "text",
    "telefone" "text",
    "email" "text",
    "especialidade" "text",
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."locatarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_auditoria_acoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "profissional_id" "uuid",
    "profissional_nome" "text",
    "permissao_chave" "text" NOT NULL,
    "descricao" "text",
    "referencia_tabela" "text",
    "referencia_id" "uuid",
    "dados_anteriores" "jsonb",
    "dados_novos" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."log_auditoria_acoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."metas_salao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "mes" "text" NOT NULL,
    "meta_bruta" numeric(12,2) DEFAULT 0 NOT NULL,
    "super_meta_bruta" numeric(12,2) DEFAULT 0 NOT NULL,
    "meta_liquida" numeric(12,2) DEFAULT 0 NOT NULL,
    "super_meta_liquida" numeric(12,2) DEFAULT 0 NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."metas_salao" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modelos_contrato_aluguel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "nome" "text" DEFAULT 'Contrato Padrão'::"text" NOT NULL,
    "conteudo" "text" DEFAULT ''::"text" NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."modelos_contrato_aluguel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modulos_catalogo" (
    "chave" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "preco_mensal" numeric(10,2) DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "preco_anual" numeric(10,2)
);


ALTER TABLE "public"."modulos_catalogo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nbs_catalogo" (
    "codigo" "text" NOT NULL,
    "codigo_exibe" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "rotulo" "text" NOT NULL,
    "exemplos" "text",
    "ctribnac" "text",
    "grupo" "text" DEFAULT '1.2602'::"text" NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "fonte" "text" DEFAULT 'Portaria Conjunta RFB/SCS 1.820/2013 (NBS 1.1) — MDIC'::"text" NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."nbs_catalogo" OWNER TO "postgres";


COMMENT ON TABLE "public"."nbs_catalogo" IS 'NBS oficial (MDIC) para o enquadramento IBS/CBS. Referência nacional, igual para todos os salões — não confundir com o código MUNICIPAL, que é por prefeitura e mora em codigos_municipais_aceitos.';



COMMENT ON COLUMN "public"."nbs_catalogo"."ctribnac" IS 'cTribNac sugerido para o item. É federal, mas o salão pode ajustar por orientação da contabilidade dele.';



CREATE TABLE IF NOT EXISTS "public"."nfce_emissoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "referencia" "text" NOT NULL,
    "numero" integer NOT NULL,
    "serie" "text",
    "status" "text" DEFAULT 'processando'::"text" NOT NULL,
    "chave_acesso" "text",
    "link_danfe" "text",
    "link_xml" "text",
    "mensagem_erro" "text",
    "valor_total" numeric(12,2),
    "payload" "jsonb",
    "os_numero" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "storage_path_xml" "text",
    "storage_path_danfe" "text"
);


ALTER TABLE "public"."nfce_emissoes" OWNER TO "postgres";


COMMENT ON TABLE "public"."nfce_emissoes" IS 'Registro de toda tentativa de emissão de NFC-e (PDV/produtos). Inserido antes da chamada à Focus NFe e atualizado com o resultado — nunca deve existir NFC-e autorizada na SEFAZ sem linha aqui.';



COMMENT ON COLUMN "public"."nfce_emissoes"."chave_acesso" IS 'Chave de acesso de 44 caracteres. TEXT de propósito: desde 01/07/2026 aceita letras (CNPJ alfanumérico) — nunca converter para tipo numérico.';



CREATE TABLE IF NOT EXISTS "public"."nfe_config_empresa" (
    "salao_id" "uuid" NOT NULL,
    "cnpj" "text" NOT NULL,
    "company_token" "text",
    "ambiente" "text" DEFAULT 'homologacao'::"text" NOT NULL,
    "nfse_ativo" boolean DEFAULT false NOT NULL,
    "nfse_faturamento" "text",
    "nfse_ativado_em" timestamp with time zone,
    "nfce_ativo" boolean DEFAULT false NOT NULL,
    "nfce_faturamento" "text",
    "nfce_ativado_em" timestamp with time zone,
    "certificado_status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "certificado_validade" "date",
    "certificado_enviado_em" timestamp with time zone,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "nfe_config_empresa_ambiente_check" CHECK (("ambiente" = ANY (ARRAY['homologacao'::"text", 'producao'::"text"]))),
    CONSTRAINT "nfe_config_empresa_certificado_status_check" CHECK (("certificado_status" = ANY (ARRAY['pendente'::"text", 'enviado'::"text", 'valido'::"text", 'expirado'::"text", 'invalido'::"text"]))),
    CONSTRAINT "nfe_config_empresa_nfce_faturamento_check" CHECK (("nfce_faturamento" = ANY (ARRAY['direto'::"text", 'centralizado'::"text"]))),
    CONSTRAINT "nfe_config_empresa_nfse_faturamento_check" CHECK (("nfse_faturamento" = ANY (ARRAY['direto'::"text", 'centralizado'::"text"])))
);


ALTER TABLE "public"."nfe_config_empresa" OWNER TO "postgres";


COMMENT ON TABLE "public"."nfe_config_empresa" IS 'Configuração fiscal de cada salão junto ao provedor Brasil NF-e. Um registro por CNPJ (salão).';



CREATE TABLE IF NOT EXISTS "public"."nfe_emissoes_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "numero_documento" "text",
    "chave_acesso" "text",
    "status" "text" NOT NULL,
    "valor" numeric(10,2),
    "agendamento_id" "uuid",
    "venda_vitrine_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "nfe_emissoes_log_status_check" CHECK (("status" = ANY (ARRAY['emitida'::"text", 'rejeitada'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "nfe_emissoes_log_tipo_check" CHECK (("tipo" = ANY (ARRAY['nfse'::"text", 'nfce'::"text"])))
);


ALTER TABLE "public"."nfe_emissoes_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notas_fiscais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "cliente_nome" "text",
    "descricao_servico" "text",
    "valor" numeric NOT NULL,
    "status" "text" DEFAULT 'Não Emitido'::"text",
    "numero_nota" "text",
    "motivo_rejeicao" "text",
    "data_criacao" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "valor_cota_salao" numeric DEFAULT 0,
    "valor_cota_profissional" numeric DEFAULT 0,
    "profissional_nome" "text",
    "profissional_documento" "text",
    "rps_numero" integer,
    "lote_numero" integer,
    "tipo_nota" character varying(10) DEFAULT 'NFSE'::character varying,
    "chave_acesso" "text",
    "ambiente" character varying(1) DEFAULT '2'::character varying,
    "protocolo_sefaz" character varying(50),
    "qr_code_url" "text",
    "xml_assinado" "text",
    "cpf_cliente" character varying(11),
    "id_externo" "text",
    "link_pdf" "text",
    "link_xml" "text",
    "data_emissao" timestamp with time zone,
    "mensagem_erro" "text",
    "cliente_cpf" "text",
    "item_lista_servico" "text" DEFAULT '06.01'::"text",
    "financeiro_id" bigint,
    "cnpj_profissional" "text",
    "tipo_parceiro" "text",
    "data_movimentacao" timestamp with time zone,
    "cod_lote_brasilnfe" "text",
    "storage_path_xml" "text",
    "storage_path_pdf" "text",
    "aliquota_iss" numeric,
    "codigo_tributacao_municipio" "text",
    "nbs" "text",
    "codigo_verificacao" "text",
    "base_calculo" numeric(12,2),
    "valor_iss" numeric(12,2),
    "aliquota_apurada" numeric(7,4),
    CONSTRAINT "notas_fiscais_status_valido" CHECK (("status" = ANY (ARRAY['Não Emitido'::"text", 'Pendente'::"text", 'Emitida'::"text", 'Erro'::"text", 'Cancelada'::"text", 'Dispensada'::"text", 'Histórico'::"text"]))),
    CONSTRAINT "notas_fiscais_tipo_parceiro_check" CHECK ((("tipo_parceiro" IS NULL) OR ("tipo_parceiro" = ANY (ARRAY['parceiro_cnpj'::"text", 'parceiro_cpf'::"text", 'clt'::"text", 'pj'::"text", 'socio'::"text"]))))
);


ALTER TABLE "public"."notas_fiscais" OWNER TO "postgres";


COMMENT ON COLUMN "public"."notas_fiscais"."numero_nota" IS 'Número da nota emitida pela prefeitura';



COMMENT ON COLUMN "public"."notas_fiscais"."chave_acesso" IS 'Chave de acesso. NFS-e nacional tem 50 caracteres; NF-e/NFC-e, 44. Abre a nota em nfse.gov.br/ConsultaPublica/?tpc=1&chave=<chave>';



COMMENT ON COLUMN "public"."notas_fiscais"."id_externo" IS 'UUID da nota no Focus NFe (referencia passada na requisição)';



COMMENT ON COLUMN "public"."notas_fiscais"."link_pdf" IS 'URL pública do PDF da NFS-e (retornada pelo Focus NFe)';



COMMENT ON COLUMN "public"."notas_fiscais"."link_xml" IS 'URL pública do XML da NFS-e (retornada pelo Focus NFe)';



COMMENT ON COLUMN "public"."notas_fiscais"."item_lista_servico" IS 'Código LC 116/2003 — padrão 06.01 para salões de beleza';



COMMENT ON COLUMN "public"."notas_fiscais"."cnpj_profissional" IS 'CNPJ/MEI do profissional parceiro (campo gDed do NFS-e). Nulo para CLT/PJ sem dedução.';



COMMENT ON COLUMN "public"."notas_fiscais"."tipo_parceiro" IS 'Regime fiscal do profissional: parceiro_cnpj (deduz receita bruta), parceiro_cpf (RPA+INSS 11%), etc.';



COMMENT ON COLUMN "public"."notas_fiscais"."nbs" IS 'NBS do servico (Lei da Transparencia). Congelado no fechamento, como aliquota_iss e cTribNac.';



COMMENT ON COLUMN "public"."notas_fiscais"."aliquota_apurada" IS 'Alíquota que a prefeitura aplicou, não a que enviamos. Divergência entre as duas indica enquadramento errado.';



CREATE TABLE IF NOT EXISTS "public"."notas_fiscais_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nota_fiscal_id" "uuid",
    "produto_id" "uuid",
    "numero_item" integer,
    "cprod" character varying(50),
    "xprod" character varying(255),
    "ncm" character varying(8),
    "cfop" character varying(4),
    "csosn" character varying(3),
    "unidade" character varying(6) DEFAULT 'UN'::character varying,
    "quantidade" numeric(12,4) DEFAULT 1,
    "valor_unitario" numeric(12,2) DEFAULT 0,
    "valor_total" numeric(12,2) DEFAULT 0,
    "valor_desconto" numeric(12,2) DEFAULT 0
);


ALTER TABLE "public"."notas_fiscais_itens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notas_fiscais_plataforma" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pagamento_id" "uuid",
    "salao_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "numero_nota" "text",
    "link_pdf" "text",
    "observacao" "text",
    "data_emissao" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notas_fiscais_plataforma_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'emitida'::"text", 'isento'::"text", 'erro'::"text"])))
);


ALTER TABLE "public"."notas_fiscais_plataforma" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid",
    "titulo" "text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "lida" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "destinatario_tipo" "text" DEFAULT 'salao'::"text" NOT NULL,
    "destinatario_id" "uuid",
    "tipo" "text" DEFAULT ''::"text" NOT NULL,
    "agendamento_id" "uuid",
    CONSTRAINT "notificacoes_destinatario_tipo_check" CHECK (("destinatario_tipo" = ANY (ARRAY['salao'::"text", 'cliente'::"text"])))
);


ALTER TABLE "public"."notificacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."os_contadores" (
    "salao_id" "uuid" NOT NULL,
    "mes_ano" "text" NOT NULL,
    "proximo" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."os_contadores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagamentos_aluguel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "contrato_id" "uuid" NOT NULL,
    "mes_referencia" "date" NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "data_pagamento" "date",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "forma_pagamento" "text",
    "observacao" "text",
    "lancado_no_financeiro" boolean DEFAULT false,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pagamentos_aluguel" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pagamentos_aluguel"."status" IS 'Valores: pendente | pago | estornado  (minúsculas por convenção do módulo de aluguel)';



CREATE TABLE IF NOT EXISTS "public"."pagamentos_assinatura" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "modulo_chave" "text" NOT NULL,
    "valor" numeric(10,2) NOT NULL,
    "status" "text" NOT NULL,
    "gateway" "text" DEFAULT 'mercadopago'::"text" NOT NULL,
    "pagamento_externo_id" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pagamentos_assinatura" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parceiro_documentos_mensais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "profissional_id" "uuid" NOT NULL,
    "competencia" "date" NOT NULL,
    "nota_recebida" boolean DEFAULT false NOT NULL,
    "nota_numero" "text",
    "nota_valor" numeric(12,2),
    "nota_data" "date",
    "das_comprovado" boolean DEFAULT false NOT NULL,
    "das_data" "date",
    "observacao" "text",
    "registrado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "registrado_por" "uuid",
    CONSTRAINT "competencia_no_primeiro_dia" CHECK ((EXTRACT(day FROM "competencia") = (1)::numeric))
);


ALTER TABLE "public"."parceiro_documentos_mensais" OWNER TO "postgres";


COMMENT ON TABLE "public"."parceiro_documentos_mensais" IS 'Lastro documental da exclusao da cota-parte da receita bruta: nota fiscal do parceiro ao salao e comprovante do DAS, por competencia.';



CREATE TABLE IF NOT EXISTS "public"."pedidos_vitrine" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "itens" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "gateway" "text",
    "gateway_tx_id" "text",
    "pago_em" timestamp with time zone,
    "observacao" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pedidos_vitrine_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'pago'::"text", 'cancelado'::"text", 'entregue'::"text"])))
);


ALTER TABLE "public"."pedidos_vitrine" OWNER TO "postgres";


COMMENT ON TABLE "public"."pedidos_vitrine" IS 'Pedidos feitos pelo Portal do Cliente na vitrine de produtos.';



CREATE TABLE IF NOT EXISTS "public"."perfis_usuarios" (
    "id" "uuid" NOT NULL,
    "salao_id" "uuid",
    "nome" "text",
    "regra" "text" DEFAULT 'dono'::"text",
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    "nivel_acesso" "text" DEFAULT 'admin'::"text",
    "telefone" "text",
    "is_plataforma_admin" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."perfis_usuarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planos" (
    "chave" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "limite_profissionais" integer,
    "preco_mensal" numeric(10,2),
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "preco_anual" numeric(10,2)
);


ALTER TABLE "public"."planos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planos_assinatura_cliente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "preco_mensal" numeric(10,2) DEFAULT 0 NOT NULL,
    "desconto_percentual" numeric(5,2) DEFAULT 0 NOT NULL,
    "servicos_inclusos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cor" "text" DEFAULT '#D4AF37'::"text",
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."planos_assinatura_cliente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plataforma_config" (
    "id" integer DEFAULT 1 NOT NULL,
    "gateway_pagamento" "text" DEFAULT 'mercadopago'::"text" NOT NULL,
    CONSTRAINT "plataforma_config_gateway_pagamento_check" CHECK (("gateway_pagamento" = ANY (ARRAY['mercadopago'::"text", 'infinitepay'::"text"]))),
    CONSTRAINT "plataforma_config_singleton" CHECK (("id" = 1))
);


ALTER TABLE "public"."plataforma_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plataforma_config_financeira" (
    "id" integer DEFAULT 1 NOT NULL,
    "taxa_cartao_credito" numeric(5,2) DEFAULT 0,
    "taxa_cartao_debito" numeric(5,2) DEFAULT 0,
    "taxa_pix" numeric(5,2) DEFAULT 0,
    "imposto_percentual" numeric(5,2) DEFAULT 0,
    CONSTRAINT "apenas_uma_linha" CHECK (("id" = 1))
);


ALTER TABLE "public"."plataforma_config_financeira" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plataforma_contas_recebimento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "gateway" "text" NOT NULL,
    "mercadopago_access_token" "text",
    "infinitepay_handle" "text",
    "ativa" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mercadopago_webhook_secret" "text",
    "infinitepay_webhook_token" "text",
    "cielo_merchant_id" "text",
    "cielo_merchant_key" "text",
    "asaas_api_key" "text",
    "asaas_environment" "text"
);


ALTER TABLE "public"."plataforma_contas_recebimento" OWNER TO "postgres";


COMMENT ON COLUMN "public"."plataforma_contas_recebimento"."mercadopago_webhook_secret" IS 'Segredo HMAC configurado no painel do Mercado Pago para validar assinatura dos webhooks.';



COMMENT ON COLUMN "public"."plataforma_contas_recebimento"."infinitepay_webhook_token" IS 'Token compartilhado enviado pela InfinitePay no header Authorization dos webhooks.';



COMMENT ON COLUMN "public"."plataforma_contas_recebimento"."asaas_api_key" IS 'Chave de API (access_token) da conta Asaas usada para cobrar assinatura/módulos dos salões.';



COMMENT ON COLUMN "public"."plataforma_contas_recebimento"."asaas_environment" IS '"sandbox" ou "production" (padrão production quando nulo) — ver ASAAS_ENVIRONMENT em criar-checkout/route.ts e webhooks/asaas/route.ts.';



CREATE TABLE IF NOT EXISTS "public"."plataforma_despesas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "descricao" "text" NOT NULL,
    "valor" numeric(10,2) DEFAULT 0 NOT NULL,
    "tipo" "text" NOT NULL,
    "ativa" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "plataforma_despesas_tipo_check" CHECK (("tipo" = ANY (ARRAY['fixa'::"text", 'variavel'::"text"])))
);


ALTER TABLE "public"."plataforma_despesas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plataforma_documentos" (
    "id" integer NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "conteudo" "text" DEFAULT ''::"text" NOT NULL,
    "versao" integer DEFAULT 1 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plataforma_documentos_tipo_check" CHECK (("tipo" = ANY (ARRAY['regras'::"text", 'contrato'::"text", 'termos_uso'::"text", 'privacidade'::"text", 'dpa'::"text"])))
);


ALTER TABLE "public"."plataforma_documentos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."plataforma_documentos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."plataforma_documentos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."plataforma_documentos_id_seq" OWNED BY "public"."plataforma_documentos"."id";



CREATE TABLE IF NOT EXISTS "public"."plataforma_nfse_config" (
    "id" integer DEFAULT 1 NOT NULL,
    "cnpj" "text",
    "razao_social" "text",
    "inscricao_municipal" "text",
    "codigo_ibge" "text",
    "regime_tributario" "text" DEFAULT 'Simples Nacional'::"text",
    "aliquota_padrao" numeric(5,2) DEFAULT 2.00,
    "item_lista_servico" "text" DEFAULT '01.07'::"text",
    "provedor" "text" DEFAULT 'focusnfe'::"text",
    "token_focus" "text",
    "token_brasilnfe" "text",
    "ambiente" "text" DEFAULT 'sandbox'::"text",
    "modo_emissao" "text" DEFAULT 'manual'::"text",
    "atualizado_em" timestamp with time zone,
    CONSTRAINT "apenas_uma_linha" CHECK (("id" = 1))
);


ALTER TABLE "public"."plataforma_nfse_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plataforma_whatsapp_config" (
    "id" integer DEFAULT 1 NOT NULL,
    "provedor" "text" DEFAULT 'meta'::"text" NOT NULL,
    "token" "text",
    "phone_number_id" "text",
    "waba_id" "text",
    "atualizado_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "apenas_uma_linha" CHECK (("id" = 1))
);


ALTER TABLE "public"."plataforma_whatsapp_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."portal_push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."precificacao_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."precificacao_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."precificacao_config" IS 'Configurações do Luarys Precifica por salão (custos fixos, horas/mês, margem, imposto, taxas). Migrado de localStorage para banco em jun/2026 para permitir acesso multi-dispositivo.';



CREATE TABLE IF NOT EXISTS "public"."preferencias_sidebar" (
    "usuario_id" "uuid" NOT NULL,
    "ordem" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "ocultos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preferencias_sidebar" OWNER TO "postgres";


COMMENT ON TABLE "public"."preferencias_sidebar" IS 'Preferencia pessoal de cada login para a ordem/visibilidade dos itens editaveis da Sidebar. Nao afeta permissoes (RBAC) -- so decora o que o usuario ja pode ver.';



COMMENT ON COLUMN "public"."preferencias_sidebar"."ordem" IS 'Ids dos NavLink editaveis (ex: "agenda", "crm", "financeiro"), na ordem que o usuario escolheu. Itens com permissao que nao estao nesta lista aparecem no final, na ordem padrao do sistema.';



COMMENT ON COLUMN "public"."preferencias_sidebar"."ocultos" IS 'Ids dos NavLink editaveis que o usuario escolheu esconder. Itens fixos (notas fiscais, migracao) nunca podem entrar aqui -- a tela de edicao nem oferece essa opcao para eles.';



CREATE TABLE IF NOT EXISTS "public"."produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid",
    "nome_produto" "text" NOT NULL,
    "categoria" "text",
    "unidade_medida" "text",
    "quantidade_atual" numeric DEFAULT 0,
    "estoque_minimo" numeric DEFAULT 0,
    "custo_medio" numeric DEFAULT 0,
    "preco_venda" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ncm" "text",
    "cfop_padrao" "text" DEFAULT '5102'::"text",
    "csosn_padrao" "text" DEFAULT '102'::"text",
    "codigo_barras" "text",
    "subcategoria" "text",
    "codigo_sku" character varying(50),
    "cest" character varying(7),
    "origem" character varying(1) DEFAULT '0'::character varying,
    "visivel_vitrine" boolean DEFAULT false NOT NULL,
    "imagem_url" "text",
    "descricao_vitrine" "text",
    "cclasstrib" "text"
);


ALTER TABLE "public"."produtos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."produtos"."cclasstrib" IS 'Código de Classificação Tributária do IBS/CBS (Reforma Tributária). Nulo = usa o padrão 000001 do provedor. Confirmar com a contabilidade.';



CREATE TABLE IF NOT EXISTS "public"."profissionais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid",
    "nome" "text" NOT NULL,
    "percentual_comissao" numeric(5,2) DEFAULT 0.00,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "cargo" "text",
    "perfil_avancado" json,
    "especialidades" json DEFAULT '[ ]'::json,
    "servicos_comissoes" json,
    "cnpj_mei" "text",
    "inscricao_municipal" "text",
    "permissoes" "jsonb" DEFAULT '{"editar_equipe": false, "fazer_estorno": false, "ver_dashboard": false, "acesso_sistema": false, "ver_financeiro": false, "aplicar_desconto": false, "ver_propria_agenda": false, "ver_proprio_faturamento": false, "bloquear_proprio_horario": false, "criar_proprio_agendamento": false, "editar_valores_proprio_agendamento": false}'::"jsonb",
    "foto_url" "text",
    "comissao_produtos" numeric DEFAULT 0,
    "horarios_funcionamento" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "produtivo" boolean DEFAULT true NOT NULL,
    "is_demo" boolean DEFAULT false NOT NULL,
    "permite_comissao_produtos" boolean DEFAULT false NOT NULL,
    "tipo_parceiro" "text",
    CONSTRAINT "profissionais_tipo_parceiro_check" CHECK (("tipo_parceiro" = ANY (ARRAY['parceiro_cnpj'::"text", 'parceiro_cpf'::"text", 'clt'::"text", 'pj'::"text", 'socio'::"text"])))
);


ALTER TABLE "public"."profissionais" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profissionais"."tipo_parceiro" IS 'parceiro_cnpj = Lei 13.352/2016 com CNPJ (cota excluída da receita bruta do salão no Simples);
   parceiro_cpf  = Lei 13.352/2016 sem CNPJ (salão tributa valor total);
   clt           = CLT registrado;
   pj            = Prestador PJ avulso;
   socio         = Sócio/Cotista.';



CREATE OR REPLACE VIEW "public"."profissionais_publico" WITH ("security_invoker"='true') AS
 SELECT "id",
    "salao_id",
    "nome",
    "foto_url",
    "ativo",
    "produtivo",
    "perfil_avancado"
   FROM "public"."profissionais"
  WHERE (("ativo" = true) AND ("produtivo" = true));


ALTER VIEW "public"."profissionais_publico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salao_modulos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "modulo_chave" "text" NOT NULL,
    "ativo" boolean DEFAULT false NOT NULL,
    "origem" "text" DEFAULT 'manual'::"text" NOT NULL,
    "ativado_em" timestamp with time zone,
    "pagamento_externo_id" "text",
    "periodicidade" "text" DEFAULT 'mensal'::"text" NOT NULL,
    "renovacao_em" "date",
    "cancelamento_agendado" boolean DEFAULT false NOT NULL,
    "preco_customizado" numeric(10,2),
    "aviso_enviado_em" timestamp with time zone,
    "periodo" "text" DEFAULT 'mensal'::"text",
    "segundo_aviso_enviado_em" timestamp with time zone,
    "asaas_subscription_id" "text",
    "lembretes_enviados" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "salao_modulos_periodicidade_check" CHECK (("periodicidade" = ANY (ARRAY['mensal'::"text", 'semestral'::"text", 'anual'::"text"]))),
    CONSTRAINT "salao_modulos_periodo_check" CHECK (("periodo" = ANY (ARRAY['mensal'::"text", 'anual'::"text"])))
);


ALTER TABLE "public"."salao_modulos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."salao_modulos"."asaas_subscription_id" IS 'ID da subscription no Asaas (cobrança recorrente deste módulo). Usado para cancelar a recorrência no Asaas quando o salão desativa o módulo.';



COMMENT ON COLUMN "public"."salao_modulos"."lembretes_enviados" IS 'Lembretes antecipados já enviados, por chave: {"d2":"<iso>","d1":"<iso>"}. Separado de aviso_enviado_em, que é o aviso de D+0.';



CREATE TABLE IF NOT EXISTS "public"."salao_planos_historico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "plano_anterior" "text",
    "plano_novo" "text",
    "alterado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."salao_planos_historico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salao_whatsapp_pacote" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "tipo" "text" DEFAULT 'mensal'::"text" NOT NULL,
    "limite_mes" integer,
    "creditos_saldo" integer,
    "ativo" boolean DEFAULT true NOT NULL,
    "contratado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."salao_whatsapp_pacote" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saloes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome_fantasia" "text" NOT NULL,
    "telefone_whatsapp" "text",
    "plano_atual" "text" DEFAULT 'Starter'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "cnpj" "text",
    "razao_social" "text",
    "telefone" "text",
    "plano" "text" DEFAULT 'Premium'::"text",
    "email_contato" "text",
    "cep" "text",
    "logradouro" "text",
    "numero" "text",
    "complemento" "text",
    "bairro" "text",
    "cidade" "text",
    "estado" "text",
    "uf" "text",
    "cobrar_sinal" boolean DEFAULT false,
    "porcentagem_sinal" integer DEFAULT 20,
    "gateway_pagamento" "text" DEFAULT 'mercadopago'::"text",
    "token_pagamento" "text",
    "slug" "text",
    "horarios_funcionamento" "text",
    "sobre_nos" "text",
    "politica_cancelamento" "text",
    "instagram" "text",
    "site" "text",
    "modulo_fiscal_ativo" boolean DEFAULT false,
    "is_vip" boolean DEFAULT false,
    "inscricao_estadual" "text",
    "cnae" "text",
    "inscricao_municipal" "text",
    "codigo_ibge" "text",
    "msg_whatsapp" "text",
    "msg_email" "text",
    "api_whatsapp_liberada" boolean DEFAULT false,
    "acesso_total" boolean DEFAULT false NOT NULL,
    "limite_profissionais" integer,
    "modulo_fiscal_liberado" boolean DEFAULT false NOT NULL,
    "ambiente_demo" boolean DEFAULT false NOT NULL,
    "plano_chave" "text",
    "plano_periodicidade" "text" DEFAULT 'mensal'::"text" NOT NULL,
    "plano_renovacao_em" "date",
    "preco_legado" numeric(10,2),
    "trial_termina_em" "date",
    "config_comissao_nomenclatura" "text" DEFAULT 'comissao'::"text",
    "config_comissao_custo_op" "text" DEFAULT 'nao_descontar'::"text",
    "email_fiscal" "text",
    "regime_tributario" "text",
    "pin_gerente" "text",
    "msg_confirmacao_agendamento" "text",
    "config_comissao_taxa_op_modo" "text" DEFAULT 'nao_descontar'::"text",
    "config_comissao_taxa_op_percentual" numeric DEFAULT 0,
    "config_fiscal" "jsonb" DEFAULT '{}'::"jsonb",
    "email_contador" "text",
    "responsavel_nome" "text",
    "responsavel_cpf" "text",
    "trial_expiracao" timestamp with time zone,
    "plano_contratado_em" timestamp with time zone,
    "limite_whatsapp_mes" integer DEFAULT 100,
    "plano_assinatura" "text" DEFAULT 'trial'::"text" NOT NULL,
    "status_assinatura" "text" DEFAULT 'trial'::"text" NOT NULL,
    "assinatura_inicio" timestamp with time zone,
    "assinatura_fim" timestamp with time zone,
    "valor_mensalidade" numeric(10,2),
    "gateway_assinatura_id" "text",
    "plano_aviso_enviado_em" timestamp with time zone,
    "plano_periodo" "text" DEFAULT 'mensal'::"text",
    "msg_whatsapp_aniversario" "text",
    "status_fiscal" "text" DEFAULT 'inativo'::"text" NOT NULL,
    "token_nfse_salao" "text",
    "token_nfce_salao" "text",
    "a1_path" "text",
    "a1_senha_enc" "text",
    "a1_enviado_em" timestamp with time zone,
    "fiscal_ativado_em" timestamp with time zone,
    "plano_segundo_aviso_enviado_em" timestamp with time zone,
    "vitrine_liberada" boolean DEFAULT false NOT NULL,
    "prazo_sinal_minutos" integer DEFAULT 20 NOT NULL,
    "confirmacao_antecedencia_horas" integer DEFAULT 24 NOT NULL,
    "asaas_subscription_id" "text",
    "cancelamento_agendado" boolean DEFAULT false NOT NULL,
    "limite_notas_mes" integer DEFAULT 150 NOT NULL,
    "lembretes_enviados" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "saloes_confirmacao_antecedencia_horas_check" CHECK (("confirmacao_antecedencia_horas" = ANY (ARRAY[6, 12, 24]))),
    CONSTRAINT "saloes_plano_periodicidade_check" CHECK (("plano_periodicidade" = ANY (ARRAY['mensal'::"text", 'semestral'::"text", 'anual'::"text"]))),
    CONSTRAINT "saloes_plano_periodo_check" CHECK (("plano_periodo" = ANY (ARRAY['mensal'::"text", 'anual'::"text"])))
);


ALTER TABLE "public"."saloes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."saloes"."plano_assinatura" IS 'trial | basico | profissional | premium';



COMMENT ON COLUMN "public"."saloes"."status_assinatura" IS 'trial | ativo | suspenso | cancelado';



COMMENT ON COLUMN "public"."saloes"."asaas_subscription_id" IS 'ID da subscription no Asaas (cobrança recorrente do plano base). Usado para cancelar a recorrência no Asaas quando o salão troca/cancela de plano.';



CREATE OR REPLACE VIEW "public"."saloes_publico" WITH ("security_invoker"='true') AS
 SELECT "id",
    "slug",
    "nome_fantasia",
    "telefone",
    "horarios_funcionamento",
    "cobrar_sinal",
    "porcentagem_sinal",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
    "cep",
    "sobre_nos",
    "politica_cancelamento",
    "instagram",
    "site"
   FROM "public"."saloes";


ALTER VIEW "public"."saloes_publico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."servicos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid",
    "nome_servico" "text" NOT NULL,
    "preco_padrao" numeric(10,2) NOT NULL,
    "duracao_minutos" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "descricao" "text",
    "tipo_preco" "text" DEFAULT 'Fixo'::"text",
    "codigo_servico_municipal" "text" DEFAULT '04.01'::"text",
    "produto_associado_id" "uuid",
    "gasto_estimado_produto" numeric DEFAULT 0,
    "custo_fixo_operacional" numeric DEFAULT 0,
    "categoria" "text" DEFAULT 'Geral'::"text",
    "exibir_online" boolean DEFAULT true,
    "custo_operacional" numeric DEFAULT 0,
    "tipo_despesa" "text" DEFAULT 'Fixo'::"text",
    "valor_despesa" numeric DEFAULT 0,
    "preco_promocional" numeric(10,2),
    "custo_produto" numeric(10,2) DEFAULT 0,
    "custo_produto_prof" numeric(10,2) DEFAULT 0,
    "custo_descartaveis" numeric(10,2) DEFAULT 0,
    "custo_op_estabelecimento" numeric(10,2) DEFAULT 0,
    "custo_op_profissional" numeric(10,2) DEFAULT 0,
    "is_demo" boolean DEFAULT false NOT NULL,
    "aliquota_iss" numeric(5,2) DEFAULT 0,
    "codigo_municipio" "text",
    "nbs" "text",
    "setor" "text",
    "comissao_padrao" numeric,
    "eh_cortesia" boolean DEFAULT false NOT NULL,
    "dias_retorno_medio" integer,
    "codigo_tributacao_nacional" "text"
);


ALTER TABLE "public"."servicos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."servicos"."comissao_padrao" IS 'Percentual de comissão sugerido como padrão deste serviço. Usado para pré-preencher o campo ao habilitar o serviço para um profissional novo em AbaEquipe. NÃO é a comissão real paga — isso continua em profissionais.servicos_comissoes.';



COMMENT ON COLUMN "public"."servicos"."eh_cortesia" IS 'Quando true, o servico e tratado como cortesia/nao cobrado: nao entra nos alertas de margem/comissao nem no contador Abaixo do Ideal do Diagnostico, e conta como Preco saudavel.';



CREATE OR REPLACE VIEW "public"."servicos_publico" WITH ("security_invoker"='true') AS
 SELECT "id",
    "salao_id",
    "nome_servico",
    "descricao",
    "preco_padrao",
    "tipo_preco",
    "duracao_minutos",
    "categoria",
    "setor",
    "exibir_online"
   FROM "public"."servicos"
  WHERE ("exibir_online" = true);


ALTER VIEW "public"."servicos_publico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."setores_salao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."setores_salao" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."termos_aceites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "usuario_id" "uuid",
    "termo_id" "uuid" NOT NULL,
    "versao" "text" NOT NULL,
    "ip" "text",
    "user_agent" "text",
    "aceito_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."termos_aceites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."termos_uso" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "versao" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "conteudo" "text" NOT NULL,
    "ativo" boolean DEFAULT false,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."termos_uso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios_portal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome_completo" "text" NOT NULL,
    "email" "text" NOT NULL,
    "cpf" "text" NOT NULL,
    "telefone_whatsapp" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "senha_definida" boolean DEFAULT false NOT NULL,
    "solicitacao_exclusao_em" timestamp with time zone
);


ALTER TABLE "public"."usuarios_portal" OWNER TO "postgres";


COMMENT ON COLUMN "public"."usuarios_portal"."senha_definida" IS 'true = cliente já criou login/senha pelo Portal (auth.users.id = usuarios_portal.id). false = registro existe só como dado de vínculo (migração retroativa ou cadastro feito pela loja), aguardando o cliente definir senha pela primeira vez.';



COMMENT ON COLUMN "public"."usuarios_portal"."solicitacao_exclusao_em" IS 'Data em que o titular solicitou exclusão da conta — LGPD Art. 18, VI. Null = sem solicitação pendente. Preenchido pelo endpoint /api/portal/solicitar-exclusao.';



CREATE TABLE IF NOT EXISTS "public"."vitrine_config" (
    "salao_id" "uuid" NOT NULL,
    "modo" "text" DEFAULT 'desativada'::"text" NOT NULL,
    "ativo" boolean DEFAULT false NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vitrine_config_modo_check" CHECK (("modo" = ANY (ARRAY['desativada'::"text", 'catalogo'::"text", 'pedido'::"text", 'compra'::"text"])))
);


ALTER TABLE "public"."vitrine_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."vitrine_config" IS 'Configuração da vitrine de produtos por salão — modo e ativação.';



CREATE TABLE IF NOT EXISTS "public"."vitrine_promocoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "imagem_url" "text",
    "preco_original" numeric(10,2),
    "preco_promo" numeric(10,2),
    "validade_ate" "date",
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vitrine_promocoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_assinaturas_creditos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "pacote_id" "uuid" NOT NULL,
    "asaas_subscription_id" "text" NOT NULL,
    "ativa" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancelada_em" timestamp with time zone
);


ALTER TABLE "public"."whatsapp_assinaturas_creditos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_carteira_creditos" (
    "salao_id" "uuid" NOT NULL,
    "saldo_atendimento" integer DEFAULT 0 NOT NULL,
    "saldo_campanha" integer DEFAULT 0 NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_carteira_creditos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_compras_creditos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "pacote_id" "uuid" NOT NULL,
    "quantidade" integer NOT NULL,
    "preco_pago" numeric(10,2) NOT NULL,
    "meio_pagamento" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pagamento_externo_id" "text",
    CONSTRAINT "whatsapp_compras_creditos_meio_pagamento_check" CHECK (("meio_pagamento" = ANY (ARRAY['pix'::"text", 'cartao_credito'::"text", 'cartao_debito'::"text"])))
);


ALTER TABLE "public"."whatsapp_compras_creditos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "whatsapp_phone_id" "text",
    "whatsapp_waba_id" "text",
    "whatsapp_token" "text",
    "whatsapp_status" "text" DEFAULT 'desconectado'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "provedor" "text" DEFAULT 'meta'::"text"
);


ALTER TABLE "public"."whatsapp_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_config_plano" (
    "salao_id" "uuid" NOT NULL,
    "plano" "text" NOT NULL,
    "waba_id" "text",
    "phone_number_id" "text",
    "token_criptografado" "text",
    "linha_credito_compartilhada" boolean DEFAULT false NOT NULL,
    "mensalidade_gestao" numeric(10,2),
    "ativo" boolean DEFAULT true NOT NULL,
    "provisionado_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "whatsapp_config_plano_plano_check" CHECK (("plano" = ANY (ARRAY['turnkey_prepago'::"text", 'gestao_meta'::"text"])))
);


ALTER TABLE "public"."whatsapp_config_plano" OWNER TO "postgres";


COMMENT ON COLUMN "public"."whatsapp_config_plano"."token_criptografado" IS 'Token de System User permanente do salão, criptografado com AES-256-GCM. Descriptografar somente no servidor (nunca expor ao browser).';



COMMENT ON COLUMN "public"."whatsapp_config_plano"."linha_credito_compartilhada" IS 'true somente no Plano A após aprovação da Luarys como Solution Partner da Meta. Plano B mantém sempre false — o salão paga a Meta diretamente.';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_conversas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "telefone_cliente" "text" NOT NULL,
    "tipo" "text" DEFAULT 'utilidade'::"text" NOT NULL,
    "aberta_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expira_em" timestamp with time zone NOT NULL,
    "mes_ref" "date" NOT NULL
);


ALTER TABLE "public"."whatsapp_conversas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_mensagens_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "sub_waba_id" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "categoria_solicitada" "text",
    "origem" "text" DEFAULT 'atendimento'::"text" NOT NULL,
    "custo_unitario" numeric(10,4) NOT NULL,
    "meta_message_id" "text",
    "cliente_id" "uuid",
    "campanha_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "whatsapp_mensagens_log_categoria_check" CHECK (("categoria" = ANY (ARRAY['servico'::"text", 'utilidade'::"text", 'marketing'::"text", 'autenticacao'::"text"]))),
    CONSTRAINT "whatsapp_mensagens_log_origem_check" CHECK (("origem" = ANY (ARRAY['atendimento'::"text", 'campanha'::"text", 'automatico'::"text"])))
);


ALTER TABLE "public"."whatsapp_mensagens_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_pacotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "quantidade" integer NOT NULL,
    "preco" numeric(10,2) NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    CONSTRAINT "whatsapp_pacotes_tipo_check" CHECK (("tipo" = ANY (ARRAY['atendimento'::"text", 'campanha'::"text"])))
);


ALTER TABLE "public"."whatsapp_pacotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_uso" (
    "id" bigint NOT NULL,
    "salao_id" "uuid" NOT NULL,
    "mes_ref" "date" NOT NULL,
    "enviadas" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."whatsapp_uso" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."whatsapp_uso_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."whatsapp_uso_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."whatsapp_uso_id_seq" OWNED BY "public"."whatsapp_uso"."id";



ALTER TABLE ONLY "public"."plataforma_documentos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."plataforma_documentos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."whatsapp_uso" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."whatsapp_uso_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."aceites_contrato"
    ADD CONSTRAINT "aceites_contrato_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agendamentos"
    ADD CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assinaturas_cliente"
    ADD CONSTRAINT "assinaturas_cliente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auditoria_certificados"
    ADD CONSTRAINT "auditoria_certificados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auditoria_log"
    ADD CONSTRAINT "auditoria_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automacoes"
    ADD CONSTRAINT "automacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avaliacoes_atendimento"
    ADD CONSTRAINT "avaliacoes_atendimento_agendamento_id_key" UNIQUE ("agendamento_id");



ALTER TABLE ONLY "public"."avaliacoes_atendimento"
    ADD CONSTRAINT "avaliacoes_atendimento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avisos_plataforma"
    ADD CONSTRAINT "avisos_plataforma_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avisos_visualizacoes"
    ADD CONSTRAINT "avisos_visualizacoes_pkey" PRIMARY KEY ("aviso_id", "usuario_id");



ALTER TABLE ONLY "public"."caixa_transacoes"
    ADD CONSTRAINT "caixa_transacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carteira_clientes"
    ADD CONSTRAINT "carteira_clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cobrancas_assinatura"
    ADD CONSTRAINT "cobrancas_assinatura_assinatura_id_mes_referencia_key" UNIQUE ("assinatura_id", "mes_referencia");



ALTER TABLE ONLY "public"."cobrancas_assinatura"
    ADD CONSTRAINT "cobrancas_assinatura_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."codigos_municipais_aceitos"
    ADD CONSTRAINT "codigos_municipais_aceitos_pkey" PRIMARY KEY ("codigo_ibge", "ctrib_nac", "ctrib_mun", "ambiente");



ALTER TABLE ONLY "public"."comissao_extras"
    ADD CONSTRAINT "comissao_extras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comissoes"
    ADD CONSTRAINT "comissoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comunicados_salao"
    ADD CONSTRAINT "comunicados_salao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_taxas"
    ADD CONSTRAINT "config_taxas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_fiscais_profissionais"
    ADD CONSTRAINT "configuracoes_fiscais_profissionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_nfce"
    ADD CONSTRAINT "configuracoes_nfce_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_nfce_produtos"
    ADD CONSTRAINT "configuracoes_nfce_produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_nfce_produtos"
    ADD CONSTRAINT "configuracoes_nfce_produtos_salao_id_key" UNIQUE ("salao_id");



ALTER TABLE ONLY "public"."configuracoes_nfse"
    ADD CONSTRAINT "configuracoes_nfse_pkey" PRIMARY KEY ("salao_id");



ALTER TABLE ONLY "public"."contratos_aluguel"
    ADD CONSTRAINT "contratos_aluguel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_clientes"
    ADD CONSTRAINT "crm_clientes_cliente_id_salao_id_key" UNIQUE ("cliente_id", "salao_id");



ALTER TABLE ONLY "public"."crm_clientes"
    ADD CONSTRAINT "crm_clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custos_fixos_salao"
    ADD CONSTRAINT "custos_fixos_salao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custos_fixos_salao"
    ADD CONSTRAINT "custos_fixos_salao_salao_id_key" UNIQUE ("salao_id");



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estoque"
    ADD CONSTRAINT "estoque_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."etiquetas"
    ADD CONSTRAINT "etiquetas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ficha_tecnica"
    ADD CONSTRAINT "ficha_tecnica_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fidelidade_config"
    ADD CONSTRAINT "fidelidade_config_pkey" PRIMARY KEY ("salao_id");



ALTER TABLE ONLY "public"."fidelidade_premios"
    ADD CONSTRAINT "fidelidade_premios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fidelidade_servicos_bloqueados"
    ADD CONSTRAINT "fidelidade_servicos_bloqueados_pkey" PRIMARY KEY ("salao_id", "servico_id");



ALTER TABLE ONLY "public"."fidelidade_transacoes"
    ADD CONSTRAINT "fidelidade_transacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fila_envio"
    ADD CONSTRAINT "fila_envio_automacao_id_chave_dedup_key" UNIQUE ("automacao_id", "chave_dedup");



ALTER TABLE ONLY "public"."fila_envio"
    ADD CONSTRAINT "fila_envio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financeiro"
    ADD CONSTRAINT "financeiro_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fornecedores"
    ADD CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funcoes"
    ADD CONSTRAINT "funcoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_estoque"
    ADD CONSTRAINT "historico_estoque_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lgpd_solicitacoes_exclusao"
    ADD CONSTRAINT "lgpd_solicitacoes_exclusao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lista_espera"
    ADD CONSTRAINT "lista_espera_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locatarios"
    ADD CONSTRAINT "locatarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_auditoria_acoes"
    ADD CONSTRAINT "log_auditoria_acoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metas_salao"
    ADD CONSTRAINT "metas_salao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metas_salao"
    ADD CONSTRAINT "metas_salao_salao_id_mes_key" UNIQUE ("salao_id", "mes");



ALTER TABLE ONLY "public"."modelos_contrato_aluguel"
    ADD CONSTRAINT "modelos_contrato_aluguel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modelos_contrato_aluguel"
    ADD CONSTRAINT "modelos_contrato_aluguel_salao_id_key" UNIQUE ("salao_id");



ALTER TABLE ONLY "public"."modulos_catalogo"
    ADD CONSTRAINT "modulos_catalogo_pkey" PRIMARY KEY ("chave");



ALTER TABLE ONLY "public"."nbs_catalogo"
    ADD CONSTRAINT "nbs_catalogo_pkey" PRIMARY KEY ("codigo");



ALTER TABLE ONLY "public"."nfce_emissoes"
    ADD CONSTRAINT "nfce_emissoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nfce_emissoes"
    ADD CONSTRAINT "nfce_emissoes_referencia_key" UNIQUE ("referencia");



ALTER TABLE ONLY "public"."nfe_config_empresa"
    ADD CONSTRAINT "nfe_config_empresa_pkey" PRIMARY KEY ("salao_id");



ALTER TABLE ONLY "public"."nfe_emissoes_log"
    ADD CONSTRAINT "nfe_emissoes_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas_fiscais_itens"
    ADD CONSTRAINT "notas_fiscais_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas_fiscais"
    ADD CONSTRAINT "notas_fiscais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas_fiscais_plataforma"
    ADD CONSTRAINT "notas_fiscais_plataforma_pagamento_id_key" UNIQUE ("pagamento_id");



ALTER TABLE ONLY "public"."notas_fiscais_plataforma"
    ADD CONSTRAINT "notas_fiscais_plataforma_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificacoes"
    ADD CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."os_contadores"
    ADD CONSTRAINT "os_contadores_pkey" PRIMARY KEY ("salao_id", "mes_ano");



ALTER TABLE ONLY "public"."pagamentos_aluguel"
    ADD CONSTRAINT "pagamentos_aluguel_contrato_id_mes_referencia_key" UNIQUE ("contrato_id", "mes_referencia");



ALTER TABLE ONLY "public"."pagamentos_aluguel"
    ADD CONSTRAINT "pagamentos_aluguel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagamentos_assinatura"
    ADD CONSTRAINT "pagamentos_assinatura_pagamento_externo_id_key" UNIQUE ("pagamento_externo_id");



ALTER TABLE ONLY "public"."pagamentos_assinatura"
    ADD CONSTRAINT "pagamentos_assinatura_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parceiro_documentos_mensais"
    ADD CONSTRAINT "parceiro_documentos_mensais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parceiro_documentos_mensais"
    ADD CONSTRAINT "parceiro_documentos_unicos" UNIQUE ("salao_id", "profissional_id", "competencia");



ALTER TABLE ONLY "public"."pedidos_vitrine"
    ADD CONSTRAINT "pedidos_vitrine_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfis_usuarios"
    ADD CONSTRAINT "perfis_usuarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planos_assinatura_cliente"
    ADD CONSTRAINT "planos_assinatura_cliente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planos"
    ADD CONSTRAINT "planos_pkey" PRIMARY KEY ("chave");



ALTER TABLE ONLY "public"."plataforma_config_financeira"
    ADD CONSTRAINT "plataforma_config_financeira_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plataforma_config"
    ADD CONSTRAINT "plataforma_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plataforma_contas_recebimento"
    ADD CONSTRAINT "plataforma_contas_recebimento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plataforma_despesas"
    ADD CONSTRAINT "plataforma_despesas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plataforma_documentos"
    ADD CONSTRAINT "plataforma_documentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plataforma_nfse_config"
    ADD CONSTRAINT "plataforma_nfse_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plataforma_whatsapp_config"
    ADD CONSTRAINT "plataforma_whatsapp_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_push_subscriptions"
    ADD CONSTRAINT "portal_push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_push_subscriptions"
    ADD CONSTRAINT "portal_push_subscriptions_usuario_id_endpoint_key" UNIQUE ("usuario_id", "endpoint");



ALTER TABLE ONLY "public"."precificacao_config"
    ADD CONSTRAINT "precificacao_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."precificacao_config"
    ADD CONSTRAINT "precificacao_config_salao_id_key" UNIQUE ("salao_id");



ALTER TABLE ONLY "public"."preferencias_sidebar"
    ADD CONSTRAINT "preferencias_sidebar_pkey" PRIMARY KEY ("usuario_id");



ALTER TABLE ONLY "public"."produtos"
    ADD CONSTRAINT "produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profissionais"
    ADD CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salao_modulos"
    ADD CONSTRAINT "salao_modulos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salao_modulos"
    ADD CONSTRAINT "salao_modulos_salao_id_modulo_chave_key" UNIQUE ("salao_id", "modulo_chave");



ALTER TABLE ONLY "public"."salao_planos_historico"
    ADD CONSTRAINT "salao_planos_historico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salao_whatsapp_pacote"
    ADD CONSTRAINT "salao_whatsapp_pacote_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salao_whatsapp_pacote"
    ADD CONSTRAINT "salao_whatsapp_pacote_salao_id_key" UNIQUE ("salao_id");



ALTER TABLE ONLY "public"."saloes"
    ADD CONSTRAINT "saloes_cnpj_key" UNIQUE ("cnpj");



ALTER TABLE ONLY "public"."saloes"
    ADD CONSTRAINT "saloes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saloes"
    ADD CONSTRAINT "saloes_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."servicos"
    ADD CONSTRAINT "servicos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."setores_salao"
    ADD CONSTRAINT "setores_salao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."setores_salao"
    ADD CONSTRAINT "setores_salao_salao_id_nome_key" UNIQUE ("salao_id", "nome");



ALTER TABLE ONLY "public"."termos_aceites"
    ADD CONSTRAINT "termos_aceites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."termos_uso"
    ADD CONSTRAINT "termos_uso_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_nfce"
    ADD CONSTRAINT "unique_nfce_salao" UNIQUE ("salao_id");



ALTER TABLE ONLY "public"."configuracoes_fiscais_profissionais"
    ADD CONSTRAINT "unique_profissional_salao" UNIQUE ("salao_id", "profissional_id");



ALTER TABLE ONLY "public"."config_taxas"
    ADD CONSTRAINT "unique_salao_taxa" UNIQUE ("salao_id");



ALTER TABLE ONLY "public"."usuarios_portal"
    ADD CONSTRAINT "usuarios_portal_cpf_key" UNIQUE ("cpf");



ALTER TABLE ONLY "public"."usuarios_portal"
    ADD CONSTRAINT "usuarios_portal_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."usuarios_portal"
    ADD CONSTRAINT "usuarios_portal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vitrine_config"
    ADD CONSTRAINT "vitrine_config_pkey" PRIMARY KEY ("salao_id");



ALTER TABLE ONLY "public"."vitrine_promocoes"
    ADD CONSTRAINT "vitrine_promocoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_assinaturas_creditos"
    ADD CONSTRAINT "whatsapp_assinaturas_creditos_asaas_subscription_id_key" UNIQUE ("asaas_subscription_id");



ALTER TABLE ONLY "public"."whatsapp_assinaturas_creditos"
    ADD CONSTRAINT "whatsapp_assinaturas_creditos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_carteira_creditos"
    ADD CONSTRAINT "whatsapp_carteira_creditos_pkey" PRIMARY KEY ("salao_id");



ALTER TABLE ONLY "public"."whatsapp_compras_creditos"
    ADD CONSTRAINT "whatsapp_compras_creditos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_config"
    ADD CONSTRAINT "whatsapp_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_config_plano"
    ADD CONSTRAINT "whatsapp_config_plano_pkey" PRIMARY KEY ("salao_id");



ALTER TABLE ONLY "public"."whatsapp_config"
    ADD CONSTRAINT "whatsapp_config_salao_id_key" UNIQUE ("salao_id");



ALTER TABLE ONLY "public"."whatsapp_conversas"
    ADD CONSTRAINT "whatsapp_conversas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_mensagens_log"
    ADD CONSTRAINT "whatsapp_mensagens_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_pacotes"
    ADD CONSTRAINT "whatsapp_pacotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_uso"
    ADD CONSTRAINT "whatsapp_uso_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_uso"
    ADD CONSTRAINT "whatsapp_uso_salao_id_mes_ref_key" UNIQUE ("salao_id", "mes_ref");



CREATE UNIQUE INDEX "agendamentos_slot_unique" ON "public"."agendamentos" USING "btree" ("salao_id", "profissional_id", "data", "inicio") WHERE (("eh_encaixe" IS NOT TRUE) AND ("status" = ANY (ARRAY['Agendado'::"text", 'Confirmado'::"text", 'Aguardando'::"text", 'Em Atendimento'::"text"])));



CREATE INDEX "auditoria_certificados_criado_em_idx" ON "public"."auditoria_certificados" USING "btree" ("criado_em" DESC);



CREATE INDEX "auditoria_certificados_salao_id_idx" ON "public"."auditoria_certificados" USING "btree" ("salao_id");



CREATE INDEX "fidelidade_transacoes_financeiro_idx" ON "public"."fidelidade_transacoes" USING "btree" ("financeiro_id") WHERE ("financeiro_id" IS NOT NULL);



CREATE INDEX "historico_estoque_financeiro_idx" ON "public"."historico_estoque" USING "btree" ("financeiro_id") WHERE ("financeiro_id" IS NOT NULL);



CREATE INDEX "historico_estoque_pedido_idx" ON "public"."historico_estoque" USING "btree" ("pedido_id") WHERE ("pedido_id" IS NOT NULL);



CREATE INDEX "idx_aceites_contrato_salao" ON "public"."aceites_contrato" USING "btree" ("salao_id", "documento_id", "versao_aceita");



CREATE INDEX "idx_assinaturas_cliente_salao" ON "public"."assinaturas_cliente" USING "btree" ("salao_id", "cliente_id");



CREATE INDEX "idx_assinaturas_cliente_status" ON "public"."assinaturas_cliente" USING "btree" ("salao_id", "status");



CREATE INDEX "idx_auditoria_log_salao" ON "public"."auditoria_log" USING "btree" ("salao_id", "criado_em" DESC);



CREATE INDEX "idx_automacoes_salao" ON "public"."automacoes" USING "btree" ("salao_id");



CREATE INDEX "idx_avaliacoes_profissional" ON "public"."avaliacoes_atendimento" USING "btree" ("profissional_id");



CREATE INDEX "idx_avaliacoes_salao" ON "public"."avaliacoes_atendimento" USING "btree" ("salao_id");



CREATE INDEX "idx_caixa_transacoes_salao_cliente" ON "public"."caixa_transacoes" USING "btree" ("salao_id", "cliente_id");



CREATE INDEX "idx_clientes_cpf" ON "public"."clientes" USING "btree" ("cpf");



CREATE INDEX "idx_clientes_email" ON "public"."clientes" USING "btree" ("email");



CREATE INDEX "idx_clientes_telefone" ON "public"."clientes" USING "btree" ("telefone_whatsapp");



CREATE INDEX "idx_clientes_usuario_portal" ON "public"."clientes" USING "btree" ("usuario_portal_id");



CREATE INDEX "idx_cobrancas_assinatura_salao_mes" ON "public"."cobrancas_assinatura" USING "btree" ("salao_id", "mes_referencia");



CREATE INDEX "idx_codmun_busca" ON "public"."codigos_municipais_aceitos" USING "btree" ("codigo_ibge", "ctrib_nac", "ambiente");



CREATE INDEX "idx_comissao_extras_profissional" ON "public"."comissao_extras" USING "btree" ("profissional_id");



CREATE INDEX "idx_comissao_extras_salao" ON "public"."comissao_extras" USING "btree" ("salao_id", "created_at" DESC);



CREATE INDEX "idx_comissao_extras_salao_data" ON "public"."comissao_extras" USING "btree" ("salao_id", "created_at");



CREATE INDEX "idx_comissoes_agendamento" ON "public"."comissoes" USING "btree" ("agendamento_id");



CREATE INDEX "idx_comissoes_profissional_id" ON "public"."comissoes" USING "btree" ("profissional_id");



CREATE INDEX "idx_comissoes_salao_id" ON "public"."comissoes" USING "btree" ("salao_id");



CREATE INDEX "idx_comissoes_salao_profissional" ON "public"."comissoes" USING "btree" ("salao_id", "profissional_id");



CREATE INDEX "idx_comissoes_salao_status" ON "public"."comissoes" USING "btree" ("salao_id", "status");



CREATE INDEX "idx_comissoes_status" ON "public"."comissoes" USING "btree" ("status");



CREATE INDEX "idx_comunicados_salao_id" ON "public"."comunicados_salao" USING "btree" ("salao_id", "ativo");



CREATE INDEX "idx_crm_clientes_cliente_id" ON "public"."crm_clientes" USING "btree" ("cliente_id");



CREATE INDEX "idx_crm_clientes_salao_id" ON "public"."crm_clientes" USING "btree" ("salao_id");



CREATE INDEX "idx_despesas_salao_pagamento" ON "public"."despesas" USING "btree" ("salao_id", "data_pagamento");



CREATE INDEX "idx_despesas_salao_vencimento" ON "public"."despesas" USING "btree" ("salao_id", "data_vencimento");



CREATE INDEX "idx_despesas_status" ON "public"."despesas" USING "btree" ("salao_id", "status");



CREATE INDEX "idx_despesas_tipo_custo" ON "public"."despesas" USING "btree" ("tipo_custo");



CREATE INDEX "idx_etiquetas_salao_id" ON "public"."etiquetas" USING "btree" ("salao_id");



CREATE INDEX "idx_fidelidade_transacoes_cliente" ON "public"."fidelidade_transacoes" USING "btree" ("salao_id", "cliente_id");



CREATE INDEX "idx_fila_envio_salao_status" ON "public"."fila_envio" USING "btree" ("salao_id", "status");



CREATE INDEX "idx_financeiro_agendamento_ids" ON "public"."financeiro" USING "gin" ("agendamento_ids");



CREATE INDEX "idx_financeiro_salao_data" ON "public"."financeiro" USING "btree" ("salao_id", "data_movimentacao");



CREATE INDEX "idx_financeiro_status" ON "public"."financeiro" USING "btree" ("salao_id", "status");



CREATE INDEX "idx_financeiro_tipo_custo" ON "public"."financeiro" USING "btree" ("tipo_custo");



CREATE INDEX "idx_lgpd_exclusao_prazo" ON "public"."lgpd_solicitacoes_exclusao" USING "btree" ("prazo_resposta_em") WHERE ("status" = 'pendente'::"text");



CREATE INDEX "idx_lgpd_exclusao_token" ON "public"."lgpd_solicitacoes_exclusao" USING "btree" ("token_confirmacao") WHERE (("token_confirmacao" IS NOT NULL) AND ("status" = 'pendente'::"text"));



CREATE INDEX "idx_lgpd_exclusao_usuario" ON "public"."lgpd_solicitacoes_exclusao" USING "btree" ("usuario_portal_id", "status");



CREATE INDEX "idx_log_auditoria_profissional" ON "public"."log_auditoria_acoes" USING "btree" ("profissional_id");



CREATE INDEX "idx_log_auditoria_salao" ON "public"."log_auditoria_acoes" USING "btree" ("salao_id", "created_at" DESC);



CREATE INDEX "idx_nfe_emissoes_salao" ON "public"."nfe_emissoes_log" USING "btree" ("salao_id", "criado_em" DESC);



CREATE INDEX "idx_notas_fiscais_financeiro_id" ON "public"."notas_fiscais" USING "btree" ("financeiro_id");



CREATE INDEX "idx_notificacoes_cliente" ON "public"."notificacoes" USING "btree" ("destinatario_id", "lida") WHERE ("destinatario_tipo" = 'cliente'::"text");



CREATE INDEX "idx_notificacoes_salao" ON "public"."notificacoes" USING "btree" ("salao_id", "lida") WHERE ("destinatario_tipo" = 'salao'::"text");



CREATE INDEX "idx_parceiro_docs_salao_competencia" ON "public"."parceiro_documentos_mensais" USING "btree" ("salao_id", "competencia" DESC);



CREATE INDEX "idx_pedidos_vitrine_salao" ON "public"."pedidos_vitrine" USING "btree" ("salao_id", "status");



CREATE INDEX "idx_planos_historico_salao" ON "public"."salao_planos_historico" USING "btree" ("salao_id", "criado_em" DESC);



CREATE UNIQUE INDEX "idx_plataforma_documentos_tipo_ativo" ON "public"."plataforma_documentos" USING "btree" ("tipo") WHERE ("ativo" = true);



CREATE INDEX "idx_push_subs_usuario" ON "public"."portal_push_subscriptions" USING "btree" ("usuario_id");



CREATE INDEX "idx_salao_modulos_renovacao_em" ON "public"."salao_modulos" USING "btree" ("renovacao_em") WHERE (("renovacao_em" IS NOT NULL) AND ("ativo" = true));



CREATE INDEX "idx_saloes_assinatura" ON "public"."saloes" USING "btree" ("plano_assinatura", "status_assinatura");



CREATE INDEX "idx_saloes_plano_renovacao_em" ON "public"."saloes" USING "btree" ("plano_renovacao_em") WHERE ("plano_renovacao_em" IS NOT NULL);



CREATE INDEX "idx_servicos_setor" ON "public"."servicos" USING "btree" ("setor");



CREATE INDEX "idx_usuarios_portal_cpf" ON "public"."usuarios_portal" USING "btree" ("cpf");



CREATE INDEX "idx_usuarios_portal_email" ON "public"."usuarios_portal" USING "btree" ("email");



CREATE INDEX "idx_whatsapp_conversas_mes" ON "public"."whatsapp_conversas" USING "btree" ("salao_id", "mes_ref");



CREATE INDEX "idx_whatsapp_conversas_salao_tel" ON "public"."whatsapp_conversas" USING "btree" ("salao_id", "telefone_cliente", "expira_em");



CREATE INDEX "idx_whatsapp_log_salao_mes" ON "public"."whatsapp_mensagens_log" USING "btree" ("salao_id", "criado_em" DESC);



CREATE UNIQUE INDEX "nfce_emissoes_salao_serie_numero_uidx" ON "public"."nfce_emissoes" USING "btree" ("salao_id", COALESCE("serie", '1'::"text"), "numero");



CREATE INDEX "nfce_emissoes_salao_status_idx" ON "public"."nfce_emissoes" USING "btree" ("salao_id", "status");



CREATE UNIQUE INDEX "saloes_cnpj_unique" ON "public"."saloes" USING "btree" ("cnpj") WHERE ("cnpj" IS NOT NULL);



CREATE UNIQUE INDEX "uq_modulos_catalogo_chave" ON "public"."modulos_catalogo" USING "btree" ("chave");



CREATE UNIQUE INDEX "uq_whatsapp_pacotes_tipo_qtd" ON "public"."whatsapp_pacotes" USING "btree" ("tipo", "quantidade");



CREATE INDEX "whatsapp_assinaturas_creditos_salao_idx" ON "public"."whatsapp_assinaturas_creditos" USING "btree" ("salao_id", "pacote_id") WHERE ("ativa" = true);



CREATE UNIQUE INDEX "whatsapp_compras_creditos_pagamento_externo_id_key" ON "public"."whatsapp_compras_creditos" USING "btree" ("pagamento_externo_id");



CREATE OR REPLACE TRIGGER "trg_auditoria_cancelamento_agendamento" AFTER UPDATE ON "public"."agendamentos" FOR EACH ROW WHEN ((("new"."status" = 'Cancelado'::"text") AND ("old"."status" IS DISTINCT FROM 'Cancelado'::"text"))) EXECUTE FUNCTION "public"."registrar_auditoria_cancelamento_agendamento"();



CREATE OR REPLACE TRIGGER "trg_auditoria_financeiro" AFTER DELETE OR UPDATE ON "public"."financeiro" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_auditoria_financeiro"();



CREATE OR REPLACE TRIGGER "trg_bloquear_encaixe_via_portal" BEFORE UPDATE ON "public"."agendamentos" FOR EACH ROW EXECUTE FUNCTION "public"."bloquear_encaixe_via_portal"();



CREATE OR REPLACE TRIGGER "trg_comissao_data_evento" BEFORE INSERT ON "public"."comissoes" FOR EACH ROW EXECUTE FUNCTION "public"."set_comissao_data_evento"();



CREATE OR REPLACE TRIGGER "trg_comunicados_atualizado_em" BEFORE UPDATE ON "public"."comunicados_salao" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_atualizado_em"();



CREATE OR REPLACE TRIGGER "trg_fidelidade_creditar_pontos" AFTER UPDATE ON "public"."agendamentos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_fidelidade_creditar_pontos"();



CREATE OR REPLACE TRIGGER "trg_limite_profissionais" BEFORE INSERT OR UPDATE ON "public"."profissionais" FOR EACH ROW EXECUTE FUNCTION "public"."verificar_limite_profissionais"();



CREATE OR REPLACE TRIGGER "trg_nfce_emissoes_touch" BEFORE UPDATE ON "public"."nfce_emissoes" FOR EACH ROW EXECUTE FUNCTION "public"."nfce_emissoes_touch"();



CREATE OR REPLACE TRIGGER "trg_verificar_comissao" BEFORE INSERT OR UPDATE ON "public"."comissoes" FOR EACH ROW EXECUTE FUNCTION "public"."verificar_elegibilidade_comissao"();



CREATE OR REPLACE TRIGGER "trg_vitrine_promocoes_updated_at" BEFORE UPDATE ON "public"."vitrine_promocoes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trig_gateway_unico_ativo" BEFORE INSERT OR UPDATE OF "ativa" ON "public"."plataforma_contas_recebimento" FOR EACH ROW EXECUTE FUNCTION "public"."desativar_outras_contas_recebimento"();



ALTER TABLE ONLY "public"."aceites_contrato"
    ADD CONSTRAINT "aceites_contrato_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "public"."plataforma_documentos"("id");



ALTER TABLE ONLY "public"."aceites_contrato"
    ADD CONSTRAINT "aceites_contrato_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agendamentos"
    ADD CONSTRAINT "agendamentos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agendamentos"
    ADD CONSTRAINT "agendamentos_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agendamentos"
    ADD CONSTRAINT "agendamentos_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agendamentos"
    ADD CONSTRAINT "agendamentos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assinaturas_cliente"
    ADD CONSTRAINT "assinaturas_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assinaturas_cliente"
    ADD CONSTRAINT "assinaturas_cliente_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "public"."planos_assinatura_cliente"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."assinaturas_cliente"
    ADD CONSTRAINT "assinaturas_cliente_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auditoria_certificados"
    ADD CONSTRAINT "auditoria_certificados_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auditoria_certificados"
    ADD CONSTRAINT "auditoria_certificados_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."auditoria_log"
    ADD CONSTRAINT "auditoria_log_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automacoes"
    ADD CONSTRAINT "automacoes_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes_atendimento"
    ADD CONSTRAINT "avaliacoes_atendimento_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacoes_atendimento"
    ADD CONSTRAINT "avaliacoes_atendimento_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avaliacoes_atendimento"
    ADD CONSTRAINT "avaliacoes_atendimento_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avisos_plataforma"
    ADD CONSTRAINT "avisos_plataforma_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "public"."perfis_usuarios"("id");



ALTER TABLE ONLY "public"."avisos_visualizacoes"
    ADD CONSTRAINT "avisos_visualizacoes_aviso_id_fkey" FOREIGN KEY ("aviso_id") REFERENCES "public"."avisos_plataforma"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avisos_visualizacoes"
    ADD CONSTRAINT "avisos_visualizacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."perfis_usuarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carteira_clientes"
    ADD CONSTRAINT "carteira_clientes_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id");



ALTER TABLE ONLY "public"."carteira_clientes"
    ADD CONSTRAINT "carteira_clientes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."carteira_clientes"
    ADD CONSTRAINT "carteira_clientes_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_usuario_portal_id_fkey" FOREIGN KEY ("usuario_portal_id") REFERENCES "public"."usuarios_portal"("id");



ALTER TABLE ONLY "public"."cobrancas_assinatura"
    ADD CONSTRAINT "cobrancas_assinatura_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "public"."assinaturas_cliente"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cobrancas_assinatura"
    ADD CONSTRAINT "cobrancas_assinatura_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comissao_extras"
    ADD CONSTRAINT "comissao_extras_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comissao_extras"
    ADD CONSTRAINT "comissao_extras_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comissoes"
    ADD CONSTRAINT "comissoes_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comissoes"
    ADD CONSTRAINT "comissoes_id_prof_fkey" FOREIGN KEY ("id_prof") REFERENCES "public"."profissionais"("id");



ALTER TABLE ONLY "public"."comissoes"
    ADD CONSTRAINT "comissoes_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comissoes"
    ADD CONSTRAINT "comissoes_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id");



ALTER TABLE ONLY "public"."comunicados_salao"
    ADD CONSTRAINT "comunicados_salao_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."config_taxas"
    ADD CONSTRAINT "config_taxas_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."configuracoes_fiscais_profissionais"
    ADD CONSTRAINT "configuracoes_fiscais_profissionais_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."configuracoes_nfce_produtos"
    ADD CONSTRAINT "configuracoes_nfce_produtos_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."configuracoes_nfce"
    ADD CONSTRAINT "configuracoes_nfce_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contratos_aluguel"
    ADD CONSTRAINT "contratos_aluguel_locatario_id_fkey" FOREIGN KEY ("locatario_id") REFERENCES "public"."locatarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contratos_aluguel"
    ADD CONSTRAINT "contratos_aluguel_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_clientes"
    ADD CONSTRAINT "crm_clientes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_clientes"
    ADD CONSTRAINT "crm_clientes_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custos_fixos_salao"
    ADD CONSTRAINT "custos_fixos_salao_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."despesas"
    ADD CONSTRAINT "despesas_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."etiquetas"
    ADD CONSTRAINT "etiquetas_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ficha_tecnica"
    ADD CONSTRAINT "ficha_tecnica_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ficha_tecnica"
    ADD CONSTRAINT "ficha_tecnica_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fidelidade_config"
    ADD CONSTRAINT "fidelidade_config_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fidelidade_premios"
    ADD CONSTRAINT "fidelidade_premios_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fidelidade_premios"
    ADD CONSTRAINT "fidelidade_premios_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fidelidade_servicos_bloqueados"
    ADD CONSTRAINT "fidelidade_servicos_bloqueados_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fidelidade_servicos_bloqueados"
    ADD CONSTRAINT "fidelidade_servicos_bloqueados_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fidelidade_transacoes"
    ADD CONSTRAINT "fidelidade_transacoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fidelidade_transacoes"
    ADD CONSTRAINT "fidelidade_transacoes_origem_agendamento_id_fkey" FOREIGN KEY ("origem_agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fidelidade_transacoes"
    ADD CONSTRAINT "fidelidade_transacoes_premio_id_fkey" FOREIGN KEY ("premio_id") REFERENCES "public"."fidelidade_premios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fidelidade_transacoes"
    ADD CONSTRAINT "fidelidade_transacoes_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fila_envio"
    ADD CONSTRAINT "fila_envio_automacao_id_fkey" FOREIGN KEY ("automacao_id") REFERENCES "public"."automacoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fila_envio"
    ADD CONSTRAINT "fila_envio_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."fila_envio"
    ADD CONSTRAINT "fila_envio_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financeiro"
    ADD CONSTRAINT "financeiro_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id");



ALTER TABLE ONLY "public"."usuarios_portal"
    ADD CONSTRAINT "fk_auth_users" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_config"
    ADD CONSTRAINT "fk_salao" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_estoque"
    ADD CONSTRAINT "historico_estoque_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locatarios"
    ADD CONSTRAINT "locatarios_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."log_auditoria_acoes"
    ADD CONSTRAINT "log_auditoria_acoes_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id");



ALTER TABLE ONLY "public"."log_auditoria_acoes"
    ADD CONSTRAINT "log_auditoria_acoes_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id");



ALTER TABLE ONLY "public"."metas_salao"
    ADD CONSTRAINT "metas_salao_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modelos_contrato_aluguel"
    ADD CONSTRAINT "modelos_contrato_aluguel_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nfce_emissoes"
    ADD CONSTRAINT "nfce_emissoes_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nfe_config_empresa"
    ADD CONSTRAINT "nfe_config_empresa_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nfe_emissoes_log"
    ADD CONSTRAINT "nfe_emissoes_log_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."nfe_emissoes_log"
    ADD CONSTRAINT "nfe_emissoes_log_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas_fiscais"
    ADD CONSTRAINT "notas_fiscais_financeiro_id_fkey" FOREIGN KEY ("financeiro_id") REFERENCES "public"."financeiro"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notas_fiscais_itens"
    ADD CONSTRAINT "notas_fiscais_itens_nota_fiscal_id_fkey" FOREIGN KEY ("nota_fiscal_id") REFERENCES "public"."notas_fiscais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas_fiscais_itens"
    ADD CONSTRAINT "notas_fiscais_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notas_fiscais_plataforma"
    ADD CONSTRAINT "notas_fiscais_plataforma_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "public"."pagamentos_assinatura"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notas_fiscais_plataforma"
    ADD CONSTRAINT "notas_fiscais_plataforma_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificacoes"
    ADD CONSTRAINT "notificacoes_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "public"."agendamentos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notificacoes"
    ADD CONSTRAINT "notificacoes_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."os_contadores"
    ADD CONSTRAINT "os_contadores_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos_aluguel"
    ADD CONSTRAINT "pagamentos_aluguel_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos_aluguel"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos_aluguel"
    ADD CONSTRAINT "pagamentos_aluguel_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagamentos_assinatura"
    ADD CONSTRAINT "pagamentos_assinatura_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parceiro_documentos_mensais"
    ADD CONSTRAINT "parceiro_documentos_mensais_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "public"."profissionais"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parceiro_documentos_mensais"
    ADD CONSTRAINT "parceiro_documentos_mensais_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedidos_vitrine"
    ADD CONSTRAINT "pedidos_vitrine_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfis_usuarios"
    ADD CONSTRAINT "perfis_usuarios_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfis_usuarios"
    ADD CONSTRAINT "perfis_usuarios_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planos_assinatura_cliente"
    ADD CONSTRAINT "planos_assinatura_cliente_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_push_subscriptions"
    ADD CONSTRAINT "portal_push_subscriptions_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_portal"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."precificacao_config"
    ADD CONSTRAINT "precificacao_config_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."preferencias_sidebar"
    ADD CONSTRAINT "preferencias_sidebar_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."perfis_usuarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profissionais"
    ADD CONSTRAINT "profissionais_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salao_modulos"
    ADD CONSTRAINT "salao_modulos_modulo_chave_fkey" FOREIGN KEY ("modulo_chave") REFERENCES "public"."modulos_catalogo"("chave");



ALTER TABLE ONLY "public"."salao_modulos"
    ADD CONSTRAINT "salao_modulos_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salao_planos_historico"
    ADD CONSTRAINT "salao_planos_historico_alterado_por_fkey" FOREIGN KEY ("alterado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."salao_planos_historico"
    ADD CONSTRAINT "salao_planos_historico_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salao_whatsapp_pacote"
    ADD CONSTRAINT "salao_whatsapp_pacote_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saloes"
    ADD CONSTRAINT "saloes_plano_chave_fkey" FOREIGN KEY ("plano_chave") REFERENCES "public"."planos"("chave");



ALTER TABLE ONLY "public"."servicos"
    ADD CONSTRAINT "servicos_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."setores_salao"
    ADD CONSTRAINT "setores_salao_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."termos_aceites"
    ADD CONSTRAINT "termos_aceites_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."termos_aceites"
    ADD CONSTRAINT "termos_aceites_termo_id_fkey" FOREIGN KEY ("termo_id") REFERENCES "public"."termos_uso"("id");



ALTER TABLE ONLY "public"."termos_aceites"
    ADD CONSTRAINT "termos_aceites_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vitrine_config"
    ADD CONSTRAINT "vitrine_config_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vitrine_promocoes"
    ADD CONSTRAINT "vitrine_promocoes_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_assinaturas_creditos"
    ADD CONSTRAINT "whatsapp_assinaturas_creditos_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "public"."whatsapp_pacotes"("id");



ALTER TABLE ONLY "public"."whatsapp_assinaturas_creditos"
    ADD CONSTRAINT "whatsapp_assinaturas_creditos_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_carteira_creditos"
    ADD CONSTRAINT "whatsapp_carteira_creditos_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_compras_creditos"
    ADD CONSTRAINT "whatsapp_compras_creditos_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "public"."whatsapp_pacotes"("id");



ALTER TABLE ONLY "public"."whatsapp_compras_creditos"
    ADD CONSTRAINT "whatsapp_compras_creditos_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_config_plano"
    ADD CONSTRAINT "whatsapp_config_plano_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_conversas"
    ADD CONSTRAINT "whatsapp_conversas_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_mensagens_log"
    ADD CONSTRAINT "whatsapp_mensagens_log_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_mensagens_log"
    ADD CONSTRAINT "whatsapp_mensagens_log_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_uso"
    ADD CONSTRAINT "whatsapp_uso_salao_id_fkey" FOREIGN KEY ("salao_id") REFERENCES "public"."saloes"("id") ON DELETE CASCADE;



CREATE POLICY "Catalogo e publico para leitura" ON "public"."modulos_catalogo" FOR SELECT USING (true);



CREATE POLICY "Cliente cria o próprio cadastro" ON "public"."usuarios_portal" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Cliente edita o próprio cadastro" ON "public"."usuarios_portal" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Cliente lê o próprio cadastro" ON "public"."usuarios_portal" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Dono gerencia automacoes do seu salao" ON "public"."automacoes" USING (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())))) WITH CHECK (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"()))));



CREATE POLICY "Dono gerencia fila de envio do seu salao" ON "public"."fila_envio" USING (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())))) WITH CHECK (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"()))));



CREATE POLICY "Dono ve auditoria do seu salao" ON "public"."auditoria_log" FOR SELECT USING (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"()))));



CREATE POLICY "Planos sao publicos para leitura" ON "public"."planos" FOR SELECT USING (true);



CREATE POLICY "Platform admin gerencia acesso_total" ON "public"."saloes" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true)))));



CREATE POLICY "Platform admin gerencia avisos" ON "public"."avisos_plataforma" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true)))));



CREATE POLICY "Platform admin gerencia catalogo" ON "public"."modulos_catalogo" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true)))));



CREATE POLICY "Platform admin gerencia config da plataforma" ON "public"."plataforma_config" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true)))));



CREATE POLICY "Platform admin gerencia contas de recebimento" ON "public"."plataforma_contas_recebimento" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true)))));



CREATE POLICY "Platform admin gerencia notas fiscais da plataforma" ON "public"."notas_fiscais_plataforma" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true)))));



CREATE POLICY "Platform admin gerencia pagamentos_assinatura" ON "public"."pagamentos_assinatura" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true)))));



CREATE POLICY "Platform admin gerencia planos" ON "public"."planos" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true)))));



CREATE POLICY "Platform admin gerencia salao_modulos" ON "public"."salao_modulos" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true)))));



CREATE POLICY "Platform admin le visualizacoes" ON "public"."avisos_visualizacoes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true)))));



CREATE POLICY "Platform admin ve toda auditoria" ON "public"."auditoria_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = "auth"."uid"()) AND ("pu"."is_plataforma_admin" = true)))));



CREATE POLICY "Salao ve seus proprios modulos" ON "public"."salao_modulos" FOR SELECT USING ((("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"()))) OR ("salao_id" IN ( SELECT "profissionais"."salao_id"
   FROM "public"."profissionais"
  WHERE ("profissionais"."id" = "auth"."uid"())))));



CREATE POLICY "Salao ve seus proprios pagamentos" ON "public"."pagamentos_assinatura" FOR SELECT USING (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"()))));



CREATE POLICY "Usuario gerencia suas proprias visualizacoes" ON "public"."avisos_visualizacoes" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Usuarios leem avisos ativos do sistema" ON "public"."avisos_plataforma" FOR SELECT USING ((("ativo" = true) AND ("mostrar_no_sistema" = true)));



CREATE POLICY "Ver proprio perfil" ON "public"."perfis_usuarios" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."aceites_contrato" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "aceites_insert" ON "public"."termos_aceites" FOR INSERT WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "aceites_insert_proprio_salao" ON "public"."aceites_contrato" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "aceites_salao" ON "public"."termos_aceites" FOR SELECT USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "aceites_select_proprio_salao" ON "public"."aceites_contrato" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "admin_plataforma_planos_historico" ON "public"."salao_planos_historico" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios"
  WHERE (("perfis_usuarios"."id" = "auth"."uid"()) AND ("perfis_usuarios"."is_plataforma_admin" = true)))));



ALTER TABLE "public"."agendamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assinaturas_cliente" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assinaturas_cliente_proprio_salao" ON "public"."assinaturas_cliente" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."auditoria_certificados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auditoria_certificados_insercao_service" ON "public"."auditoria_certificados" FOR INSERT WITH CHECK (false);



CREATE POLICY "auditoria_certificados_leitura" ON "public"."auditoria_certificados" FOR SELECT USING (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."auditoria_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avaliacoes_atendimento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avisos_plataforma" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avisos_visualizacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."caixa_transacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "caixa_transacoes_delete_proprio_salao" ON "public"."caixa_transacoes" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "caixa_transacoes_insert_proprio_salao" ON "public"."caixa_transacoes" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "caixa_transacoes_select_proprio_salao" ON "public"."caixa_transacoes" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "caixa_transacoes_update_proprio_salao" ON "public"."caixa_transacoes" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."carteira_clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carteira_clientes_proprio_salao" ON "public"."carteira_clientes" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "cfg_fiscal_prof_proprio_salao" ON "public"."configuracoes_fiscais_profissionais" TO "authenticated" USING (("profissional_id" IN ( SELECT "profissionais"."id"
   FROM "public"."profissionais"
  WHERE ("profissionais"."salao_id" = "public"."auth_salao_id"())))) WITH CHECK (("profissional_id" IN ( SELECT "profissionais"."id"
   FROM "public"."profissionais"
  WHERE ("profissionais"."salao_id" = "public"."auth_salao_id"()))));



CREATE POLICY "cliente_insere_avaliacao_propria" ON "public"."avaliacoes_atendimento" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."agendamentos" "ag"
     JOIN "public"."clientes" "c" ON (("c"."id" = "ag"."cliente_id")))
  WHERE (("ag"."id" = "avaliacoes_atendimento"."agendamento_id") AND ("c"."usuario_portal_id" = "auth"."uid"()) AND ("ag"."status" = 'Finalizado'::"text") AND ("ag"."salao_id" = "avaliacoes_atendimento"."salao_id")))) AND ("salao_id" = ( SELECT "ag2"."salao_id"
   FROM "public"."agendamentos" "ag2"
  WHERE ("ag2"."id" = "avaliacoes_atendimento"."agendamento_id")))));



CREATE POLICY "cliente_le_proprias_avaliacoes" ON "public"."avaliacoes_atendimento" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clientes" "c"
  WHERE (("c"."id" = "avaliacoes_atendimento"."cliente_id") AND ("c"."usuario_portal_id" = "auth"."uid"())))));



ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_delete_proprio_salao" ON "public"."clientes" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "clientes_insert_proprio_salao" ON "public"."clientes" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "clientes_insert_proprio_vinculo" ON "public"."clientes" FOR INSERT TO "authenticated" WITH CHECK (("usuario_portal_id" = "auth"."uid"()));



CREATE POLICY "clientes_select_proprio_salao" ON "public"."clientes" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "clientes_update_proprio_salao" ON "public"."clientes" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."cobrancas_assinatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cobrancas_assinatura_proprio_salao" ON "public"."cobrancas_assinatura" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."codigos_municipais_aceitos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "codigos_municipais_leitura" ON "public"."codigos_municipais_aceitos" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."comissao_extras" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comissao_extras_salao" ON "public"."comissao_extras" TO "authenticated" USING (("salao_id" = ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())
 LIMIT 1)));



ALTER TABLE "public"."comissoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comissoes_delete_proprio_salao" ON "public"."comissoes" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "comissoes_insert_proprio_salao" ON "public"."comissoes" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "comissoes_select_proprio_salao" ON "public"."comissoes" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "comissoes_update_proprio_salao" ON "public"."comissoes" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."comunicados_salao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."config_taxas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "config_taxas_proprio_salao" ON "public"."config_taxas" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."configuracoes_fiscais_profissionais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracoes_nfce" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracoes_nfce_produtos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "configuracoes_nfce_proprio_salao" ON "public"."configuracoes_nfce" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."configuracoes_nfse" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "configuracoes_nfse_proprio_salao" ON "public"."configuracoes_nfse" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."contratos_aluguel" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contratos_aluguel_proprio_salao" ON "public"."contratos_aluguel" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."crm_clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crm_clientes_salao_isolado" ON "public"."crm_clientes" USING (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())
UNION
 SELECT "profissionais"."salao_id"
   FROM "public"."profissionais"
  WHERE ("profissionais"."id" = "auth"."uid"()))));



CREATE POLICY "custos_fixos_proprio_salao" ON "public"."custos_fixos_salao" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."custos_fixos_salao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."despesas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "despesas_delete_proprio_salao" ON "public"."despesas" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "despesas_insert_proprio_salao" ON "public"."despesas" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "despesas_select_proprio_salao" ON "public"."despesas" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "despesas_update_proprio_salao" ON "public"."despesas" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "documentos_leitura_autenticado" ON "public"."plataforma_documentos" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."estoque" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estoque_delete_proprio_salao" ON "public"."estoque" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "estoque_insert_proprio_salao" ON "public"."estoque" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "estoque_select_proprio_salao" ON "public"."estoque" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "estoque_update_proprio_salao" ON "public"."estoque" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."etiquetas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "etiquetas_salao_isolado" ON "public"."etiquetas" USING (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())
UNION
 SELECT "profissionais"."salao_id"
   FROM "public"."profissionais"
  WHERE ("profissionais"."id" = "auth"."uid"()))));



ALTER TABLE "public"."ficha_tecnica" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ficha_tecnica_via_servico" ON "public"."ficha_tecnica" TO "authenticated" USING (("servico_id" IN ( SELECT "servicos"."id"
   FROM "public"."servicos"
  WHERE ("servicos"."salao_id" = "public"."auth_salao_id"())))) WITH CHECK (("servico_id" IN ( SELECT "servicos"."id"
   FROM "public"."servicos"
  WHERE ("servicos"."salao_id" = "public"."auth_salao_id"()))));



ALTER TABLE "public"."fidelidade_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fidelidade_config_select_proprio_salao" ON "public"."fidelidade_config" FOR SELECT USING (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())
UNION
 SELECT "profissionais"."salao_id"
   FROM "public"."profissionais"
  WHERE ("profissionais"."id" = "auth"."uid"()))));



CREATE POLICY "fidelidade_config_update_proprio_salao" ON "public"."fidelidade_config" USING (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())
UNION
 SELECT "profissionais"."salao_id"
   FROM "public"."profissionais"
  WHERE ("profissionais"."id" = "auth"."uid"()))));



ALTER TABLE "public"."fidelidade_premios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fidelidade_premios_all_proprio_salao" ON "public"."fidelidade_premios" USING (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())
UNION
 SELECT "profissionais"."salao_id"
   FROM "public"."profissionais"
  WHERE ("profissionais"."id" = "auth"."uid"()))));



CREATE POLICY "fidelidade_premios_select_proprio_salao" ON "public"."fidelidade_premios" FOR SELECT USING (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())
UNION
 SELECT "profissionais"."salao_id"
   FROM "public"."profissionais"
  WHERE ("profissionais"."id" = "auth"."uid"()))));



ALTER TABLE "public"."fidelidade_servicos_bloqueados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fidelidade_transacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fidelidade_transacoes_select_proprio_salao" ON "public"."fidelidade_transacoes" FOR SELECT USING (("salao_id" IN ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())
UNION
 SELECT "profissionais"."salao_id"
   FROM "public"."profissionais"
  WHERE ("profissionais"."id" = "auth"."uid"()))));



ALTER TABLE "public"."fila_envio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financeiro" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financeiro_delete_proprio_salao" ON "public"."financeiro" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "financeiro_insert_proprio_salao" ON "public"."financeiro" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "financeiro_select_proprio_salao" ON "public"."financeiro" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "financeiro_update_proprio_salao" ON "public"."financeiro" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."fornecedores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fornecedores_proprio_salao" ON "public"."fornecedores" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."funcoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "funcoes_leitura_autenticado" ON "public"."funcoes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "funcoes_select_authenticated" ON "public"."funcoes" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."historico_estoque" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historico_estoque_isolado_salao" ON "public"."historico_estoque" TO "authenticated" USING (("salao_id" = ( SELECT "public"."auth_salao_id"() AS "auth_salao_id"))) WITH CHECK (("salao_id" = ( SELECT "public"."auth_salao_id"() AS "auth_salao_id")));



CREATE POLICY "leitura_publica_documentos_legais" ON "public"."plataforma_documentos" FOR SELECT TO "anon" USING (("ativo" = true));



CREATE POLICY "leitura_publica_produtos_vitrine" ON "public"."produtos" FOR SELECT TO "authenticated", "anon" USING (("visivel_vitrine" = true));



CREATE POLICY "leitura_publica_promocoes_ativas" ON "public"."vitrine_promocoes" FOR SELECT TO "authenticated", "anon" USING (("ativo" = true));



CREATE POLICY "leitura_publica_vitrine_config" ON "public"."vitrine_config" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "lgpd_exclusao_titular_le_proprio" ON "public"."lgpd_solicitacoes_exclusao" FOR SELECT TO "authenticated" USING (("usuario_portal_id" = "auth"."uid"()));



ALTER TABLE "public"."lgpd_solicitacoes_exclusao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lista_espera" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lista_espera_isolado_salao" ON "public"."lista_espera" TO "authenticated" USING (("salao_id" = ( SELECT "public"."auth_salao_id"() AS "auth_salao_id"))) WITH CHECK (("salao_id" = ( SELECT "public"."auth_salao_id"() AS "auth_salao_id")));



ALTER TABLE "public"."locatarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "locatarios_proprio_salao" ON "public"."locatarios" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."log_auditoria_acoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "log_auditoria_acoes_le_salao" ON "public"."log_auditoria_acoes" FOR SELECT TO "authenticated" USING (("salao_id" = ( SELECT "public"."auth_salao_id"() AS "auth_salao_id")));



ALTER TABLE "public"."metas_salao" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "metas_salao_delete" ON "public"."metas_salao" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "metas_salao_insert" ON "public"."metas_salao" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "metas_salao_select" ON "public"."metas_salao" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "metas_salao_update" ON "public"."metas_salao" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."modelos_contrato_aluguel" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modelos_contrato_proprio_salao" ON "public"."modelos_contrato_aluguel" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."modulos_catalogo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nbs_catalogo" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nbs_catalogo_leitura" ON "public"."nbs_catalogo" FOR SELECT TO "authenticated" USING ("ativo");



CREATE POLICY "nfce_config_proprio_salao" ON "public"."configuracoes_nfce_produtos" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."nfce_emissoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "nfce_emissoes_select_proprio_salao" ON "public"."nfce_emissoes" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."nfe_config_empresa" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nfe_emissoes_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notas_fiscais" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notas_fiscais_delete_proprio_salao" ON "public"."notas_fiscais" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "notas_fiscais_insert_proprio_salao" ON "public"."notas_fiscais" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."notas_fiscais_itens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notas_fiscais_itens_via_nota" ON "public"."notas_fiscais_itens" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."notas_fiscais" "nf"
  WHERE (("nf"."id" = "notas_fiscais_itens"."nota_fiscal_id") AND ("nf"."salao_id" = ( SELECT "public"."auth_salao_id"() AS "auth_salao_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."notas_fiscais" "nf"
  WHERE (("nf"."id" = "notas_fiscais_itens"."nota_fiscal_id") AND ("nf"."salao_id" = ( SELECT "public"."auth_salao_id"() AS "auth_salao_id"))))));



ALTER TABLE "public"."notas_fiscais_plataforma" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notas_fiscais_select_proprio_salao" ON "public"."notas_fiscais" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "notas_fiscais_update_proprio_salao" ON "public"."notas_fiscais" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."notificacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notificacoes_delete_proprio_salao" ON "public"."notificacoes" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "notificacoes_insert_proprio_salao" ON "public"."notificacoes" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "notificacoes_select_proprio_salao" ON "public"."notificacoes" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "notificacoes_update_proprio_salao" ON "public"."notificacoes" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."os_contadores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "os_contadores_salao_proprio" ON "public"."os_contadores" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."pagamentos_aluguel" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pagamentos_aluguel_proprio_salao" ON "public"."pagamentos_aluguel" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."pagamentos_assinatura" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "painel_escreve_agendamentos_do_salao" ON "public"."agendamentos" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "painel_le_agendamentos_do_salao" ON "public"."agendamentos" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "parceiro_docs_do_salao" ON "public"."parceiro_documentos_mensais" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."parceiro_documentos_mensais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pedidos_vitrine" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."perfis_usuarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planos_assinatura_cliente" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planos_assinatura_proprio_salao" ON "public"."planos_assinatura_cliente" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."plataforma_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plataforma_config_financeira" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plataforma_config_financeira_admin_plataforma" ON "public"."plataforma_config_financeira" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("pu"."is_plataforma_admin" = true)))));



ALTER TABLE "public"."plataforma_contas_recebimento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plataforma_despesas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plataforma_despesas_admin_plataforma" ON "public"."plataforma_despesas" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("pu"."is_plataforma_admin" = true)))));



ALTER TABLE "public"."plataforma_documentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plataforma_nfse_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plataforma_nfse_config_admin_plataforma" ON "public"."plataforma_nfse_config" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("pu"."is_plataforma_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."perfis_usuarios" "pu"
  WHERE (("pu"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("pu"."is_plataforma_admin" = true)))));



ALTER TABLE "public"."plataforma_whatsapp_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_anon_le_saloes_publico" ON "public"."saloes" FOR SELECT TO "anon" USING (true);



CREATE POLICY "portal_atualiza_agendamento_proprio" ON "public"."agendamentos" FOR UPDATE TO "authenticated" USING (("cliente_id" IN ( SELECT "public"."portal_cliente_ids_do_usuario"("auth"."uid"()) AS "portal_cliente_ids_do_usuario"))) WITH CHECK (("cliente_id" IN ( SELECT "public"."portal_cliente_ids_do_usuario"("auth"."uid"()) AS "portal_cliente_ids_do_usuario")));



CREATE POLICY "portal_atualiza_notificacoes_cliente" ON "public"."notificacoes" FOR UPDATE TO "authenticated" USING ((("destinatario_tipo" = 'cliente'::"text") AND ("destinatario_id" = "auth"."uid"())));



CREATE POLICY "portal_atualiza_proprio_clientes" ON "public"."clientes" FOR UPDATE TO "authenticated" USING (("usuario_portal_id" = "auth"."uid"())) WITH CHECK (("usuario_portal_id" = "auth"."uid"()));



CREATE POLICY "portal_insere_agendamento_proprio" ON "public"."agendamentos" FOR INSERT TO "authenticated" WITH CHECK (("cliente_id" IN ( SELECT "public"."portal_cliente_ids_do_usuario"("auth"."uid"()) AS "portal_cliente_ids_do_usuario")));



CREATE POLICY "portal_insere_notificacao" ON "public"."notificacoes" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "portal_insere_pedido_vitrine" ON "public"."pedidos_vitrine" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clientes" "c"
  WHERE (("c"."id" = "pedidos_vitrine"."cliente_id") AND ("c"."usuario_portal_id" = "auth"."uid"()) AND ("c"."salao_id" = "pedidos_vitrine"."salao_id")))));



CREATE POLICY "portal_insere_proprio_clientes" ON "public"."clientes" FOR INSERT TO "authenticated" WITH CHECK (("usuario_portal_id" = "auth"."uid"()));



CREATE POLICY "portal_le_agendamentos_proprios" ON "public"."agendamentos" FOR SELECT TO "authenticated" USING (("cliente_id" IN ( SELECT "public"."portal_cliente_ids_do_usuario"("auth"."uid"()) AS "portal_cliente_ids_do_usuario")));



CREATE POLICY "portal_le_comunicados_vigentes" ON "public"."comunicados_salao" FOR SELECT TO "authenticated" USING ((("ativo" = true) AND (("valido_ate" IS NULL) OR ("valido_ate" >= CURRENT_DATE)) AND (EXISTS ( SELECT 1
   FROM "public"."clientes" "c"
  WHERE (("c"."salao_id" = "comunicados_salao"."salao_id") AND ("c"."usuario_portal_id" = "auth"."uid"()))))));



CREATE POLICY "portal_le_notificacoes_cliente" ON "public"."notificacoes" FOR SELECT TO "authenticated" USING ((("destinatario_tipo" = 'cliente'::"text") AND ("destinatario_id" = "auth"."uid"())));



CREATE POLICY "portal_le_proprio_clientes" ON "public"."clientes" FOR SELECT TO "authenticated" USING (("usuario_portal_id" = "auth"."uid"()));



CREATE POLICY "portal_le_proprios_pedidos" ON "public"."pedidos_vitrine" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clientes" "c"
  WHERE (("c"."id" = "pedidos_vitrine"."cliente_id") AND ("c"."usuario_portal_id" = "auth"."uid"())))));



CREATE POLICY "portal_le_vitrine_config" ON "public"."vitrine_config" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clientes" "c"
  WHERE (("c"."salao_id" = "vitrine_config"."salao_id") AND ("c"."usuario_portal_id" = "auth"."uid"())))));



ALTER TABLE "public"."portal_push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."precificacao_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "precificacao_config_delete" ON "public"."precificacao_config" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "precificacao_config_insert" ON "public"."precificacao_config" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "precificacao_config_select" ON "public"."precificacao_config" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "precificacao_config_update" ON "public"."precificacao_config" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."preferencias_sidebar" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "preferencias_sidebar_proprio_usuario" ON "public"."preferencias_sidebar" TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."produtos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "produtos_painel_proprio_salao" ON "public"."produtos" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "produtos_portal_leitura_publica" ON "public"."produtos" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."profissionais" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profissionais_delete_proprio_salao" ON "public"."profissionais" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "profissionais_select_portal" ON "public"."profissionais" FOR SELECT TO "anon" USING (("ativo" = true));



CREATE POLICY "profissionais_select_proprio_salao" ON "public"."profissionais" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "profissionais_update_proprio_salao" ON "public"."profissionais" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "push_subs_service_role" ON "public"."portal_push_subscriptions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "salao lê proprias conversas" ON "public"."whatsapp_conversas" FOR SELECT USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao lê proprio pacote" ON "public"."salao_whatsapp_pacote" FOR SELECT USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao lê proprio uso" ON "public"."whatsapp_uso" FOR SELECT USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_atualiza_notificacoes" ON "public"."notificacoes" FOR UPDATE USING ((("salao_id" = "public"."auth_salao_id"()) AND ("destinatario_tipo" = 'salao'::"text")));



CREATE POLICY "salao_gerencia_comunicados" ON "public"."comunicados_salao" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_gerencia_produtos" ON "public"."produtos" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_gerencia_promocoes" ON "public"."vitrine_promocoes" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_gerencia_vitrine_config" ON "public"."vitrine_config" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_le_notificacoes" ON "public"."notificacoes" FOR SELECT USING ((("salao_id" = "public"."auth_salao_id"()) AND ("destinatario_tipo" = 'salao'::"text")));



CREATE POLICY "salao_le_pedidos_vitrine" ON "public"."pedidos_vitrine" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_le_propria_carteira" ON "public"."whatsapp_carteira_creditos" FOR SELECT USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_le_propria_compras" ON "public"."whatsapp_compras_creditos" FOR SELECT USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_le_propria_config_fiscal" ON "public"."nfe_config_empresa" FOR SELECT USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_le_proprias_avaliacoes" ON "public"."avaliacoes_atendimento" FOR SELECT TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_le_proprio_log" ON "public"."whatsapp_mensagens_log" FOR SELECT USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_le_proprio_log_fiscal" ON "public"."nfe_emissoes_log" FOR SELECT USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_le_proprio_plano" ON "public"."whatsapp_config_plano" FOR SELECT USING (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."salao_modulos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."salao_planos_historico" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salao_proprio_comissao_extras" ON "public"."comissao_extras" TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "salao_proprio_fidelidade_bloqueios" ON "public"."fidelidade_servicos_bloqueados" USING (("public"."auth_salao_id"() = "salao_id"));



ALTER TABLE "public"."salao_whatsapp_pacote" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saloes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saloes_portal_leitura_publica" ON "public"."saloes" FOR SELECT USING (true);



CREATE POLICY "saloes_update_proprio_salao" ON "public"."saloes" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())
 LIMIT 1))) WITH CHECK (("id" = ( SELECT "perfis_usuarios"."salao_id"
   FROM "public"."perfis_usuarios"
  WHERE ("perfis_usuarios"."id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "service_role_all" ON "public"."whatsapp_assinaturas_creditos" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."servicos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "servicos_delete_proprio_salao" ON "public"."servicos" FOR DELETE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "servicos_insert_proprio_salao" ON "public"."servicos" FOR INSERT TO "authenticated" WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "servicos_select_publico" ON "public"."servicos" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "servicos_update_proprio_salao" ON "public"."servicos" FOR UPDATE TO "authenticated" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



ALTER TABLE "public"."setores_salao" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "setores_salao_proprio" ON "public"."setores_salao" USING (("salao_id" = "public"."auth_salao_id"())) WITH CHECK (("salao_id" = "public"."auth_salao_id"()));



CREATE POLICY "somente admin lê config whatsapp" ON "public"."plataforma_whatsapp_config" USING (false);



ALTER TABLE "public"."termos_aceites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "termos_leitura" ON "public"."termos_uso" FOR SELECT USING (true);



ALTER TABLE "public"."termos_uso" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "todos_leem_pacotes_ativos" ON "public"."whatsapp_pacotes" FOR SELECT USING (("ativo" = true));



ALTER TABLE "public"."usuarios_portal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vitrine_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vitrine_promocoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_assinaturas_creditos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_carteira_creditos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_compras_creditos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_config_isolado_salao" ON "public"."whatsapp_config" TO "authenticated" USING (("salao_id" = ( SELECT "public"."auth_salao_id"() AS "auth_salao_id"))) WITH CHECK (("salao_id" = ( SELECT "public"."auth_salao_id"() AS "auth_salao_id")));



ALTER TABLE "public"."whatsapp_config_plano" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_conversas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_mensagens_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_pacotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_uso" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."whatsapp_config";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































REVOKE ALL ON FUNCTION "public"."admin_ativar_modulo_fiscal"("p_salao_id" "uuid", "p_nfse" boolean, "p_nfce" boolean, "p_company_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_ativar_modulo_fiscal"("p_salao_id" "uuid", "p_nfse" boolean, "p_nfce" boolean, "p_company_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_liberar_modulo_global"("p_modulo_chave" "text", "p_dias" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_liberar_modulo_global"("p_modulo_chave" "text", "p_dias" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_listar_promocoes_ativas"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_listar_promocoes_ativas"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_revogar_promocao_global"("p_modulo_chave" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_revogar_promocao_global"("p_modulo_chave" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ajustar_metricas_cliente"("p_cliente_id" "uuid", "p_salao_id" "uuid", "p_delta_gasto" numeric, "p_delta_visitas" integer, "p_data_visita" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ajustar_metricas_cliente"("p_cliente_id" "uuid", "p_salao_id" "uuid", "p_delta_gasto" numeric, "p_delta_visitas" integer, "p_data_visita" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ajustar_metricas_cliente"("p_cliente_id" "uuid", "p_salao_id" "uuid", "p_delta_gasto" numeric, "p_delta_visitas" integer, "p_data_visita" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ativar_producao_fiscal"("p_salao_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ativar_producao_fiscal"("p_salao_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_atualizado_em"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_salao_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_salao_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_salao_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."baixar_estoque_vitrine"("p_salao_id" "uuid", "p_pedido_id" "uuid", "p_itens" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."baixar_estoque_vitrine"("p_salao_id" "uuid", "p_pedido_id" "uuid", "p_itens" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."bloquear_encaixe_via_portal"() TO "anon";
GRANT ALL ON FUNCTION "public"."bloquear_encaixe_via_portal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bloquear_encaixe_via_portal"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."buscar_agendamentos_para_lembrete"("p_janela_min" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."buscar_agendamentos_para_lembrete"("p_janela_min" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."comprar_pacote_whatsapp"("p_pacote_id" "uuid", "p_meio_pagamento" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."comprar_pacote_whatsapp"("p_pacote_id" "uuid", "p_meio_pagamento" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."creditar_pacote_whatsapp_pago"("p_salao_id" "uuid", "p_pacote_id" "uuid", "p_meio_pagamento" "text", "p_pagamento_externo_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."creditar_pacote_whatsapp_pago"("p_salao_id" "uuid", "p_pacote_id" "uuid", "p_meio_pagamento" "text", "p_pagamento_externo_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."creditar_pacote_whatsapp_service"("p_salao_id" "uuid", "p_pacote_id" "uuid", "p_meio_pagamento" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."creditar_pacote_whatsapp_service"("p_salao_id" "uuid", "p_pacote_id" "uuid", "p_meio_pagamento" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."debitar_credito_whatsapp"("p_salao_id" "uuid", "p_sub_waba_id" "text", "p_categoria" "text", "p_origem" "text", "p_custo_unitario" numeric, "p_categoria_solicitada" "text", "p_meta_message_id" "text", "p_cliente_id" "uuid", "p_campanha_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."debitar_credito_whatsapp"("p_salao_id" "uuid", "p_sub_waba_id" "text", "p_categoria" "text", "p_origem" "text", "p_custo_unitario" numeric, "p_categoria_solicitada" "text", "p_meta_message_id" "text", "p_cliente_id" "uuid", "p_campanha_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."desativar_outras_contas_recebimento"() TO "anon";
GRANT ALL ON FUNCTION "public"."desativar_outras_contas_recebimento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."desativar_outras_contas_recebimento"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."expirar_modulos_vencidos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expirar_modulos_vencidos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."expirar_planos_vencidos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expirar_planos_vencidos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fechar_conta_atomico"("p" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fechar_conta_atomico"("p" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."fechar_conta_atomico"("p" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."fn_fidelidade_creditar_pontos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_fidelidade_creditar_pontos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gerar_numero_os"("p_salao_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gerar_numero_os"("p_salao_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_numero_os"("p_salao_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."horarios_ocupados_salao"("p_salao_id" "uuid", "p_data" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."horarios_ocupados_salao"("p_salao_id" "uuid", "p_data" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."horarios_ocupados_salao"("p_salao_id" "uuid", "p_data" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."limpar_aguardando_pagamento"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."limpar_aguardando_pagamento"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesclar_clientes_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesclar_clientes_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesclar_produtos_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesclar_produtos_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mesclar_servicos_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mesclar_servicos_duplicados"("p_salao_id" "uuid", "p_manter_id" "uuid", "p_remover_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."nfce_emissoes_touch"() TO "anon";
GRANT ALL ON FUNCTION "public"."nfce_emissoes_touch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."nfce_emissoes_touch"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_consumo_whatsapp_mes"("p_mes" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_consumo_whatsapp_mes"("p_mes" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_consumo_whatsapp_mes"("p_mes" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_proximo_numero_nfce"("p_salao_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_proximo_numero_nfce"("p_salao_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_saldo_whatsapp"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_saldo_whatsapp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_saldo_whatsapp"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."obter_status_fiscal"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."obter_status_fiscal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."obter_status_fiscal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_cliente_ids_do_usuario"("p_uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_cliente_ids_do_usuario"("p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_cliente_ids_do_usuario"("p_uid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_auditoria_cancelamento_agendamento"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_auditoria_cancelamento_agendamento"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_auditoria_financeiro"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_auditoria_financeiro"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_certificado_fiscal"("p_salao_id" "uuid", "p_validade" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_certificado_fiscal"("p_salao_id" "uuid", "p_validade" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."registrar_conversa_whatsapp"("p_salao_id" "uuid", "p_telefone" "text", "p_tipo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_conversa_whatsapp"("p_salao_id" "uuid", "p_telefone" "text", "p_tipo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resgatar_credito_fidelidade"("p_salao_id" "uuid", "p_cliente_id" "uuid", "p_pontos" integer, "p_financeiro_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resgatar_credito_fidelidade"("p_salao_id" "uuid", "p_cliente_id" "uuid", "p_pontos" integer, "p_financeiro_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resgatar_credito_fidelidade"("p_salao_id" "uuid", "p_cliente_id" "uuid", "p_pontos" integer, "p_financeiro_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."resgatar_premio_fidelidade"("p_salao_id" "uuid", "p_cliente_id" "uuid", "p_premio_id" "uuid", "p_profissional_id" "uuid", "p_data" "date", "p_inicio" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resgatar_premio_fidelidade"("p_salao_id" "uuid", "p_cliente_id" "uuid", "p_premio_id" "uuid", "p_profissional_id" "uuid", "p_data" "date", "p_inicio" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resgatar_premio_fidelidade"("p_salao_id" "uuid", "p_cliente_id" "uuid", "p_premio_id" "uuid", "p_profissional_id" "uuid", "p_data" "date", "p_inicio" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restaurar_credito_whatsapp"("p_wamid" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restaurar_credito_whatsapp"("p_wamid" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverter_movimentos_venda"("p_financeiro_id" bigint, "p_salao_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reverter_movimentos_venda"("p_financeiro_id" bigint, "p_salao_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reverter_movimentos_venda"("p_financeiro_id" bigint, "p_salao_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_comissao_data_evento"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_comissao_data_evento"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validar_certificado_fiscal"("p_salao_id" "uuid", "p_validade" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validar_certificado_fiscal"("p_salao_id" "uuid", "p_validade" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_elegibilidade_comissao"() TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_elegibilidade_comissao"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_elegibilidade_comissao"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_limite_profissionais"() TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_limite_profissionais"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_limite_profissionais"() TO "service_role";
























GRANT ALL ON TABLE "public"."aceites_contrato" TO "anon";
GRANT ALL ON TABLE "public"."aceites_contrato" TO "authenticated";
GRANT ALL ON TABLE "public"."aceites_contrato" TO "service_role";



GRANT ALL ON TABLE "public"."agendamentos" TO "anon";
GRANT ALL ON TABLE "public"."agendamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."agendamentos" TO "service_role";



GRANT ALL ON TABLE "public"."assinaturas_cliente" TO "anon";
GRANT ALL ON TABLE "public"."assinaturas_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."assinaturas_cliente" TO "service_role";



GRANT ALL ON TABLE "public"."auditoria_certificados" TO "anon";
GRANT ALL ON TABLE "public"."auditoria_certificados" TO "authenticated";
GRANT ALL ON TABLE "public"."auditoria_certificados" TO "service_role";



GRANT ALL ON TABLE "public"."auditoria_log" TO "anon";
GRANT ALL ON TABLE "public"."auditoria_log" TO "authenticated";
GRANT ALL ON TABLE "public"."auditoria_log" TO "service_role";



GRANT ALL ON TABLE "public"."automacoes" TO "anon";
GRANT ALL ON TABLE "public"."automacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."automacoes" TO "service_role";



GRANT ALL ON TABLE "public"."avaliacoes_atendimento" TO "anon";
GRANT ALL ON TABLE "public"."avaliacoes_atendimento" TO "authenticated";
GRANT ALL ON TABLE "public"."avaliacoes_atendimento" TO "service_role";



GRANT ALL ON TABLE "public"."avisos_plataforma" TO "anon";
GRANT ALL ON TABLE "public"."avisos_plataforma" TO "authenticated";
GRANT ALL ON TABLE "public"."avisos_plataforma" TO "service_role";



GRANT ALL ON TABLE "public"."avisos_visualizacoes" TO "anon";
GRANT ALL ON TABLE "public"."avisos_visualizacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."avisos_visualizacoes" TO "service_role";



GRANT ALL ON TABLE "public"."caixa_transacoes" TO "anon";
GRANT ALL ON TABLE "public"."caixa_transacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."caixa_transacoes" TO "service_role";



GRANT ALL ON TABLE "public"."carteira_clientes" TO "anon";
GRANT ALL ON TABLE "public"."carteira_clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."carteira_clientes" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON TABLE "public"."cobrancas_assinatura" TO "anon";
GRANT ALL ON TABLE "public"."cobrancas_assinatura" TO "authenticated";
GRANT ALL ON TABLE "public"."cobrancas_assinatura" TO "service_role";



GRANT ALL ON TABLE "public"."codigos_municipais_aceitos" TO "anon";
GRANT ALL ON TABLE "public"."codigos_municipais_aceitos" TO "authenticated";
GRANT ALL ON TABLE "public"."codigos_municipais_aceitos" TO "service_role";



GRANT ALL ON TABLE "public"."comissao_extras" TO "anon";
GRANT ALL ON TABLE "public"."comissao_extras" TO "authenticated";
GRANT ALL ON TABLE "public"."comissao_extras" TO "service_role";



GRANT ALL ON TABLE "public"."comissoes" TO "anon";
GRANT ALL ON TABLE "public"."comissoes" TO "authenticated";
GRANT ALL ON TABLE "public"."comissoes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comissoes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comissoes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comissoes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comunicados_salao" TO "anon";
GRANT ALL ON TABLE "public"."comunicados_salao" TO "authenticated";
GRANT ALL ON TABLE "public"."comunicados_salao" TO "service_role";



GRANT ALL ON TABLE "public"."config_taxas" TO "anon";
GRANT ALL ON TABLE "public"."config_taxas" TO "authenticated";
GRANT ALL ON TABLE "public"."config_taxas" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_fiscais_profissionais" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes_fiscais_profissionais" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes_fiscais_profissionais" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_nfce" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes_nfce" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes_nfce" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_nfce_produtos" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes_nfce_produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes_nfce_produtos" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_nfse" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes_nfse" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes_nfse" TO "service_role";



GRANT ALL ON TABLE "public"."contratos_aluguel" TO "anon";
GRANT ALL ON TABLE "public"."contratos_aluguel" TO "authenticated";
GRANT ALL ON TABLE "public"."contratos_aluguel" TO "service_role";



GRANT ALL ON TABLE "public"."crm_clientes" TO "anon";
GRANT ALL ON TABLE "public"."crm_clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_clientes" TO "service_role";



GRANT ALL ON TABLE "public"."custos_fixos_salao" TO "anon";
GRANT ALL ON TABLE "public"."custos_fixos_salao" TO "authenticated";
GRANT ALL ON TABLE "public"."custos_fixos_salao" TO "service_role";



GRANT ALL ON TABLE "public"."despesas" TO "anon";
GRANT ALL ON TABLE "public"."despesas" TO "authenticated";
GRANT ALL ON TABLE "public"."despesas" TO "service_role";



GRANT ALL ON TABLE "public"."estoque" TO "anon";
GRANT ALL ON TABLE "public"."estoque" TO "authenticated";
GRANT ALL ON TABLE "public"."estoque" TO "service_role";



GRANT ALL ON TABLE "public"."etiquetas" TO "anon";
GRANT ALL ON TABLE "public"."etiquetas" TO "authenticated";
GRANT ALL ON TABLE "public"."etiquetas" TO "service_role";



GRANT ALL ON TABLE "public"."ficha_tecnica" TO "anon";
GRANT ALL ON TABLE "public"."ficha_tecnica" TO "authenticated";
GRANT ALL ON TABLE "public"."ficha_tecnica" TO "service_role";



GRANT ALL ON TABLE "public"."fidelidade_config" TO "anon";
GRANT ALL ON TABLE "public"."fidelidade_config" TO "authenticated";
GRANT ALL ON TABLE "public"."fidelidade_config" TO "service_role";



GRANT ALL ON TABLE "public"."fidelidade_premios" TO "anon";
GRANT ALL ON TABLE "public"."fidelidade_premios" TO "authenticated";
GRANT ALL ON TABLE "public"."fidelidade_premios" TO "service_role";



GRANT ALL ON TABLE "public"."fidelidade_servicos_bloqueados" TO "anon";
GRANT ALL ON TABLE "public"."fidelidade_servicos_bloqueados" TO "authenticated";
GRANT ALL ON TABLE "public"."fidelidade_servicos_bloqueados" TO "service_role";



GRANT ALL ON TABLE "public"."fidelidade_transacoes" TO "anon";
GRANT ALL ON TABLE "public"."fidelidade_transacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."fidelidade_transacoes" TO "service_role";



GRANT ALL ON TABLE "public"."fila_envio" TO "anon";
GRANT ALL ON TABLE "public"."fila_envio" TO "authenticated";
GRANT ALL ON TABLE "public"."fila_envio" TO "service_role";



GRANT ALL ON TABLE "public"."financeiro" TO "anon";
GRANT ALL ON TABLE "public"."financeiro" TO "authenticated";
GRANT ALL ON TABLE "public"."financeiro" TO "service_role";



GRANT ALL ON SEQUENCE "public"."financeiro_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."financeiro_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."financeiro_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fornecedores" TO "anon";
GRANT ALL ON TABLE "public"."fornecedores" TO "authenticated";
GRANT ALL ON TABLE "public"."fornecedores" TO "service_role";



GRANT ALL ON TABLE "public"."funcoes" TO "anon";
GRANT ALL ON TABLE "public"."funcoes" TO "authenticated";
GRANT ALL ON TABLE "public"."funcoes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."funcoes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."funcoes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."funcoes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."historico_estoque" TO "anon";
GRANT ALL ON TABLE "public"."historico_estoque" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_estoque" TO "service_role";



GRANT ALL ON TABLE "public"."lgpd_solicitacoes_exclusao" TO "anon";
GRANT ALL ON TABLE "public"."lgpd_solicitacoes_exclusao" TO "authenticated";
GRANT ALL ON TABLE "public"."lgpd_solicitacoes_exclusao" TO "service_role";



GRANT ALL ON TABLE "public"."lista_espera" TO "anon";
GRANT ALL ON TABLE "public"."lista_espera" TO "authenticated";
GRANT ALL ON TABLE "public"."lista_espera" TO "service_role";



GRANT ALL ON TABLE "public"."locatarios" TO "anon";
GRANT ALL ON TABLE "public"."locatarios" TO "authenticated";
GRANT ALL ON TABLE "public"."locatarios" TO "service_role";



GRANT ALL ON TABLE "public"."log_auditoria_acoes" TO "anon";
GRANT ALL ON TABLE "public"."log_auditoria_acoes" TO "authenticated";
GRANT ALL ON TABLE "public"."log_auditoria_acoes" TO "service_role";



GRANT ALL ON TABLE "public"."metas_salao" TO "anon";
GRANT ALL ON TABLE "public"."metas_salao" TO "authenticated";
GRANT ALL ON TABLE "public"."metas_salao" TO "service_role";



GRANT ALL ON TABLE "public"."modelos_contrato_aluguel" TO "anon";
GRANT ALL ON TABLE "public"."modelos_contrato_aluguel" TO "authenticated";
GRANT ALL ON TABLE "public"."modelos_contrato_aluguel" TO "service_role";



GRANT ALL ON TABLE "public"."modulos_catalogo" TO "anon";
GRANT ALL ON TABLE "public"."modulos_catalogo" TO "authenticated";
GRANT ALL ON TABLE "public"."modulos_catalogo" TO "service_role";



GRANT ALL ON TABLE "public"."nbs_catalogo" TO "authenticated";
GRANT ALL ON TABLE "public"."nbs_catalogo" TO "service_role";



GRANT ALL ON TABLE "public"."nfce_emissoes" TO "anon";
GRANT ALL ON TABLE "public"."nfce_emissoes" TO "authenticated";
GRANT ALL ON TABLE "public"."nfce_emissoes" TO "service_role";



GRANT ALL ON TABLE "public"."nfe_config_empresa" TO "anon";
GRANT ALL ON TABLE "public"."nfe_config_empresa" TO "authenticated";
GRANT ALL ON TABLE "public"."nfe_config_empresa" TO "service_role";



GRANT ALL ON TABLE "public"."nfe_emissoes_log" TO "anon";
GRANT ALL ON TABLE "public"."nfe_emissoes_log" TO "authenticated";
GRANT ALL ON TABLE "public"."nfe_emissoes_log" TO "service_role";



GRANT ALL ON TABLE "public"."notas_fiscais" TO "anon";
GRANT ALL ON TABLE "public"."notas_fiscais" TO "authenticated";
GRANT ALL ON TABLE "public"."notas_fiscais" TO "service_role";



GRANT ALL ON TABLE "public"."notas_fiscais_itens" TO "anon";
GRANT ALL ON TABLE "public"."notas_fiscais_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."notas_fiscais_itens" TO "service_role";



GRANT ALL ON TABLE "public"."notas_fiscais_plataforma" TO "anon";
GRANT ALL ON TABLE "public"."notas_fiscais_plataforma" TO "authenticated";
GRANT ALL ON TABLE "public"."notas_fiscais_plataforma" TO "service_role";



GRANT ALL ON TABLE "public"."notificacoes" TO "anon";
GRANT ALL ON TABLE "public"."notificacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."notificacoes" TO "service_role";



GRANT ALL ON TABLE "public"."os_contadores" TO "anon";
GRANT ALL ON TABLE "public"."os_contadores" TO "authenticated";
GRANT ALL ON TABLE "public"."os_contadores" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos_aluguel" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos_aluguel" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos_aluguel" TO "service_role";



GRANT ALL ON TABLE "public"."pagamentos_assinatura" TO "anon";
GRANT ALL ON TABLE "public"."pagamentos_assinatura" TO "authenticated";
GRANT ALL ON TABLE "public"."pagamentos_assinatura" TO "service_role";



GRANT ALL ON TABLE "public"."parceiro_documentos_mensais" TO "anon";
GRANT ALL ON TABLE "public"."parceiro_documentos_mensais" TO "authenticated";
GRANT ALL ON TABLE "public"."parceiro_documentos_mensais" TO "service_role";



GRANT ALL ON TABLE "public"."pedidos_vitrine" TO "anon";
GRANT ALL ON TABLE "public"."pedidos_vitrine" TO "authenticated";
GRANT ALL ON TABLE "public"."pedidos_vitrine" TO "service_role";



GRANT ALL ON TABLE "public"."perfis_usuarios" TO "anon";
GRANT ALL ON TABLE "public"."perfis_usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."perfis_usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."planos" TO "anon";
GRANT ALL ON TABLE "public"."planos" TO "authenticated";
GRANT ALL ON TABLE "public"."planos" TO "service_role";



GRANT ALL ON TABLE "public"."planos_assinatura_cliente" TO "anon";
GRANT ALL ON TABLE "public"."planos_assinatura_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."planos_assinatura_cliente" TO "service_role";



GRANT ALL ON TABLE "public"."plataforma_config" TO "anon";
GRANT ALL ON TABLE "public"."plataforma_config" TO "authenticated";
GRANT ALL ON TABLE "public"."plataforma_config" TO "service_role";



GRANT ALL ON TABLE "public"."plataforma_config_financeira" TO "anon";
GRANT ALL ON TABLE "public"."plataforma_config_financeira" TO "authenticated";
GRANT ALL ON TABLE "public"."plataforma_config_financeira" TO "service_role";



GRANT ALL ON TABLE "public"."plataforma_contas_recebimento" TO "anon";
GRANT ALL ON TABLE "public"."plataforma_contas_recebimento" TO "authenticated";
GRANT ALL ON TABLE "public"."plataforma_contas_recebimento" TO "service_role";



GRANT ALL ON TABLE "public"."plataforma_despesas" TO "anon";
GRANT ALL ON TABLE "public"."plataforma_despesas" TO "authenticated";
GRANT ALL ON TABLE "public"."plataforma_despesas" TO "service_role";



GRANT ALL ON TABLE "public"."plataforma_documentos" TO "anon";
GRANT ALL ON TABLE "public"."plataforma_documentos" TO "authenticated";
GRANT ALL ON TABLE "public"."plataforma_documentos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."plataforma_documentos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."plataforma_documentos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."plataforma_documentos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."plataforma_nfse_config" TO "anon";
GRANT ALL ON TABLE "public"."plataforma_nfse_config" TO "authenticated";
GRANT ALL ON TABLE "public"."plataforma_nfse_config" TO "service_role";



GRANT ALL ON TABLE "public"."plataforma_whatsapp_config" TO "anon";
GRANT ALL ON TABLE "public"."plataforma_whatsapp_config" TO "authenticated";
GRANT ALL ON TABLE "public"."plataforma_whatsapp_config" TO "service_role";



GRANT ALL ON TABLE "public"."portal_push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."portal_push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."precificacao_config" TO "anon";
GRANT ALL ON TABLE "public"."precificacao_config" TO "authenticated";
GRANT ALL ON TABLE "public"."precificacao_config" TO "service_role";



GRANT ALL ON TABLE "public"."preferencias_sidebar" TO "anon";
GRANT ALL ON TABLE "public"."preferencias_sidebar" TO "authenticated";
GRANT ALL ON TABLE "public"."preferencias_sidebar" TO "service_role";



GRANT ALL ON TABLE "public"."produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."produtos" TO "anon";



GRANT SELECT("salao_id") ON TABLE "public"."produtos" TO "anon";



GRANT SELECT("nome_produto") ON TABLE "public"."produtos" TO "anon";



GRANT SELECT("categoria") ON TABLE "public"."produtos" TO "anon";



GRANT SELECT("unidade_medida") ON TABLE "public"."produtos" TO "anon";



GRANT SELECT("quantidade_atual") ON TABLE "public"."produtos" TO "anon";



GRANT SELECT("preco_venda") ON TABLE "public"."produtos" TO "anon";



GRANT SELECT("subcategoria") ON TABLE "public"."produtos" TO "anon";



GRANT SELECT("visivel_vitrine") ON TABLE "public"."produtos" TO "anon";



GRANT SELECT("imagem_url") ON TABLE "public"."produtos" TO "anon";



GRANT SELECT("descricao_vitrine") ON TABLE "public"."produtos" TO "anon";



GRANT ALL ON TABLE "public"."profissionais" TO "authenticated";
GRANT ALL ON TABLE "public"."profissionais" TO "service_role";



GRANT ALL ON TABLE "public"."profissionais_publico" TO "anon";
GRANT ALL ON TABLE "public"."profissionais_publico" TO "authenticated";
GRANT ALL ON TABLE "public"."profissionais_publico" TO "service_role";



GRANT ALL ON TABLE "public"."salao_modulos" TO "anon";
GRANT ALL ON TABLE "public"."salao_modulos" TO "authenticated";
GRANT ALL ON TABLE "public"."salao_modulos" TO "service_role";



GRANT ALL ON TABLE "public"."salao_planos_historico" TO "anon";
GRANT ALL ON TABLE "public"."salao_planos_historico" TO "authenticated";
GRANT ALL ON TABLE "public"."salao_planos_historico" TO "service_role";



GRANT ALL ON TABLE "public"."salao_whatsapp_pacote" TO "anon";
GRANT ALL ON TABLE "public"."salao_whatsapp_pacote" TO "authenticated";
GRANT ALL ON TABLE "public"."salao_whatsapp_pacote" TO "service_role";



GRANT ALL ON TABLE "public"."saloes" TO "authenticated";
GRANT ALL ON TABLE "public"."saloes" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."saloes" TO "anon";



GRANT SELECT("nome_fantasia") ON TABLE "public"."saloes" TO "anon";



GRANT SELECT("telefone") ON TABLE "public"."saloes" TO "anon";



GRANT SELECT("bairro") ON TABLE "public"."saloes" TO "anon";



GRANT SELECT("cidade") ON TABLE "public"."saloes" TO "anon";



GRANT SELECT("estado") ON TABLE "public"."saloes" TO "anon";



GRANT SELECT("cobrar_sinal") ON TABLE "public"."saloes" TO "anon";



GRANT SELECT("porcentagem_sinal") ON TABLE "public"."saloes" TO "anon";



GRANT SELECT("slug") ON TABLE "public"."saloes" TO "anon";



GRANT SELECT("horarios_funcionamento") ON TABLE "public"."saloes" TO "anon";



GRANT SELECT("vitrine_liberada") ON TABLE "public"."saloes" TO "anon";



GRANT SELECT("prazo_sinal_minutos") ON TABLE "public"."saloes" TO "anon";



GRANT ALL ON TABLE "public"."saloes_publico" TO "anon";
GRANT ALL ON TABLE "public"."saloes_publico" TO "authenticated";
GRANT ALL ON TABLE "public"."saloes_publico" TO "service_role";



GRANT ALL ON TABLE "public"."servicos" TO "authenticated";
GRANT ALL ON TABLE "public"."servicos" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."servicos" TO "anon";



GRANT SELECT("salao_id") ON TABLE "public"."servicos" TO "anon";



GRANT SELECT("nome_servico") ON TABLE "public"."servicos" TO "anon";



GRANT SELECT("preco_padrao") ON TABLE "public"."servicos" TO "anon";



GRANT SELECT("duracao_minutos") ON TABLE "public"."servicos" TO "anon";



GRANT SELECT("descricao") ON TABLE "public"."servicos" TO "anon";



GRANT SELECT("tipo_preco") ON TABLE "public"."servicos" TO "anon";



GRANT SELECT("categoria") ON TABLE "public"."servicos" TO "anon";



GRANT SELECT("exibir_online") ON TABLE "public"."servicos" TO "anon";



GRANT SELECT("setor") ON TABLE "public"."servicos" TO "anon";



GRANT ALL ON TABLE "public"."servicos_publico" TO "anon";
GRANT ALL ON TABLE "public"."servicos_publico" TO "authenticated";
GRANT ALL ON TABLE "public"."servicos_publico" TO "service_role";



GRANT ALL ON TABLE "public"."setores_salao" TO "anon";
GRANT ALL ON TABLE "public"."setores_salao" TO "authenticated";
GRANT ALL ON TABLE "public"."setores_salao" TO "service_role";



GRANT ALL ON TABLE "public"."termos_aceites" TO "anon";
GRANT ALL ON TABLE "public"."termos_aceites" TO "authenticated";
GRANT ALL ON TABLE "public"."termos_aceites" TO "service_role";



GRANT ALL ON TABLE "public"."termos_uso" TO "anon";
GRANT ALL ON TABLE "public"."termos_uso" TO "authenticated";
GRANT ALL ON TABLE "public"."termos_uso" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_portal" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_portal" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_portal" TO "service_role";



GRANT ALL ON TABLE "public"."vitrine_config" TO "anon";
GRANT ALL ON TABLE "public"."vitrine_config" TO "authenticated";
GRANT ALL ON TABLE "public"."vitrine_config" TO "service_role";



GRANT ALL ON TABLE "public"."vitrine_promocoes" TO "anon";
GRANT ALL ON TABLE "public"."vitrine_promocoes" TO "authenticated";
GRANT ALL ON TABLE "public"."vitrine_promocoes" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_assinaturas_creditos" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_assinaturas_creditos" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_assinaturas_creditos" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_carteira_creditos" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_carteira_creditos" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_carteira_creditos" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_compras_creditos" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_compras_creditos" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_compras_creditos" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_config" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_config" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_config" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_config_plano" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_config_plano" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_config_plano" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_conversas" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_conversas" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_conversas" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_mensagens_log" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_mensagens_log" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_mensagens_log" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_pacotes" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_pacotes" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_pacotes" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_uso" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_uso" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_uso" TO "service_role";



GRANT ALL ON SEQUENCE "public"."whatsapp_uso_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."whatsapp_uso_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."whatsapp_uso_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































