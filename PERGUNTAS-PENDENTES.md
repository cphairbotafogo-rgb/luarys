# Perguntas pendentes

Atualizado em 07/08/2026. O que já foi respondido saiu da lista — o histórico
das respostas está no fim.

---

## Brasil NFe

**Todas respondidas em 07/08/2026.** Sobraram duas em análise do lado deles.

| # | Pergunta | Resposta |
|---|---|---|
| 1 | XML sobrevivem à exclusão da empresa? | **Sim** — por lei guardam 5 anos, e a consulta continua funcionando |
| 2 | Numeração recomeça ao reativar? | **Não** — volta a mesma série e numeração cadastradas |
| 3 | Cobrança proporcional? Data de corte? | Primeira ativação valor cheio, as seguintes **proporcionais**. **Cancelando antes do próximo ciclo, o boleto não é gerado** |
| 4 | NFS-e e NF-e/NFC-e são planos separados? | **Sim** — NF-e e NFC-e no mesmo plano; NFS-e em outro |
| 6 | Homologação sem assinar? | **Sim**, mas o ambiente deles vai direto para a homologação da SEFAZ: exige CNPJ válido e habilitado, Inscrição Estadual, certificado digital e, para NFC-e, **CSC de homologação** |
| 8 | Avisam do vencimento do A1? | **Sim**, por e-mail, para o endereço do cadastro da empresa |

**Em análise — mandar o CNPJ 17.326.293/0001-02 para eles:**

5. `ValorDeducoes` sai sem `vDedRed` no XML — *"Temos que analisar. Nos passe o
   CNPJ da empresa para análise aqui."*
7. `CodVerificacao` volta vazio para o Rio — mesma resposta: precisa do CNPJ.

**O que essas respostas mudam no sistema**

- A resposta 1 **destrava a exclusão automática**: não é preciso baixar e
  arquivar os XML antes de deletar a empresa. O `deletarEmpresa()` pode ser
  chamado direto.
- A resposta 3 diz **quando** chamar: assim que o período pago acabar, antes do
  ciclo seguinte. É exatamente o momento em que a régua já desativa o módulo.
- A resposta 8 tem uma consequência: cadastramos o `email_fiscal` **do salão**
  como contato, então o aviso de certificado vencendo vai para ele e **não para
  a Luarys**. Se quisermos saber antes do salão, precisa de outro caminho.

## Contabilidade

Perguntas secas, sem contexto de negócio.

### Sobre a LUARYS SOFTWARE E SISTEMAS LTDA (68.176.336/0001-43)

1. Em **qual anexo do Simples** a empresa está enquadrada hoje, III ou V? Qual o
   **Fator R** apurado no último período?
2. O que precisaria mudar na **folha ou no pró-labore** para o Fator R ficar
   acima de 28%?
3. A empresa passa a **revender a terceiros um serviço contratado de outro
   fornecedor**, cobrado dentro da mensalidade do sistema. Isso muda o
   enquadramento no **item 01.07** ou exige outro código de serviço?

### Sobre o Concept Prime Hair (17.326.293/0001-02)

4. **O `06.01.20` que a senhora passou substitui qual campo?**
   Nas notas já emitidas e aceitas, cabelo saiu com **nacional `060101`** +
   **municipal `005`**. O `06.01.20` entra no lugar do nacional ou do municipal?
   Hoje os 321 serviços estão com `060101` + `005`.
5. Como tratar a **Gorjeta**? Está cadastrada como serviço e é a única sem
   classificação nenhuma — sem setor, sem NBS, sem código municipal, alíquota 0.
   É repasse ao profissional ou receita do salão?
6. O **Regime Especial de Tributação** está como *"Microempresa ou EPP"*. É esse
   mesmo, ou qual dos códigos de 0 a 6 deve ir na nota?
7. Atendimento que mistura **cabelo e estética na mesma visita: uma nota ou
   duas?** Já ocorreram 27 casos.
8. Como declarar o **dono que também atende clientes**?
9. Qual **`cClassTrib` (IBS/CBS)** se aplica a cosmético revendido por optante do
   Simples? A SEFAZ-RJ rejeita nota sem esse campo desde 03/08. *(Só vale quando
   a NFC-e entrar — o salão ainda não vende produto com nota.)*
10. O comprovante estadual diz **"Optante Simei desde 2023"**, mas as NFS-e de
    julho saem como ME/EPP. O cadastro estadual precisa ser atualizado?

> Ela já avisou: *"sem ver as opções fica complicado"*. **Mandar print das listas
> suspensas** junto com as perguntas 4 e 6.

---

## Respondido — histórico

**Brasil NFe, 07/08/2026**
- **Preço:** a diretoria autorizou **NFS-e a R$ 49,90/mês por CNPJ** (valor da
  última Black Friday, igualado ao da NF-e). Custo por salão: R$ 49,90 só com
  NFS-e, R$ 99,80 com os dois.
- **Suspensão não existe:** *"precisa deletar a empresa do sistema. Se precisar
  reativar depois é possível também."* Parar de pagar por um CNPJ =
  `empresa.deletarEmpresa()`. Reativar é recadastrar — e como não guardamos
  certificado nem senha, o salão precisa subir o A1 de novo. Isso tem que estar
  escrito na tela de cancelamento.

**Contabilidade (Márcia), 05/08/2026**
- **ISS 5%** → aplicado em `aliquota_padrao` e em 321 serviços.
- **PIS e COFINS não saem ainda** → ambos em `0.00`.

**Resolvido sem precisar perguntar, 07/08/2026**
- **Classificação NBS.** Conferida por Ari contra a NBS oficial do MDIC
  (Portaria Conjunta 1.820/2013), as Notas Explicativas e o Anexo VIII da NFS-e.
  Os códigos dizem sozinhos a que serviço servem. Resultado: cabeleireiro
  `126021000`; manicure, pedicure, podologia, sobrancelha, micropigmentação e
  estética facial `126022000`; depilação `126029000`; bem-estar (spa, sauna,
  massagem) `126023000`, sem uso hoje. Aplicado em 110 cadastros e embarcado na
  tabela `nbs_catalogo` para todos os salões escolherem da lista.
- **Código municipal `060104`.** Não existe mais — os 321 serviços estão todos
  em `005`. Saiu da lista de pedidos à prefeitura.
