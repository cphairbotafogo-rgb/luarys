-- registrarPagamentoAssinatura() faz upsert com onConflict: 'pagamento_externo_id',
-- mas a coluna nunca teve constraint única — todo upsert falhava com
-- "42P10 there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" e, como o erro era descartado sem log, a tabela
-- pagamentos_assinatura ficou vazia desde sempre (0 linhas, todos os
-- gateways). Isso também quebra a checagem de idempotência (H2) que depende
-- de encontrar o registro pelo pagamento_externo_id.
alter table pagamentos_assinatura
  add constraint pagamentos_assinatura_pagamento_externo_id_key unique (pagamento_externo_id);
