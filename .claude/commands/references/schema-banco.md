# Schema do Banco — Eleva/Luarys

Colunas confirmadas por queries explícitas que funcionam no código. Atualizar este arquivo sempre que uma tabela nova for criada ou uma coluna for adicionada/renomeada.

---

## `agendamentos`

```sql
id                        UUID PK
salao_id                  UUID NOT NULL
cliente_id                UUID nullable  -- FK clientes
cliente_nome              TEXT           -- cópia desnormalizada do nome
profissional_id           UUID           -- FK profissionais  ← nome REAL (não id_prof!)
servico_id                UUID nullable  -- FK servicos
data                      DATE
inicio                    TEXT           -- "HH:MM" (5 chars, substring(0,5) ao usar)
duracao_min               INTEGER
status                    TEXT           -- 'Confirmado' | 'Finalizado' | 'Cancelado' | 'Bloqueado'
valor_final               NUMERIC nullable
valor_sinal               NUMERIC nullable
observacao                TEXT nullable
cor                       TEXT nullable
eh_encaixe                BOOLEAN default false
recorrencia               TEXT default 'nao'
criado_por                TEXT nullable
preco_editado_manualmente BOOLEAN default false
created_at                TIMESTAMPTZ
```

**❌ NÃO EXISTEM como colunas:** `id_prof`, `servico` (texto), `nome_servico`

**Para obter nome do serviço:** JOIN com `servicos(nome_servico)` via `servico_id`, ou query separada.

---

## `profissionais`

```sql
id                  UUID PK
salao_id            UUID NOT NULL
nome                TEXT
email               TEXT nullable
ativo               BOOLEAN
perfil_avancado     TEXT nullable
produtivo           BOOLEAN nullable
servicos_comissoes  JSONB    -- { "uuid-servico": 30, "uuid-servico2": 25 } (% por serviço)
comissao_produtos   NUMERIC nullable
```

---

## `clientes`

```sql
id                  UUID PK
salao_id            UUID NOT NULL
nome_completo       TEXT         -- nome COMPLETO (não apenas "nome")
telefone_whatsapp   TEXT nullable  -- campo de telefone é "telefone_whatsapp", não "telefone"
email               TEXT nullable
cpf                 TEXT nullable
nascimento          DATE nullable  -- data de nascimento
total_gasto         NUMERIC nullable
total_visitas       INTEGER nullable
ultima_visita       DATE nullable
usuario_portal_id   UUID nullable  -- vincula ao auth.users do portal
```

---

## `servicos`

```sql
id                  UUID PK
salao_id            UUID NOT NULL
nome_servico        TEXT          -- nome do serviço (não "nome" sozinho)
categoria           TEXT default 'Geral'
setor               TEXT nullable
descricao           TEXT nullable
tipo_preco          TEXT          -- 'Fixo' | 'A partir de' | ...
preco_padrao        NUMERIC
duracao_minutos     INTEGER       -- atenção: "duracao_minutos" aqui, mas "duracao_min" em agendamentos
custo_operacional   NUMERIC nullable
exibir_online       BOOLEAN
comissao_padrao     NUMERIC nullable
created_at          TIMESTAMPTZ
```

---

## `comissoes`

```sql
id                    UUID PK
salao_id              UUID NOT NULL
id_prof               UUID          -- LEGADO, provavelmente NOT NULL — preencher junto com profissional_id
profissional_id       UUID          -- FK profissionais (adicionado jun/2026)
agendamento_id        UUID nullable -- FK agendamentos
status                TEXT          -- 'Pendente' | 'Pago'
valor_servico         NUMERIC
porcentagem_comissao  NUMERIC
valor_comissao        NUMERIC
tipo                  TEXT          -- 'servico' | 'produto' | 'ajuste'
servico_nome          TEXT nullable
created_at            TIMESTAMPTZ
```

**Regra:** ao inserir, sempre preencher `id_prof: prof.id` E `profissional_id: prof.id` para compatibilidade com código legado.

---

## `comissao_extras`

