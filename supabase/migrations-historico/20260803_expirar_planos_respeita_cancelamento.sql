-- expirar_planos_vencidos() zerava plano_chave/plano_renovacao_em de QUALQUER
-- salão vencido, sem checar cancelamento_agendado — diferente da versão de
-- módulos (expirar_modulos_vencidos, 20260630_expirar_modulos_vencidos.sql),
-- que só desativa quando o cancelamento foi explicitamente agendado pelo
-- salão. Isso fazia essa RPC (se o job pg_cron 'expirar-planos-diario'
-- estiver ativo) atropelar a régua de aviso/carência de inadimplência de
-- /api/assinatura/processar-vencimentos (D+0, D+7, suspensão em D+10):
-- um salão simplesmente atrasado, ainda dentro da janela de aviso, teria o
-- plano zerado na madrugada seguinte ao vencimento — sem receber os avisos
-- e sem a régua de 10 dias ser respeitada.
--
-- Corrigido para só expirar planos com cancelamento_agendado = true (mesma
-- semântica de expirar_modulos_vencidos). Inadimplência orgânica (sem
-- cancelamento pedido pelo salão) continua sendo tratada exclusivamente por
-- processar-vencimentos, que já suspende em D+10 respeitando os avisos.
CREATE OR REPLACE FUNCTION expirar_planos_vencidos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
