---
name: luarys-seguranca-dados
description: Segurança de aplicação para o projeto Luarys — multi-tenant, autenticação, pagamentos, LGPD e proteção geral de sistema online. USE SEMPRE que for criar ou alterar uma tabela, uma policy de RLS, uma rota de API, qualquer ponto de acesso usado pelo Portal do Cliente (anon/sem login), um formulário, um upload de arquivo, ou qualquer fluxo de autenticação/sessão/pagamento — mesmo que o pedido do usuário não mencione segurança explicitamente. Consultar também antes de aprovar/revisar qualquer SQL antes de rodar no Supabase, antes de adicionar uma coluna sensível (CPF, custo interno, comissão, telefone, senha, token) numa tabela com policy pública, e antes de lançar qualquer funcionalidade nova em produção. Nasceu de uma auditoria real (jun/2026) que encontrou policies "USING (true)" vazando CPF, telefone e custo operacional de todos os salões para qualquer visitante sem login — o objetivo é cobrir essa e outras categorias de falha antes que aconteçam, não só depois de uma auditoria.
---

# Segurança de Sistema Online — Luarys

O Luarys é um SaaS multi-tenant (dezenas de salões compartilhando o mesmo banco) que processa dado pessoal (CPF, telefone, e-mail, possivelmente dado de saúde em fichas de anamnese) e dinheiro real (assinaturas via Mercado Pago/InfinitePay, faturamento dos salões clientes). Isso o coloca sob LGPD e sob risco financeiro direto se houver falha.

**Esta skill não é um substituto para revisão humana ou pentest profissional.** Ela existe para que os padrões já conhecidos sejam aplicados de forma consistente, e para que cada categoria de risco tenha um responsável claro de "o que verificar" — reduzindo a chance de esquecimento, não eliminando a necessidade de revisão.

## Como usar esta skill

Leia esta página inteira primeiro — ela é o índice e cobre os pontos mais críticos resumidamente. Para o assunto específico do que você está construindo, leia também a referência correspondente antes de escrever código:

| Vou construir... | Leia também |
|---|---|
| Uma tabela nova, uma policy de RLS | `references/rls_multitenant.md` |
| Algo que o Portal (sem login) vai acessar | `references/portal_padroes.md` |
| Uma tabela que mistura dado público e sensível | `references/view_publica.md` |
| Uma rota de API nova (`src/app/api/.../route.ts`) | `references/api_routes.md` |
| Algo envolvendo pagamento/webhook de gateway | `references/webhooks_pagamento.md` |
| Login, sessão, cookie, "lembrar de mim" | `references/autenticacao_sessao.md` |
| Upload de arquivo (foto, comprovante, PDF) | `references/upload_arquivos.md` |
| PIN/senha secundária, MFA, headers HTTP | `references/protecao_adicional.md` |
| Qualquer coisa relacionada a CPF, dado de saúde, exclusão de conta | `references/lgpd_dados_pessoais.md` |
| Revisar um SQL de RLS antes de rodar | `references/checklist_revisao_rls.md` |
| Lançar uma funcionalidade nova em produção | `references/checklist_pre_lancamento.md` |

## As 10 regras que mais importam (resumo executivo)

1. **Toda tabela operacional tem `salao_id`, e toda policy de `authenticated` filtra por `salao_id = auth_salao_id()`.** Nunca `USING (true)` numa tabela com dado de mais de um salão.
2. **`TO anon` é risco alto por padrão.** A `anon key` já está pública no navegador de qualquer visitante — a única proteção real é a policy do banco. Toda policy `anon` exige a pergunta: "se alguém copiar a anon key e consultar direto, sem usar o site, o que isso retorna?"
3. **RLS filtra linhas, não colunas.** Se uma tabela tem coluna sensível (custo, comissão, CPF) e também precisa de policy pública, a solução é uma view com só as colunas seguras — nunca abrir a tabela inteira.
4. **Webhooks de pagamento nunca confiam no payload recebido** — sempre re-consultam o status real na API do gateway antes de processar. Quando o gateway oferece validação de assinatura (HMAC), implementar.
5. **Toda rota de API que recebe input externo valida esse input** antes de usar — tipo, formato, tamanho, presença dos campos obrigatórios. Preferir um schema (Zod) a validação manual espalhada.
6. **Rotas sensíveis a abuso (login, criação de conta, recuperação de senha, chave admin) têm rate limiting** — sem isso, qualquer um pode tentar força bruta sem limite.
7. **Sessão usa cookies httpOnly geridos pelo middleware** (`@supabase/ssr` + `middleware.ts`), nunca token de auth guardado manualmente em localStorage acessível por JavaScript de terceiros.
8. **Nenhuma chave secreta (service_role, token de gateway, segredo de webhook) aparece no código do client** — só em variáveis de ambiente do servidor, nunca em `NEXT_PUBLIC_*`.
9. **Toda escrita feita com `service_role`** (que ignora RLS) **filtra `salao_id` manualmente no código**, porque o banco não vai proteger essa chamada.
10. **Dado pessoal sensível (CPF, dado de saúde) tem rastreabilidade de quem acessa e para quê** — e o sistema precisa ter um caminho de exclusão/portabilidade, mesmo que manual no começo.
11. **Nenhum segredo (PIN, senha) usa um valor padrão hardcoded como fallback** quando não configurado — isso já causou um bug real no projeto (`pin_gerente || '1234'`). Se não configurado, bloquear a ação, nunca aceitar um valor previsível.

## Antes de lançar qualquer funcionalidade nova

Ver `references/checklist_pre_lancamento.md` para o roteiro completo. Resumo: pergunte "quem pode ver isso, quem pode mudar isso, e o que acontece se alguém tentar contornar pelo caminho errado (API direta, não pela tela)?" — para toda funcionalidade nova, não só para as que "parecem" sensíveis. Funcionalidades que não parecem sensíveis (ex: "ver lista de horários livres") podem vazar dado indiretamente (ex: confirmar quais clientes existem por tentativa e erro).

## Mantendo esta skill viva

Sempre que uma auditoria, um incidente, ou uma dúvida de segurança revelar algo que não está coberto aqui, atualizar o arquivo de referência correspondente (ou criar um novo) — esta skill só protege contra o que já está documentada nela. Segurança de verdade também depende de revisão humana periódica e, antes de operar em escala com dinheiro real de terceiros, de um pentest profissional independente.
