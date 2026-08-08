# Supabase local

Para testar migration antes de aplicar na nuvem, e para a extensão do VS Code
ter onde conectar.

---

## O problema que isto resolve

Hoje as migrations são aplicadas **à mão, no SQL Editor da nuvem**. Isso tem
duas consequências ruins:

1. **Não dá para reconstruir o banco a partir do repositório.** São 105
   migrations e **nenhuma cria as tabelas centrais** — não existe
   `CREATE TABLE saloes`, nem `agendamentos`, nem `clientes`. O histórico começa
   em 21/06/2026 e só traz alterações. O esquema base nasceu no painel.
2. **Não há como saber se o versionado bate com a produção.** Migration
   esquecida, ou rodada com uma alteração no meio, some sem deixar rastro.

O Supabase local só é útil depois de resolver o item 1 — senão as 105 migrations
falham, porque não há em que aplicá-las.

---

## Preparação, uma vez só

O `supabase/config.toml` já está no repositório. Falta o que depende das suas
credenciais:

```bash
npx supabase login                        # abre o navegador
npx supabase link --project-ref yojtfr…   # pede a senha do banco
npx supabase db pull                      # captura o esquema atual como baseline
```

O `db pull` gera uma migration nova com **tudo que existe hoje na produção** —
tabelas, políticas RLS, funções, triggers. É o baseline que faltava. A partir
dela, o banco passa a ser reconstruível.

> A senha do banco é a do projeto no Supabase, em Settings → Database. Não é a
> mesma da sua conta.

**Confira o que o `db pull` gerou antes de commitar.** Ele traz o estado real,
que pode incluir coisa aplicada à mão e nunca versionada — é justamente o ponto,
mas vale ler.

---

## No dia a dia

```bash
npx supabase start      # sobe os contêineres (precisa do Docker Desktop aberto)
npx supabase db reset   # recria o banco local do zero, aplicando as migrations
npx supabase stop       # derruba
```

Com o `start` rodando, a extensão do VS Code conecta sozinha: ela procura a
instância local em `localhost:54321`.

**Fluxo para migration nova:**

1. Escreve o `.sql` em `supabase/migrations/`
2. `npx supabase db reset` — se a migration estiver errada, quebra aqui, não na
   produção
3. Confere o resultado pela extensão ou pelo Studio local
4. Só então aplica na nuvem

---

## O que o local NÃO substitui

- **Os dados.** O local nasce vazio. Os scripts em `scripts/conferencia/` falam
  com o banco real e continuam sendo o caminho para conferir dados de produção.
- **Os testes de cobrança.** Eles usam o Asaas em sandbox e o banco real; não têm
  relação com o Supabase local.
- **As chaves.** O `.env.local` aponta para a nuvem. Para rodar o app contra o
  local seria preciso trocar a URL e a chave anônima pelas que o `supabase start`
  imprime — só faça isso se for esse o objetivo, e lembre de voltar depois.

---

## Cuidado

`supabase db reset` **apaga o banco local inteiro**. Nunca pode ser confundido
com um comando contra a nuvem — confira que não há `--linked` na linha.

E `supabase db push` aplica as migrations locais **na nuvem**. Não use por
enquanto: enquanto não houver baseline, ele tentaria aplicar 105 migrations num
banco que já as tem.
