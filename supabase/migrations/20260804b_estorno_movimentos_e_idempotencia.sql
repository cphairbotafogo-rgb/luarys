-- 20260804b_estorno_movimentos_e_idempotencia.sql
--
-- Resolve três pendências da auditoria que têm a MESMA raiz: as tabelas de
-- movimento não registram de qual venda vieram, então o estorno não tinha como
-- desfazê-las com precisão (sobrava adivinhar pelo texto de motivo/descricao).
--
--   1. Estoque não voltava no estorno.
--   2. Pontos de fidelidade não eram retirados no estorno.
--   3. Fechamento de conta podia ser gravado duas vezes (duas abas / dois
--      aparelhos fechando a mesma comanda).
--
-- Decisões de regra (definidas com o Ari em 04/08/2026):
--   - Estoque: volta APENAS produto revendido (motivo 'Venda no Fechamento').
--     Insumo de ficha técnica ('Uso no Serviço: X') NÃO volta — foi consumido de
--     verdade no cabelo do cliente, ainda que a venda seja estornada.
--   - Fidelidade: reverte os DOIS lados (pontos ganhos na venda e pontos que o
--     cliente gastou como desconto nela).
--   - Saldo de pontos pode ficar negativo se o cliente já gastou o que ganhou; o
--     extrato fica fiel e a tela já exibe com GREATEST(0, ...).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Vínculo dos movimentos com a venda que os originou
-- ─────────────────────────────────────────────────────────────────────────────
-- financeiro.id é bigint (identity) — não uuid.
ALTER TABLE historico_estoque      ADD COLUMN IF NOT EXISTS financeiro_id bigint;
ALTER TABLE fidelidade_transacoes  ADD COLUMN IF NOT EXISTS financeiro_id bigint;

COMMENT ON COLUMN historico_estoque.financeiro_id IS
  'Venda que originou a movimentação (financeiro.id). Preenchido pelo fechamento de conta; é o que permite ao estorno devolver exatamente o que foi baixado. NULL em movimentações manuais do módulo Estoque.';
COMMENT ON COLUMN fidelidade_transacoes.financeiro_id IS
  'Venda que originou a transação de pontos (financeiro.id). Permite ao estorno reverter ganho e resgate da mesma venda. NULL em lançamentos avulsos.';

CREATE INDEX IF NOT EXISTS historico_estoque_financeiro_idx
  ON historico_estoque (financeiro_id) WHERE financeiro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fidelidade_transacoes_financeiro_idx
  ON fidelidade_transacoes (financeiro_id) WHERE financeiro_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) resgatar_credito_fidelidade — passa a aceitar o financeiro_id de origem
-- ─────────────────────────────────────────────────────────────────────────────
-- O 4º parâmetro tem DEFAULT NULL, então as chamadas antigas de 3 argumentos
-- continuam válidas. A versão de 3 args é derrubada primeiro porque manter as
-- duas tornaria a chamada de 3 argumentos ambígua no Postgres.
-- Corpo idêntico ao de 20260717_h1 (advisory lock inclusive) — só muda o INSERT.
DROP FUNCTION IF EXISTS resgatar_credito_fidelidade(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION resgatar_credito_fidelidade(
  p_salao_id       UUID,
  p_cliente_id     UUID,
  p_pontos         INTEGER,
  p_financeiro_id  BIGINT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

REVOKE ALL ON FUNCTION resgatar_credito_fidelidade(UUID, UUID, INTEGER, BIGINT) FROM public, anon;
GRANT EXECUTE ON FUNCTION resgatar_credito_fidelidade(UUID, UUID, INTEGER, BIGINT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) reverter_movimentos_venda — desfaz estoque e fidelidade de uma venda
-- ─────────────────────────────────────────────────────────────────────────────
-- Idempotente: rodar duas vezes na mesma venda não devolve estoque em dobro nem
-- retira pontos duas vezes (a marca da reversão é a própria linha de contrapartida
-- gravada com o mesmo financeiro_id).
CREATE OR REPLACE FUNCTION reverter_movimentos_venda(
  p_financeiro_id BIGINT,
  p_salao_id      UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

COMMENT ON FUNCTION reverter_movimentos_venda(BIGINT, UUID) IS
  'Desfaz estoque (só produto revendido) e pontos de fidelidade (ganho + resgate) de uma venda estornada. Idempotente.';

REVOKE ALL ON FUNCTION reverter_movimentos_venda(BIGINT, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION reverter_movimentos_venda(BIGINT, UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) fechar_conta_atomico — idempotência + vínculo do estoque com a venda
-- ─────────────────────────────────────────────────────────────────────────────
-- NOVO nesta versão:
--   a) Advisory lock + guarda de duplicidade: se JÁ existe um lançamento não
--      estornado apontando para algum dos mesmos agendamentos, devolve o id
--      existente em vez de gravar tudo de novo. Isso barra o fechamento em
--      duplicidade a partir de duas abas/aparelhos — o `salvando` do botão só
--      protegia o duplo-clique na mesma aba, e uma segunda gravação duplicava
--      receita, comissão e baixa de estoque.
--   b) historico_estoque passa a guardar o financeiro_id da venda.
-- O restante é idêntico à versão de 20260804_correcoes_auditoria.
CREATE OR REPLACE FUNCTION public.fechar_conta_atomico(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION public.fechar_conta_atomico(jsonb) TO authenticated;
