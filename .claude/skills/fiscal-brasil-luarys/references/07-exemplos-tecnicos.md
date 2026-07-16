# Exemplos técnicos — payloads de referência

**Última verificação:** 01/07/2026
**Aviso:** estes exemplos são ilustrativos, baseados em documentação pública de provedores (Focus NFe) e notas técnicas oficiais. **Não copiar direto para produção** — sempre validar contra o schema mais recente do provedor escolhido e testar em homologação antes.

## NFS-e — DPS (Declaração de Prestação de Serviço) no Ambiente Nacional

Formato de payload típico para emissão via API integrada à SEFIN Nacional (exemplo adaptado de documentação da Focus NFe):

```json
{
  "data_emissao": "2026-07-01T11:16:06-03:00",
  "data_competencia": "2026-07-01",
  "codigo_municipio_emissora": 3304557,
  "cnpj_prestador": "00000000000000",
  "codigo_opcao_simples_nacional": 1,
  "regime_especial_tributacao": 0,
  "cnpj_tomador": "00000000000000",
  "razao_social_tomador": "NOME DO CLIENTE",
  "codigo_municipio_tomador": 3304557,
  "cep_tomador": "00000000",
  "logradouro_tomador": "RUA EXEMPLO",
  "numero_tomador": "000",
  "bairro_tomador": "BAIRRO EXEMPLO",
  "codigo_municipio_prestacao": 3304557,
  "codigo_tributacao_nacional_iss": "140501",
  "codigo_nbs": "121012200",
  "descricao_servico": "Serviço de cabeleireiro/estética",
  "valor_servico": 120.00,
  "valor_iss": 3.00
}
```

**Campos que mais importam para o Luarys:**
- `codigo_opcao_simples_nacional`: indica se o prestador (salão) é optante do Simples — quase sempre `1` (sim) no caso do Luarys.
- `codigo_nbs`: Nomenclatura Brasileira de Serviços — precisa mapear os serviços do salão (corte, coloração, manicure etc.) para o código NBS correto. Isso é cadastro, não cálculo — o Luarys precisa de uma tabela de mapeamento serviço → NBS.
- `codigo_tributacao_nacional_iss`: código de tributação — também depende do enquadramento do serviço.
- `codigo_municipio_prestacao`: importante para salões multi-unidade em cidades diferentes.

## NFS-e — grupo IBSCBS (a partir da NT 004 v2.0)

Estrutura adicional que passa a acompanhar a DPS quando o grupo IBS/CBS estiver ativo (layout com validade jurídica desde 05/jan/2026):

```json
{
  "ibscbs": {
    "cst": "000",
    "cclasstrib": "000001",
    "base_calculo": 120.00,
    "aliquota_ibs_estadual": 0.001,
    "aliquota_ibs_municipal": 0.001,
    "aliquota_cbs": 0.009,
    "valor_ibs": 0.12,
    "valor_cbs": 1.08
  }
}
```

Os valores de `cst` e `cclasstrib` variam por tipo de operação — não usar estes valores fixos em produção, são apenas ilustrativos da estrutura do campo. O cálculo em si tende a vir de uma calculadora centralizada (RTC) ou do próprio provedor de emissão — o Luarys normalmente só precisa enviar os dados de origem (valor do serviço, classificação) e receber os valores de volta.

## NF-e/NFC-e — grupo UB (tributação IBS/CBS) e cClassTrib

Estrutura no XML (representação simplificada em JSON para referência de campo, já que o schema real é XML/XSD):

```json
{
  "det": {
    "prod": {
      "cProd": "SKU-001",
      "xProd": "Shampoo profissional 500ml",
      "NCM": "33051000",
      "CFOP": "5102"
    },
    "imposto": {
      "UB": {
        "CST": "000",
        "cClassTrib": "000001",
        "vBC": 45.00,
        "pIBSUF": 0.001,
        "pIBSMun": 0.001,
        "pCBS": 0.009,
        "vIBS": 0.045,
        "vCBS": 0.405
      }
    }
  }
}
```

**Relevante apenas se o salão revende produto pelo PDV** (não é o caso da maioria dos serviços). `NCM` volta a ser determinante — cadastro de produto precisa ter NCM correto, senão risco de rejeição.

## Chave de acesso NF-e/NFC-e — formato pós CNPJ alfanumérico (vigente desde 01/07/2026)

Regex de validação **antiga** (não usar mais):
```
^\d{44}$
```

Regex **atual**, que aceita letras nas 12 posições centrais correspondentes ao CNPJ do emitente:
```
^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$
```

Se o Luarys tiver alguma validação de chave de acesso no front-end ou back-end (JS/TS no Next.js, ou constraint no Postgres), essa é a regex a usar a partir de agora.

## Tipagem recomendada no Supabase/Postgres

Se alguma tabela do Luarys guarda CNPJ ou chave de acesso, confirmar que os tipos são de texto, não numéricos:

```sql
-- Errado (quebra com CNPJ alfanumérico):
cnpj NUMERIC(14)
chave_acesso BIGINT

-- Correto:
cnpj VARCHAR(14)
chave_acesso CHAR(44)
```

Isso ainda precisa ser confirmado diretamente no schema real do Luarys (ver nota sobre acesso ao Supabase no changelog da skill).
