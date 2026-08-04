/**
 * cTribNac — Código de Tributação Nacional da NFS-e (Sistema Nacional NFS-e).
 *
 * Formato: **6 dígitos, sem pontuação**, hierárquico —
 *   item(2) + subitem(2) + desdobro nacional(2)
 * O item e o subitem vêm da lista anexa à LC 116/2003; o desdobro é criado pelo
 * padrão nacional. Por isso "06.01" NÃO é um cTribNac válido: o equivalente é
 * `060101`.
 *
 * Histórico dos dois erros que passamos aqui, para não repetir:
 *  1. O fechamento gravava o **NBS** do serviço ("126021000", 9 dígitos). O XSD
 *     recusava: "cTribNac ... TSCodTribNac ... Pattern constraint failed".
 *  2. Trocamos por "06.01"/"06.02" (item da LC 116 com ponto). Passou no XSD,
 *     mas a prefeitura devolveu "E0310 - O código de tributação nacional
 *     informado não existe conforme a lista de serviços nacional".
 * Só o formato de 6 dígitos satisfaz os dois.
 *
 * O NBS continua sendo dado legítimo (enquadramento IBS/CBS da Reforma
 * Tributária) — só não pode ir neste campo.
 *
 * Códigos conferidos na lista nacional (04/08/2026):
 *   060101 — Barbearia, cabeleireiros, manicuros, pedicuros e congêneres
 *   060201 — Esteticistas, tratamento de pele, depilação e congêneres
 */

/** Formato exigido pelo cTribNac: exatamente 6 dígitos. */
export const PADRAO_LC116 = /^\d{6}$/;

/** Serviço de salão mais comum — usado quando não há classificação. */
export const LC116_PADRAO = '060101';

export function lc116Valido(codigo: string | null | undefined): boolean {
  return !!codigo && PADRAO_LC116.test(String(codigo).trim());
}

/** true quando o campo está preenchido mas fora do formato (recusa certa). */
export function lc116Invalido(codigo: string | null | undefined): boolean {
  return !!codigo && !lc116Valido(codigo);
}

/**
 * Conversões conhecidas para cTribNac.
 *
 * Cobre os dois formatos errados que já circularam na base — o NBS e o item da
 * LC 116 com ponto — para que notas antigas e serviços já cadastrados sejam
 * corrigidos sem precisar de recadastro manual.
 *
 * ⚠️ O agrupamento NBS → cTribNac foi deduzido dos nomes dos serviços
 * cadastrados; não existe correspondência normativa entre as duas tabelas.
 * Confirmar com o contador antes de emitir em produção.
 */
const CONVERSOES: Record<string, string> = {
  // NBS (9 dígitos) usado pelo cadastro de serviços
  '126021000': '060101', // cabelo — corte, coloração, escova, tratamentos
  '126022000': '060101', // unhas — manicure, pedicure, alongamento
  '126023000': '060201', // estética facial — pele, lábios, micropigmentação
  // Item da LC 116 sem o desdobro nacional (formato "06.01", já sem o ponto)
  '0601': '060101',
  '0602': '060201',
};

/**
 * Devolve um cTribNac sempre válido.
 * Aceita já-cTribNac (passa direto), NBS ou item LC 116 com ponto (converte),
 * ou qualquer outra coisa (cai no padrão) — nunca devolve código recusável.
 */
export function resolverLc116(codigo: string | null | undefined): string {
  const v = String(codigo ?? '').trim();
  if (lc116Valido(v)) return v;
  const soDigitos = v.replace(/\D/g, '');
  return CONVERSOES[soDigitos] ?? LC116_PADRAO;
}
