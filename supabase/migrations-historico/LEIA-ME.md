# Migrations históricas — não são executadas

As 105 migrations aqui foram aplicadas na produção entre 21/06 e 07/08/2026,
uma a uma, à mão pelo SQL Editor. Estão guardadas porque contam **por que** cada
mudança foi feita — vários comentários dentro delas explicam defeitos reais e
não existem em outro lugar.

**Elas não rodam mais.** O `supabase/migrations/20260101000000_baseline_producao.sql`
já contém tudo que elas fizeram: é um retrato do esquema de produção, tirado em
08/08/2026 com `supabase db dump --linked`. Executá-las depois do baseline
quebraria — coluna já existe, tabela já existe.

## Por que o baseline foi preciso

Nenhuma destas 105 cria as tabelas centrais. Não existe `CREATE TABLE saloes`,
nem `agendamentos`, nem `clientes` — o esquema base nasceu no painel do Supabase,
fora do versionamento. O histórico começa em 21/06/2026 e só traz alterações.

Ou seja, até 08/08/2026 **ninguém conseguia reconstruir o banco a partir do
repositório**, e não havia como saber se o versionado batia com a produção.

## Se precisar consultar

São a única fonte do raciocínio por trás de decisões como o `chave_acesso` de 50
caracteres, o fechamento da exposição anônima e a normalização de status das
notas. Ler é útil; executar, não.
