// Tipos do Clube de Assinaturas (mensalidade recorrente do salão para clientes).

export interface ServicoIncluso {
  servico_id: string;
  nome: string;
  qtd_mes: number;
  preco: number;   // valor unitário do serviço (snapshot ao adicionar) — base do desconto
}

export interface PlanoAssinatura {
  id?: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  desconto_percentual: number;
  servicos_inclusos: ServicoIncluso[];
  cor: string;
  ativo: boolean;
}

export const PLANO_VAZIO: PlanoAssinatura = {
  nome: '',
  descricao: '',
  preco_mensal: 0,
  desconto_percentual: 0,
  servicos_inclusos: [],
  cor: '#D4AF37',
  ativo: true,
};

// Resumo curto dos benefícios para exibir no card do plano.
export function resumoBeneficios(p: PlanoAssinatura): string {
  const partes: string[] = [];
  if (p.desconto_percentual > 0) partes.push(`${p.desconto_percentual}% off geral`);
  const totalServicos = p.servicos_inclusos.reduce((s, x) => s + (Number(x.qtd_mes) || 0), 0);
  if (totalServicos > 0) partes.push(`${totalServicos} serviço${totalServicos > 1 ? 's' : ''} incluso${totalServicos > 1 ? 's' : ''}/mês`);
  return partes.length ? partes.join(' · ') : 'Sem benefícios definidos';
}
