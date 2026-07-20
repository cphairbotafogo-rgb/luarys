-- Pré-requisito: migrations/lembrete_antecedencia_horas.sql já deve ter sido rodada.
-- Execute UMA VEZ no Supabase SQL Editor.

-- 1. Marca quando o lembrete de horário foi efetivamente enviado.
--    NULL = ainda não enviado (cron busca por este campo).
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS lembrete_enviado_em timestamptz;

-- 2. RPC chamada pelo cron a cada hora.
--    Retorna todos os agendamentos cujo horário cai dentro de uma janela
--    de ±p_janela_min minutos em relação ao tempo configurado de antecedência
--    de cada salão (6 h, 12 h ou 24 h).
--    SECURITY DEFINER: acessa múltiplos salões sem contexto de auth de usuário.
CREATE OR REPLACE FUNCTION buscar_agendamentos_para_lembrete(p_janela_min int DEFAULT 35)
RETURNS TABLE (
  ag_id              uuid,
  salao_id           uuid,
  salao_nome         text,
  msg_template       text,
  antecedencia_horas int,
  data_hora_inicio   timestamptz,
  cliente_nome       text,
  telefone           text,
  nome_servico       text,
  nome_profissional  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
