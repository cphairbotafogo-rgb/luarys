import { supabase } from "@/lib/supabase";
import { verificarPinGerente } from "@/lib/verificarPinGerente";
import type { Transacao } from "../tipos";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Params {
  salaoId: string;
  transacao: Transacao;
  pin: string;
  motivo: string;
  autorizador: string;
}

interface Resultado {
  ok: boolean;
  erro?: string;
}

async function verificarPin(salaoId: string, pin: string): Promise<string | null> {
  const { valido, erro } = await verificarPinGerente(salaoId, pin);
  if (erro) return erro;
  if (!valido) return 'PIN incorreto.';
  return null;
}

/**
 * Devolve ao estoque o produto revendido e reverte os pontos de fidelidade da
 * venda (ganhos e resgates). Insumo de ficha técnica NÃO volta — foi consumido
 * de verdade no atendimento, ainda que a venda seja estornada.
 * A RPC é idempotente: chamar duas vezes na mesma venda não devolve em dobro.
 */
async function reverterMovimentosDaVenda(financeiroId: string | number, salaoId: string) {
  const { data, error } = await supabase.rpc('reverter_movimentos_venda', {
    p_financeiro_id: Number(financeiroId),
    p_salao_id: salaoId,
  });
  if (error) {
    // Não derruba o estorno: o lançamento financeiro já foi marcado como
    // estornado e o operador precisa ver a operação concluir. Fica no log para
    // ajuste manual de estoque/pontos.
    console.error('[estornarOS] Falha ao reverter estoque/fidelidade:', error.message);
    return;
  }
  const r = data as any;
  if (r?.revertido) {
    console.info(
      `[estornarOS] Venda ${financeiroId}: ${r.itens_estoque_devolvidos} item(ns) devolvidos ao estoque, ${r.pontos_revertidos} ponto(s) revertidos.`,
    );
  }
}

async function reverterAgendamentos(agendamentoIds: any[]) {
  const ids = (agendamentoIds || []).filter((id: any) => typeof id === 'string' && UUID_RE.test(id));
  if (ids.length === 0) return;
  await supabase.from('agendamentos').update({
    status: 'Confirmado', cor: '#3B82F6', valor_comissao: null, comissao_paga: null,
  }).in('id', ids);
  // Remove todas as comissões (pendentes e pagas) — estorno cancela o serviço inteiro
  await supabase.from('comissoes').delete().in('agendamento_id', ids);
}

// Cancela a NFS-e vinculada ao lançamento financeiro (se existir e estiver emitida)
async function cancelarNotaVinculada(finId: string, nota: string) {
  const { data: nf } = await supabase
    .from('notas_fiscais')
    .select('id, status')
    .eq('financeiro_id', finId)
    .maybeSingle();
  if (!nf) return;
  // Marca como Cancelada localmente — operador deve cancelar na prefeitura manualmente
  // se a nota tiver id_externo (já enviada ao provedor)
  await supabase.from('notas_fiscais')
    .update({ status: 'Cancelada', mensagem_erro: `Estornada: ${nota}` })
    .eq('id', nf.id);
}

// Decrementa total_gasto e total_visitas do cliente e registra estorno de pontos
async function reverterMetricasCliente(salaoId: string, clienteNome: string, valor: number) {
  if (!clienteNome || valor <= 0) return;
  const { data: cli } = await supabase
    .from('clientes')
    .select('id')
    .eq('salao_id', salaoId)
    .ilike('nome_completo', clienteNome)
    .maybeSingle();
  if (!cli) return;

  // Via RPC atômica (migration 20260804_correcoes_auditoria) com deltas negativos.
  // Antes era read-modify-write: lia o total e regravava o resultado calculado em
  // JS, então um estorno concorrente com uma venda do mesmo cliente perdia uma das
  // duas gravações. A RPC também já protege contra valor negativo.
  const { error: errMetricas } = await supabase.rpc('ajustar_metricas_cliente', {
    p_cliente_id:    cli.id,
    p_salao_id:      salaoId,
    p_delta_gasto:   -Math.abs(valor),
    p_delta_visitas: -1,
    p_data_visita:   null,
  });
  if (errMetricas) console.error('[estornarOS] Falha ao reverter métricas do cliente:', errMetricas.message);

  // Os pontos de fidelidade em si são revertidos por reverterMovimentosDaVenda()
  // (RPC reverter_movimentos_venda), que devolve ganho e resgate a partir do
  // financeiro_id da venda. Não há lançamento de pontos aqui para não gravar duas
  // linhas de estorno para o mesmo atendimento.
}

