-- Separa o lembrete ANTECIPADO do aviso de atraso, e permite mais de um.
--
-- Defeito encontrado em 06/08/2026 lendo processar-vencimentos: o lembrete
-- antecipado gravava `aviso_enviado_em`, e o aviso do dia do vencimento testa
-- justamente `!aviso_enviado_em`. Resultado: quem recebia o lembrete de 3 dias
-- NUNCA recebia o aviso de D+0. A régua pulava de "vence em breve" direto para
-- "último aviso antes do bloqueio", sete dias depois.
--
-- Quem paga em dia nunca percebeu. Quem atrasou perdeu o aviso mais útil da
-- sequência — o do dia, quando ainda dá para resolver sem constrangimento.
--
-- `lembretes_enviados` guarda quais lembretes já saíram, por chave ('d2', 'd1',
-- 'd30'), em vez de um carimbo único. Sem isso não há como mandar dois avisos
-- antecipados sem um apagar o outro.

ALTER TABLE salao_modulos
  ADD COLUMN IF NOT EXISTS lembretes_enviados JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE saloes
  ADD COLUMN IF NOT EXISTS lembretes_enviados JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN salao_modulos.lembretes_enviados IS
  'Lembretes antecipados já enviados, por chave: {"d2":"<iso>","d1":"<iso>"}. Separado de aviso_enviado_em, que é o aviso de D+0.';

-- Limpa o carimbo dos que estão em dia: hoje ele pode ter vindo do lembrete
-- antecipado e estaria bloqueando o aviso de D+0 desses registros.
UPDATE salao_modulos
   SET aviso_enviado_em = NULL
 WHERE aviso_enviado_em IS NOT NULL
   AND segundo_aviso_enviado_em IS NULL
   AND renovacao_em > now();
