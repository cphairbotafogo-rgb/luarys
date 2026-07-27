# CLAUDE.md — Luarys

## Projeto
Multi-tenant SaaS de gestão de salão. Stack: **Next.js + Turbopack · TypeScript · Supabase/PostgreSQL com RLS · Tailwind CSS**.
Caminho local: `C:\Users\conce\OneDrive\Área de Trabalho\luarys`
Supabase project ID: `yojtfrgoosapnsvyzgpw` · salao_id piloto: `2746822d-fcbf-4d03-9f1a-cc66f94adbf2`
Piloto real: Concept Prime Hair (Botafogo/RJ). Nome antigo "Eleva" — usar sempre **Luarys**.
Produção: `https://www.luarys.com.br` (**sempre com www** — sem www há 308 e gateways não seguem redirect em POST de webhook).

> Este arquivo existe para uma coisa: **impedir que uma mudança em um módulo quebre outro**.
> O Luarys é forte em integrações cruzadas (um fechamento de conta alimenta financeiro,
> caixa, comissões, estoque, fidelidade e nota fiscal ao mesmo tempo). Isso deve continuar
> — mas toda mudança nesses fluxos passa pela seção "Integrações cruzadas" e pelo
> checklist da seção final.

## Módulos (`src/modules/`)
`agenda` `aniversario` `auth` `caixa` `comunicacao` `configuracoes` `crescimento` `crm`
`dashboard` `equipe` `estoque` `fidelidade` `financeiro` `fiscal` `nfce` `painel-mobile`
`portal` `precificacao` `relatorios` `servicos` `whatsapp`

---

## Fluxo de trabalho obrigatório — vistoria antes de aplicar

Nenhuma mudança é aplicada "de primeira". Todo trabalho segue 5 etapas, nesta ordem:

**1. PLANEJAR** — descrever em poucas linhas o que será feito, quais arquivos serão
tocados e quais módulos/tabelas a mudança atravessa (consultar "Integrações cruzadas").

**2. VERIFICAR CONTRA O CÓDIGO REAL** — antes de escrever qualquer linha:
- Ler o arquivo real que será alterado (nunca editar de memória — o arquivo pode ter
  mudado desde a última sessão).
- Confirmar que colunas, tabelas e RPCs citadas existem de verdade (migrations ou banco),
  em vez de assumir. Metade dos bugs históricos veio de suposição de schema.
- Mapear quem mais chama/depende do que vai mudar (`grep` por usos, não confiar na memória).

**3. VISTORIAR A PRÓPRIA LÓGICA** — antes de apresentar, revisar o que foi escrito como
se fosse código de outra pessoa, procurando ativamente por erro:
- Rodar o "Checklist antes de mexer em rota de dinheiro, crédito ou nota fiscal" (seção final).
- Simular os caminhos ruins: e se vier `null`? E se dois usuários clicarem ao mesmo tempo?
  E se a rede cair no passo 3 de 5? E se o webhook chegar duas vezes?
- Conferir tipos e nomes contra o arquivo real (não contra o que "deveria ser").
- Se houver como compilar/rodar (`tsc`, build, teste do fluxo), fazer isso ANTES de entregar.
- Se a vistoria encontrar problema: corrigir e vistoriar de novo — não entregar com ressalva.

**4. AUTONOMIA POR FAIXA DE RISCO** — a vistoria (etapas 1–3) vale para TUDO,
mas a necessidade de confirmação depende do risco:

🟢 **FAIXA VERDE — executar direto, sem pedir liberação** (avisar no resumo final
o que foi feito). É o padrão para o dia a dia:
- Telas, componentes, hooks, estilos, textos, labels, toasts e ajustes visuais
- Correção de bugs de interface e de lógica de exibição/cálculo em tela
- Refatoração e modularização (regra das 400 linhas), renomear, extrair, organizar
- Criação de arquivos novos, tipos, helpers e utilitários
- Queries de LEITURA e ajustes em relatórios/telas de consulta
- Melhorias de performance, logs e mensagens de erro
- Documentação, comentários e atualizações do próprio CLAUDE.md

🔴 **FAIXA VERMELHA — apresentar plano + resultado da vistoria e AGUARDAR o OK
do Ari antes de aplicar.** Lista fechada — se não está aqui, é verde:
- Qualquer SQL de escrita no schema: migrations, criar/alterar RPCs, policies, triggers
- Rotas de dinheiro, crédito, assinatura, nota fiscal e webhooks (criar ou alterar)
- Fechamento de conta (`fechar_conta_atomico` e todo o fluxo da seção "Integrações cruzadas")
- Autenticação, RLS, permissões e tudo que envolva `service_role`
- Deletar/alterar dados existentes em massa (UPDATE/DELETE sem ser via tela do sistema)
- Variáveis de ambiente, segredos, configuração de deploy/produção
- Remover ou desativar validações e proteções existentes

