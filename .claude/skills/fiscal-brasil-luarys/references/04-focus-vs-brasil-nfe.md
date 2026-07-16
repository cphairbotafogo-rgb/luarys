# Focus NFe vs. Brasil NFe — comparativo para decisão do Luarys

**Última verificação:** 01/07/2026
**Fontes principais:** focusnfe.com.br, notaas.com.br (comparativos de mercado 2026), nfe.io/blog

> **Nota de honestidade**: não encontrei documentação técnica pública recente e específica da Brasil NFe (planos, cobertura de municípios, suporte a IBS/CBS) equivalente ao que a Focus NFe publica. O que está abaixo é o que dá para afirmar com confiança das fontes verificadas — o resto fica marcado como "a confirmar diretamente com o provedor" antes de fechar contrato.

## O que qualquer provedor de nota fiscal faz

Funciona como intermediário entre o sistema do Luarys e a SEFAZ/prefeitura/Ambiente Nacional: recebe os dados via API REST (JSON), calcula/valida, envia, e devolve o documento autorizado (XML + PDF). O objetivo é o Luarys nunca falar diretamente com a SEFAZ.

## Focus NFe — o que está documentado

- Cobertura declarada: integração com **mais de 1.300 prefeituras**, mais de 860 milhões de notas processadas, mais de 33 mil empresas atendidas.
- Suporta **NF-e, NFC-e, NFS-e, CT-e, MD-e, MDF-e, NFCom** numa única API.
- API REST, JSON, qualquer linguagem que faça HTTP.
- Guia técnico específico para emissão de NFS-e no **Ambiente Nacional** (o que interessa diretamente para o prazo de set/2026) — inclusive com exemplo de payload de DPS (Declaração de Prestação de Serviço), incluindo `codigo_opcao_simples_nacional`, `codigo_nbs`, `codigo_tributacao_nacional_iss`.
- Sem fidelidade contratual mínima — segundo o próprio site, cliente pode cancelar quando quiser.
- Suporte via ticket, time formado por profissionais de tecnologia.

## Pontos a verificar diretamente com a Brasil NFe antes de decidir

Como não há fonte pública equivalente e verificada nesta pesquisa, confirmar com o provedor (ou testar em homologação) antes de comprometer a arquitetura do Luarys:

1. **Compliance explícito com o Ambiente Nacional/SEFIN** para o prazo de 1º/set/2026 (Resolução CGSN 189/2026) — pedir declaração ou documentação técnica direta.
2. Suporte ao **grupo UB / cClassTrib** (campos de IBS/CBS) na NF-e/NFC-e, obrigatórios desde jan/2026.
3. Suporte ao **DANFSe v2.0** e se a geração do PDF é responsabilidade do provedor ou fica com o Luarys, considerando que a API nacional de geração do DANFSe foi suspensa em 01/07/2026 (ver `06-alertas-urgentes.md`).
4. Tratamento do **CNPJ alfanumérico** (chave de acesso, validação, tipagem) — em vigor em produção desde 01/07/2026.
5. Modelo de custo por nota emitida vs. por assinatura mensal — decisivo no ponto de equilíbrio de 6-7 salões pagantes já mapeado no modelo de precificação do Luarys.
6. SLA de suporte e histórico de disponibilidade (uptime) da API — crítico porque falha na emissão trava o fechamento de caixa do salão no PDV.

## Critérios gerais de mercado para escolher provedor de API fiscal em 2026

Segundo análises de mercado (Notaas, nfe.io), os critérios que mais diferenciam provedores hoje são:
- Cobertura nacional real (a NFS-e ainda depende de integração cidade a cidade nos municípios que não migraram ao Ambiente Nacional).
- Webhooks nativos para retorno assíncrono de status da nota — importante para o Luarys não deixar o PDV travado esperando resposta síncrona.
- Painel white label — relevante se o Luarys quiser oferecer visão da nota fiscal dentro do próprio Portal do Cliente/AbaFinanceiro sem expor a marca do provedor.
- Arquivamento do XML por 11 anos (132 meses) — obrigatório desde o Ajuste SINIEF nº 2/2025; confirmar se o provedor já faz isso automaticamente ou se fica sob responsabilidade do Luarys armazenar.
- Modelo freemium/teste antes de comprometer contrato — útil para validar em ambiente de homologação antes de decidir.

## Recomendação de processo (não é recomendação de provedor)

Dado que a decisão está em aberto: montar uma tabela de teste em ambiente de homologação com os dois provedores, usando os mesmos 5 itens acima como critério objetivo, antes da decisão final — em vez de decidir por reputação de mercado. A Focus NFe tem documentação técnica pública verificável agora; a Brasil NFe precisa ser verificada diretamente (pedir manual técnico e declaração de compliance com o prazo de set/2026 por escrito).
