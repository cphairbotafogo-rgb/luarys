# Focus NFe vs. Brasil NFe — comparativo para decisão do Luarys

**Última verificação:** 30/07/2026
**Fontes principais:** focusnfe.com.br, notaas.com.br (comparativos de mercado 2026), nfe.io/blog, brasilnfe.com.br/docs (SDK oficial `brasilnfe` no npm + doc pública, confirmado em 30/07/2026)

## ✅ Decisão registrada (30/07/2026)

**Ari decidiu: Brasil NFe é o único provedor de NFS-e da plataforma.** Focus NFe não será usado.

Contexto que embasou a decisão: nenhum salão tinha `focus_nfe_token` configurado (Focus NFe nunca chegou a emitir nota real), e 4 dos 5 salões já estavam com `config_fiscal.provedor_nfse = 'brasilnfe'` de uma configuração anterior — inclusive o piloto real (Concept Prime Hair, `modulo_fiscal_liberado = true`). Como nada estava emitindo nota de verdade ainda, não havia migração a fazer nem risco de quebrar fluxo em produção.

Passos em andamento: UserToken (conta master Luarys) configurado em `Admin → NFS-e Luarys`, ambiente `sandbox` até validar o cadastro de empresa (`POST /company` via `/api/admin/brasilnfe/cadastrar`) com o piloto real antes de qualquer salão ir para `producao`.

Os itens da seção "Pontos a verificar diretamente com a Brasil NFe antes de decidir" abaixo **continuam válidos como checklist de validação técnica** (compliance Ambiente Nacional, DANFSe v2.0, CNPJ alfanumérico etc.) — decidir o provedor não dispensa confirmar esses pontos antes de qualquer salão emitir em produção.

## ✅ Integração real confirmada (30/07/2026) — API, headers e modelo de token

Testado de ponta a ponta contra o SDK oficial `brasilnfe` (npm) + doc pública (brasilnfe.com.br/docs). O código do Luarys usava URL/headers/endpoints **adivinhados** numa sessão anterior — todos errados. Modelo real:

- **URL única**: `https://api.brasilnfe.com.br/services/` (sandbox e produção — não existe subdomínio de homologação; `homologacao.brasilnfe.com.br` não existe no DNS, confirmado via `vercel logs`).
- **Ambiente é um campo do payload** (`TipoAmbiente: 1` produção / `2` homologação), não a URL.
- **Dois headers de auth**: `Token` (por empresa/CNPJ, usado pra emissão) + `UserToken` (conta master Luarys, usado só pra gerenciar empresas — cadastrar/editar/listar/certificado).
- **Cadastro de empresa** (`POST .../Empresa/AdicionarEmpresa`, com `UserToken`) devolve um `token` exclusivo daquela empresa — é esse token, não um "CompanyToken" genérico, que fica salvo em `saloes.config_fiscal.brasilnfe_company_token`. Exige `Endereco` com `Cep` preenchido (a doc lista como opcional, mas a API recusa sem isso — testado com erro real "Não foi informado o CEP da empresa").
- **Certificado A1** (`AlterarCertificado`) exige o `Token` da empresa (não o `UserToken`) — só funciona depois do cadastro. Campo do payload é `Base64CertificateFile` (não `Base64Certificado`, como a doc em prosa sugere — o `.d.ts` do SDK é a fonte confiável aqui).
- Implementado em `src/lib/nfse/brasilnfe.ts` (`cadastrarEmpresaLuarys`, `submeterCertificadoA1`) — cadastro roda automaticamente quando o salão compra o módulo `nfse`/`nfce` (hook em `src/lib/assinaturas.ts`, disparado pelo webhook Asaas).
- **`emitir`/`consultar`/`cancelar` (emissão de nota de verdade) ainda NÃO foram reescritos contra esse modelo real** — continuam com endpoint adivinhado, vão falhar se chamados. A API real devolve XML/PDF em **base64 no corpo da resposta** (não como link) — decidir onde armazenar (Supabase Storage) antes de implementar.

## ⚠️ Pendência de negócio (não é técnica): ativação paga por CNPJ

Pesquisa em 30/07/2026 encontrou um método `GerarLinkAtivacao` na API/SDK (grupo "Empresas") que gera um link de checkout (processado pela **Fintely**, mesma empresa do fundador da Brasil NFe) para contratar o plano daquele CNPJ especificamente. Preços públicos (brasilnfe.com.br/#precos): ~R$49,90/mês por CNPJ para NF-e/NFC-e, ~R$24,90/mês para MDF-e — **por CNPJ cadastrado**, não uma taxa única da integradora.

Isso significa que **cadastrar um salão (`AdicionarEmpresa`) não ativa emissão de produção sozinho** — cada CNPJ pode precisar dessa ativação paga separada antes de emitir nota real. Não testamos ainda se isso bloqueia emissão em `TipoAmbiente: 2` (homologação/sandbox) ou só em produção.

**Isso afeta diretamente o modelo de precificação do Luarys** — se a Luarys paga esse valor por salão ativo, precisa entrar na conta de ponto de equilíbrio (a mesma citada no item 5 da seção anterior). Ari precisa decidir: repassar esse custo no preço do módulo NFS-e/NFC-e pro salão, ou absorver como custo fixo da Luarys. Confirmar com o suporte da Brasil NFe (contato@brasilnfe.com.br / WhatsApp (31) 97168-5947) antes de escalar o cadastro automático para muitos salões.

> **Nota de honestidade**: não encontrei documentação técnica pública recente e específica da Brasil NFe (cobertura de municípios, suporte a IBS/CBS) equivalente ao que a Focus NFe publica. O que está acima é o que dá para afirmar com confiança das fontes verificadas — o resto (KYC de integrador em alto volume, se `GerarLinkAtivacao` bloqueia sandbox) fica marcado como "a confirmar diretamente com o provedor" antes de escalar.

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
