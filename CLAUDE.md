# CLAUDE.md — Luarys

## Projeto
Multi-tenant SaaS de gestão de salão. Stack: **Next.js + Turbopack · TypeScript · Supabase/PostgreSQL com RLS · Tailwind CSS**.
Caminho local: `C:\Users\conce\OneDrive\Área de Trabalho\luarys`
Supabase project ID: `yojtfrgoosapnsvyzgpw` · salao_id: `2746822d-fcbf-4d03-9f1a-cc66f94adbf2`

## Módulos (`src/modules/`)
`agenda` `caixa` `financeiro` `crm` `estoque` `equipe` `servicos` `configuracoes`
`relatorios` `precificacao` `fidelidade` `crescimento` `dashboard`

## Regras de código — SEMPRE seguir
- **Máximo 400 linhas por arquivo.** Acima disso, dividir em subpasta com `tipos.ts` + `useX.ts` + componentes filhos.
- **Sem hardcode de hex de status.** Usar `COR_POR_STATUS` de `src/lib/agendaUtils.ts` como fonte única.
- **Sem hardcode de hex de UI.** Usar tokens `C.*` de `src/lib/constants.ts` e `RAIO_*` de `src/lib/estiloGlobal.ts`.
- **Português do Brasil** em todo texto de interface, comentários, variáveis de exemplo e mensagens de erro.
- **Entregar arquivos individuais** (nunca zip) para Ari abrir direto no VS Code.
- **RLS obrigatório.** Toda query usa `auth_salao_id()` RPC. Nunca expor dados de outro salão.
- **UUID guard** antes de passar arrays para colunas `uuid[]` no Postgres — `String(null) === "null"` passa pelo `filter(Boolean)` e quebra o cast.

## Padrões Supabase
- `gerar_numero_os` falha fora de contexto auth → `os_numero` deve ser nullable.
- `agendamento_ids` em `financeiro` é `uuid[]` → inserir `null`, nunca `{}`.
- `servicos_comissoes` em `profissionais` é `json` (não jsonb) → cast de texto nas comparações.
- `ficha_tecnica` RLS exige subquery indireta via `servicos`.
- `preferencias_sidebar` usa `usuario_id = auth.uid()` (não salao_id).

## Status da agenda → cores (COR_POR_STATUS)
| Status | Cor |
|---|---|
| Agendado | `#1E293B` Quase preto — aguardando confirmação |
| Confirmado | `#94A3B8` Cinza — cliente confirmou presença |
| Aguardando | `#D4AF37` Dourado — cliente chegou, aguarda vez |
| Em Atendimento | `#3B82F6` Azul — serviço em andamento |
| Finalizado | `#4F9D6E` Verde vivo |
| Faltou | `#EF4444` Vermelho + borda tracejada |
| Cancelado | `#EF4444` Vermelho opaco |
| Bloqueado | usa `ag.cor` do banco (salvo por `corDoTipoBloqueio` em ModalAusencia) |

## Skills instaladas (`/mnt/skills/user/`)
`eleva-padroes` · `eleva-conexoes` · `eleva-seguranca-dados` · `eleva-blindagem-negocio`
`luarys-visual-lock` · `eleva-design-portal-cliente`

## Skills do projeto (`.claude/skills/`)
- **`luarys-taxas-cartoes`** — padrão obrigatório para todo cálculo de taxa operadora. Hook: `useTaxasConfig(perfil)` em `src/lib/useTaxasConfig.ts`. Fonte única: `config_taxas`. Nunca hardcode taxa, nunca ler `taxa_maquina`.
- **`luarys-contexto-global`** — `DadosGlobaisProvider` em `src/lib/contexto/DadosGlobaisContext.tsx`. Busca `servicos`, `profissionais` e `config_taxas` uma vez no login. Hook: `useDadosGlobais()`. Evitar queries duplicadas dessas tabelas por componente.
- **`luarys-abas-persistentes`** — Padrão de abas que ficam montadas em background (`display:none`). Abas: `agenda`, `crm`, `caixa`, `financeiro`, `relatorios`. Implementado em `src/app/page.tsx`.
- **`luarys-query-higiene`** — Regras para queries Supabase: nunca `select('*')`, sempre `Promise.all`, paginação em listas, debounce em filtros, `.maybeSingle()` quando linha pode não existir.
- **`fiscal-brasil-luarys`** — referência fiscal NFS-e / Reforma Tributária.

## O que estamos mantendo
- **Modularização progressiva:** dividir arquivos >400 lin. em subpastas com `tipos.ts` + hook + componentes. **Fila concluída** — todos os módulos estão abaixo de 400 linhas.
- **Agenda:** tooltip hover (WhatsApp) + menu clique direito (status, fechar conta, faltou, cancelar). Cores por status automáticas via `corPorStatus()`.
- **Fechamento de caixa (`useFechamentoCaixa.ts`):** UUID regex guard no array `agendamento_ids`; log de etapa no catch para diagnóstico.
- **Automações N8N:** hub central planejado para WhatsApp, e-mail e Google Reviews integrados à agenda real.
- **NFS-e / NFC-e:** estrutura pronta (tabelas, RPCs, `GavetaNFSe`, `GavetaNFCe`); requerem Edge Functions SEFAZ + certificado A1 + token Brasil NFe (pendente).
- **Gateway de pagamento WhatsApp:** fluxo de compra de créditos existe, mas não está conectado a Mercado Pago / Stripe. Aviso amarelo visível na tela e TODO no `PainelCarteiraWhatsapp.tsx`.

## Idioma

Responda sempre em português do Brasil (pt-BR), incluindo explicações, 
comentários de commit e mensagens no terminal. Comentários no código 
podem ficar em inglês (padrão do projeto), mas toda comunicação comigo 
deve ser em português.