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

// ─── Cláusulas obrigatórias do contrato (art. 1º-A, § 10) ────────────────────
//
// A lei lista sete cláusulas que o contrato de parceria DEVE conter, além da
// homologação no sindicato da categoria (art. 1º-A, § 1º). Cláusula ausente é
// o motivo mais comum de descaracterização em reclamação trabalhista — por isso
// o sistema passa a registrar cada uma, em vez de só guardar CNPJ e função.
//
// Isto é registro do que foi pactuado, não substitui o contrato assinado.

export interface ContratoParceria {
  /** § 10, I — percentual de retenção do salão sobre cada serviço. */
  percentualRetencao?: number | string | null;
  /** § 10, II — salão retém e recolhe os tributos do profissional. */
  retencaoTributos?: boolean;
  /** § 10, III — condições e periodicidade do pagamento. */
  periodicidadePagamento?: string | null;
  /** § 10, IV — direitos de uso de bens materiais e acesso às dependências. */
  direitosUsoBens?: string | null;
  /** § 10, V — rescisão unilateral com aviso prévio mínimo de 30 dias. */
  avisoPrevioDias?: number | string | null;
  /** § 10, VI — responsabilidade compartilhada por manutenção e higiene. */
  responsabilidadeCompartilhada?: boolean;
  /** § 10, VII — profissional mantém inscrição fiscal regular. */
  regularidadeFiscal?: boolean;
  /** § 1º — homologação no sindicato (ou órgão substituto). */
  homologacaoSindicato?: string | null;
  homologacaoData?: string | null;
  [k: string]: unknown;
}

/** Aviso prévio mínimo que a lei exige para rescisão unilateral (§ 10, V). */
export const AVISO_PREVIO_MINIMO_DIAS = 30;

export interface PendenciaClausula {
  chave: string;
  rotulo: string;
  dispositivo: string;
}

/**
 * Quais cláusulas obrigatórias ainda faltam no contrato.
 *
 * Devolve lista vazia quando está tudo registrado. Não bloqueia o salvamento —
 * o salão precisa conseguir cadastrar o profissional antes de ter o contrato
 * assinado em mãos —, mas alimenta o aviso na tela e o checklist de conformidade.
 */
export function pendenciasContratoParceria(c: ContratoParceria | null | undefined): PendenciaClausula[] {
  const contrato = c ?? {};
  const faltando: PendenciaClausula[] = [];
  const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

  const percentual = Number(contrato.percentualRetencao);
  if (vazio(contrato.percentualRetencao) || !Number.isFinite(percentual) || percentual <= 0) {
    faltando.push({ chave: 'percentualRetencao', rotulo: 'Percentual de retenção do salão', dispositivo: '§ 10, I' });
  }
  if (contrato.retencaoTributos !== true) {
    faltando.push({ chave: 'retencaoTributos', rotulo: 'Cláusula de retenção e recolhimento de tributos', dispositivo: '§ 10, II' });
  }
  if (vazio(contrato.periodicidadePagamento)) {
    faltando.push({ chave: 'periodicidadePagamento', rotulo: 'Condições e periodicidade do pagamento', dispositivo: '§ 10, III' });
  }
  if (vazio(contrato.direitosUsoBens)) {
    faltando.push({ chave: 'direitosUsoBens', rotulo: 'Direitos de uso dos bens e acesso ao salão', dispositivo: '§ 10, IV' });
  }
  const aviso = Number(contrato.avisoPrevioDias);
  if (!Number.isFinite(aviso) || aviso < AVISO_PREVIO_MINIMO_DIAS) {
    faltando.push({ chave: 'avisoPrevioDias', rotulo: `Aviso prévio de rescisão (mínimo ${AVISO_PREVIO_MINIMO_DIAS} dias)`, dispositivo: '§ 10, V' });
  }
  if (contrato.responsabilidadeCompartilhada !== true) {
    faltando.push({ chave: 'responsabilidadeCompartilhada', rotulo: 'Responsabilidade compartilhada por manutenção e higiene', dispositivo: '§ 10, VI' });
  }
  if (contrato.regularidadeFiscal !== true) {
    faltando.push({ chave: 'regularidadeFiscal', rotulo: 'Obrigação de manter inscrição fiscal regular', dispositivo: '§ 10, VII' });
  }
  if (vazio(contrato.homologacaoSindicato)) {
    faltando.push({ chave: 'homologacaoSindicato', rotulo: 'Homologação no sindicato da categoria', dispositivo: '§ 1º' });
  }

  return faltando;
}
