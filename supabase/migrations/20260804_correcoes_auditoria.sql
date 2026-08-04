-- 20260804_correcoes_auditoria.sql
--
-- Duas correções vindas da auditoria geral do sistema (04/08/2026).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 1) ajustar_metricas_cliente() — soma/subtrai total_gasto e total_visitas de
--    forma ATÔMICA.
--
--    PROBLEMA: tanto o fechamento de conta quanto o estorno faziam
--    read-modify-write:
--        le total_gasto  →  calcula em JS  →  grava o resultado
--    Duas vendas do mesmo cliente fechadas ao mesmo tempo (dois caixas, ou
--    caixa + PDV) liam o MESMO valor inicial e a segunda gravação sobrescrevia
--    a primeira — o total_gasto do cliente ficava menor do que o real, sem erro
--    nenhum. O mesmo valia para total_visitas.
--
--    SOLUÇÃO: um único UPDATE que soma a partir do valor corrente na linha,
--    dentro da própria instrução (o Postgres serializa por linha). Aceita delta
--    negativo — é o que o estorno usa para devolver.
--
--    total_gasto nunca fica negativo (GREATEST 0); total_visitas idem.
--
-- 2) fechar_conta_atomico() — não gravar histórico de estoque quando a baixa
--    não aconteceu.
--
--    PROBLEMA: o UPDATE em `produtos` filtra por id + salao_id. Se o produto não
--    existisse, tivesse sido apagado, ou fosse de outro salão, o UPDATE afetava
--    0 linhas — mas o INSERT em historico_estoque rodava assim mesmo. Resultado:
--    movimentação de saída registrada para uma baixa que nunca ocorreu,
--    desencontrando o histórico do saldo real.
--
--    SOLUÇÃO: só insere no histórico se o UPDATE afetou alguma linha.
--    O resto da função é idêntico à versão de 20260711 (pagamentos split).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) Métricas do cliente, atômicas ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ajustar_metricas_cliente(
  p_cliente_id     uuid,
  p_salao_id       uuid,
  p_delta_gasto    numeric,
  p_delta_visitas  integer,
  p_data_visita    date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

COMMENT ON FUNCTION public.ajustar_metricas_cliente(uuid, uuid, numeric, integer, date) IS
  'Soma (ou subtrai, com delta negativo) total_gasto/total_visitas de um cliente de forma atômica. Usado pelo fechamento de conta e pelo estorno — substitui o read-modify-write que perdia gravações concorrentes.';

REVOKE ALL ON FUNCTION public.ajustar_metricas_cliente(uuid, uuid, numeric, integer, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_metricas_cliente(uuid, uuid, numeric, integer, date) TO authenticated;

-- ── 2) fechar_conta_atomico: histórico de estoque só quando houve baixa ──────
CREATE OR REPLACE FUNCTION public.fechar_conta_atomico(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_salao_id uuid := (p->>'salao_id')::uuid;
  v_fin      jsonb := p->'financeiro';
  v_fin_id   bigint;
  v_ag_ids   uuid[];
  item       jsonb;
  v_afetadas integer;
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

  -- 2) ESTOQUE — histórico só se a baixa realmente aconteceu
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p->'estoque', '[]'::jsonb)) LOOP
    UPDATE produtos
       SET quantidade_atual = COALESCE(quantidade_atual, 0) - (item->>'quantidade')::numeric
     WHERE id = (item->>'produto_id')::uuid
       AND salao_id = v_salao_id;

    GET DIAGNOSTICS v_afetadas = ROW_COUNT;

    IF v_afetadas > 0 THEN
      INSERT INTO historico_estoque (salao_id, produto_id, tipo, quantidade, motivo)
      VALUES (v_salao_id, (item->>'produto_id')::uuid, 'Saida', (item->>'quantidade')::numeric, item->>'motivo');
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

  RETURN jsonb_build_object('financeiro_id', v_fin_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fechar_conta_atomico(jsonb) TO authenticated;
