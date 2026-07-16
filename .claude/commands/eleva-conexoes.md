---
name: eleva-conexoes
description: Mapa de conexões, fluxos de dados e armadilhas de integração do projeto Eleva/Luarys. USE SEMPRE que for criar ou editar qualquer funcionalidade que grave ou leia dados entre módulos — agenda, caixa, financeiro, relatórios, comissões, estoque, CRM, portal. Previne bugs de desconexão silenciosa: ação que grava numa tabela mas esquece de gravar em outra, query que usa nome de coluna errado, join PostgREST que falha por falta de FK, estado React que não chega ao componente filho. Consultar ANTES de escrever qualquer hook de fechamento, insert multi-tabela, query com join, ou funcionalidade nova que depende de dados de outro módulo.
---

# Eleva — Mapa de Conexões e Fluxos de Dados

Este projeto tem um padrão de bug recorrente: **uma ação grava em A mas esquece de gravar em B**, e o módulo que lê de B mostra zero ou vazio sem nenhum erro visível. Esta skill existe para mapear onde cada dado nasce, onde ele precisa chegar, e o que acontece quando a ponte entre eles quebra.

## Quando ler cada referência

| Vou construir... | Leia também |
|---|---|
| Qualquer ação de fechamento de caixa / PDV | `references/fluxo-fechamento.md` |
| Funcionalidade que aparece em Relatórios | `references/fluxo-relatorios.md` |
| Query Supabase (select/insert/update) | `references/nomes-colunas.md` |
| Join PostgREST com `!` (ex: `tabela!fk`) | `references/joins-postgrest.md` |
| Nova tabela ou nova coluna no banco | `references/joins-postgrest.md` + `references/nomes-colunas.md` |
| Qualquer coisa que envolva comissões | `references/fluxo-fechamento.md` |
| Dados que precisam aparecer no Portal do Cliente | `references/fluxo-portal.md` |
| Login do lojista, login do portal, objeto `perfil`, permissões | `references/autenticacao.md` |

## As 10 regras que mais importam

1. **Fechamento de caixa grava em 6 tabelas.** Se qualquer uma faltar, algum módulo vai mostrar dado errado ou vazio. Ver `references/fluxo-fechamento.md`.

2. **`item_id` ≠ `id` da linha do caixa.** Ao mapear serviços para o fechamento, `item_id` deve receber `ag.servico_id` (o UUID do serviço no catálogo). Usar `ag.id` (UUID do agendamento) como `item_id` faz `servicos_comissoes[item_id]` retornar `undefined` → comissão zero silenciosa.

3. **Joins PostgREST com `!` exigem FK declarada no banco.** `profissionais!profissional_id` retorna 404 se não houver `FOREIGN KEY (profissional_id) REFERENCES profissionais(id)`. Nunca escrever esse join sem antes confirmar que a FK existe.

4. **`caixa_transacoes` e `financeiro` são tabelas diferentes** que precisam ser gravadas juntas. `caixa_transacoes` alimenta a Frente de Caixa; `financeiro` alimenta DRE e Relatórios. Gravar só uma quebra metade do sistema.

5. **Busca por nome de serviço falha silenciosamente.** `servicosDb.find(s => s.nome_servico === ag.servico)` retorna `null` se houver diferença de maiúscula, espaço ou acento. Sempre priorizar `s.id === ag.servico_id`.

6. **`id_prof` é campo legado — sempre preencher junto com `profissional_id`.** A tabela `comissoes` tem os dois campos por compatibilidade. Gravar só um quebra consultas que usam o outro.

7. **Estado React não atualiza antes de um `await`.** Bandeiras de cartão, totais calculados e qualquer estado que mude no mesmo tick do clique precisam ser passados como parâmetro para a função async — não lidos do estado depois do await.

8. **`agendamento_ids` no `financeiro` é o que conecta pagamento ↔ atendimento.** Sem esse array, o Relatório de Atendimentos não consegue mostrar a forma de pagamento de cada serviço.

9. **`comissao_extras` é uma tabela separada** de `comissoes`. Bônus e abatimentos manuais ficam em `comissao_extras`; comissões geradas pelo fechamento ficam em `comissoes`. Não misturar.

10. **Toda funcionalidade nova que gera dado financeiro precisa de um caminho de volta para os Relatórios.** Antes de implementar, responda: "onde esse dado vai aparecer nos relatórios? que tabela o relatório lê? estou gravando nessa tabela?"

## Mapa rápido: quem grava onde

```
AÇÃO                    TABELAS GRAVADAS
──────────────────────────────────────────────────────────
Fechamento de Caixa  →  agendamentos (status=Finalizado)
                        comissoes (por serviço)
                        notas_fiscais
                        financeiro (+ agendamento_ids)
                        caixa_transacoes
                        produtos (baixa de estoque)
                        clientes (total_gasto, visitas)

Novo Agendamento     →  agendamentos
                        crm_clientes (etiquetas)

Cancelamento         →  agendamentos (status=Cancelado)
                        financeiro (estorno, se pago)

Venda PDV            →  caixa_transacoes
                        financeiro
                        produtos (baixa)
                        historico_estoque

Cadastro Profissional→  profissionais (servicos_comissoes JSONB)
                        auth.users (via API /criar-profissional)

Lançamento Despesa   →  despesas
                        financeiro (tipo='saida')
```

## Mapa rápido: quem lê de onde

```
MÓDULO/RELATÓRIO         LÊ DE
──────────────────────────────────────────────────────────
Frente de Caixa      →  caixa_transacoes
Financeiro / DRE     →  financeiro + despesas
Comissões da Equipe  →  comissoes + comissao_extras
                        (join profissionais via FK)
Rel. Atendimentos    →  agendamentos + financeiro.agendamento_ids
Balanço              →  financeiro + despesas
Dashboard            →  agendamentos + financeiro + clientes
CRM                  →  clientes + crm_clientes
Estoque              →  produtos + historico_estoque
Portal do Cliente    →  agendamentos + clientes + servicos
```
