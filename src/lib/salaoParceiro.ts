/**
 * Regras da Lei do Salão-Parceiro (Lei 12.592/2012, alterada pela 13.352/2016).
 *
 * Ponto único de verdade para as validações que impedem a parceria de ser
 * descaracterizada. Cada regra abaixo cita o dispositivo que a sustenta — se
 * alguma mudar, é aqui que se mexe.
 *
 * ⚠️ Referência operacional, não parecer jurídico. Alíquotas e tetos mudam todo
 * ano; conferir com o contador antes de fechar o exercício.
 * Valores conferidos em 04/08/2026.
 */

// ─── Rol taxativo de funções (art. 1º-A, caput) ──────────────────────────────
//
// A lei lista exatamente quem pode ser profissional-parceiro. Função fora desta
// lista configura vínculo empregatício (art. 1º-C, II) — é o erro mais caro e o
// mais fácil de cometer, porque o salão cadastra "recepcionista" ou
// "massoterapeuta" como parceiro sem perceber.

export const FUNCOES_PERMITIDAS_PARCERIA = [
  'cabeleireiro',
  'barbeiro',
  'esteticista',
  'manicure',
  'pedicure',
  'depilador',
  'maquiador',
] as const;

/** Remove acento, caixa e flexão de gênero para comparar "Cabeleireira" com "cabeleireiro". */
function normalizarFuncao(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(a\)|\(o\)/g, '')      // "Cabeleireiro(a)"
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A função pode ser exercida sob contrato de parceria?
 *
 * Compara por radical para aceitar as variações que o salão realmente digita:
 * "Cabeleireira", "Cabeleireiro(a)", "Nail Designer" (manicure), "Depilação".
 * Na dúvida o retorno é `false` — é melhor o salão justificar um caso legítimo
 * do que o sistema deixar passar um vínculo.
 */
export function funcaoPermitidaParceria(funcao: string | null | undefined): boolean {
  const f = normalizarFuncao(String(funcao ?? ''));
  if (!f) return false;

  const radicais: Record<string, string[]> = {
    cabeleireiro: ['cabeleireir', 'hair', 'colorist'],
    barbeiro:     ['barbeir', 'barber'],
    esteticista:  ['esteticist', 'estetica', 'esteticis'],
    manicure:     ['manicur', 'nail', 'unha'],
    pedicure:     ['pedicur'],
    depilador:    ['depilad', 'depilac'],
    maquiador:    ['maquiad', 'maquiag', 'makeup', 'make up'],
  };

  return Object.values(radicais).some(lista => lista.some(r => f.includes(r)));
}

/** Tipos de contrato do cadastro que caracterizam parceria da Lei 13.352. */
export function contratoEhParceria(tipoContrato: string | null | undefined): boolean {
  return String(tipoContrato ?? '').toLowerCase().includes('parceiro');
}

// ─── Regime tributário do salão (art. 1º-A, § 11) ────────────────────────────
//
// O salão-parceiro não pode ser MEI. Se for, o arranjo é inválido desde a
// origem — e a dedução da cota-parte na NFS-e não se sustenta.

export const REGIMES_VEDADOS_AO_SALAO_PARCEIRO = ['MEI'];

export function regimePermiteSalaoParceiro(regime: string | null | undefined): boolean {
  const r = String(regime ?? '').trim();
  if (!r) return true; // não cadastrado ainda: não bloqueia, só não afirma nada
  return !REGIMES_VEDADOS_AO_SALAO_PARCEIRO.some(v => r.toUpperCase() === v);
}

// ─── Retenções do parceiro pessoa física (RPA) ───────────────────────────────
//
// Só se aplicam quando o parceiro NÃO tem CNPJ. Parceiro MEI/ME/EPP emite nota
// ao salão e não sofre estas retenções.

/** Teto do salário-de-contribuição em 2026. */
export const TETO_INSS = 8475.55;

/** Alíquota do contribuinte individual retida pelo tomador (Lei 10.666/2003, art. 4º). */
export const INSS_ALIQUOTA = 0.11;

/**
 * INSS a reter do parceiro pessoa física.
 * 11% sobre a cota-parte, **limitado ao teto** — a versão anterior aplicava 11%
 * sobre qualquer valor, retendo a mais de quem passa do teto.
 */
export function calcularInssRetido(cotaParte: number): number {
  const base = Math.min(Math.max(Number(cotaParte) || 0, 0), TETO_INSS);
  return Math.round(base * INSS_ALIQUOTA * 100) / 100;
}

/**
 * Tabela progressiva mensal do IRRF vigente em 2026.
 * base × alíquota − parcela a deduzir.
 */
export const TABELA_IRRF = [
  { ate: 2428.80, aliquota: 0,     deduzir: 0 },
  { ate: 2826.65, aliquota: 0.075, deduzir: 182.16 },
  { ate: 3751.05, aliquota: 0.15,  deduzir: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deduzir: 675.49 },
  { ate: Infinity, aliquota: 0.275, deduzir: 908.73 },
];

/** Dedução mensal por dependente em 2026. */
export const DEDUCAO_DEPENDENTE = 189.59;

/**
 * IRRF a reter do parceiro pessoa física.
 *
 * A base é a cota-parte MENOS o INSS retido e menos as deduções por dependente
 * — descontar o INSS antes é regra, não arredondamento: aplicar a tabela sobre
 * o bruto reteria imposto a mais.
 *
 * ⚠️ Usa a tabela progressiva tradicional. A Lei 15.270/2025 criou um redutor
 * que amplia a isenção efetiva até R$ 5.000 de rendimento tributável mensal
 * (com redução parcial até R$ 7.350); se ele alcançar o rendimento de autônomo,
 * o valor retido aqui fica acima do devido — e o excesso é restituível na
 * declaração anual. Preferimos esse lado: reter a menos deixa o salão, como
 * fonte pagadora, responsável pela diferença. Confirmar com o contador.
 */
export function calcularIrrfRetido(cotaParte: number, inssRetido: number, dependentes = 0): number {
  const base = (Number(cotaParte) || 0) - (Number(inssRetido) || 0) - (dependentes * DEDUCAO_DEPENDENTE);
  if (base <= 0) return 0;

  const faixa = TABELA_IRRF.find(f => base <= f.ate) ?? TABELA_IRRF[TABELA_IRRF.length - 1];
  const imposto = base * faixa.aliquota - faixa.deduzir;
  return imposto > 0 ? Math.round(imposto * 100) / 100 : 0;
}

/** Retenções e líquido do parceiro pessoa física, num cálculo só. */
export function calcularRepassePessoaFisica(cotaParte: number, dependentes = 0) {
  const bruto = Math.round((Number(cotaParte) || 0) * 100) / 100;
  const inss = calcularInssRetido(bruto);
  const irrf = calcularIrrfRetido(bruto, inss, dependentes);
  return {
    bruto,
    inss,
    irrf,
    liquido: Math.round((bruto - inss - irrf) * 100) / 100,
    baseIrrf: Math.max(0, Math.round((bruto - inss - dependentes * DEDUCAO_DEPENDENTE) * 100) / 100),
  };
}
