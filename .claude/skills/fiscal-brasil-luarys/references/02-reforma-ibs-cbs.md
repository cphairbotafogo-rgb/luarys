# Reforma Tributária — IBS/CBS na NF-e e NFC-e

**Última verificação:** 01/07/2026
**Fontes principais:** Ato Conjunto RFB/CGIBS nº 1 (22/dez/2025), Nota Técnica 2025.002 v.1.40, TOTVS Espaço Legislação, Financial Contabilidade

## Contexto legal

Emenda Constitucional 132/2023 + Lei Complementar 214/2025 criaram o **IVA Dual brasileiro**: IBS (Imposto sobre Bens e Serviços — estados/municípios) e CBS (Contribuição sobre Bens e Serviços — federal). Cronograma:
- **2026**: ano-teste, alíquota simbólica de 1% (0,9% CBS + 0,1% IBS), compensada com PIS/COFINS. Não aumenta a carga tributária — é validação de sistemas.
- **2027**: cobrança efetiva da CBS começa; Imposto Seletivo entra em vigor.
- **até 2032/2033**: transição gradual do IBS, substituindo ICMS e ISS por completo.

## O que muda no documento fiscal (relevante para GavetaNFCe/GavetaPDV)

Desde **1º/jan/2026**, NF-e e NFC-e precisam incluir, por força da Nota Técnica 2025.002:
- **Grupo UB** (tributação IBS/CBS) — novo bloco de campos no XML.
- **CSTs específicos de IBS e CBS** (diferentes dos CSTs de ICMS/PIS/COFINS já conhecidos).
- **Código `cClassTrib`** — classifica a operação dentro do novo sistema tributário. Sem ele corretamente preenchido, a nota é **rejeitada na origem** pelo SEFAZ.
- Campos monetários de CBS/IBS calculados usam tipo numérico Decimal(18,2).

Sem esses campos, a nota simplesmente não passa — não é uma penalidade futura, é rejeição imediata do documento.

## Cadastro de produtos/serviços

- **NCM** volta a ser determinante para produtos (risco de rejeição/autuação se errado).
- **NBS** (Nomenclatura Brasileira de Serviços) passa a ser referência para enquadramento de serviços — relevante mesmo para quem emite só NFS-e, porque o enquadramento por NBS tende a alimentar a mesma lógica de classificação tributária usada no cClassTrib.
- CFOPs precisam revisão para operações internas, interestaduais, importação e exportação.

## O que isso significa para o Luarys

- Se o salão revende produto (shampoo, cosmético) pelo PDV → emite NF-e/NFC-e → **precisa** desses campos novos desde jan/2026. Verificar se o provedor de nota fiscal (Focus/Brasil NFe) já suporta o grupo UB e cClassTrib antes de fechar contrato.
- Para serviço puro (a maioria dos salões) → é NFS-e, que também está recebendo os grupos "IBSCBS" no leiaute nacional (ver Nota Técnica do Comitê Gestor da NFS-e, com validade jurídica desde 5/jan/2026).
- Cálculo do IBS/CBS **não é responsabilidade do sistema emissor**: existe uma calculadora centralizada da RTC (Reforma Tributária do Consumo). Na prática, o ERP/PDV envia dados mínimos e a calculadora central devolve os valores — reduz a complexidade que precisaria estar no código do Luarys.

## Não confundir com Simples Nacional

Empresas do Simples Nacional continuam recolhendo pelo regime unificado (DAS) durante a transição — os campos de IBS/CBS aparecem no documento fiscal por exigência de padronização/apuração, mas isso não muda automaticamente o regime tributário do cliente. Ver contexto do Fator R/Anexo V já tratado no modelo de precificação do Luarys.
