-- 20260727_clientes_pais.sql
--
-- Mesmo padrão do achado em 20260727_clientes_tipo_pessoa.sql: a aba Endereço
-- de ModalFichaCliente.tsx tem um campo "País" (set('pais', ...)) mas a
-- coluna nunca existiu em clientes — o mesmo update em massa que corrige o
-- tipo_cliente/cnpj falharia de novo assim que alguém editasse esse campo.

alter table public.clientes
  add column if not exists pais text not null default 'Brasil';
