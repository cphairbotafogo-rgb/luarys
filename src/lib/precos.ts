/**
 * src/lib/precos.ts
 *
 * Cálculo de preços por periodicidade para planos e add-ons.
 * Mensal = preço cheio. Semestral = 10% off (pagamento único de 6 meses).
 * Anual = 20% off (pagamento único de 12 meses).
 */

export type Periodicidade = 'mensal' | 'semestral' | 'anual';

export const DESCONTO_SEMESTRAL = 0.10;
export const DESCONTO_ANUAL = 0.20;

export const MESES_POR_PERIODICIDADE: Record<Periodicidade, number> = {
  mensal: 1,
  semestral: 6,
  anual: 12,
};

export const LABELS_PERIODICIDADE: Record<Periodicidade, string> = {
  mensal: 'Mensal',
  semestral: 'Semestral (10% off)',
  anual: 'Anual (20% off)',
};

/** Valor total cobrado na contratação (pagamento único para semestral/anual). */
export function calcularPrecoTotal(precoMensal: number, periodicidade: Periodicidade): number {
  const meses = MESES_POR_PERIODICIDADE[periodicidade];
  const desconto = periodicidade === 'semestral' ? DESCONTO_SEMESTRAL : periodicidade === 'anual' ? DESCONTO_ANUAL : 0;
  return Math.round(precoMensal * meses * (1 - desconto) * 100) / 100;
}

/** Valor "equivalente por mês" — útil para comparar visualmente as opções. */
export function calcularPrecoEquivalenteMensal(precoMensal: number, periodicidade: Periodicidade): number {
  const meses = MESES_POR_PERIODICIDADE[periodicidade];
  const total = calcularPrecoTotal(precoMensal, periodicidade);
  return Math.round((total / meses) * 100) / 100;
}

/** Data de renovação a partir de hoje, dada a periodicidade. */
export function calcularProximaRenovacao(periodicidade: Periodicidade, apartirDe: Date = new Date()): Date {
  const meses = MESES_POR_PERIODICIDADE[periodicidade];
  const data = new Date(apartirDe);
  data.setMonth(data.getMonth() + meses);
  return data;
}