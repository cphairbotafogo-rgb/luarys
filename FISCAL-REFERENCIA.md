# Fiscal — estrutura confirmada

Como a emissão de nota funciona no Luarys **hoje, verificado contra dados reais**.
Serve para consertar sem chutar quando algo quebrar.

Cada afirmação aqui foi conferida em 07/08/2026 contra o banco de produção, os
XML autorizados ou a API. O que **não** foi verificado está na última seção, com
o nome de "não confirmado" — não misture os dois.

Legislação e prazos ficam na skill `fiscal-brasil-luarys`. Aqui é só a nossa
implementação.

---

## 1. Quem emite

**Brasil NFe é o único provedor.** A Focus NFe foi removida do sistema em
30/07/2026 — se encontrar menção a ela em comentário ou documento, está velho.

Dois tokens, e confundi-los é o erro mais comum:

| Token | Onde vive | Para quê |
|---|---|---|
| **UserToken** | `plataforma_nfse_config.token_brasilnfe` ou `BRASIL_NFE_USER_TOKEN` | Master da Luarys. Só para **cadastrar empresa** |
| **companyToken** | `saloes.config_fiscal.brasilnfe_company_token` | Um por CNPJ. Emite, consulta, cancela, sobe certificado |

O companyToken nasce do `adicionarEmpresa` e é gravado em `config_fiscal`.
Sem ele, nenhuma emissão acontece.

**Ambiente** vem de `plataforma_nfse_config.ambiente` (`producao` → `TipoAmbiente: 1`,
qualquer outra coisa → `2`). O padrão é homologação, de propósito: nunca
codificar produção.

---

## 2. Os códigos do Concept Prime Hair

Confirmados contra 488 notas que a prefeitura aceitou.

| Campo | Valor | Vale para |
|---|---|---|
| `cTribNac` (nacional) | `060101` | **todos** os 322 serviços |
| `cTribMun` (municipal) | `005` | **todos** |
| Alíquota configurada | `5%` | todos menos a Gorjeta |

**Não dividir por item da LC 116.** O `005` é o código do salão-parceiro optante
pelo Simples (Lei 12.592/2012) e cobre a operação inteira — cabelo, manicure,
pedicure, depilação, estética. Foi a divisão `060201 + 060220` que gerou a
rejeição **E0314**. Sobrevivem 10 notas antigas com essa divisão: são o erro
corrigido, não o padrão a seguir.

O **NBS é o outro eixo** — ele descreve a atividade, então segue a classe:

| Classe | NBS | Serviços |
|---|---|---|
| Cabeleireiro(a) | `126021000` (1.2602.10.00) | 167 |
| Manicure · Nail Designer · Podologia | `126022000` (1.2602.20.00) | 44 |
| Estética · Sobrancelha | `126022000` | 40 |
| Depilação | `126029000` (1.2602.90.00) | 70 |
| *(bem-estar: spa, sauna, massagem)* | `126023000` (1.2602.30.00) | sem uso |

Fonte: Portaria Conjunta RFB/SCS 1.820/2013 (MDIC). A tabela vive em
`nbs_catalogo` — a tela lê de lá, com cópia de socorro no código.

**Alíquota 5% sai 0% na nota, e está certo.** Quem zera é o ambiente nacional,
porque o ISS do Simples vai no DAS. São camadas diferentes, não conflito. Não
"consertar" isso.

---

## 3. O XML é a fonte, não o JSON

**A descoberta que mais custou.** A resposta JSON da Brasil NFe **não traz**
`Chave`, `CodVerificacao` nem `Valores.*`. Ler de lá deixou 485 de 486 notas sem
chave de acesso.

O XML autorizado (padrão nacional, `xmlns="http://www.sped.fazenda.gov.br/nfse"`)
tem tudo:

| No XML | Vira | Exemplo |
|---|---|---|
| `infNFSe/@Id` | `chave_acesso` | `NFS` + 50 dígitos |
| `nNFSe` | `numero_nota` | `12` |
| `dhProc` | `data_emissao` | `2026-08-04T23:11:39-03:00` |
| `nDFSe` | `protocolo_sefaz` | `537928` |
| `nDPS` | `rps_numero` | `12` |
| `cStat` | autorizado quando `100` | |
| `vServPrest/vServ` | `base_calculo` | `199.00` |
| `trib/totTrib/vTotTrib/vTotTribMun` | `valor_iss` | `0.00` |

Quem extrai: `lerXmlNFSe()` em `src/lib/nfse/brasilnfe.ts`. Por expressão
regular, porque a estrutura é fixa por leiaute.

