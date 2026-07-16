# ⚠️ Alertas urgentes — mudanças em vigor agora

**Última verificação:** 01/07/2026
**Fontes principais:** Nota Técnica nº 008 SE/CGNFS-e (05/mai/2026), Nota Técnica Conjunta DF-e 2025.001 (ENCAT) e NT 2026.004, blog Motor Fiscal

Este arquivo existe porque duas mudanças técnicas **entram em vigor exatamente em 1º/jul/2026** — ou seja, hoje, na data em que esta skill foi verificada. Ambas quebram integrações silenciosamente se não forem tratadas. Merecem prioridade se o Luarys já tiver qualquer integração fiscal em produção ou em desenvolvimento avançado.

## 1. CNPJ alfanumérico — produção a partir de hoje (1º/jul/2026)

A Receita Federal (IN RFB 2.229/2024) começa a emitir CNPJs com **letras maiúsculas** a partir de hoje. Isso afeta a **chave de acesso da NF-e/NFC-e** (44 caracteres): as 12 posições centrais, que hoje são só números, passam a aceitar `[A-Z0-9]`.

**Onde isso pode quebrar no Luarys, se houver módulo de NF-e/NFC-e:**
- Qualquer regex de validação tipo `\d{14}` (CNPJ) ou `\d{44}` (chave de acesso) precisa virar `[A-Z0-9]`.
- Colunas de banco tipadas como `BIGINT`/`NUMERIC` para CNPJ ou chave de acesso **não comportam mais o dado** — precisam virar `VARCHAR`/`CHAR`. No Supabase/Postgres, checar se algum campo `cnpj` ou `chave_acesso` está como tipo numérico.
- **Risco mais traiçoeiro**: qualquer rotina de conciliação que faça cast implícito para número (`parseInt`, `CAST AS BIGINT`, "tira máscara e vira número") quebra silenciosamente quando o CNPJ tiver letra — sem erro visível, só divergência de fechamento.
- O dígito verificador do CNPJ alfanumérico usa algoritmo novo (módulo 11, valor = ASCII − 48). Se o Luarys valida CNPJ localmente antes de mandar pro provedor, o validador precisa ser atualizado (é retrocompatível com CNPJs numéricos antigos).

**NFS-e Nacional**: ainda **sem nota técnica publicada** sobre CNPJ alfanumérico até a última verificação. O campo de Inscrição Federal na chave da NFS-e (50 caracteres) já é tratado como string, então a expectativa é que resolva sozinho — mas trate como ponto de atenção, não como resolvido.

**Ação prática**: se o Luarys ainda não emite NF-e/NFC-e (caso mais comum hoje, já que a maioria dos salões é serviço puro/NFS-e), isso não é urgente. Vira urgente no dia em que o PDV do salão emitir NF-e/NFC-e de produto para um cliente/fornecedor com CNPJ novo.

## 2. DANFSe v2.0 e suspensão da API nacional de geração — hoje (1º/jul/2026)

A Nota Técnica nº 008 do Comitê Gestor da NFS-e redesenhou o **DANFSe** (documento impresso/PDF da NFS-e, equivalente ao DANFE da NF-e) e, principalmente:

> A partir de hoje, a API nacional que gerava o PDF do DANFSe **é suspensa**. Gerar esse PDF passa a ser responsabilidade de cada emissor/ERP/software fiscal.

**O que muda no documento (se o Luarys algum dia gerar o PDF em vez de repassar ao provedor):**
- Cabeçalho identifica "DANFSe v2.0".
- Novo bloco de **Destinatário da Operação**, separado do Tomador/Adquirente.
- Bloco inteiro novo de **tributação IBS/CBS** (CST, classificação, base de cálculo, alíquotas).
- Linhas de PIS/COFINS de apuração própria só aparecem para competência até dez/2026 — depois some.
- Totais desdobrados: "Valor Líquido da NFS-e", "Total do IBS/CBS", "Valor Líquido + IBS/CBS".
- Bloco de "Canhoto" opcional (cientificação e assinatura).

**Ação prática para o Luarys**: isso só é problema direto se o GavetaNFSe gera o PDF/impressão do DANFSe internamente. Se o Luarys delega essa geração ao provedor (Focus NFe / Brasil NFe / outro), a responsabilidade de adequação é do provedor — mas vale confirmar explicitamente com quem for escolhido em `04-focus-vs-brasil-nfe.md` se ele já suporta o v2.0, porque a API nacional que fazia isso de graça parou de funcionar hoje.

## Por que isso está num arquivo separado

Essas duas mudanças têm data de corte muito mais precisa (hoje) do que o resto da skill (que trata de prazos de meses/anos). Se este arquivo estiver sendo lido depois de jul/2026, o conteúdo acima já é "passado" — mas serve de exemplo do tipo de mudança pontual que vale a pena registrar assim que sai a Nota Técnica, em vez de esperar a atualização trimestral da skill inteira.
