-- M5: Corrigir policy INSERT em notificacoes
-- PROBLEMA: "portal_insere_notificacao" tem WITH CHECK (true) — qualquer
-- autenticado pode inserir notificações para qualquer salão.
-- SOLUÇÃO: restringir para que o salao_id da notificação seja o do chamador.

DROP POLICY IF EXISTS "portal_insere_notificacao" ON notificacoes;

CREATE POLICY "portal_insere_notificacao" ON notificacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (salao_id = auth_salao_id());