export async function estornarOS({ salaoId, transacao, pin, motivo, autorizador }: Params): Promise<Resultado> {
  if (!motivo.trim()) return { ok: false, erro: 'Informe o motivo do estorno.' };

  const errPin = await verificarPin(salaoId, pin);
  if (errPin) return { ok: false, erro: errPin };

  const nota = `Motivo: ${motivo} | Por: ${autorizador} | Em: ${new Date().toLocaleString('pt-BR')}`;
  const isFinanceiro = transacao._origem === 'financeiro';
  const realId = isFinanceiro ? String(transacao.id).replace('fin-', '') : transacao.id;

  if (isFinanceiro) {
    const { data: finRow } = await supabase.from('financeiro')
      .select('agendamento_ids, cliente_nome, valor')
      .eq('id', realId).maybeSingle();

    const { error } = await supabase.from('financeiro')
      .update({ status: 'Estornado', comentario: nota }).eq('id', realId);
    if (error) return { ok: false, erro: 'Erro: ' + error.message };

    await reverterAgendamentos(finRow?.agendamento_ids || []);
    await reverterMovimentosDaVenda(realId, salaoId);
    await cancelarNotaVinculada(String(realId), nota);
    await reverterMetricasCliente(
      salaoId,
      finRow?.cliente_nome || transacao.cliente_nome,
      finRow?.valor        || transacao.valor_total,
    );

    if (transacao.os_numero) {
      await supabase.from('caixa_transacoes')
        .update({ status: 'Estornado' })
        .eq('salao_id', salaoId).eq('os_numero', transacao.os_numero);
    }
  } else {
    const { error } = await supabase.from('caixa_transacoes')
      .update({ status: 'Estornado' }).eq('id', realId);
    if (error) return { ok: false, erro: 'Erro: ' + error.message };

    // Busca o espelho no financeiro: primeiro por os_numero; se nulo, por
    // cliente_nome + minuto (venda de produto sem OS gerada, ex.: gerar_numero_os falhou).
    let finRow: any = null;
    if (transacao.os_numero) {
      const { data } = await supabase.from('financeiro')
        .select('id, agendamento_ids, cliente_nome, valor')
        .eq('salao_id', salaoId).eq('os_numero', transacao.os_numero).maybeSingle();
      finRow = data;
    }
    if (!finRow && transacao.cliente_nome && transacao.data_hora) {
      const minutoInicio = transacao.data_hora.slice(0, 16);
      const minutoFim    = new Date(new Date(transacao.data_hora).getTime() + 60000).toISOString().slice(0, 16);
      const { data } = await supabase.from('financeiro')
        .select('id, agendamento_ids, cliente_nome, valor')
        .eq('salao_id', salaoId)
        .ilike('cliente_nome', transacao.cliente_nome)
        .gte('data_movimentacao', minutoInicio).lte('data_movimentacao', minutoFim + ':59')
        .neq('status', 'Estornado')
        .maybeSingle();
      finRow = data;
    }
    if (finRow) {
      await supabase.from('financeiro')
        .update({ status: 'Estornado', comentario: nota }).eq('id', finRow.id);
      await reverterAgendamentos(finRow.agendamento_ids || []);
      await reverterMovimentosDaVenda(finRow.id, salaoId);
      await cancelarNotaVinculada(String(finRow.id), nota);
      await reverterMetricasCliente(
        salaoId,
        finRow.cliente_nome || transacao.cliente_nome,
        finRow.valor        || transacao.valor_total,
      );
    }
  }

  return { ok: true };
}
