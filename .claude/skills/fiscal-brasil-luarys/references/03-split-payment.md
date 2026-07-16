# Split Payment — impacto no caixa e no PDV

**Última verificação:** 01/07/2026
**Fontes principais:** Ministério da Fazenda (Ato Conjunto RFB/CGIBS nº 2, jun/2026), Thomson Reuters/OneSource, e-Auditoria, Bank Manager

## O que é

O **Split Payment** (pagamento fracionado/segregado) é o mecanismo que faz a parte de IBS/CBS de uma venda ser desviada **automaticamente pelo sistema financeiro** (banco, cartão, Pix, boleto) direto para o Fisco, no momento do pagamento — em vez de o vendedor receber o valor cheio e recolher o imposto depois.

Exemplo prático: venda de R$100 com alíquota-teste de 1% → nota sai em R$101. Na hora do pagamento, o sistema de pagamento já separa: R$100 vai para o salão, R$1 vai direto para o Fisco. O salão nunca vê esse R$1 passar pelo caixa.

## Cronograma

- **2026**: fase de testes/ensaio geral, com as mesmas alíquotas simbólicas de 0,9% CBS + 0,1% IBS. Split payment sendo testado em operações reais, mas ainda não é regra geral obrigatória para todo mundo.
- **03/jun/2026**: RFB e Comitê Gestor do IBS publicaram o Manual de Integração e Swagger da Plataforma Pública do Split Payment (Ato Conjunto RFB/CGIBS nº 2/2026) — documentação técnica já disponível publicamente, direcionada a instituições de pagamento.
- **2027 em diante**: cobrança efetiva começa a valer.
- **Até 2033**: implementação plena.

## Quem precisa se adaptar tecnicamente

- **PSPs e adquirentes** (maquininhas, gateways de pagamento): obrigados a integrar seus sistemas de liquidação à API da Plataforma Pública para segregar o tributo na raiz da transação.
- **Empresas/fornecedores** (o salão): deixam de recolher CBS/IBS ativamente via DARF/guia — o valor já vem separado. Isso impacta o **fluxo de caixa**: a empresa não pode mais usar o valor do tributo como capital de giro entre a venda e o pagamento do imposto, porque esse valor nunca chega a entrar na conta.
- **Desenvolvedores** (Luarys): não precisa implementar a segregação em si (isso é responsabilidade do PSP/adquirente/banco), mas o **PDV e o módulo financeiro precisam refletir corretamente o valor líquido esperado** por venda, para não gerar divergência no fechamento de caixa.

## O que isso significa para o AbaFinanceiro / GavetaPDV do Luarys

- Quando o split payment entrar em vigor de fato (2027+), o valor que efetivamente cai na conta do salão será **líquido de tributo** — o fechamento de caixa diário precisa saber diferenciar "valor da venda" de "valor líquido recebido" para não parecer que está faltando dinheiro.
- Ainda não é urgente implementar isso — 2026 é teste, o salão não perde capital de giro de verdade ainda. Mas vale já desenhar o modelo de dados do financeiro pensando nessa distinção (bruto vs. líquido por transação), para não precisar de retrabalho estrutural em 2027.
- Chaves de identificação técnicas usadas no back-end de pagamento (`txId` para Pix, `numCtrlTED`, `numCtrlTEF`) não são responsabilidade do Luarys — ficam a cargo do PSP/adquirente que o salão usa.

## Modalidades previstas

Três formas de operacionalização (ainda em definição fina): completo on-line (com abatimento automático de créditos), completo off-line (retenção temporária se o sistema falhar), e simplificado (retenção por média de carga tributária definida pelo Fisco). Nenhuma delas exige mudança de código no Luarys — é infraestrutura bancária.
