---
name: fiscal-brasil-luarys
description: Regras, prazos e exemplos técnicos da legislação fiscal brasileira em transição (NFS-e Ambiente Nacional/SEFIN, Reforma Tributária IBS/CBS, split payment, CNPJ alfanumérico, DANFSe v2.0) aplicados ao contexto do Luarys/Eleva — sistema de gestão para salões em Next.js/Supabase. Consulte esta skill sempre que a conversa envolver nota fiscal, NFS-e, NF-e, NFC-e, Ambiente Nacional, SEFIN, Emissor Nacional, Focus NFe, Brasil NFe, IBS, CBS, split payment, reforma tributária, Simples Nacional, Anexo V, cClassTrib, chave de acesso, CNPJ alfanumérico, DANFSe, ou qualquer trabalho no módulo fiscal do Luarys (GavetaNFCe, GavetaNFSe, AbaFinanceiro). Use também antes de escrever validação de CNPJ/chave de acesso, montar payload de emissão, decidir provedor de nota fiscal, ou redigir cláusulas de responsabilidade fiscal do Luarys — mesmo que o pedido não mencione nota fiscal explicitamente, como em pedidos do tipo valida esse CNPJ, por que a nota foi rejeitada, ou cadastro de serviço do salão.
---

# Fiscal Brasil — Luarys

Skill de referência sobre a legislação fiscal brasileira em transição (NFS-e Ambiente Nacional + Reforma Tributária/IBS-CBS), aplicada ao contexto específico do Luarys: SaaS de gestão para salões, arquitetura multi-tenant em Next.js/Supabase, clientes majoritariamente Simples Nacional Anexo V, sem CLT.

**Todo o conteúdo desta skill foi verificado em 01/07/2026.** Essa área muda com Notas Técnicas quase mensais — antes de usar em decisão crítica (ex: fechar contrato com provedor, definir layout de campo obrigatório), confirme se não saiu atualização mais recente. Ver seção "Como manter atualizada" no fim deste arquivo.

⚠️ Leia `references/06-alertas-urgentes.md` primeiro se a conversa envolver NF-e/NFC-e ou geração de DANFSe — há duas mudanças técnicas com corte exatamente em 01/07/2026 (CNPJ alfanumérico e suspensão da API nacional de geração do DANFSe).

## Quando usar cada referência

| Situação | Arquivo |
|---|---|
| Dúvida sobre obrigatoriedade do Emissor Nacional / prazo setembro 2026 | `references/01-nfse-ambiente-nacional.md` |
| Campos novos na NF-e/NFC-e (IBS, CBS, cClassTrib) — o que muda no GavetaNFCe | `references/02-reforma-ibs-cbs.md` |
| Impacto do split payment no caixa/PDV do salão | `references/03-split-payment.md` |
| Decidir ou justificar Focus NFe vs Brasil NFe | `references/04-focus-vs-brasil-nfe.md` |
| Redigir termos/contrato posicionando Luarys como integrador, não emissor | `references/05-luarys-posicionamento.md` |
| Mudanças com prazo de corte imediato (CNPJ alfanumérico, DANFSe v2.0) | `references/06-alertas-urgentes.md` |
| Escrever/revisar código que monta payload de NFS-e/NF-e, valida CNPJ ou chave de acesso | `references/07-exemplos-tecnicos.md` |

## Contexto do Luarys que toda resposta deve respeitar

- Clientes-alvo: salões pequenos/médios, tipicamente **Simples Nacional, Anexo V** (sem funcionários CLT — Fator R já é tratado no modelo de precificação, não repetir esse cálculo aqui).
- Luarys **não é emissora de nota fiscal** — é um sistema que se integra a um provedor terceirizado (Focus NFe ou Brasil NFe) via API. A responsabilidade fiscal é do salão/tomador do CNPJ, nunca do Luarys.
- Módulos fiscais existentes no código: `GavetaNFCe`, `GavetaNFSe`, `GavetaPDV`, `AbaFinanceiro` (ver skill `eleva-padroes` para convenções de código).
- Serviço de salão = **NFS-e** (municipal/nacional), não NF-e. NF-e/NFC-e só entram se o salão vender produtos (ex: revenda de cosméticos) via PDV.

## Checklist rápido — antes de responder sobre fiscal

1. É sobre **serviço** (corte, procedimento) → NFS-e → checar `01`.
2. É sobre **venda de produto no PDV** → NF-e/NFC-e → checar `02`.
3. Envolve **fluxo de caixa/pagamento** → checar `03` (split payment).
4. Envolve **escolha de provedor/API** → checar `04`.
5. Envolve **termos legais, contrato, responsabilidade** → checar `05`.
6. Nunca invente prazo ou campo técnico — se não estiver nas referências, diga que não tem certeza e sugira pesquisar antes de codificar.

## Como manter atualizada

Cada arquivo em `references/` tem uma linha `**Última verificação:**` no topo. Quando Ari pedir uma atualização, ou antes de uma decisão que dependa de prazo/layout:
1. Pesquisar o tema específico (não a área toda) — ex: "Nota Técnica NFS-e Nacional julho 2026".
2. Atualizar só o arquivo afetado, mantendo o resto intocado.
3. Atualizar a data de verificação daquele arquivo.

## Pendências conhecidas (registrar aqui, não deixar perder)

- **Conexão com Supabase do Luarys ainda não verificada por esta skill.** As referências de tipagem de coluna (`references/07-exemplos-tecnicos.md`) são recomendações genéricas, não uma auditoria real do schema. Assim que o conector Supabase estiver disponível numa sessão, rodar uma checagem em colunas `cnpj`/`chave_acesso` e atualizar este arquivo com o resultado real.
- **Decisão Focus NFe vs. Brasil NFe ainda em aberto** (ver `references/04-focus-vs-brasil-nfe.md`) — não há dado público verificado sobre compliance da Brasil NFe com o Ambiente Nacional/SEFIN. Assim que Ari decidir, registrar a escolha e o motivo diretamente naquele arquivo.
- **Casos de teste da skill ainda não foram rodados formalmente.** Se quiser rigor maior (útil antes de usar em decisão de contrato), pedir para rodar 5-6 prompts reais contra a skill e revisar as respostas.

## Changelog

- **01/07/2026**: criação da skill (SKILL.md + 06 referências). Description otimizada manualmente (sem `claude -p`, indisponível no claude.ai). Adicionado `07-exemplos-tecnicos.md` com payloads de referência.