**`codigo_verificacao` não é preenchido de propósito** — não existe no padrão
nacional, é campo da Nota Carioca. Quem faz esse papel é a chave.

### A chave de acesso

50 dígitos, com estrutura fixa:

```
3304557 2 17326293000102 000000000002026082076870796
└IBGE─┘ │ └───CNPJ────┘  └──── sequencial + verificador ────┘
        └ ambiente (2 = homologação)
```

**A DANFSe não é nossa para gerar.** Ela vive no portal nacional, e a chave
abre:

```
https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=<chave_acesso>
```

O botão "Portal nacional" em `GavetaNFSe.tsx` já monta esse link. Ele só aparece
quando há chave — foi por isso que ficou invisível enquanto a chave não era
gravada. Em homologação o provedor não devolve PDF, e a API nacional de geração
do DANFSe está suspensa: **o link é o caminho**, não um plano B.

Três caminhos independentes para a mesma nota, e nenhum depende dos outros:
o XML assinado no nosso bucket, a chave no banco, o portal nacional.

---

## 4. Onde cada coisa mora

| Tabela | Guarda |
|---|---|
| `notas_fiscais` | **NFS-e** (serviço). Criada em `lancarOS.ts` |
| `nfce_emissoes` | **NFC-e** (produto/PDV). Tabela própria |
| `nbs_catalogo` | NBS oficial, referência nacional |
| `codigos_municipais_aceitos` | O que cada prefeitura já aceitou — aprendizado por município |
| `plataforma_nfse_config` | UserToken e ambiente da plataforma |
| `saloes.config_fiscal` | JSONB por salão: companyToken, alíquota, regime, ambiente |

A NFC-e **não** grava em `notas_fiscais` de propósito: a cota mensal conta linhas
dessa tabela, e produto não deve consumir cota de serviço.

**Bucket `notas-fiscais`, privado.** Caminho `nfse/<id-da-nota>.xml`. Testado:
anônimo não lista nem baixa, e a URL pública devolve 400. O acesso é pela rota
`/api/nfse/arquivo/[notaId]`, que confere a posse e gera URL assinada.

### Status da nota

| Status | O que significa | Pode reemitir? |
|---|---|---|
| `Não Emitido` | nunca foi | sim |
| `Pendente` | está com a prefeitura, ou não sabemos | **não** — consultar antes |
| `Emitida` | autorizada | não |
| `Erro` | recusada, com motivo | sim |
| `Cancelada` · `Dispensada` · `Histórico` | fora do fluxo | não |

---

## 5. As proteções, e por que existem

Cada uma nasceu de um defeito real. Não remova sem entender qual.

**Timeout não vira `Erro`.** O `catch` da emissão devolve `processando`. Se
virasse `Erro`, a nota ficaria reemitível — e se a Brasil NFe tivesse aceitado e
a resposta se perdesse, o reenvio emitiria uma **segunda nota do mesmo serviço**.

**E `Pendente` sem lote tem saída.** `consultarPorIdentificador()` procura pelo
`IdentificadorInterno` que mandamos na emissão. Descobre qual dos três é o caso:
não chegou (volta para `Não Emitido`), chegou e foi autorizada (grava o lote),
ou foi cancelada. Sem isso, a proteção acima só trocaria duplicidade por nota
travada.

> O SDK escreve `IndentificadorInterno`, com um "n" a mais. É a grafia deles;
> corrigir quebra a busca.

**Emissão bloqueada para empresa excluída.** `config_fiscal.brasilnfe_excluido_em`
barra em `/api/nfse/emitir` e `/api/nfce/emitir`. O `brasilnfe_company_token` é
**preservado** na exclusão — é ele que consulta as notas já emitidas, e a guarda
é de 5 anos.

**Toda rota confere posse.** `autenticarRota` + filtro por `salao_id`, inclusive
antes de falar com o provedor. Resposta 404 igual para "não existe" e "não é
sua".

**Cota mensal** conta `Emitida` + `Pendente` do mês, com o mês começando em
horário de Brasília. Pendente conta porque já foi para a prefeitura; e as datas
vêm de colunas diferentes (`data_emissao` e `data_criacao`), porque nota pendente
ainda não tem data de emissão.

**Numeração da NFC-e** é atômica, por RPC `obter_proximo_numero_nfce`. Nunca ler
e atualizar em dois passos.

**Dedução nunca passa do valor do serviço.** Havia trava na nossa
`base_calculo`, mas não no `ValorDeducoes` enviado — e quem refaz a conta é a
prefeitura. A nota 469 do piloto saiu com serviço de R$ 79,01 e dedução de
R$ 206,60: base negativa do lado deles, declarando repasse maior que a receita.

---

