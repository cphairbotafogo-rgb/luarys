// src/modules/financeiro/tipos.ts
// Tipos, constantes e funções puras do módulo financeiro (sem React).

export type AbaFinanceiroId = 'painel' | 'lancamentos' | 'despesas' | 'conciliacao' | 'comparativo' | 'carteiras' | 'aluguel' | 'exportacao';

export interface FormTransacao {
  tipo: string;
  descricao: string;
  categoria: string;
  tipo_custo: 'Fixo' | 'Variável' | '';
  relacao_tipo: string;
  relacao_id: string;
  valor: string;
  data_movimentacao: string;
  forma_pagamento: string;
  status: string;
}

/** Sugere Fixo/Variável com base na categoria — sempre editável pelo usuário */
export function sugerirTipoCusto(categoria: string): 'Fixo' | 'Variável' | '' {
  if (categoria === 'Despesas Fixas') return 'Fixo';
  if ([
    'Despesas Variáveis', 'Comissões', 'Adiantamento Salarial (Vale)',
    'Impostos / Taxas', 'Marketing',
  ].includes(categoria)) return 'Variável';
  return '';
}

/** Retorna o form vazio para nova transação */
export function formVazioFactory(diaDeHoje: string): FormTransacao {
  return {
    tipo: 'saida',
    descricao: '',
    categoria: 'Despesas Variáveis',
    tipo_custo: sugerirTipoCusto('Despesas Variáveis') as 'Fixo' | 'Variável' | '',
    relacao_tipo: 'Nenhuma',
    relacao_id: '',
    valor: '',
    data_movimentacao: diaDeHoje,
    forma_pagamento: 'PIX',
    status: 'Pago',
  };
}

/** Lê a aba ativa da hash da URL */
export function abaAtivaFromHash(): AbaFinanceiroId {
  if (typeof window === 'undefined') return 'painel';
  const hash = window.location.hash;
  if (hash.includes('aba=lancamentos'))  return 'lancamentos';
  if (hash.includes('aba=despesas'))     return 'despesas';
  if (hash.includes('aba=conciliacao'))  return 'conciliacao';
  if (hash.includes('aba=comparativo'))  return 'comparativo';
  if (hash.includes('aba=carteiras'))    return 'carteiras';
  if (hash.includes('aba=aluguel'))      return 'aluguel';
  return 'painel';
}
