'use client'
/**
 * src/modules/relatorios/gavetas/produtividade/tipos.ts
 *
 * Interfaces, constantes e fórmulas puras do Radar de Produtividade.
 * Sem React, sem Supabase — só lógica pura.
 */

// ─── INTERFACES ───────────────────────────────────────────────────────────────

export interface PeriodoFiltro {
  tipo: 'mes_atual' | 'semana' | 'personalizado';
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
}

export interface DadosProfissional {
  id: string;
  nome: string;
  atendimentos: number;
  minutosTrabalhados: number;
  minutosBloqueados: number;
  faturamento: number;
  // Calculados
  horasTrabalhadas: number;   // minutosTrabalhados / 60
  valorHora: number;           // faturamento / horasTrabalhadas
  ticketMedio: number;         // faturamento / atendimentos
  taxaOcupacao: number;        // trabalhados / (trabalhados + bloqueados) * 100
}

export interface DadosDia {
  data: string;            // YYYY-MM-DD
  profissionalId: string;
  profissionalNome: string;
  atendimentos: number;
  minutos: number;
  faturamento: number;
  valorHora: number;
}

export interface MetaHora {
  profissionalId: string;
  metaValorHora: number;  // R$/h configurado pelo dono
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

// Faixas de semáforo para valor/hora (R$)
// Ajustadas ao mercado de salão premium Rio de Janeiro
export const FAIXAS_VALOR_HORA = {
  otimo:   { min: 200, label: 'Excelente', cor: '#10B981' },
  bom:     { min: 120, label: 'Bom',       cor: '#F59E0B' },
  fraco:   { min: 60,  label: 'Fraco',     cor: '#F97316' },
  critico: { min: 0,   label: 'Crítico',   cor: '#EF4444' },
};

export function classificarValorHora(valor: number): keyof typeof FAIXAS_VALOR_HORA {
  if (valor >= FAIXAS_VALOR_HORA.otimo.min)  return 'otimo';
  if (valor >= FAIXAS_VALOR_HORA.bom.min)    return 'bom';
  if (valor >= FAIXAS_VALOR_HORA.fraco.min)  return 'fraco';
  return 'critico';
}

export function corValorHora(valor: number): string {
  return FAIXAS_VALOR_HORA[classificarValorHora(valor)].cor;
}

export function labelValorHora(valor: number): string {
  return FAIXAS_VALOR_HORA[classificarValorHora(valor)].label;
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

export function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtData(d: string) {
  if (!d) return '—';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function fmtHoras(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** Monta os limites de um período */
export function calcularPeriodo(tipo: PeriodoFiltro['tipo']): { inicio: string; fim: string } {
  const hoje = new Date();
  const off = hoje.getTimezoneOffset() * 60000;
  const hojeStr = new Date(hoje.getTime() - off).toISOString().split('T')[0];

  if (tipo === 'mes_atual') {
    return { inicio: hojeStr.slice(0, 7) + '-01', fim: hojeStr };
  }
  if (tipo === 'semana') {
    const dom = new Date(hoje.getTime() - off);
    dom.setDate(dom.getDate() - dom.getDay());
    return { inicio: dom.toISOString().split('T')[0], fim: hojeStr };
  }
  return { inicio: hojeStr, fim: hojeStr }; // personalizado: ponto de partida
}
