# TAREFAS.md — Eleva / Luarys
> Backlog consolidado. Atualizar a cada sessão de trabalho.
> Última revisão: 26/06/2026

---

## 🔴 URGENTE — Dívida técnica estrutural

| # | Tarefa | Arquivo(s) |
|---|---|---|
| U1 | Remover `useFechamentoCaixa.ts` duplicado da pasta `fechamento/` | `modals/fechamento/useFechamentoCaixa.ts` |
| U2 | Corrigir nome de arquivo: `permissoen.ts` → `permissoes.ts` | `src/lib/permissoes/permissoen.ts` |
| U3 | Remover `AbaMigracao.tsx` duplicado de `configuracoes/` (manter só `migracao/`) | `configuracoes/AbaMigracao.tsx` |
| U4 | Auditar todas as RLS policies — `fix_recursao_rls_agendamentos.sql` indica loop anterior | `agendamentos`, `clientes`, `caixa`, `notas`, `comissoes` |
| U5 | Criar normalizador de webhooks de pagamento (Mercado Pago + InfinitePay → formato único) | `src/lib/pagamentos/normalizador.ts` (novo) |

---

## 🟡 ALTA — Funcionalidades em andamento / bugs conhecidos

| # | Módulo | Tarefa | Observação |
|---|---|---|---|
| A1 | Agenda | Bloqueio deve aparecer como card na grade com cor e motivo visíveis | Cor distinta por tipo de bloqueio |
| A2 | Agenda | Horários bloqueados não podem ser agendados via Portal do Cliente | Bloquear slots no fetch de disponibilidade |
| A3 | Agenda | Redimensionamento do card não deve abrir "Detalhes do Agendamento" | Separar drag do click |
| A4 | Agenda | Status "Faltou" — cliente permanece na grade com card vermelho tracejado | Já implementado, verificar se chegou ao banco |
| A5 | Agenda | Cores de status devem seguir `COR_POR_STATUS` em todo o sistema | `agendaUtils.ts` já corrigido — validar sidebar e modal |
| A6 | Caixa | Busca por Nº OS na Frente de Caixa | `AbaCaixa.tsx` / `useAbaCaixa.ts` |
| A7 | Novo Agendamento | Botão "Salvar e Fechar Conta" — salva e abre `ModalFechamentoCaixa` | `ModalNovoAgendamento.tsx` |
| A8 | Relatórios | Sincronizar "Radar de Produtividade" com "Visão Geral do Negócio" | Mesma query base |
| A9 | Relatórios | Filtro de período do "Resumo do Turno" deve respeitar data selecionada sem vazamento | `useFechamentoCaixa.ts` |

---

## 🟢 MÉDIA — Melhorias planejadas

| # | Módulo | Tarefa |
|---|---|---|
| M1 | Agenda | `ModalNovoAgendamento.tsx` — dividir em hook + componentes (598 linhas) |
| M2 | Relatorios | `GavetaFechamentoContabil.tsx` — dividir (919 linhas) |
| M3 | Portal | `PortalDashboard.tsx` — dividir (924 linhas) |
| M4 | Config | `AbaMigracao.tsx` — dividir (709 linhas) |
| M5 | Relatorios | `GavetaProdutividade.tsx` — dividir (576 linhas) |
| M6 | Fiscal | `GavetaNFCe.tsx` — dividir (576 linhas) |
| M7 | CRM | Portal do Cliente — agendamento online respeita bloqueios e folgas |
| M8 | Fidelidade | Clube de assinatura recorrente para cliente final |
| M9 | Financeiro | Conciliação de cartões — extrair para componente próprio (placeholder atual) |

---

## ⚫ ESTRATÉGICO — Próxima fase de produto

| # | Tarefa | Impacto |
|---|---|---|
| E1 | WhatsApp automático via API oficial Meta (substituir N8N manual) | Alto — maior gap vs. Trinks |
| E2 | NFS-e funcional via Edge Function SEFAZ (substituir placeholder) | Alto — obrigação legal 2026/2027 |
| E3 | App mobile PWA para profissional (ver própria agenda e comissões) | Médio |
| E4 | Criar `lib/fiscal/core.ts` — centralizar criação, envio, consulta, cancelamento e fallback | Médio |
| E5 | Desacoplar agenda por eventos: `AGENDAMENTO_CRIADO`, `ATENDIMENTO_FINALIZADO`, `CAIXA_FECHADO`, `NOTA_GERADA`, `COMISSAO_PROCESSADA`, `FIDELIDADE_APLICADA` | Médio-alto (escalabilidade) |
| E6 | Marketplace / vitrine pública para captação de clientes novos | Médio |

---

## ✅ CONCLUÍDO

| # | Tarefa | Data |
|---|---|---|
| C1 | `AbaCaixa.tsx` dividido em 5 arquivos (882 → max 358 linhas) | Jun/2026 |
| C2 | `GavetaComissoes.tsx` dividido em 6 arquivos (1322 → max 445 linhas) | Jun/2026 |
| C3 | `AbaFinanceiro.tsx` dividido em 7 arquivos (810 → max 229 linhas) | Jun/2026 |
| C4 | `AbaAgenda.tsx` dividido em 3 arquivos (601 → max 317 linhas) | Jun/2026 |
| C5 | `ModalEdicao.tsx` dividido em 3 arquivos (670 → max 406 linhas) | Jun/2026 |
| C6 | `AbaCRM.tsx` dividido em 3 arquivos (692 → max 247 linhas) | Jun/2026 |
| C7 | Tooltip hover na agenda (WhatsApp clicável) | Jun/2026 |
| C8 | Menu clique direito sobre card da agenda (status, fechar conta, faltou, cancelar) | Jun/2026 |
| C9 | `COR_POR_STATUS` como fonte única de verdade em `agendaUtils.ts` | Jun/2026 |
| C10 | `CLAUDE.md` e `.claudeignore` criados na raiz do projeto | Jun/2026 |
| C11 | UUID regex guard no `useFechamentoCaixa.ts` (fix `String(null)` no array `uuid[]`) | Jun/2026 |
| C12 | Serviços adicionais com profissionais diferentes no `ModalEdicao` | Jun/2026 |
