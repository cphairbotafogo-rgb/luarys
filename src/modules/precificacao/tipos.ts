/**
 * src/modules/precificacao/tipos.ts
 *
 * Tipos, constantes e fórmulas puras (sem React).
 * Importado por todos os arquivos do módulo Luarys Precifica.
 */

// ─── INTERFACES ───────────────────────────────────────────────────────────────

export interface ConfigCustos {
  custoFixoMensal: number;   // R$ — soma dos custos fixos/mês
  horasMes: number;          // total de horas faturadas por TODOS os profissionais/mês (modo "simples")
  aliquotaImposto: number;   // % — Simples Nacional ou outro regime
  taxaCartao: number;        // % — maquininha / gateway
  depreciacao: number;       // % — reserva para equipamentos
  // ── Segmentação por categoria (opcional) ──────────────────────────────
  // Quando modoHoras === 'categoria', o custo fixo por hora de cada serviço
  // usa as horas da SUA categoria (ex: "Cabelo"), em vez do total do salão.
  // Isso evita que a manicure (poucas horas/mês) distorça o custo-hora do
  // cabeleireiro, e vice-versa — o problema original que motivou esse modo.
  modoHoras?: 'simples' | 'categoria';
  horasMesPorCategoria?: Record<string, number>;
}

/**
 * Resolve quantas horas/mês usar no cálculo de custo fixo por hora de um
 * serviço, dependendo do modo configurado:
 *  - 'simples' (ou ausente, para configs antigas): usa config.horasMes, igual
 *    para todos os serviços — comportamento original, preservado.
 *  - 'categoria': usa horasMesPorCategoria[categoria]. Se a categoria não
 *    tiver valor configurado, cai para config.horasMes como fallback, para
 *    nunca travar o cálculo por falta de dado.
 */
export function obterHorasMesEfetivo(config: ConfigCustos, categoria?: string): number {
  if (config.modoHoras === 'categoria' && categoria) {
    const horasCategoria = config.horasMesPorCategoria?.[categoria];
    if (horasCategoria && horasCategoria > 0) return horasCategoria;
  }
  return config.horasMes;
}

export interface FormCalculo {
  duracaoMin: number;
  custoInsumos: number;
  percentComissao: number;   // modo comissionado
  cotaParteParceiro: number; // modo parceiro (% que vai para o profissional MEI)
  margemDesejada: number;
  categoria?: string;        // categoria do serviço — usada quando config.modoHoras === 'categoria'
}

export interface Resultado {
  precoIdeal: number;
  custoDireto: number;
  custoFixoServico: number;
  comissaoValor: number;     // comissão OU cota-parte do parceiro
  impostoValor: number;      // imposto pago PELO SALÃO
  cartaoValor: number;
  depreciacaoValor: number;
  lucroValor: number;
  lucroHora: number;         // quanto o serviço deixa de lucro por hora ocupada da agenda
  divisor: number;
  cotaParteSalaoValor?: number;
  economiaTributaria?: number;
}

// ─── CLASSIFICAÇÃO DE LUCRO POR HORA ──────────────────────────────────────────
// Faixas usadas para o semáforo de "uso do tempo da equipe" — ajustar conforme
// referência de mercado evoluir. Pensado em torno de um piso de referência por
// hora de cadeira ocupada, não em percentual de margem.

export function classificarLucroHora(valor: number): 'otimo' | 'bom' | 'fraco' | 'prejuizo' {
  if (valor < 0) return 'prejuizo';
  if (valor < 15) return 'fraco';
  if (valor < 30) return 'bom';
  return 'otimo';
}

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────

export const CONFIG_DEFAULT: ConfigCustos = {
  custoFixoMensal: 0,
  horasMes: 200,
  aliquotaImposto: 6,
  taxaCartao: 3,
  depreciacao: 2,
  modoHoras: 'simples',
  horasMesPorCategoria: {},
};

export const FORM_DEFAULT: FormCalculo = {
  duracaoMin: 60,
  custoInsumos: 0,
  percentComissao: 40,
  cotaParteParceiro: 60,
  margemDesejada: 20,
};

// ─── PALETA ───────────────────────────────────────────────────────────────────

export const CORES: Record<string, string> = {
  insumos:     '#F59E0B',
  estrutura:   '#6B788A',
  comissao:    '#8B5CF6',
  parceiro:    '#7C3AED',
  imposto:     '#EF4444',
  cartao:      '#94A3B8',
  depreciacao: '#D97706',
  lucro:       '#D4AF37',
};

