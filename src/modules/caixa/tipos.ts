// src/modules/caixa/tipos.ts
// Constantes e tipos do módulo Frente de Caixa (sem React, sem 'use client').

export const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard'] as const;

export type FiltroPeriodo = 'hoje' | 'semana' | 'mes' | 'livre';
export type ModoCaixa = 'opcoes' | 'forma' | 'data' | 'estorno';

export interface FormLancar {
  cliente: string;
  valor: string;
  forma: string;
  bandeira: string;
  clienteCpf?: string | null;
  itemListaServico?: string | null;
}

export interface Transacao {
  id: string | number;
  os_numero?: string | null;
  cliente_nome: string;
  valor_total: number;
  forma_pagamento: string;
  bandeira_cartao?: string | null;
  status: string;
  data_hora: string;
  _origem?: 'financeiro' | 'caixa';
  profissional_nome?: string;
}

export interface AgEmAberto {
  id: string;
  inicio: string;
  status: string;
  cliente_nome: string;
  servico_id: string;
  profissional_id: string;
  _nome_servico: string;
  _nome_profissional: string;
}

/** Normaliza registro do financeiro para o formato Transacao */
export function normalizarFinanceiro(f: any): Transacao {
  return {
    id: `fin-${f.id}`,
    os_numero: f.os_numero || null,
    cliente_nome: f.cliente_nome,
    valor_total: f.valor,
    forma_pagamento: f.forma_pagamento || f.metodo_pagamento,
    bandeira_cartao: f.bandeira_cartao || null,
    status: 'Concluído',
    data_hora: f.data_movimentacao,
    _origem: 'financeiro',
  };
}

/** Converte forma de pagamento do PDV para o padrão do financeiro */
export function formaParaFinanceiro(forma: string): string {
  if (forma === 'Pix') return 'PIX';
  if (forma === 'Cartão de Crédito') return 'Cartão Crédito';
  if (forma === 'Cartão de Débito') return 'Cartão Débito';
  return 'DINHEIRO';
}
