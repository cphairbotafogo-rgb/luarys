-- 20260711_financeiro_pagamentos_split.sql
--
-- Guarda a DIVISÃO real dos pagamentos de cada venda (pix/crédito/débito/dinheiro/
-- cheque/pré-pago) em financeiro.pagamentos (jsonb). Antes só existia forma_pagamento
-- (a forma dominante). Com isto, o Relatório de Movimentações mostra o split exato,
-- igual à Trinks — para vendas feitas a partir de agora (as antigas não têm o dado).

ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS pagamentos jsonb;

-- RPC atualizada: mesma lógica de antes + insere `pagamentos` no financeiro.
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

  -- 2) ESTOQUE
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p->'estoque', '[]'::jsonb)) LOOP
    UPDATE produtos
       SET quantidade_atual = COALESCE(quantidade_atual, 0) - (item->>'quantidade')::numeric
     WHERE id = (item->>'produto_id')::uuid
       AND salao_id = v_salao_id;
    INSERT INTO historico_estoque (salao_id, produto_id, tipo, quantidade, motivo)
    VALUES (v_salao_id, (item->>'produto_id')::uuid, 'Saida', (item->>'quantidade')::numeric, item->>'motivo');
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
