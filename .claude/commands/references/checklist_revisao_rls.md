# Checklist de revisão — antes de rodar qualquer script de RLS

Baseado na auditoria real de jun/2026, em que um script de correção de RLS
resolveu o isolamento entre salões para usuários logados, mas manteve (sem
querer) policies `anon` completamente abertas, vazando CPF, telefone e
custo operacional de todos os salões.

## Passo a passo

Para CADA `CREATE POLICY` do script, responda antes de aprovar:

### 1. Pra quem essa policy vale? (`TO ...`)
- `TO authenticated` — só usuário logado. Risco menor, mas ainda precisa
  checar se filtra por `salao_id` (ver passo 2).
- `TO anon` — qualquer visitante, sem login. **Risco alto por padrão.**
  Exige justificativa explícita: por que esse dado precisa ser público?
- `TO anon, authenticated` (junto) — mesma atenção que `TO anon` sozinho.

### 2. Tem `USING (true)` ou `WITH CHECK (true)` sem mais nada?
Isso significa **sem filtro nenhum**. Pergunte: "essa tabela tem
`salao_id`? Por que a policy não está usando `salao_id = auth_salao_id()`
(para authenticated) ou algum filtro equivalente (para anon)?"

Não existe caso legítimo de `USING(true)` numa tabela operacional
(agendamentos, clientes, financeiro, comissões) — só é aceitável em
tabelas de catálogo verdadeiramente global e sem dado sensível (ex: `funcoes`).

### 3. É `FOR ALL`?
`FOR ALL` cobre SELECT + INSERT + UPDATE + DELETE numa policy só. Fácil
de ser mais permissivo do que a intenção original (ex: queria só permitir
leitura, mas `FOR ALL USING(true)` também libera DELETE). Prefira sempre
policies separadas por operação, a menos que realmente todas as 4
operações devam ter exatamente a mesma regra.

### 4. A tabela tem coluna sensível misturada com coluna pública?
Liste as colunas da tabela. Se há qualquer coluna sensível (CPF, telefone,
e-mail, custo interno, comissão, dado de cartão, senha/token) JUNTO com
colunas que a policy libera publicamente, RLS não resolve sozinho — é
preciso uma view pública só com as colunas seguras (ver `view_publica.md`).

### 5. Existe uma tabela "irmã" que faz a mesma coisa e já está protegida?
Útil para achar inconsistência: se `financeiro` tem policy restrita mas
`comissoes` (tabela parecida, mesmo nível de sensibilidade) está aberta,
isso é sinal de que algo foi esquecido, não uma decisão deliberada.

### 6. O `DROP POLICY IF EXISTS` no início do script remove TODAS as
policies antigas daquela tabela, ou só uma com nome específico?
Se o nome da policy antiga não bater exatamente com o que está no banco
(`pg_policies`), o `DROP` falha silenciosamente (`IF EXISTS` engole o
erro) e a policy antiga permissiva **continua ativa**, coexistindo com a
nova — Postgres aplica RLS como OR entre todas as policies aplicáveis,
então a mais permissiva sempre vence. **Depois de rodar o script, sempre
conferir com uma nova consulta a `pg_policies` que não sobrou nenhuma
policy antiga inesperada.**

```sql
-- Rodar depois de qualquer alteração de RLS, para conferir o estado final
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Sinal de alerta rápido (regex mental)

Ao ler o script, qualquer uma dessas combinações merece parar e perguntar
"tem certeza?":

- `TO anon` + `USING (true)`
- `TO anon` + `WITH CHECK (true)`
- `FOR ALL` + `USING (true)`
- Nome de policy genérico tipo `"Acesso X"` sem indicar authenticated/anon
  nem a regra (dificulta saber, só pelo nome em `pg_policies`, o que ela faz)
