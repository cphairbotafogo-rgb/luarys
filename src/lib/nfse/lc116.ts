/**
 * Código da LC 116 (item da lista de serviços) — validação e conversão a partir
 * do NBS.
 *
 * Contexto: o campo `item_lista_servico` da nota tem de levar o item da Lei
 * Complementar 116 no formato `06.01`. O fechamento de conta vinha gravando ali
 * o **NBS** do serviço (`126021000`, 9 dígitos), que é outra taxonomia — a
 * prefeitura recusa no schema com "cTribNac ... Pattern constraint failed".
 * Preenchido com o código errado é pior que vazio: vazio cai no padrão 06.01 e
 * é aceito.
 *
 * O NBS continua sendo dado legítimo (serve para o enquadramento IBS/CBS da
 * Reforma Tributária) — só não pode ir neste campo.
 */

/** Formato exigido: dois dígitos, ponto, dois dígitos. Ex: `06.01`. */
export const PADRAO_LC116 = /^\d{2}\.\d{2}$/;

/** Item usado quando não há classificação — serviço de salão mais comum. */
export const LC116_PADRAO = '06.01';

export function lc116Valido(codigo: string | null | undefined): boolean {
  return !!codigo && PADRAO_LC116.test(String(codigo).trim());
}

/** true quando o campo está preenchido mas fora do formato (recusa certa). */
export function lc116Invalido(codigo: string | null | undefined): boolean {
  return !!codigo && !lc116Valido(codigo);
}

/**
 * NBS → item da LC 116, para os serviços de salão.
 *
 * 6.01 — "Barbearia, cabeleireiros, manicuros, pedicuros e congêneres":
 *        cabelo e unha caem no mesmo item.
 * 6.02 — "Esteticistas, tratamento de pele, depilação e congêneres".
 *
 * ⚠️ Mapeamento proposto a partir dos nomes dos serviços cadastrados, não de
 * tabela oficial NBS↔LC116 (não existe correspondência normativa entre as duas).
 * O salão deve confirmar com o contador antes de emitir em produção.
 */
const NBS_PARA_LC116: Record<string, string> = {
  '126021000': '06.01', // cabelo — corte, coloração, escova, tratamentos
  '126022000': '06.01', // unhas — manicure, pedicure, alongamento
  '126023000': '06.02', // estética facial — pele, lábios, micropigmentação
};

/**
 * Devolve um código LC 116 sempre válido.
 * Aceita já-LC116 (passa direto), NBS conhecido (converte) ou qualquer outra
 * coisa (cai no padrão) — nunca devolve um código que a prefeitura recusaria.
 */
export function resolverLc116(codigo: string | null | undefined): string {
  const v = String(codigo ?? '').trim();
  if (lc116Valido(v)) return v;
  const soDigitos = v.replace(/\D/g, '');
  return NBS_PARA_LC116[soDigitos] ?? LC116_PADRAO;
}