Regra de desempate: **na dúvida se é verde ou vermelha, tratar como vermelha.**
Se uma tarefa verde revelar no meio do caminho que precisa tocar algo vermelho
(ex.: a tela precisa de uma coluna nova no banco), parar nessa parte, fazer o
que é verde, e apresentar a parte vermelha para aprovação.

**5. CONFERIR DEPOIS DE APLICAR** — após o Ari aplicar, orientar como validar na prática
(qual tela abrir, qual fluxo executar, o que deve aparecer no banco/log) e perguntar o
resultado antes de dar o item por encerrado.

Regra de honestidade da vistoria: dizer explicitamente o que **não** foi testado
(ex.: "não tenho como executar contra o banco real; validei tipos e concorrência no código").
Nunca afirmar "está funcionando" sobre algo que só foi lido, não executado.

---

## Regras de código — SEMPRE seguir
- **Máximo 400 linhas por arquivo.** Acima disso, dividir em subpasta com `tipos.ts` + `useX.ts` + componentes filhos. Fila de modularização concluída — manter assim.
- **Sem hardcode de hex de status.** Usar `COR_POR_STATUS` de `src/lib/agendaUtils.ts` como fonte única.
- **Sem hardcode de hex de UI.** Usar tokens `C.*` de `src/lib/constants.ts` e `RAIO_*` de `src/lib/estiloGlobal.ts`.
- **Português do Brasil em tudo**: interface, mensagens de erro, comentários de código, variáveis de exemplo, commits e terminal. Nunca misturar inglês (o código existente já é 100% comentado em pt-BR — manter).
- **Entregar arquivos individuais** (nunca zip) para Ari abrir direto no VS Code.
- **Ícones**: `react-icons/fi`. Nunca lucide-react.
- **Nunca `alert()`** — usar o sistema de Toast (`@/components/Toast`).
- **Next.js 16**: `params` de rota dinâmica é `Promise` — sempre `await params`.
- **RLS obrigatório.** Toda query usa `auth_salao_id()` RPC. Nunca expor dados de outro salão. Nunca `TO anon USING (true)`.
- **UUID guard** antes de passar arrays para colunas `uuid[]` no Postgres — `String(null) === "null"` passa pelo `filter(Boolean)` e quebra o cast.
- **Toda função/tabela SQL nova exige arquivo em `supabase/migrations/`.** Nada de criar só pelo SQL Editor (ver "Drift de schema").

## Padrões Supabase (peculiaridades reais do banco)
- `gerar_numero_os` falha fora de contexto auth → `os_numero` deve ser nullable.
- `agendamento_ids` em `financeiro` é `uuid[]` → inserir `null`, nunca `{}`.
- `servicos_comissoes` em `profissionais` é `json` (não jsonb) → cast de texto nas comparações.
- `ficha_tecnica` RLS exige subquery indireta via `servicos`.
- `preferencias_sidebar` usa `usuario_id = auth.uid()` (não salao_id).
- `perfis_usuarios` **não tem coluna `role`** — pedir coluna inexistente derruba a query inteira e mascara o erro real. Logar sempre o `error.message` cru; `.maybeSingle()` + descarte do error esconde falhas de schema.
- plpgsql: `RETURNS TABLE` com nomes iguais aos das colunas → erro 42702 (ambiguidade). Usar `#variable_conflict use_column` ou renomear os OUT params.

---

## Segurança — padrões obrigatórios (copiar dos exemplos citados)

### Autenticação de rotas de API
- Toda rota autenticada usa `autenticarRota()` de `src/lib/apiAuth.ts`. O `salao_id` vem **sempre** do perfil do usuário autenticado no servidor — **nunca do body**.
- `SUPABASE_SERVICE_ROLE_KEY` só existe em rotas de API (server). Jamais no client.
- Rotas admin: verificar `perfis_usuarios.is_plataforma_admin` (exemplo: `api/admin/rodar-cron`).

### Webhooks: SEMPRE fail-closed
- Segredo ausente no ambiente → **rejeitar tudo**, nunca "pular a validação". Exemplos corretos a copiar: `api/whatsapp/webhook` (HMAC X-Hub-Signature-256 + `timingSafeEqual`) e `api/webhooks/asaas` (token no header + **re-busca do pagamento na API** antes de creditar).
- Comparação de segredo/assinatura: sempre `crypto.timingSafeEqual`, nunca `!==`.
- Nunca interpolar dados do corpo do webhook em filtros `.or()` / strings de query PostgREST — usar `.eq()` / `.in()` com valores.

