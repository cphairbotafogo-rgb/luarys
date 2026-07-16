# Padrões de policy para acesso do Portal (`anon`)

O Portal do Cliente (`src/app/portal/`) acessa o Supabase como usuário `anon`
— sem login Supabase tradicional. Ele identifica o salão via
`salaoSelecionado.id` (vindo da seleção de unidade, geralmente confirmado
por slug na URL ou seleção manual na lista). **Toda policy `TO anon` precisa
assumir que um atacante pode chamar a API diretamente, sem passar pelo
Portal de verdade** — a `anon key` já está pública no navegador de qualquer
visitante, então a única proteção real é a própria policy do banco.

## Regra prática

Pergunte sempre: **"se alguém copiar a anon key do DevTools e fizer a query
direto, sem usar o site, o que ela retorna?"** Se a resposta for "tudo, de
todos os salões", a policy está errada.

## Por tabela

### `servicos` — pode ser `USING(true)`, MAS sem colunas sensíveis na mesma tabela

`nome_servico`, `preco_padrao`, `duracao_minutos` são informação que o
salão já expõe publicamente (ex: no próprio site/Instagram). É aceitável:

```sql
CREATE POLICY "servicos_select_publico"
  ON servicos FOR SELECT TO anon, authenticated
  USING (true);
```

**MAS** `servicos` no Luarys também tem `custo_operacional` e
`comissao_padrao` — dado estratégico interno do salão, nunca deveria ser
público. RLS não filtra colunas, só linhas. Solução: criar uma view pública
sem essas colunas e apontar o Portal para ela. Ver `view_publica.md`.

### `agendamentos` — nunca `USING(true)` puro

Contém nome de cliente, profissional, valor. Mesmo que o objetivo seja só
"o Portal vê os agendamentos do salão X", `USING(true)` libera os
agendamentos de TODOS os salões. Hoje (jun/2026) o projeto ainda não tem
um jeito limpo de passar "qual salão" para dentro de uma policy de `anon`
sem autenticação real — isso é uma limitação conhecida do Supabase RLS
(não dá pra usar uma variável de sessão arbitrária vinda do client sem
mecanismo adicional, tipo JWT customizado ou Postgres `SET`).

**Mitigação mínima recomendada enquanto isso não é resolvido
arquiteturalmente:** limitar o que a policy expõe ao mínimo necessário —
nunca liberar SELECT completo. Considerar:
- Expor só agendamentos futuros (`data >= CURRENT_DATE`), não o histórico inteiro
- Expor só uma view com colunas mínimas (data, horário, status — sem nome
  completo de cliente nem valor) para o caso de uso "checar horário
  disponível", que é o que justifica esse acesso
- Para "Meus agendamentos" do cliente logado no Portal, usar uma Supabase
  Edge Function ou API route com `service_role` que filtra no código por
  `cliente_id` + `salao_id`, em vez de RLS direto para `anon`

**Não copiar cegamente um exemplo antigo de `USING(true)` para
agendamentos** — isso já foi identificado como vazamento real numa
auditoria (jun/2026) e está pendente de correção arquitetural, não é
padrão a seguir.

### `clientes` — nunca `USING(true)`, nem para SELECT nem para UPDATE

Contém CPF, telefone, e-mail, histórico de gastos. Mesmo risco de
`agendamentos`, agravado por ser dado pessoal sob LGPD (CPF é dado
identificável; combinado com telefone/e-mail facilita ainda mais).

**Nunca**:
```sql
-- NUNCA fazer isso
CREATE POLICY "clientes_select_portal" ON clientes FOR SELECT TO anon USING (true);
CREATE POLICY "clientes_update_portal" ON clientes FOR UPDATE TO anon USING (true) WITH CHECK (true);
```

Para o caso de uso "cliente final edita o próprio cadastro no Portal",
prefira um fluxo com token de sessão próprio do Portal (ver
`usuarios_portal`/`PortalLogin.tsx` no código — o projeto já tem um
sistema de login de cliente separado do Supabase Auth tradicional; usar
esse mecanismo para validar identidade antes de liberar leitura/escrita,
não abrir a tabela inteira via RLS `anon`).

### `notas_fiscais`, `notificacoes` (insert via portal)

`WITH CHECK(true)` para INSERT é menos grave que SELECT/UPDATE aberto
(não vaza dado existente), mas ainda permite que qualquer um, sem login,
crie registros falsos em qualquer salão — possível vetor de spam/abuso.
Mínimo recomendado: `WITH CHECK (salao_id IS NOT NULL AND EXISTS (SELECT 1 FROM saloes WHERE id = salao_id))`
— garante ao menos que aponta para um salão real, mesmo sem poder validar
"é desse salão que o visitante realmente está".

### `profissionais` (select para Portal)

Bom exemplo já existente no projeto — tem filtro mesmo sendo `anon`:
```sql
CREATE POLICY "profissionais_select_portal"
  ON profissionais FOR SELECT TO anon
  USING (ativo = true);
```
Isso não filtra por salão (ainda expõe profissionais de todos os salões),
mas pelo menos filtra por `ativo = true`, reduzindo a superfície. Padrão
mínimo aceitável quando não dá pra filtrar por salão diretamente — mas
não é o ideal; idealmente combinar com filtro de salão também.
