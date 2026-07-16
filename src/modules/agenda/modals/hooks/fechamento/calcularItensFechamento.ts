/**
 * calcularItensFechamento.ts
 *
 * Cálculo PURO (sem I/O, sem await) de comissões, baixas de estoque e
 * finalizações de agendamento para o Fechamento de Conta.
 *
 * Retorna os arrays que a RPC `fechar_conta_atomico` grava numa transação.
 * Inclui o ramo de ASSINATURA (serviço incluso pago via Clube): quando coberto,
 * o cliente paga R$ 0 e a comissão do designado é proporcional ao desconto.
 */

// ── Contexto de assinatura do cliente (Clube) ────────────────────────────────
export interface AssinaturaCtx {
  subscriptions: Array<{
    assinatura_id: string;
    preco_mensal: number;
    valor_cheio: number;                 // Σ preço×qtd dos serviços inclusos do plano
    inclusos: Record<string, number>;    // servico_id → qtd_mes incluída
    profArea: Record<string, string>;    // categoria → profissional_id designado
  }>;
  consumoInicial: Record<string, number>; // `${assinatura_id}|${servico_id}` → já consumidos no mês
  categoriaPorServico: Record<string, string>; // servico_id → categoria
}

export interface ConsumoAssinatura {
  assinatura_id: string;
  servico_id: string;
  profissional_id: string;
  valor_cheio: number;
  agendamento_id: string | null;
}

interface Params {
  itens: any[];
  fichasTecnicas: any[];
  profissionaisDb: any[];
  servicosDb: any[];
  produtosDb: any[];
  modoDescontoCusto: string;
  modoTaxaOp: string;
  percTaxaOpCustom: number;
  taxaOperadoraPercent: number;
  assinatura?: AssinaturaCtx | null;
}

export interface ComissaoCalculada {
  id_prof: string;
  profissional_id: string;
  agendamento_id: string | null;
  status: string;
  servico_nome: string;
  valor_servico: number;
  porcentagem_comissao: number;
  valor_comissao: number;
}

export interface BaixaEstoque {
  produto_id: string;
  quantidade: number;
  motivo: string;
}

export interface FinalizacaoAgendamento {
  id: string;
  valor_comissao: number;
  desconto: number | null;
  valor_final: number;
}

export interface ResultadoCalculo {
  comissoes: ComissaoCalculada[];
  estoque: BaixaEstoque[];
  agendamentos: FinalizacaoAgendamento[];
  valorTotalComissoes: number;
  profissionalPrincipal: string;
  valorCoberto: number;              // total dos serviços cobertos pela assinatura (não cobrar do cliente)
  consumos: ConsumoAssinatura[];     // consumos de assinatura a registrar
}

