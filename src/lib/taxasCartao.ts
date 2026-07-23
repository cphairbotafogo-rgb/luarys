// src/lib/taxasCartao.ts
// Funções puras de taxa de operadora de cartão — sem React, sem fetch.
// Extraídas de useTaxasConfig.ts para reuso em código que não pode chamar
// hooks (ex: executarFechamentoConta.ts, uma função async fora de componente).
// Fonte única desta lógica — não duplicar em outro lugar.

/** Acha a chave de taxasCartoes que corresponde à bandeira, case-insensitive. */
export function resolverChaveBandeira(bandeira: string, taxasCartoes: Record<string, any>): string | null {
  if (!bandeira) return null;
  if (taxasCartoes[bandeira]) return bandeira;
  const lower = bandeira.toLowerCase();
  return Object.keys(taxasCartoes).find(k => k.toLowerCase() === lower) ?? null;
}

/**
 * Média das taxas configuradas de um campo (ex: 'debito', 'cred_1'), usada como
 * fallback quando a bandeira do pagamento não tem taxa própria configurada.
 */
export function taxaMedia(campo: string, taxasCartoes: Record<string, any>): number {
  const vals = Object.values(taxasCartoes)
    .map((b: any) => parseFloat(b?.[campo] || '0') || 0)
    .filter(t => t > 0);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
