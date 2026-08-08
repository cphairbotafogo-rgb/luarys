-- 20260727_clientes_tipo_pessoa.sql
--
-- ModalFichaCliente.tsx (aba Identidade) já tinha um seletor Pessoa Física /
-- Pessoa Jurídica com campo de CNPJ, mas a tabela clientes nunca teve as
-- colunas tipo_cliente/cnpj. salvarFichaCliente() (useAbaAgenda.ts) manda o
-- objeto inteiro pro UPDATE sem checar erro — assim que alguém tocava nesse
-- seletor e clicava "Salvar Ficha", o Postgres rejeitava o update inteiro
-- (coluna inexistente) e ninguém percebia, porque o modal fecha e recarrega
-- independente do resultado. Mesmo padrão de "deriva de schema" já visto
-- várias vezes neste projeto — aqui a correção é adicionar as colunas que a
-- tela já espera, em vez de remover a funcionalidade.

alter table public.clientes
  add column if not exists tipo_cliente text not null default 'PF' check (tipo_cliente in ('PF', 'PJ')),
  add column if not exists cnpj text;

comment on column public.clientes.tipo_cliente is
  'Pessoa Física (PF) ou Pessoa Jurídica (PJ) — usado por ModalFichaCliente (Agenda). CPF fica em clientes.cpf, CNPJ em clientes.cnpj (colunas separadas, nunca reaproveitar uma pra outra).';
comment on column public.clientes.cnpj is
  'CNPJ do cliente quando tipo_cliente = PJ. Alfanumérico (IN RFB 2.229/2024) — usar src/lib/cnpj.ts se algum dia ganhar validação/formatação nesta tela.';
