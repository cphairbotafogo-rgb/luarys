export const FORMAS = ["PIX", "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Transferência", "Outro"];

export type Entrada = { id: string; tipo: 'deposito' | 'uso' | 'estorno'; valor: number; descricao: string | null; created_at: string; forma_pagamento: string | null; };
export type ClienteCarteira = { cliente_id: string | null; cliente_nome: string; saldo: number; ultima_movimentacao: string; };

export function avatar(nome: string) {
  return nome?.charAt(0).toUpperCase() || "?";
}

export function sinalValor(tipo: Entrada['tipo']) {
  return tipo === 'deposito' ? 1 : -1;
}
