# auth_salao_id() — função auxiliar padrão do projeto

Já existe (ou deve existir) no banco do Luarys esta função, criada na correção de RLS de jun/2026:

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

## Por que ela existe

O Luarys tem dois tipos de login que podem estar autenticados via Supabase Auth:
- **Donos/gerentes/colaboradores administrativos** → linha em `perfis_usuarios`
- **Profissionais** (quando logam para ver a própria agenda/comissão) → linha em `profissionais`

`auth.uid()` sozinho não diz a qual salão o usuário pertence — é preciso ir buscar em uma das duas tabelas, dependendo de qual tipo de login é. `auth_salao_id()` resolve isso numa função só, reutilizável em qualquer policy.

## Por que é `SECURITY DEFINER`

Sem isso, a função rodaria com os privilégios de quem a *chama* — e se RLS de `perfis_usuarios`/`profissionais` também estiver restrito, a função não conseguiria nem fazer o próprio SELECT interno (loop de dependência). `SECURITY DEFINER` faz a função rodar com privilégio de quem a *criou*, ignorando RLS só para essa consulta interna específica.

**Isso é seguro porque:**
- A função não recebe nenhum parâmetro do chamador — não há como pedir o `salao_id` de outra pessoa
- Ela só lê `auth.uid()`, que vem do JWT da sessão (não é manipulável pelo client)
- Ela só retorna UM valor (salao_id), não expõe nenhuma outra coluna

## Como usar numa policy nova

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

Sempre as 4 operações separadas (SELECT/INSERT/UPDATE/DELETE), não `FOR ALL` — `FOR ALL` é mais fácil de ficar permissivo demais por engano quando a intenção real era restringir só uma operação.

## Caso especial: tabela sem `salao_id` direto

Quando o isolamento por salão precisa passar por uma tabela intermediária (ex: `configuracoes_fiscais_profissionais`, que só tem `profissional_id`, não `salao_id` direto):

```sql
CREATE POLICY "cfg_fiscal_prof_proprio_salao"
  ON configuracoes_fiscais_profissionais FOR ALL TO authenticated
  USING (
    profissional_id IN (
      SELECT id FROM profissionais WHERE salao_id = auth_salao_id()
    )
  )
  WITH CHECK (
    profissional_id IN (
      SELECT id FROM profissionais WHERE salao_id = auth_salao_id()
    )
  );
```
