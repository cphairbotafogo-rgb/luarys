# RLS e isolamento multi-tenant

## A função auxiliar `auth_salao_id()`

```sql
CREATE OR REPLACE FUNCTION auth_salao_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT salao_id FROM perfis_usuarios WHERE id = auth.uid()
  UNION
  SELECT salao_id FROM profissionais WHERE id = auth.uid()
  LIMIT 1
$$;
```

### Por que ela existe

O Luarys tem dois tipos de login autenticados via Supabase Auth: donos/gerentes
(linha em `perfis_usuarios`) e profissionais que logam para ver a própria
agenda/comissão (linha em `profissionais`). `auth.uid()` sozinho não diz a
qual salão o usuário pertence — é preciso ir buscar numa das duas tabelas,
dependendo do tipo de login. Esta função resolve isso numa chamada só.

### Por que `SECURITY DEFINER` é seguro aqui

Roda com privilégio de quem criou a função, ignorando RLS só para a
consulta interna — necessário porque, sem isso, a função não conseguiria
nem fazer o próprio SELECT se RLS de `perfis_usuarios`/`profissionais`
também estiver restrito (loop de dependência). É seguro porque: não recebe
parâmetro (não há como pedir o salão de outra pessoa), só lê `auth.uid()`
(vem do JWT da sessão, não manipulável pelo client), e só retorna um valor.

### Como usar numa policy nova

```sql
CREATE POLICY "minha_tabela_select_proprio_salao"
  ON minha_tabela FOR SELECT TO authenticated
  USING (salao_id = auth_salao_id());

CREATE POLICY "minha_tabela_insert_proprio_salao"
  ON minha_tabela FOR INSERT TO authenticated
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "minha_tabela_update_proprio_salao"
  ON minha_tabela FOR UPDATE TO authenticated
  USING (salao_id = auth_salao_id())
  WITH CHECK (salao_id = auth_salao_id());

CREATE POLICY "minha_tabela_delete_proprio_salao"
  ON minha_tabela FOR DELETE TO authenticated
  USING (salao_id = auth_salao_id());
```

Sempre as 4 operações separadas, nunca `FOR ALL` — mais fácil de ficar
permissivo demais por engano.

### Sobre o `UNION` + `LIMIT 1` na função — por que não é ambíguo aqui

Pode parecer, à primeira vista, que se uma pessoa existisse simultaneamente
em `perfis_usuarios` E em `profissionais` (mesmo `id`), o `LIMIT 1` pegaria
um resultado arbitrário/imprevisível. **Isso não acontece neste projeto**:
`profissionais.id` é sempre o mesmo `id` gerado pelo Supabase Auth no
momento da criação da conta (`supabaseAdmin.auth.admin.createUser()` em
`api/criar-profissional/route.ts`, linha `id: authUser.user.id`) — ou seja,
é a chave de autenticação em si, não uma referência arbitrária. Um único
`auth.uid()` não pode ter linha em `perfis_usuarios` E em `profissionais`
ao mesmo tempo através do fluxo normal da aplicação (seria preciso alguém
inserir isso manualmente via SQL direto, fora do fluxo — o que seria um
erro de dado a ser corrigido na origem, não algo que a função precisa
tolerar). Por isso o `UNION` aqui sempre retorna no máximo uma linha de
cada lado, e o `LIMIT 1` nunca precisa de fato escolher entre duas opções
reais. Se essa premissa mudar no futuro (ex: alguém decidir permitir que
a mesma pessoa seja dono de um salão E profissional de outro), essa função
precisa ser revisada — não está mais coberta por este raciocínio.

### Caso especial: tabela sem `salao_id` direto

Quando o isolamento passa por uma tabela intermediária:

```sql
CREATE POLICY "cfg_fiscal_prof_proprio_salao"
  ON configuracoes_fiscais_profissionais FOR ALL TO authenticated
  USING (
    profissional_id IN (SELECT id FROM profissionais WHERE salao_id = auth_salao_id())
  )
  WITH CHECK (
    profissional_id IN (SELECT id FROM profissionais WHERE salao_id = auth_salao_id())
  );
```

## Checklist obrigatório ao criar uma tabela nova

1. **Tem `salao_id`?** Toda tabela operacional precisa de `salao_id uuid REFERENCES saloes(id)`. Exceção: catálogo global compartilhado entre todos os salões (ex: `funcoes`) — comentar isso explicitamente com `COMMENT ON TABLE`.
2. **`ALTER TABLE nome ENABLE ROW LEVEL SECURITY;`** foi executado? Sem isso, a tabela fica 100% aberta para qualquer client com a `anon key` (que já é pública), mesmo sem nenhuma policy escrita.
3. Existe policy `authenticated` filtrando por `salao_id = auth_salao_id()`?
4. O Portal (`anon`) precisa ler/escrever essa tabela? Ver `portal_padroes.md` — nunca `USING(true)` sem pensar.
5. A tabela mistura dado público com dado sensível na mesma linha? Ver `view_publica.md`.

## Erros comuns que já aconteceram neste projeto (jun/2026)

- **Policy `TO anon` com `USING(true)` sem filtro algum** em `agendamentos` e `clientes` — vazava nome, telefone, CPF, valor de TODOS os salões para qualquer visitante sem login.
- **`DROP POLICY IF EXISTS` com nome que não batia** com o nome real em `pg_policies` — o `IF EXISTS` engole o erro silenciosamente, a policy antiga permissiva continua ativa e convive com a nova (Postgres aplica RLS como OR entre todas as policies da tabela — a mais permissiva sempre vence).
- **Policy baseada em `profissionais.salao_id`** quando o usuário logado era dono (que fica em `perfis_usuarios`, não em `profissionais`) — dono ficava sem acesso ao próprio dado. Corrigido com `auth_salao_id()`, que cobre os dois casos.

## Depois de QUALQUER alteração de RLS, sempre conferir o estado final

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Não assumir que o script "deu certo" só porque não retornou erro — `DROP POLICY IF EXISTS` engolindo um nome errado não gera erro nenhum.