export const LEGENDA = [
  { chave: 'insumos',     label: 'Insumos (produtos)' },
  { chave: 'estrutura',   label: 'Estrutura (custo fixo)' },
  { chave: 'comissao',    label: 'Comissão' },
  { chave: 'parceiro',    label: 'Cota-parte do parceiro' },
  { chave: 'imposto',     label: 'Imposto (só sua cota)' },
  { chave: 'cartao',      label: 'Taxa cartão' },
  { chave: 'depreciacao', label: 'Depreciação' },
  { chave: 'lucro',       label: 'Seu lucro' },
];

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

export function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function pct(v: number) {
  return v.toFixed(1) + '%';
}

// ─── FÓRMULAS ─────────────────────────────────────────────────────────────────

/** Modelo tradicional: imposto sobre o valor TOTAL do serviço */
export function calcularPrecoComissionado(config: ConfigCustos, form: FormCalculo): Resultado | null {
  const horasMesEfetivo = obterHorasMesEfetivo(config, form.categoria);
  if (horasMesEfetivo <= 0) return null;

  const custoFixoHora    = config.custoFixoMensal / horasMesEfetivo;
  const custoFixoServico = (form.duracaoMin / 60) * custoFixoHora;
  const custoDireto      = form.custoInsumos + custoFixoServico;

  const totalDeducoesPct = (
    form.percentComissao + config.aliquotaImposto + config.taxaCartao + config.depreciacao
  ) / 100;

  const divisor = 1 - totalDeducoesPct - form.margemDesejada / 100;
  if (divisor <= 0) return null;

  const precoIdeal = custoDireto / divisor;
  const lucroValor = precoIdeal * form.margemDesejada / 100;
  const horasServico = form.duracaoMin / 60;
  return {
    precoIdeal, custoDireto, custoFixoServico,
    comissaoValor:    precoIdeal * form.percentComissao / 100,
    impostoValor:     precoIdeal * config.aliquotaImposto / 100,
    cartaoValor:      precoIdeal * config.taxaCartao / 100,
    depreciacaoValor: precoIdeal * config.depreciacao / 100,
    lucroValor,
    lucroHora: horasServico > 0 ? lucroValor / horasServico : 0,
    divisor,
  };
}

/**
 * Modelo Parceiro (Lei 13.352/2016): imposto apenas sobre a cota-parte do salão.
 * Fórmula: P = D / [cotaSalao × (1 - ti) - tc - td - m]
 */
export function calcularPrecoParceiro(config: ConfigCustos, form: FormCalculo): Resultado | null {
  const horasMesEfetivo = obterHorasMesEfetivo(config, form.categoria);
  if (horasMesEfetivo <= 0) return null;

  const custoFixoHora    = config.custoFixoMensal / horasMesEfetivo;
  const custoFixoServico = (form.duracaoMin / 60) * custoFixoHora;
  const custoDireto      = form.custoInsumos + custoFixoServico;

  const cotaParceiroFrac = form.cotaParteParceiro / 100;
  const cotaSalaoFrac    = 1 - cotaParceiroFrac;
  const ti = config.aliquotaImposto / 100;
  const tc = config.taxaCartao / 100;
  const td = config.depreciacao / 100;
  const m  = form.margemDesejada / 100;

  const divisor = cotaSalaoFrac * (1 - ti) - tc - td - m;
  if (divisor <= 0) return null;

  const precoIdeal         = custoDireto / divisor;
  const cotaParteSalaoValor = precoIdeal * cotaSalaoFrac;
  const comissaoValor      = precoIdeal * cotaParceiroFrac;
  const impostoValor       = cotaParteSalaoValor * ti;
  const economiaTributaria  = precoIdeal * ti - impostoValor;
  const lucroValor         = precoIdeal * m;
  const horasServico       = form.duracaoMin / 60;

  return {
    precoIdeal, custoDireto, custoFixoServico,
    comissaoValor,
    impostoValor,
    cartaoValor:      precoIdeal * tc,
    depreciacaoValor: precoIdeal * td,
    lucroValor,
    lucroHora: horasServico > 0 ? lucroValor / horasServico : 0,
    divisor,
    cotaParteSalaoValor,
    economiaTributaria,
  };
}

export function calcularPreco(
  config: ConfigCustos,
  form: FormCalculo,
  modoParceiro: boolean
): Resultado | null {
  return modoParceiro
    ? calcularPrecoParceiro(config, form)
    : calcularPrecoComissionado(config, form);
}

// ─── ALERTAS INTELIGENTES DO CATÁLOGO ─────────────────────────────────────────
// Regras aplicadas a um serviço já cadastrado, comparando o preço REAL
// cobrado hoje com os custos reais — não o preço ideal hipotético.
// Reaproveitado pelo Diagnóstico e pelo Dashboard Executivo.

