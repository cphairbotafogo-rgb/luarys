# Skill: luarys-query-higiene

**Última verificação:** 03/07/2026

## Propósito

Padrões obrigatórios para queries Supabase no Luarys. Evita tráfego desnecessário, queries duplicadas e lentidão à medida que o banco cresce.

---

## ⚠️ REGRA DE OURO — Nunca quebre a conexão entre abas

**Trocar `select('*')` por colunas específicas é uma otimização de baixo risco APENAS quando o nome exato das colunas é confirmado.** Uma coluna errada faz o Supabase retornar `{data: null}` **silenciosamente** — sem erro visível, sem crash, os dados simplesmente não chegam.

Isso é especialmente perigoso em:
- `Promise.allSettled` → resultado `fulfilled` mas `value.data = null`
- `if (dados)` que guarda o `setState` → estado nunca atualizado → tela vazia
- Abas persistentes → dado carregado uma vez, sem retry → fica vazio até reload

**Antes de qualquer troca de `select('*')`:**

```
1. Buscar no codebase outros usos da mesma tabela (INSERTs, UPDATEs, outros SELECTs)
2. Confirmar o nome exato de cada coluna que pretende incluir
3. Só aplicar se TODOS os nomes estiverem confirmados
4. Se tiver dúvida em UMA coluna → manter select('*') para essa tabela
```

---

## Tabelas protegidas — select('*') obrigatório até confirmação de schema

Estas tabelas têm componentes críticos que dependem de colunas menos óbvias.
Não trocar `select('*')` sem verificar o nome exato de cada coluna no schema:

| Tabela | Risco | Componente afetado |
|---|---|---|
| `clientes` | `telefone_whatsapp` ≠ `telefone`; `telefones` é array; `anamnese` pode não existir | Agenda, CRM, Aniversariantes |
| `agendamentos` | `eh_encaixe`, `recorrencia`, `criado_por` podem não existir | Agenda, Caixa |
| `profissionais` | `servicos_comissoes` é JSON; `cor_agenda` pode ter nome diferente | Agenda, Equipe |
| `servicos` | `preco` vs `preco_padrao` — confirmar qual existe | Agenda, Caixa, Relatórios |
| `caixa_transacoes` | schema próprio do PDV | Frente de Caixa |

---

## Colunas confirmadas por tabela (verificadas no codebase)

Use estas listas como referência segura para selects específicos:

| Tabela | Colunas confirmadas |
|---|---|
| `financeiro` | `id, tipo, status, categoria, descricao, valor, data_movimentacao, forma_pagamento, bandeira_cartao, created_at` |
| `agendamentos` (relatórios) | `id, cliente_id, cliente_nome, profissional_id, servico_id, data, inicio, status, valor_final, valor_sinal, duracao_min, observacao, cor, created_at` |
| `clientes` | `id, nome_completo, telefone_whatsapp, nascimento, created_at, cpf, email, foto_url` |
| `servicos` | `id, nome_servico, preco_padrao, duracao_minutos, categoria, ativo` |
| `profissionais` | `id, nome, foto_url, cargo, ativo, permissoes, servicos_comissoes, cor_agenda` |
| `despesas` | `id, descricao, categoria, tipo_custo, valor, data_pagamento, data_vencimento, status, forma_pagamento, observacao` |
| `config_taxas` | `taxa_pix, taxas_cartoes, max_parcelas` |
| `produtos` | `id, nome_produto, categoria, preco_venda, custo_medio, unidade_medida` |
| `historico_estoque` | `produto_id, tipo, quantidade, motivo, created_at` |
| `fornecedores` | `id, nome_empresa` |

---

## Regra 1 — Nunca usar `select('*')` em tabelas de dados **(com verificação prévia)**

```typescript
// ❌ Puxa todas as colunas — inclui campos que o código nunca lê
supabase.from('financeiro').select('*')

// ✅ Só o necessário — MAS somente quando os nomes estão confirmados
supabase.from('financeiro').select('id, valor, tipo, status, forma_pagamento, bandeira_cartao, data_movimentacao, descricao, categoria')
```

**Tabelas onde `select('*')` é aceitável por agora** (schema não confirmado):
- `clientes` em `useAgendaDados.ts` — muitos campos opcionais, não trocar sem dump do schema
- `agendamentos` em `useAgendaDados.ts` — idem

---

## Regra 2 — Batch com `Promise.all`, nunca queries sequenciais

```typescript
// ❌ Sequencial: cada query espera a anterior (lento)
const srv = await supabase.from('servicos').select(...)
const pro = await supabase.from('profissionais').select(...)

// ✅ Paralelo: todas disparam ao mesmo tempo
const [resSrv, resPro] = await Promise.all([
  supabase.from('servicos').select(...),
  supabase.from('profissionais').select(...),
]);
```

---

## Regra 3 — Paginação em listas grandes

Sempre que listar `clientes` ou `financeiro` sem período:

```typescript
supabase
  .from('clientes')
  .select('id, nome_completo, telefone_whatsapp, data_nascimento')
  .eq('salao_id', perfil.salao_id)
  .order('nome_completo')
  .range(pagina * 100, (pagina + 1) * 100 - 1)
```

---

## Regra 4 — Filtro de período ANTES de `.select()`

```typescript
// ✅ Filtra no banco, não em JS
supabase
  .from('financeiro')
  .select('id, valor, tipo, status')
  .eq('salao_id', perfil.salao_id)
  .gte('data_movimentacao', `${inicio}T00:00:00Z`)
  .lte('data_movimentacao', `${fim}T23:59:59Z`)
```

---

## Regra 5 — Debounce em filtros de busca

```typescript
function useBuscaComDebounce(termo: string, delay = 300) {
  const [termoDebounced, setTermoDebounced] = useState(termo);
  useEffect(() => {
    const t = setTimeout(() => setTermoDebounced(termo), delay);
    return () => clearTimeout(t);
  }, [termo, delay]);
  return termoDebounced;
}
```

---

## Regra 6 — Dados que não mudam: usar contexto global

`servicos`, `profissionais`, `config_taxas` → não buscar por componente.
Ver skill `luarys-contexto-global`.

---

## Regra 7 — `.maybeSingle()` quando pode não existir linha

```typescript
// ❌ .single() lança erro se não encontrar
.from('config_taxas').select('taxa_pix').eq('salao_id', id).single()

// ✅ .maybeSingle() retorna null sem erro
.from('config_taxas').select('taxa_pix').eq('salao_id', id).maybeSingle()
```

Usar `.single()` apenas para INSERT/UPDATE com `.select('id')` onde a linha precisa existir.

---

## Regra 8 — Nunca buscar no render, sempre em `useEffect`

```typescript
// ✅
useEffect(() => {
  buscarDados();
}, [perfil?.salao_id]); // salao_id é string — estável
```

---

## Diagnóstico: tela vazia sem erro no console

Se um componente ficar vazio sem mensagem de erro, suspeitar de:

1. `select()` com coluna que não existe → `{data: null, error: {code: '42703'}}`
2. `Promise.allSettled` engolindo o erro → `status: 'fulfilled'` mas `value.data = null`
3. `if (dados)` saltando o `setState` → estado nunca atualizado
4. Verificar: abrir DevTools → Network → filtrar por `supabase` → checar response body
