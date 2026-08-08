-- Período médio esperado de retorno do cliente para cada serviço (em dias).
-- Ex.: Corte Masculino ~30 dias, Corte Feminino ~90 dias. Nullable e sem
-- default — serviço sem esse campo preenchido não entra na régua de "Em
-- Risco" por serviço (Luarys Cresce cai de volta na regra genérica antiga).
alter table servicos add column if not exists dias_retorno_medio integer;
