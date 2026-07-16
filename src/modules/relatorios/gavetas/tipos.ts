// src/modules/relatorios/gavetas/comissoes/tipos.ts
// Tipos e constantes do módulo GavetaComissoes (sem React, sem 'use client').

export type TipoImpressao = 'agrupado' | 'detalhado' | 'capacidade' | 'profissional';

export interface FormExtra {
  profissional_id: string;
  tipo: 'recebivel' | 'abatimento';
  descricao: string;
  valor: string;
}

export interface ComissaoAgrupada {
  servico: string;
  quantidade: number;
  valorTotal: number;
  comissaoTotal: number;
}

export interface ItemAcertoEquipe {
  profissional: any;
  totalServicos: number;
  comissaoPendente: number;
  comissaoPaga: number;
  recebiveisProf: number;
  abatimentosProf: number;
  aReceber: number;
  idsPendentes: string[];
}

/** Agrupa comissões por nome de serviço para o relatório agrupado */
export function agruparComissoes(comissoesValidas: any[]): ComissaoAgrupada[] {
  return Object.values(
    comissoesValidas.reduce((acc: any, curr: any) => {
      const nomeServico = curr.tipo === 'produto'
        ? 'Venda de Produtos'
        : (curr.agendamentos?.servicos?.nome_servico || 'Serviço não especificado');
      const valorCalculado  = Number(curr.valor_servico) || 0;
      const comissaoCalculada = Number(curr.valor_comissao) || 0;
      if (!acc[nomeServico]) {
        acc[nomeServico] = { servico: nomeServico, quantidade: 0, valorTotal: 0, comissaoTotal: 0 };
      }
      acc[nomeServico].quantidade   += 1;
      acc[nomeServico].valorTotal   += valorCalculado;
      acc[nomeServico].comissaoTotal += comissaoCalculada;
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.quantidade - a.quantidade) as ComissaoAgrupada[];
}

/** Monta o array de acerto de equipe por profissional */
export function calcularAcertoEquipe(profissionais: any[], comissoesValidas: any[], extras: any[]): ItemAcertoEquipe[] {
  return profissionais
    .map(p => {
      const comissoesProf = comissoesValidas.filter((c: any) => c.profissional_id === p.id);
      const extrasProf    = extras.filter((e: any) => e.profissional_id === p.id);
      if (comissoesProf.length === 0 && extrasProf.length === 0) return null;

      const totalServicos    = comissoesProf.reduce((a: number, c: any) => a + Number(c.valor_servico), 0);
      const comissaoPendente = comissoesProf.filter((c: any) => c.status === 'Pendente').reduce((a: number, c: any) => a + Number(c.valor_comissao), 0);
      const comissaoPaga     = comissoesProf.filter((c: any) => c.status === 'Pago').reduce((a: number, c: any) => a + Number(c.valor_comissao), 0);
      const recebiveisProf   = extrasProf.filter((e: any) => e.tipo === 'recebivel').reduce((a: number, e: any) => a + Number(e.valor), 0);
      const abatimentosProf  = extrasProf.filter((e: any) => e.tipo === 'abatimento').reduce((a: number, e: any) => a + Number(e.valor), 0);
      const aReceber         = comissaoPendente + recebiveisProf - abatimentosProf;
      const idsPendentes     = comissoesProf.filter((c: any) => c.status === 'Pendente').map((c: any) => c.id);

      return { profissional: p, totalServicos, comissaoPendente, comissaoPaga, recebiveisProf, abatimentosProf, aReceber, idsPendentes };
    })
    .filter(Boolean) as ItemAcertoEquipe[];
}
