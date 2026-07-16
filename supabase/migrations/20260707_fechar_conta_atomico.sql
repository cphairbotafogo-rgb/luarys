-- 20260707_fechar_conta_atomico.sql
--
-- RPC transacional para o Fechamento de Conta.
--
-- PROBLEMA que resolve:
--   O fluxo antigo gravava financeiro, estoque, comissões e finalização de
--   agendamentos em chamadas separadas. Se uma falhasse no meio, ficavam
--   registros órfãos (estoque baixado sem venda, comissões sem financeiro) e
--   a nova tentativa duplicava tudo.
--
-- SOLUÇÃO:
--   Uma função plpgsql roda numa ÚNICA transação — se qualquer passo levantar
--   exceção, o Postgres reverte tudo automaticamente. O núcleo crítico
--   (financeiro + estoque + comissões + finalização) passa a ser atômico.
--
-- IMPORTANTE:
--   O CÁLCULO de comissões/estoque continua no TypeScript
--   (calcularItensFechamento.ts). Esta função apenas GRAVA o que já foi
--   calculado, recebido em um único JSONB. As colunas inseridas são
--   exatamente as mesmas que o app já gravava — nada de schema novo.
--
-- SEGURANÇA:
--   SECURITY DEFINER (padrão do projeto p/ escrita cross-table sob RLS), com
--   trava explícita de tenant: p->>'salao_id' precisa bater com auth_salao_id().
--   Toda escrita é escopada por salao_id.

CREATE OR REPLACE FUNCTION fechar_conta_atomico(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salao_id uuid := (p->>'salao_id')::uuid;
  v_fin      jsonb := p->'financeiro';
  v_fin_id   bigint;   -- financeiro.id é bigint (identity), NÃO uuid. Declarar como
                       -- uuid fazia o RETURNING id INTO estourar "invalid input
                       -- syntax for type uuid: <id>" logo no INSERT do financeiro.
  v_ag_ids   uuid[];
  item       jsonb;
BEGIN
  -- Trava multi-tenant: o salão do payload precisa ser o do usuário autenticado
  IF v_salao_id IS NULL OR v_salao_id IS DISTINCT FROM auth_salao_id() THEN
    RAISE EXCEPTION 'Salão inválido para o usuário autenticado';
  END IF;

  -- agendamento_ids (uuid[]) — NULL quando vazio (nunca {}, conforme regra do projeto)
  IF jsonb_typeof(v_fin->'agendamento_ids') = 'array'
     AND jsonb_array_length(v_fin->'agendamento_ids') > 0 THEN
    SELECT array_agg(value::uuid) INTO v_ag_ids
    FROM jsonb_array_elements_text(v_fin->'agendamento_ids');
  ELSE
    v_ag_ids := NULL;
  END IF;

  -- 1) FINANCEIRO — fonte de verdade
  INSERT INTO financeiro (
    salao_id, os_numero, cliente_nome, descricao, tipo, categoria, valor,
    metodo_pagamento, forma_pagamento, bandeira_cartao, profissional_nome,
    status, data_movimentacao, agendamento_ids, comentario, desconto
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
    NULLIF(v_fin->>'desconto', '')::numeric
  )
  RETURNING id INTO v_fin_id;

  -- 2) ESTOQUE — baixa atômica (decrementa no banco, sem race) + histórico
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p->'estoque', '[]'::jsonb)) LOOP
    UPDATE produtos
       SET quantidade_atual = COALESCE(quantidade_atual, 0) - (item->>'quantidade')::numeric
     WHERE id = (item->>'produto_id')::uuid
       AND salao_id = v_salao_id;

    INSERT INTO historico_estoque (salao_id, produto_id, tipo, quantidade, motivo)
    VALUES (
      v_salao_id,
      (item->>'produto_id')::uuid,
      'Saída',
      (item->>'quantidade')::numeric,
      item->>'motivo'
    );
  END LOOP;

  -- 3) COMISSÕES
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
$$;

GRANT EXECUTE ON FUNCTION fechar_conta_atomico(jsonb) TO authenticated;
