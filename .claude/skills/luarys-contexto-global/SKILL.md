# Skill: luarys-contexto-global

**Última verificação:** 03/07/2026

## Propósito

Evitar queries repetidas ao Supabase para dados que mudam raramente. O `DadosGlobaisProvider` busca `servicos`, `profissionais` e `config_taxas` **uma única vez após o login** e os disponibiliza para todas as abas via hook.

---

## Provider

**Arquivo:** `src/lib/contexto/DadosGlobaisContext.tsx`

Deve ser montado em `ElevaApp` (`src/app/page.tsx`), envolvendo todo o conteúdo da app:

```tsx
import { DadosGlobaisProvider } from '@/lib/contexto/DadosGlobaisContext';

// Dentro de ElevaApp, logo no return:
<DadosGlobaisProvider perfil={perfil}>
  <Sidebar ... />
  <div style={{ flex: 1, ... }}>
    ...
  </div>
</DadosGlobaisProvider>
```

---

## Hook de consumo

```typescript
import { useDadosGlobais } from '@/lib/contexto/DadosGlobaisContext';

function MeuComponente() {
  const { servicos, profissionais, carregando } = useDadosGlobais();
  // servicos e profissionais já estão disponíveis — sem useEffect, sem query
}
```

---

## O que está no contexto

| Campo | Tipo | Origem |
|---|---|---|
| `servicos` | `any[]` | `servicos` onde `ativo = true` |
| `profissionais` | `any[]` | `profissionais` onde `ativo = true` |
| `taxasCartoes` | `Record<string, any>` | `config_taxas.taxas_cartoes` |
| `taxaPix` | `number` | `config_taxas.taxa_pix` |
| `configTaxasCarregada` | `boolean` | true quando config_taxas foi carregado |
| `carregando` | `boolean` | true enquanto o primeiro fetch não terminou |
| `recarregarTaxas()` | `() => Promise<void>` | Re-fetch só de config_taxas |

---

## Quando NÃO usar o contexto

- Dados que mudam com frequência no fluxo de trabalho: `agendamentos`, `financeiro`, `estoque`, `clientes` → cada aba busca o próprio dado.
- Quando o componente precisar de `servicos` com campos extras não incluídos no select global → fazer query própria com os campos necessários.

---

## `useTaxasConfig` e o contexto

`src/lib/useTaxasConfig.ts` consome automaticamente `DadosGlobaisContext` quando disponível. Se estiver dentro do provider, **não faz fetch algum**. Se usado fora (ex: portal), faz fallback para fetch próprio.

---

## Recarregamento após salvar configurações

Quando `AbaConfigTaxas` salvar novas taxas, chamar `recarregarTaxas()` para propagar sem reload de página:

```tsx
const { recarregarTaxas } = useDadosGlobais();

async function salvar() {
  await supabase.from('config_taxas').update(...);
  await recarregarTaxas(); // atualiza o contexto global
}
```