### Dinheiro e créditos
- **Preço/quantidade vêm do banco, nunca do cliente** (exemplo: `whatsapp_pacotes` em `comprar-creditos`).
- **Idempotência por id externo**: crédito disparado por webhook grava em tabela de compras com `UNIQUE (pagamento_externo_id)` + `ON CONFLICT DO NOTHING`, e só credita se a linha foi de fato inserida (exemplo: `creditar_pacote_whatsapp_pago`). Gateways reenviam webhooks — sem isso, crédito duplica.
- Débito de crédito WhatsApp acontece **depois** do envio confirmado pela Meta, via RPC atômica (`debitar_credito_whatsapp`, FOR UPDATE).
- Rate limit nas rotas críticas: `rateLimitExcedido()` de `src/lib/rateLimiter.ts` (KV/Upstash em produção; memória só vale em dev — Vercel Serverless não compartilha memória).
- Asaas: nunca enviar `installmentCount` em pagamento à vista (exige campos de parcela).

### CNPJ alfanumérico (vigente desde 01/07/2026)
- **PROIBIDO `cnpj.replace(/\D/g, '')`** — remove as letras de CNPJs novos e gera silenciosamente um CNPJ de outra empresa. Usar sempre `src/lib/cnpj.ts` (`limparCnpj` mantém `[A-Z0-9]`; `validarCnpj` já usa o algoritmo charCode−48 da IN RFB 2.229/2024).
- Nunca converter CNPJ ou chave de acesso para número (`parseInt`, `BIGINT`).
- Se um gateway rejeitar CNPJ com letra, tratar o erro do gateway — não "consertar" removendo a letra.

---

## Integrações cruzadas — o mapa que evita regressões

### Fechamento de conta (o fluxo mais sensível do sistema)
`useFechamentoCaixa.ts` + `executarFechamentoConta.ts` gravam, numa operação lógica:
**financeiro + caixa_transacoes + comissões + baixa de estoque (ficha técnica) + fidelidade + O.S. (`gerar_numero_os`) + emissão NFS-e/NFC-e (modo Automático)**, com núcleo transacional na RPC `fechar_conta_atomico`.
- UUID regex guard no array `agendamento_ids`; log de etapa no catch para diagnóstico.
- Bug histórico a nunca reintroduzir: **dual-write financeiro/caixa_transacoes** divergente (venda do PDV invisível nos relatórios). Mudou um lado → conferir o outro.
- Bug histórico de comissão: `item.id` carregando UUID do **agendamento** no lugar do UUID do **serviço**. Sempre validar qual entidade o id representa.
- Falha na emissão de nota **não pode bloquear a venda** (try/catch isolado + toast).
- Estado React não atualiza antes de `await` — dados que o fechamento precisa (ex.: bandeira do cartão) entram por parâmetro, não por leitura do estado.

### Webhook Asaas (um endpoint, dois mundos)
`api/webhooks/asaas` atende **assinaturas de módulos/planos** E **créditos WhatsApp**. A distinção é o `externalReference`:
- Créditos WhatsApp: `whatsapp::salaoId::pacoteId` — **testar ANTES** de `parseReferencia()` (que aceitaria "whatsapp" como salaoId e corromperia o fluxo de assinatura).
- Renovação de subscription pode vir **sem** `externalReference` na fatura — buscar o da subscription antes de decidir o branch.

### Notas fiscais — duas tabelas, dois fluxos, não misturar
- **NFS-e (serviço)** → tabela `notas_fiscais` (criada em `lancarOS.ts`; emissão em lote ou automática por `api/nfse/emitir`). A **cota mensal de 150 notas conta linhas dessa tabela** — por isso a NFC-e NÃO grava nela.
- **NFC-e (produto/PDV)** → tabela própria `nfce_emissoes` (migration `20260727_nfce_numero_atomico_persistencia.sql`). Numeração via RPC atômica `obter_proximo_numero_nfce` — **nunca** ler `proximo_numero` e atualizar em dois passos. Toda emissão grava registro ANTES de chamar a Focus (status `processando`) e atualiza depois — nota autorizada na SEFAZ sem registro local é falha fiscal grave (XML recuperável por 5 anos).
- Provedores NFS-e roteados por `config_fiscal.provedor_nfse` (`src/lib/nfse/index.ts` — focusnfe | brasilnfe); token por provedor via `resolverToken`.
- **Prazo crítico: 1º/set/2026** — Simples Nacional obrigado ao Emissor Nacional (Ambiente Nacional/SEFIN). Antes de qualquer decisão fiscal, consultar a skill `fiscal-brasil-luarys`.

