/**
 * src/modules/fidelidade/tipos.ts
 *
 * Luarys Fidelidade — Fase 1 (núcleo).
 *
 * A lógica pesada (ganho de pontos, débito, despesa de marketing, comissão)
 * vive no banco — ver sql/fidelidade_fase1.sql. Este arquivo só cobre o que
 * a interface precisa: tipos, formatação, e chamadas ao Supabase.
 */

import { supabase } from '@/lib/supabase';

// ─── INTERFACES ───────────────────────────────────────────────────────────────

export interface ConfigFidelidade {
  salao_id: string;
  ativo: boolean;
  pontos_por_real: number;
  permite_desconto_valor: boolean;
  valor_por_ponto: number;
}

export interface PremioFidelidade {
  id: string;
  salao_id: string;
  nome: string;
  servico_id: string | null;
  custo_pontos: number;
  valor_real: number;
  ativo: boolean;
}

export interface TransacaoFidelidade {
  id: string;
  tipo: 'ganho' | 'resgate' | 'ajuste';
  pontos: number;
  descricao: string | null;
  created_at: string;
}

// ─── FORMATAÇÃO ───────────────────────────────────────────────────────────────

export function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarPontos(v: number) {
  return v.toLocaleString('pt-BR');
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────

export async function carregarConfig(salaoId: string): Promise<ConfigFidelidade | null> {
  const { data } = await supabase
    .from('fidelidade_config')
    .select('salao_id, ativo, pontos_por_real, permite_desconto_valor, valor_por_ponto')
    .eq('salao_id', salaoId)
    .maybeSingle();
  return data || null;
}

export async function salvarConfig(salaoId: string, config: Partial<ConfigFidelidade>) {
  return supabase
    .from('fidelidade_config')
    .upsert({ salao_id: salaoId, ...config }, { onConflict: 'salao_id' });
}

// ─── PRÊMIOS ──────────────────────────────────────────────────────────────────

export async function carregarPremios(salaoId: string): Promise<PremioFidelidade[]> {
  const { data } = await supabase
    .from('fidelidade_premios')
    .select('id, salao_id, nome, servico_id, custo_pontos, valor_real, ativo')
    .eq('salao_id', salaoId)
    .order('custo_pontos');
  return data || [];
}

export async function criarPremio(salaoId: string, premio: Omit<PremioFidelidade, 'id' | 'salao_id' | 'ativo'>) {
  return supabase.from('fidelidade_premios').insert({ salao_id: salaoId, ...premio, ativo: true });
}

export async function alternarPremioAtivo(premioId: string, ativo: boolean) {
  return supabase.from('fidelidade_premios').update({ ativo }).eq('id', premioId);
}

// ─── SALDO E EXTRATO DO CLIENTE ────────────────────────────────────────────────

export async function carregarSaldoCliente(salaoId: string, clienteId: string): Promise<number> {
  const { data } = await supabase
    .from('fidelidade_transacoes')
    .select('pontos')
    .eq('salao_id', salaoId)
    .eq('cliente_id', clienteId);

  return (data || []).reduce((acc, t) => acc + t.pontos, 0);
}

export async function carregarExtratoCliente(salaoId: string, clienteId: string): Promise<TransacaoFidelidade[]> {
  const { data } = await supabase
    .from('fidelidade_transacoes')
    .select('id, tipo, pontos, descricao, created_at')
    .eq('salao_id', salaoId)
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
    .limit(30);

  return data || [];
}

// ─── RESGATE (chama a função atômica do banco — ver sql/fidelidade_fase1.sql) ─

interface ResgatarParams {
  salaoId: string;
  clienteId: string;
  premioId: string;
  profissionalId: string;
  data: string;   // 'YYYY-MM-DD'
  inicio: string; // 'HH:MM'
}

// ─── RESGATE COMO DESCONTO EM REAIS ──────────────────────────────────────────

export async function resgatarCreditoValor(
  salaoId: string,
  clienteId: string,
  pontos: number,
): Promise<{ valorReais: number | null; erro: string | null }> {
  const { data, error } = await supabase.rpc('resgatar_credito_fidelidade', {
    p_salao_id:   salaoId,
    p_cliente_id: clienteId,
    p_pontos:     pontos,
  });
  if (error) return { valorReais: null, erro: error.message };
  return { valorReais: data as number, erro: null };
}

// ─── RESGATE (chama a função atômica do banco — ver sql/fidelidade_fase1.sql) ─

export async function resgatarPremio(params: ResgatarParams): Promise<{ agendamentoId: string | null; erro: string | null }> {
  const { data, error } = await supabase.rpc('resgatar_premio_fidelidade', {
    p_salao_id: params.salaoId,
    p_cliente_id: params.clienteId,
    p_premio_id: params.premioId,
    p_profissional_id: params.profissionalId,
    p_data: params.data,
    p_inicio: params.inicio,
  });

  if (error) return { agendamentoId: null, erro: error.message };
  return { agendamentoId: data as string, erro: null };
}
