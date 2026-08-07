# Perguntas pendentes

Atualizado em 07/08/2026. O que já foi respondido saiu da lista — o histórico
das respostas está no fim.

---

## Brasil NFe

**As três primeiras vieram da resposta de hoje ("para parar a cobrança, deletar
a empresa"). A primeira é a mais importante da página.**

1. **As notas já emitidas continuam consultáveis depois de deletar a empresa? Os
   XML continuam disponíveis?**
   Guarda fiscal é de 5 anos. Se a exclusão levar o histórico junto, o sistema
   precisa **baixar e arquivar todos os XML antes** de excluir — é uma
   implementação bem diferente, e não dá para programar a exclusão sem isso.
2. **Ao reativar um CNPJ, a numeração das notas recomeça?** Numeração repetida é
   rejeição na prefeitura.
3. **A cobrança é proporcional ou por mês cheio? Existe data de corte** no mês
   para deletar e não entrar no ciclo seguinte?
4. A assinatura de NFS-e e a de NF-e/NFC-e são **mesmo separadas**, ou existe
   pacote fechado?
5. Enviamos `ValorDeducoes` em `Valores` e o XML sai **sem `vDedRed`**. Como se
   informa a dedução da cota-parte do salão-parceiro (Lei 13.352)?
6. Dá para **liberar NF-e/NFC-e só em homologação**, sem assinar? Nem a
   pré-visualização passa hoje, e ela não toca a SEFAZ.
7. O **`CodVerificacao` volta vazio** para o Rio — é do município ou falta
   configurar algo do nosso lado?
8. **Vocês avisam do vencimento do certificado A1?** Com quanta antecedência?

---

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