export function calcularItensFechamento(p: Params): ResultadoCalculo {
  const comissoes: ComissaoCalculada[] = [];
  const estoque: BaixaEstoque[] = [];
  const agendamentos: FinalizacaoAgendamento[] = [];
  const consumos: ConsumoAssinatura[] = [];
  let valorTotalComissoes = 0;
  let valorCoberto = 0;
  let profissionalPrincipal = 'Equipe';

  // Saldo de consumo do mês, mutável ao longo deste fechamento (2 cortes na mesma
  // conta descontam 2 do limite).
  const consumoLocal: Record<string, number> = { ...(p.assinatura?.consumoInicial || {}) };

  // Retorna { assinatura_id, fator, chave } se o serviço é coberto pela assinatura:
  // plano inclui o serviço + executor é o profissional designado da área + há saldo.
  function checarCobertura(servicoId: string, profId: string | null) {
    const ctx = p.assinatura;
    if (!ctx || !servicoId || !profId) return null;
    const categoria = ctx.categoriaPorServico[servicoId] || 'Geral';
    for (const sub of ctx.subscriptions) {
      const qtd = sub.inclusos[servicoId];
      if (!qtd) continue;
      if (sub.profArea[categoria] !== profId) continue;     // só o designado
      const chave = `${sub.assinatura_id}|${servicoId}`;
      if ((consumoLocal[chave] || 0) >= qtd) continue;       // sem saldo no mês
      const fator = sub.valor_cheio > 0 ? Math.max(0, Math.min(1, sub.preco_mensal / sub.valor_cheio)) : 1;
      return { assinatura_id: sub.assinatura_id, fator, chave };
    }
    return null;
  }

  for (const item of p.itens) {
    const profissional = p.profissionaisDb.find((pr: any) =>
      pr.id === (item.profissional_id || item.id_prof) || pr.nome === item.profissional
    );
    let porcentagem = 0;
    let custoInsumosDeducao = 0;
    const ehProduto = item.tipo === 'produto' && item.produto_id;
    const servicoId = item.item_id || item.id;

    if (ehProduto) {
      estoque.push({ produto_id: item.produto_id, quantidade: (item.qtd || 1), motivo: 'Venda no Fechamento' });
      if (profissional && profissional.nome !== 'Equipe') porcentagem = profissional.comissao_produtos || 0;
    } else {
      if (profissional && profissional.nome !== 'Equipe') {
        porcentagem = profissional.servicos_comissoes?.[servicoId] || 0;
      }
      const fichaDoServico = p.fichasTecnicas.filter(f => f.servico_id === servicoId);
      for (const f of fichaDoServico) {
        const qtdUsada = f.quantidade * (item.qtd || 1);
        const custoMedio = f.produtos?.custo_medio || 0;
        custoInsumosDeducao += qtdUsada * custoMedio;
        estoque.push({ produto_id: f.produto_id, quantidade: qtdUsada, motivo: `Uso no Serviço: ${item.nome}` });
      }
    }

    // Cobertura da assinatura (só serviços, com profissional executor definido)
    const cobertura = !ehProduto ? checarCobertura(servicoId, item.profissional_id) : null;

    let valorComissaoAgendamento = 0;
    if (profissional && profissional.nome !== 'Equipe') {
      profissionalPrincipal = profissional.nome;
      const valorBase = item.preco * (item.qtd || 1);

      if (cobertura) {
        // ── SERVIÇO INCLUSO NA ASSINATURA ──────────────────────────────────
        // Cliente paga R$ 0; comissão PROPORCIONAL (valor cheio × fator do desconto).
        const realizado = valorBase * cobertura.fator;
        valorComissaoAgendamento = porcentagem > 0 ? (realizado * porcentagem) / 100 : 0;
        if (valorComissaoAgendamento > 0) {
          valorTotalComissoes += valorComissaoAgendamento;
          comissoes.push({
            id_prof: profissional.id,
            profissional_id: profissional.id,
            agendamento_id: item.agendamento_id || null,
            status: 'Pendente',
            servico_nome: `${item.nome} (Assinatura)`,
            valor_servico: realizado,
            porcentagem_comissao: porcentagem,
            valor_comissao: valorComissaoAgendamento,
          });
        }
        valorCoberto += valorBase;
        consumoLocal[cobertura.chave] = (consumoLocal[cobertura.chave] || 0) + (item.qtd || 1);
        consumos.push({
          assinatura_id: cobertura.assinatura_id,
          servico_id: servicoId,
          profissional_id: item.profissional_id,
          valor_cheio: valorBase,
          agendamento_id: item.agendamento_id || null,
        });
      } else if (porcentagem > 0) {
        // ── SERVIÇO/PRODUTO NORMAL (regra atual) ───────────────────────────
        const desconto = Number(item.desconto) || 0;
        const servicoRef = !ehProduto
          ? (p.servicosDb as any[]).find((s: any) => s.nome_servico === item.nome || s.nome === item.nome || s.id === item.item_id)
          : null;
        const custoOperacional = servicoRef?.custo_operacional || 0;

        let valorBaseComissao: number;
        if (p.modoDescontoCusto === 'antes') {
          valorBaseComissao = Math.max(0, valorBase - desconto - custoInsumosDeducao - custoOperacional);
          valorComissaoAgendamento = (valorBaseComissao * porcentagem) / 100;
        } else if (p.modoDescontoCusto === 'depois') {
          valorBaseComissao = Math.max(0, valorBase - desconto - custoInsumosDeducao);
          valorComissaoAgendamento = Math.max(0, (valorBaseComissao * porcentagem) / 100 - custoOperacional);
        } else {
          valorBaseComissao = Math.max(0, valorBase - desconto - custoInsumosDeducao);
          valorComissaoAgendamento = (valorBaseComissao * porcentagem) / 100;
        }

        if (p.modoTaxaOp !== 'nao_descontar' && p.taxaOperadoraPercent > 0) {
          const valorServicoLiq = valorBase - desconto;
          const taxaTotalServico = valorServicoLiq * (p.taxaOperadoraPercent / 100);
          let deducaoTaxa = 0;
          if (p.modoTaxaOp === 'proporcional')       deducaoTaxa = taxaTotalServico * (porcentagem / 100);
          else if (p.modoTaxaOp === 'total')         deducaoTaxa = taxaTotalServico;
          else if (p.modoTaxaOp === 'metade')        deducaoTaxa = taxaTotalServico * 0.5;
          else if (p.modoTaxaOp === 'personalizado') deducaoTaxa = taxaTotalServico * (p.percTaxaOpCustom / 100);
          valorComissaoAgendamento = Math.max(0, valorComissaoAgendamento - deducaoTaxa);
        }

        if (valorComissaoAgendamento > 0) {
          valorTotalComissoes += valorComissaoAgendamento;
          comissoes.push({
            id_prof: profissional.id,
            profissional_id: profissional.id,
            agendamento_id: item.agendamento_id || null,
            status: 'Pendente',
            servico_nome: item.nome,
            valor_servico: (valorBase - desconto),
            porcentagem_comissao: porcentagem,
            valor_comissao: valorComissaoAgendamento,
          });
        }
      }
    }

    if (item.agendamento_id) {
      if (cobertura) {
        // Coberto: cliente não paga; registra desconto = valor cheio, valor_final = 0.
        agendamentos.push({
          id: item.agendamento_id,
          valor_comissao: valorComissaoAgendamento,
          desconto: item.preco * (item.qtd || 1),
          valor_final: 0,
        });
      } else {
        const descontoItem = Number(item.desconto) || 0;
        const valorFinalReal = (item.preco * (item.qtd || 1)) - descontoItem;
        agendamentos.push({
          id: item.agendamento_id,
          valor_comissao: valorComissaoAgendamento,
          desconto: descontoItem > 0 ? descontoItem : null,
          valor_final: valorFinalReal,
        });
      }
    }
  }

  return { comissoes, estoque, agendamentos, valorTotalComissoes, profissionalPrincipal, valorCoberto, consumos };
}
