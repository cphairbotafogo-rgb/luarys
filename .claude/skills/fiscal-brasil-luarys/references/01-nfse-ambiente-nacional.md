# NFS-e — Ambiente Nacional / Emissor Nacional (SEFIN)

**Última verificação:** 01/07/2026
**Fontes principais:** Portal da NFS-e (gov.br/nfse), Resolução CGSN nº 189/2026, comunicado Prefeitura de São Paulo (mai/2026), Contábeis.com.br

## O que é

O **Ambiente Nacional da NFS-e** é uma iniciativa da Receita Federal com a Abrasf para unificar os mais de 100 layouts municipais de nota fiscal de serviço em um único padrão, armazenado em um **Ambiente de Dados Nacional (ADN)**. A emissão passa a poder ocorrer pelo **Emissor Nacional**, via:
- Portal web (emissor de NFS-e web), ou
- Integração por **API com a SEFIN Nacional** — este é o caminho relevante para o Luarys.

## Prazos que importam para o Luarys

- **1º/jan/2026**: municípios e DF obrigados a autorizar emissão pelo Ambiente Nacional (ou manter emissor próprio, desde que compartilhem os dados no leiaute padronizado com o ADN).
- **1º/ago/2026**: profissionais liberais/autônomos isentos (Lei 14.864/2008) passam a usar obrigatoriamente o Emissor Nacional.
- **1º/set/2026**: **ME e EPP optantes pelo Simples Nacional obrigadas a emitir NFS-e exclusivamente pelo Emissor Nacional** (Resolução CGSN nº 189/2026, publicada 28/abr/2026). **Este é o prazo que afeta praticamente todos os clientes-alvo do Luarys.**

Importante: a obrigatoriedade do Simples vale **mesmo que o município do salão não tenha aderido ao padrão nacional** — é regra federal, independente da prefeitura local. Não assumir que "minha cidade ainda não migrou, então não preciso me preocupar".

## O que isso significa na prática para o Luarys

- Depois de 1º/set/2026, uma integração de NFS-e que dependa só do sistema municipal antigo vai parar de funcionar para clientes Simples Nacional.
- O caminho tecnicamente correto é a **API SEFIN Nacional** direta, ou um provedor (Focus NFe / Brasil NFe) que já tenha essa integração pronta — ver `04-focus-vs-brasil-nfe.md`.
- Notas emitidas nos sistemas municipais antigos **antes** da data de corte continuam válidas; a obrigatoriedade vale só para emissões novas a partir da data.
- Autenticação no Emissor Nacional é via conta **Gov.br**.

## Casos de exceção (ainda pelo Emissor Nacional)

A Resolução CGSN 189/2026 também obriga o uso do Emissor Nacional quando:
- A opção pelo Simples Nacional está pendente/em discussão administrativa que possa gerar inclusão retroativa;
- A empresa está sob impedimento por sublimite de receita bruta acumulada.

## Restrição importante

A NFS-e **não pode ser usada em operações sujeitas apenas a ICMS** (venda de mercadoria). Para salões que revendem produtos via PDV, isso continua sendo NF-e/NFC-e — ver `02-reforma-ibs-cbs.md`.

## Penalidade para município que não aderir ao ADN

Suspensão das transferências voluntárias da União a partir de jan/2026 — não afeta o Luarys diretamente, mas explica por que a adesão municipal está acelerando (Salvador, Recife, BH e dezenas de outras já formalizaram integração).
