import { supabase } from "@/lib/supabase";
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
  const { data: sl, error } = await supabase.from('saloes').select('pin_gerente').eq('id', salaoId).maybeSingle();
  if (error || !sl) return 'Não foi possível verificar o PIN. Tente novamente.';
  if (!sl.pin_gerente) return 'PIN de gerente não configurado. Acesse Configurações → Segurança.';
  if (pin !== sl.pin_gerente) return 'PIN incorreto.';
  return null;
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
    .select('id, total_gasto, total_visitas')
    .eq('salao_id', salaoId)
    .ilike('nome_completo', clienteNome)
    .maybeSingle();
  if (!cli) return;

  await supabase.from('clientes').update({
    total_gasto:   Math.max(0, (cli.total_gasto   || 0) - valor),
    total_visitas: Math.max(0, (cli.total_visitas || 1) - 1),
  }).eq('id', cli.id);

  // Registra estorno de pontos de fidelidade (falha silenciosa — nunca bloqueia o estorno)
  supabase.from('fidelidade_transacoes').insert({
    salao_id: salaoId,
    cliente_id: cli.id,
    tipo: 'estorno',
    pontos: 0,
    descricao: `Estorno de atendimento — ${clienteNome}`,
  }).then(() => {}, () => {}); // fire-and-forget; 2º arg trata rejeição (thenable do Supabase não tem .catch)
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