```sql
id              UUID PK
salao_id        UUID NOT NULL
profissional_id UUID          -- FK profissionais
tipo            TEXT          -- 'recebivel' | 'abatimento'
descricao       TEXT
valor           NUMERIC
created_at      TIMESTAMPTZ
```

---

## `financeiro`

```sql
id                UUID PK
salao_id          UUID NOT NULL
tipo              TEXT          -- 'entrada' | 'saida'
categoria         TEXT          -- ex: 'Receita de Serviços', 'Adiantamento Salarial (Vale)'
descricao         TEXT
valor             NUMERIC
data_movimentacao TIMESTAMPTZ
os_numero         TEXT nullable
cliente_nome      TEXT nullable
status            TEXT nullable  -- 'Estornado' | ...
created_at        TIMESTAMPTZ
```

---

## `despesas`

```sql
id              UUID PK
salao_id        UUID NOT NULL
valor           NUMERIC
categoria       TEXT
data_vencimento DATE
data_pagamento  DATE nullable
status          TEXT nullable   -- 'Estornado' | ...
created_at      TIMESTAMPTZ
```

---

## `saloes`

```sql
id                    UUID PK
nome_fantasia         TEXT
razao_social          TEXT nullable
limite_profissionais  INTEGER nullable
acesso_total          BOOLEAN nullable
```

---

## `perfis_usuarios`

```sql
id          UUID PK  -- = auth.uid()
salao_id    UUID NOT NULL
nome        TEXT
email       TEXT nullable
```

**Usada pela função `auth_salao_id()`** — nunca acessar diretamente no client para checar permissões.

---

## `etiquetas`

```sql
id        UUID PK
salao_id  UUID NOT NULL
nome      TEXT
cor       TEXT nullable
```

---

## `crm_clientes`

```sql
id                 UUID PK
salao_id           UUID NOT NULL
cliente_id         UUID          -- FK clientes
etiquetas          JSONB nullable
aceita_campanhas   BOOLEAN nullable
data_ultima_visita DATE nullable
```

---

## `produtos`

```sql
id              UUID PK
salao_id        UUID NOT NULL
nome_produto    TEXT          -- "nome_produto", não "nome"
custo_medio     NUMERIC nullable
unidade_medida  TEXT nullable
codigo_sku      TEXT nullable
preco_venda     NUMERIC nullable
```

---

## `auditoria_log`

```sql
id        UUID PK
salao_id  UUID NOT NULL
tabela    TEXT           -- nome da tabela auditada
criado_em TIMESTAMPTZ    -- atenção: "criado_em", NÃO "created_at"!
```

---

## `dias_excepcionais`

```sql
id              UUID PK
salao_id        UUID NOT NULL
data            DATE
tipo            TEXT    -- 'fechado' | 'aberto' | ...
hora_abertura   TEXT nullable
hora_fechamento TEXT nullable
```

---

## `notas_fiscais`

```sql
id        UUID PK
salao_id  UUID NOT NULL
-- (demais colunas conforme migration 20260622_notas_fiscais_colunas_nfe.sql)
```

---

## Resumo de armadilhas conhecidas

| Tabela | ❌ Coluna que não existe / nome errado | ✅ Nome correto |
|---|---|---|
| `agendamentos` | `id_prof` | `profissional_id` |
| `agendamentos` | `servico` (texto) | JOIN `servicos.nome_servico` via `servico_id` |
| `agendamentos` | `duracao` | `duracao_min` |
| `servicos` | `duracao_min` | `duracao_minutos` |
| `clientes` | `telefone` | `telefone_whatsapp` |
| `clientes` | `nome` | `nome_completo` |
| `produtos` | `nome` | `nome_produto` |
| `auditoria_log` | `created_at` | `criado_em` |

---

## Como manter este arquivo atualizado

Sempre que uma migration for executada no Supabase que **adiciona, remove ou renomeia** uma coluna, atualizar a seção correspondente aqui. Isso vale também para colunas adicionadas via ALTER TABLE manualmente no dashboard.
