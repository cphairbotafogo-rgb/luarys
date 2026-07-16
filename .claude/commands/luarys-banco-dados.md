---
name: luarys-banco-dados
description: Schema do banco Supabase do Eleva/Luarys — nomes reais de tabelas e colunas. USE SEMPRE antes de escrever qualquer query Supabase com colunas explícitas (select, insert, update, filter). Evita erros "column does not exist" e gastos desnecessários de tokens reescrevendo código por nome errado de coluna. USE TAMBÉM antes de criar uma tabela nova para seguir o padrão de nomenclatura do projeto.
---

# Banco de Dados — Eleva/Luarys

Leia esta página antes de escrever qualquer `.select('coluna')`, `.insert({})`, `.update({})` ou `.eq('coluna', ...)`. Errar o nome de uma coluna num select explícito causa erro 404 silencioso ou toast de erro — e exige reescrita com gasto de tokens.

## Regra de ouro

Antes de usar um nome de coluna que não está na lista abaixo:

1. Grep no código por `.from('tabela').select(` para ver o que já está sendo usado com sucesso
2. Ou use `select('*')` primeiro para inspecionar a resposta real

**Nunca assuma** que o nome da coluna é o que parece óbvio. Exemplos reais que quebraram:
- `agendamentos.id_prof` ❌ → o nome real é `profissional_id`
- `agendamentos.servico` ❌ → não existe como coluna; nome vem de JOIN com `servicos.nome_servico`
- `agendamentos.duracao_min` ✅ mas `servicos.duracao_minutos` ✅ — nomes diferentes nas duas tabelas!

Para o schema completo de cada tabela: leia `references/schema-banco.md`.

## Padrão para tabelas NOVAS

Ao criar uma tabela nova, seguir SEMPRE este padrão:

```sql
CREATE TABLE nome_tabela (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salao_id      UUID NOT NULL REFERENCES saloes(id),   -- obrigatório em toda tabela operacional
  -- colunas do negócio aqui
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;
-- + policies conforme references/rls_multitenant.md
```

### Convenções de nomenclatura obrigatórias

| O que é | Padrão | Exemplos corretos | Exemplos errados |
|---|---|---|---|
| Chave primária | `id UUID` | `id` | `id_tabela`, `tabela_id` |
| FK para outra tabela | `{tabela_singular}_id` | `profissional_id`, `servico_id`, `cliente_id` | `id_prof`, `id_cli`, `profId` |
| Multi-tenant | `salao_id UUID NOT NULL` | `salao_id` | `salon_id`, `id_salao` |
| Nome de pessoa/entidade | `nome` (padrão) | `nome`, `nome_completo`, `nome_servico`, `nome_produto` | `name`, `nomeCompleto` |
| Data sem hora | `data` ou `data_{contexto}` | `data`, `data_vencimento`, `data_nascimento` | `date`, `dataVencimento` |
| Timestamp de criação | `created_at TIMESTAMPTZ` | `created_at` | `criado_em`, `createdAt` (exceto `auditoria_log` que usa `criado_em` por legado) |
| Booleano | descritivo sem prefixo | `ativo`, `exibir_online`, `eh_encaixe` | `is_ativo`, `isActive`, `flag_online` |
| Status de registro | `status TEXT` | valores: `'Pendente'`, `'Pago'`, `'Confirmado'`, `'Finalizado'`, `'Cancelado'` | valores em inglês, minúsculo sem padrão |
| JSONB estruturado | nome descritivo | `servicos_comissoes`, `etiquetas`, `pagamentos` | `data`, `json`, `config` |
| Valor monetário | `NUMERIC` | `valor`, `valor_final`, `preco_padrao`, `valor_comissao` | `price`, `amount`, `valor_float` |
| Duração em minutos | `{contexto}_min` ou `{contexto}_minutos` | `duracao_min` (agendamentos), `duracao_minutos` (servicos) | misturar os dois na mesma tabela |

### Estado interno JS da agenda ≠ colunas do banco

O `useAgendaDados.ts` transforma os dados ao carregar — o objeto JS tem nomes diferentes das colunas do banco. **Não confundir:**

| Coluna no banco (`agendamentos`) | Chave no estado JS da agenda |
|---|---|
| `profissional_id` | `id_prof` |
| `cliente_nome` | `cliente` |
| `servico_id` + lookup | `servico` (nome resolvido) |
| `duracao_min` | `duracaoMin` |

Ao escrever queries Supabase: use os nomes do banco. Ao acessar `ag.xxx` dentro dos hooks da agenda: use os nomes do estado JS.
