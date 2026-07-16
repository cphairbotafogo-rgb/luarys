# Skill: luarys-taxas-cartoes

**Última verificação:** 03/07/2026

## Propósito

Todo cálculo de taxa operadora de cartão ou PIX no Luarys deve usar **exclusivamente** o hook `useTaxasConfig` — que busca em `config_taxas` (tela "Configurações → Taxas e Parcelamentos"). Nunca hardcode taxa, nunca ler `taxa_maquina` do banco (campo inexistente), nunca duplicar o fetch de `config_taxas` em outros componentes.

---

## Fonte única de verdade

| Configuração | Tabela | Campo |
|---|---|---|
| Taxa do PIX | `config_taxas` | `taxa_pix` (numeric) |
| Taxa débito por bandeira | `config_taxas` | `taxas_cartoes['Visa'].debito` |
| Taxa crédito à vista por bandeira | `config_taxas` | `taxas_cartoes['Visa'].cred_1` |
| Taxa crédito 2× | `config_taxas` | `taxas_cartoes['Visa'].cred_2` |
| ... até 12× | `config_taxas` | `taxas_cartoes['Visa'].cred_12` |
| Máx. parcelas | `config_taxas` | `max_parcelas` |

Bandeiras configuradas: `Visa`, `Mastercard`, `Elo`, `Amex`, `Hipercard` (exatamente neste casing).

---

## Hook centralizado

**Arquivo:** `src/lib/useTaxasConfig.ts`

```typescript
import { useTaxasConfig } from '@/lib/useTaxasConfig';

// Dentro de qualquer componente que precise de taxa:
const { obterTaxa, configCarregada } = useTaxasConfig(perfil);

// Uso:
const taxa = obterTaxa('Cartão de Débito', item.bandeira_cartao); // → 1.37
const taxa = obterTaxa('Cartão de Crédito', 'Visa');              // → 2.50 (cred_1)
const taxa = obterTaxa('Pix', null);                              // → taxa_pix
const taxa = obterTaxa('Dinheiro', null);                         // → 0
```

### Assinatura de `obterTaxa`

```typescript
obterTaxa(forma: string, bandeira: string | null): number
```

- `forma` — qualquer variação aceita: `'Cartão Débito'`, `'Cartão de Débito'`, `'CARTÃO DÉBITO'`, etc. O hook normaliza via `.toUpperCase().includes()`.
- `bandeira` — nome da bandeira do banco (`financeiro.bandeira_cartao`). Pode ser `null`.
- Retorno — percentual (ex: `1.37` representa 1,37%).

### Regras de lookup

1. **PIX** → `taxa_pix`
2. **Débito com bandeira conhecida** → `taxas_cartoes[bandeira].debito` (case-insensitive)
3. **Débito com bandeira desconhecida ou null** → média de todos os `.debito` configurados
4. **Crédito com bandeira conhecida** → `taxas_cartoes[bandeira].cred_1`
5. **Crédito com bandeira desconhecida ou null** → média de todos os `.cred_1` configurados
6. **Dinheiro / Outros** → 0

O lookup é **case-insensitive**: `'visa'` e `'VISA'` encontram `'Visa'` no JSON.  
Bandeiras não cadastradas (ex: `'Maestro/Redeshop'`) recebem a **média configurada**, nunca quebram.

---

## Quando `configCarregada` é `false`

Significa que `perfil.salao_id` ainda está ausente, ou que não existe linha em `config_taxas` para o salão. Neste caso:
- `obterTaxa` retorna `0` para tudo
- Mostre aviso ao usuário: `⚠️ Configure as taxas em Configurações → Taxas de Cartão`
- Não exiba `"—"` em colunas de taxa — exiba `"0,00%"` com o aviso separado

---

## Padrão para novos componentes

```typescript
// 1. Importar o hook
import { useTaxasConfig } from '@/lib/useTaxasConfig';

// 2. Chamar no corpo do componente (requer perfil)
const { obterTaxa, configCarregada } = useTaxasConfig(perfil);

// 3. Usar em useMemo — inclua obterTaxa nas dependências
const dados = useMemo(() => {
  return transacoes.map(t => {
    const taxa = obterTaxa(t.forma_pagamento, t.bandeira_cartao);
    const custo = t.valor * taxa / 100;
    return { ...t, taxa, custo, liquido: t.valor - custo };
  });
}, [transacoes, obterTaxa]); // ← obterTaxa é estável via useCallback interno

// 4. Aviso quando não configurado
{!configCarregada && (
  <div>⚠️ Configure as taxas em Configurações → Taxas de Cartão</div>
)}
```

---

## Componentes que já usam este hook

| Componente | Arquivo |
|---|---|
| Fluxo por Forma de Pagamento | `src/modules/relatorios/gavetas/GavetaFluxoPagamento.tsx` |
| Conciliação de Cartões | `src/modules/financeiro/AbaConciliacao.tsx` |

---

## O que NÃO fazer

```typescript
// ❌ Campo inexistente — sempre retorna undefined/NaN
const taxa = parseFloat(item.taxa_maquina) || 0;

// ❌ Taxa hardcoded
const taxa = 1.99;

// ❌ Fetch duplicado de config_taxas fora do hook
const { data } = await supabase.from('config_taxas').select('*')...

// ❌ Lookup case-sensitive sem fallback
const taxa = taxasCartoes[bandeira]?.debito; // falha se bandeira = 'visa' e chave = 'Visa'
```

---

## Como expandir para crédito parcelado

Quando o componente precisar diferenciar 1×, 2×, 3×... (ex: PDV com parcelas selecionadas):

```typescript
// Acessar diretamente taxasCartoes após validar chave
const { taxasCartoes } = useTaxasConfig(perfil);
const chave = 'Visa'; // já resolvido e case-insensitive
const taxa2x = parseFloat(taxasCartoes[chave]?.cred_2 || '0') || 0;
```

`obterTaxa` sempre usa `cred_1` para crédito. Para outros parcelamentos, acesse `taxasCartoes` diretamente.
