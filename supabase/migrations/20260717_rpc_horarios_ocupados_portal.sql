-- 20260717_rpc_horarios_ocupados_portal.sql
--
-- PROBLEMA (duplo agendamento no portal):
--   A policy RLS "portal_le_agendamentos_proprios" permite que cada cliente
--   do portal veja apenas os próprios agendamentos. Quando o portal fazia
--   SELECT em agendamentos para checar se Luciene estava livre às 13:30,
--   os agendamentos de outros clientes eram invisíveis → o sistema achava
--   a profissional livre → INSERT de duplo agendamento passava com sucesso.
--
-- SOLUÇÃO:
--   Função SECURITY DEFINER que bypassa o RLS internamente mas devolve
--   apenas os campos de ocupação (profissional_id, inicio, duracao_min,
--   status) — sem expor nome, cliente_id ou qualquer dado pessoal.
--   O hook useAgendamentoFluxo usa essa função no lugar do SELECT direto.
--
-- EXECUTAR: cole no SQL Editor do Supabase Dashboard e clique em RUN.

CREATE OR REPLACE FUNCTION horarios_ocupados_salao(p_salao_id uuid, p_data date)
RETURNS TABLE(
  profissional_id uuid,
  inicio          time without time zone,
  duracao_min     int,
  status          text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- Permite que usuários autenticados (clientes do portal) chamem a função
GRANT EXECUTE ON FUNCTION horarios_ocupados_salao(uuid, date) TO authenticated;