## 5-A. Gorjeta

**100% do profissional, líquida da taxa da maquininha** (Ari, 07/08/2026). Quem
recebeu no cartão foi o salão, e ele não paga do próprio bolso para intermediar
gorjeta de outra pessoa. No Pix a taxa é zero, então vai o valor cheio.

**Fica fora da NFS-e**, tratada como repasse: gorjeta integralmente repassada
não é receita do salão. Se entrasse na nota, inflaria o faturamento, empurraria
a faixa do Simples e distorceria o denominador do Fator R. Lançada como
recebível em `comissao_extras`.

Por isso **não tem código de serviço** — não é serviço do salão, é dinheiro
passando.

> **Consequência que precisa de resposta da contabilidade:** o salão recebe
> R$ 110 no cartão e emite nota de R$ 100. As operadoras reportam as transações
> ao fisco, e a diferença aparece. Duas saídas legítimas: a gorjeta entra na nota
> e é deduzida como cota-parte (só vale para **parceiro com CNPJ** — no piloto,
> 2 dos 3 profissionais), ou fica fora e o repasse é registrado contabilmente. A
> terceira, mais limpa, é o cliente pagar direto ao profissional: o salão não
> intermedeia, não paga taxa e não há discrepância.

**Cuidado:** o serviço "Gorjeta" continua cadastrado, com preço zero e sem
códigos. Nunca gerou nota, mas é o caminho que a transformaria em receita se
alguém puser preço nele.

---

## 6. Como consertar quando quebrar

Todos em `scripts/conferencia/`, todos com ensaio antes de `--aplicar` e backup
carimbado.

| Situação | Script |
|---|---|
| Notas sem chave, protocolo, base ou ISS | `recuperar-chave-do-xml.mjs` — relê os XML do bucket |
| NBS fora da classe | `classificar-nbs-por-classe.mjs` |
| Conferir o catálogo NBS | `testar-catalogo-nbs.mjs` |
| Qual código a prefeitura aceita | consultar `codigos_municipais_aceitos` |

**Regra que custou três reversões:** só alterar cadastro fiscal com a tela ou a
NFS-e à vista. Teste contra a API não serve para escolher código — ela aceitou
`005`, `060120` e `060104` indistintamente para o item 6.01.

E **nota histórica não arbitra**: o NBS não é validado na emissão, então "foi
aceito" não prova que está certo. Antes de usar nota antiga como fonte, pergunte
se aquele campo é validado.

---

## 7. Não confirmado

Não trate como verdade.

- **`storage_path_pdf` está em 0 de 487.** Em homologação o provedor não devolve
  `Base64Doc`. Se devolve em produção, ninguém verificou — e pelo item 3, não
  precisamos.
- **`deletarEmpresa()` nunca foi executado de verdade.** Os testes provam
  *quando* a chamada acontece, não que a Brasil NFe aceita. Na primeira exclusão
  real, conferir se a consulta às notas antigas continua funcionando com o token
  preservado.
- **`vDedRed`** — mandamos `ValorDeducoes` e o XML sai sem a dedução. Em análise
  na Brasil NFe (CNPJ enviado).
- **O `06.01.20` da contabilidade** — não se sabe se substitui o nacional
  `060101` ou o municipal `005`. Ver `PERGUNTAS-PENDENTES.md`.
- **A cota-parte na nota é a comissão, e os percentuais baixos são propositais.**
  A dedução (`gDed`) vem de `notas_fiscais.valor_cota_profissional`, que espelha
  `comissoes.valor_comissao`. No piloto, 205 comissões estão em 1% e 202 em 0% —
  **definido pelo Ari**, não é erro. Então a dedução ser pequena está certa.

  > Eu já errei duas vezes aqui: primeiro afirmei que a tabela `comissoes` estava
  > vazia (a consulta pedia a coluna `percentual`, que não existe — a real é
  > `porcentagem_comissao` — e falhou em silêncio), depois classifiquei os 1%
  > como dado ruim da importação. Antes de chamar um percentual de errado,
  > perguntar: a regra de comissão é do dono do salão.

  O que continua valendo conferir antes da produção: se o repasse real ao
  profissional-parceiro for maior que a comissão lançada, a nota deduz menos do
  que poderia — isso não é risco com o fisco, é imposto pago a mais pelo salão.
- **Gorjeta paga à parte** não tem como ser registrada — o fluxo só cobre "o
  cliente pagou a mais e deixou o troco". Pix separado para gorjeta exigiria
  outra tela.
- **Nenhum salão emitiu em produção.** Tudo acima vale para homologação
  (`ambGer: 2` nos XML). Antes de virar a chave, reler esta seção inteira.