export type NivelAlerta = 'critico' | 'atencao';

export interface AlertaServico {
  nivel: NivelAlerta;
  texto: string;
  servicoId: string; // permite navegar direto para o serviço que gerou o alerta
}

export interface DadosAlertaServico {
  servicoId: string;
  nomeServico: string;
  precoAtual: number;
  margemDesejadaSalao: number; // % — meta configurada pelo dono na Calculadora
  margemRealPct: number;       // % — margem real do serviço no preço de hoje
  lucroHoraReal: number;       // R$/h — lucro real por hora ocupada
  duracaoMin: number;
  percentComissao: number;     // % — comissão efetivamente paga nesse serviço
  ehCortesia: boolean;         // marcado explicitamente no cadastro do serviço (servicos.eh_cortesia)
}

const MARGEM_MINIMA_ABSOLUTA = 20; // % — piso de segurança, independe da meta do salão

/**
 * Gera os alertas aplicáveis a UM serviço. Pode retornar 0, 1 ou vários
 * alertas para o mesmo serviço (ex: margem baixa E comissão alta ao mesmo tempo).
 */
export function gerarAlertasServico(d: DadosAlertaServico): AlertaServico[] {
  const alertas: AlertaServico[] = [];
  const ehPrecoSimbolicoServico = d.ehCortesia;

  // Serviços de preço simbólico (cortesia/retoque não cobrado) pulam os
  // alertas de margem e de comissão — eles não foram pensados para dar
  // lucro, então "margem abaixo do mínimo" não é uma informação útil aqui.
  // O alerta de tempo ocupado na agenda (abaixo) continua valendo: mesmo
  // sendo cortesia, vale saber se está tomando tempo demais da equipe.
  if (!ehPrecoSimbolicoServico) {
    // 1. Margem abaixo do piso de segurança (20%, fixo — independe da meta do salão)
    if (d.precoAtual > 0 && d.margemRealPct < MARGEM_MINIMA_ABSOLUTA) {
      alertas.push({
        nivel: 'critico',
        servicoId: d.servicoId,
        texto: `${d.nomeServico}: margem de ${pct(d.margemRealPct)} está abaixo do mínimo seguro de ${MARGEM_MINIMA_ABSOLUTA}%.`,
      });
    }
    // 2. Margem abaixo da meta que o PRÓPRIO salão definiu (mas ainda acima do piso de 20% — senão duplica o alerta acima)
    else if (d.precoAtual > 0 && d.margemRealPct < d.margemDesejadaSalao) {
      alertas.push({
        nivel: 'atencao',
        servicoId: d.servicoId,
        texto: `${d.nomeServico}: margem de ${pct(d.margemRealPct)} está abaixo da meta do salão (${pct(d.margemDesejadaSalao)}).`,
      });
    }
  }

  // 3. Serviço ocupa muito tempo da agenda mas gera pouco lucro — vale para
  // QUALQUER preço, inclusive simbólico: um retoque "de cortesia" que toma
  // 1h da cadeira ainda é tempo que a equipe não está usando para vender.
  const statusHora = classificarLucroHora(d.lucroHoraReal);
  if (statusHora === 'prejuizo') {
    alertas.push({
      nivel: 'critico',
      servicoId: d.servicoId,
      texto: ehPrecoSimbolicoServico
        ? `${d.nomeServico} (preço simbólico): consome ${brl(Math.abs(d.lucroHoraReal))}/h de custo da agenda. Vale conferir se o tempo gasto está dentro do esperado.`
        : `${d.nomeServico}: está dando prejuízo (${brl(d.lucroHoraReal)}/h). Cada venda piora o caixa.`,
    });
  } else if (statusHora === 'fraco' && d.duracaoMin >= 90) {
    alertas.push({
      nivel: 'atencao',
      servicoId: d.servicoId,
      texto: `${d.nomeServico}: ocupa ${(d.duracaoMin / 60).toFixed(1)}h da agenda mas deixa só ${brl(d.lucroHoraReal)}/h de lucro. Vale revisar tempo ou preço.`,
    });
  }

  // 4. Comissão tão alta que praticamente inviabiliza a margem — não se
  // aplica a preço simbólico (a comissão sobre R$ 0,01 é irrelevante).
  if (!ehPrecoSimbolicoServico && d.percentComissao >= 50) {
    alertas.push({
      nivel: 'atencao',
      servicoId: d.servicoId,
      texto: `${d.nomeServico}: comissão de ${pct(d.percentComissao)} sobre o bruto deixa pouca margem para o salão. Considere o modelo Parceiro (Lei 13.352) ou rever o percentual.`,
    });
  }

  return alertas;
}