### WhatsApp — dois planos, comportamentos opostos
- **Plano B (gestao_meta)**: credenciais do próprio salão (`whatsapp_config_plano`, token criptografado via `whatsappCrypto`) — Meta cobra o salão, **sem** débito de saldo aqui.
- **Plano A (mestre Luarys)**: `plataforma_whatsapp_config` + carteira `whatsapp_carteira_creditos`. Texto livre = grátis; template marketing debita `saldo_campanha`; utilidade/autenticação debita `saldo_atendimento`.
- Ordem de detecção na rota `enviar`: existe config Plano B ativa → Plano B; senão Plano A. Mudar essa ordem quebra cobrança.
- **Gateway de créditos: Asaas, JÁ INTEGRADO** (`comprar-creditos` avulso + assinatura mensal recorrente, crédito só via webhook confirmado). `comprar-creditos-teste` credita sem pagamento real: só funciona com `WHATSAPP_CREDITO_TESTE_HABILITADO=true` — **nunca habilitar em produção**.

---

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
`luarys-visual-lock` · `eleva-design-portal-cliente` · `fiscal-brasil-luarys`

## Skills do projeto (`.claude/skills/`)
- **`luarys-taxas-cartoes`** — padrão obrigatório para todo cálculo de taxa operadora. Hook: `useTaxasConfig(perfil)` em `src/lib/useTaxasConfig.ts`. Fonte única: `config_taxas`. Nunca hardcode de taxa, nunca ler `taxa_maquina`.
- **`luarys-contexto-global`** — `DadosGlobaisProvider` em `src/lib/contexto/DadosGlobaisContext.tsx`. Busca `servicos`, `profissionais` e `config_taxas` uma vez no login. Hook: `useDadosGlobais()`. Evitar queries duplicadas dessas tabelas por componente.
- **`luarys-abas-persistentes`** — abas montadas em background (`display:none`): `agenda`, `crm`, `caixa`, `financeiro`, `relatorios`. Implementado em `src/app/page.tsx`.
- **`luarys-query-higiene`** — nunca `select('*')`, sempre `Promise.all`, paginação em listas, debounce em filtros, `.maybeSingle()` quando a linha pode não existir.

---

## O que estamos mantendo (status atualizado — jul/2026)
- **Modularização progressiva:** concluída — todos os módulos abaixo de 400 linhas. Manter o padrão em código novo.
- **Agenda:** tooltip hover (WhatsApp) + menu de clique direito (status, fechar conta, faltou, cancelar). Cores automáticas via `corPorStatus()`.
- **Automações N8N:** hub central planejado para WhatsApp, e-mail e Google Reviews integrados à agenda real.
- **NFS-e:** rotas funcionais via Focus NFe/Brasil NFe (`emitir`, `consultar`, `cancelar`, `upload-a1`, `webhook-brasilnfe`). Pendente: decisão final de provedor com integração SEFIN Nacional (prazo 1º/set/2026) e try/catch por nota no lote.
- **NFC-e:** rota de emissão funcional (Focus NFe) com numeração atômica e persistência em `nfce_emissoes`. Pendente: telas lerem de `nfce_emissoes` e reconciliação de notas `processando` via consultar.
- **WhatsApp:** envio (Planos A/B), carteira, compra de créditos via Asaas (avulso + recorrente) e webhook Meta fail-closed — funcionais. Pendente: segredos no ambiente de produção e registro do webhook na Meta (URL com www).

## Drift de schema (pendência ativa)
Estas RPCs são chamadas no código mas **não têm migration versionada** (existem só no banco vivo). Exportar do banco e versionar:
`debitar_credito_whatsapp` · `restaurar_credito_whatsapp` · `admin_ativar_modulo_fiscal` · `obter_status_fiscal` · `obter_saldo_whatsapp` · `obter_consumo_whatsapp_mes` · `baixar_estoque_vitrine` · `resgatar_premio_fidelidade`
Enquanto não versionadas, não dá para recriar o banco do zero nem auditar idempotência (ex.: `restaurar_credito_whatsapp` precisa ser idempotente por `wamid` — a Meta reenvia eventos de status).

## Checklist antes de mexer em rota de dinheiro, crédito ou nota fiscal
1. `autenticarRota()` presente? `salao_id` vem do perfil (nunca do body)?
2. Valor/preço/quantidade lidos do banco?
3. Operação disparável por webhook é idempotente (UNIQUE + ON CONFLICT no id externo)?
4. Webhook fail-closed com comparação timing-safe?
5. Existe migration para toda função/tabela nova?
6. Concorrência: dois cliques simultâneos duplicam algo? (numeração, débito, cota)
7. Falha parcial: se o passo 3 de 5 falhar, o que fica inconsistente? Tem como reconciliar?
8. A mudança toca o fechamento de conta ou o webhook Asaas? → reler "Integrações cruzadas" inteira.

## Idioma
Responder sempre em português do Brasil (pt-BR): explicações, comentários de commit, mensagens no terminal **e comentários no código** — o código existente já é todo comentado em pt-BR e assim deve continuar.
