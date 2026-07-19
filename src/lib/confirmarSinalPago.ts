/**
 * Lógica compartilhada entre os webhooks de sinal (Mercado Pago e InfinitePay).
 * Ao confirmar pagamento de sinal, atualiza o agendamento e notifica o salão.
 */
import { createClient } from '@supabase/supabase-js';
import { enviarPushPortal } from './webPush';

export async function confirmarSinalPago(agendamentoId: string): Promise<{ ok: boolean; erro?: string }> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Busca agendamento com dados necessários para notificação
  const { data: ag, error: erroAg } = await supabaseAdmin
    .from('agendamentos')
    .select('id, salao_id, cliente_id, cliente_nome, servico, data, inicio, valor_sinal, status, sinal_pago')
    .eq('id', agendamentoId)
    .maybeSingle();

  if (erroAg || !ag) {
    return { ok: false, erro: 'Agendamento não encontrado.' };
  }

  // Idempotência — ignora se já foi processado
  if (ag.sinal_pago) {
    return { ok: true };
  }

  // Atualiza agendamento: confirma sinal e libera para Agendado
  const novoStatus = ag.status === 'Aguardando Pagamento' ? 'Agendado' : ag.status;
  await supabaseAdmin
    .from('agendamentos')
    .update({ sinal_pago: true, status: novoStatus })
    .eq('id', agendamentoId);

  // Notifica o salão (sininho interno)
  const dataFormatada = ag.data
    ? new Date(ag.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : '';

  await supabaseAdmin.from('notificacoes').insert({
    salao_id: ag.salao_id,
    destinatario_tipo: 'salao',
    destinatario_id: ag.salao_id,
    tipo: 'sinal_confirmado',
    titulo: 'Sinal de reserva confirmado',
    mensagem: `${ag.cliente_nome} pagou o sinal de ${ag.servico} em ${dataFormatada} às ${ag.inicio}.`,
    agendamento_id: ag.id,
  });

  // Busca nome do salão e usuario_portal_id do cliente em paralelo
  const [{ data: salao }, { data: cliente }] = await Promise.all([
    supabaseAdmin.from('saloes').select('nome_fantasia').eq('id', ag.salao_id).maybeSingle(),
    supabaseAdmin.from('clientes').select('usuario_portal_id').eq('id', ag.cliente_id).maybeSingle(),
  ]);

  const nomeSalao = salao?.nome_fantasia || 'Salão';

  if (cliente?.usuario_portal_id) {
    await supabaseAdmin.from('notificacoes').insert({
      salao_id: ag.salao_id,
      destinatario_tipo: 'cliente',
      destinatario_id: cliente.usuario_portal_id,
      tipo: 'sinal_confirmado',
      titulo: 'Reserva confirmada!',
      mensagem: `Seu pagamento foi recebido. Agendamento de ${ag.servico} em ${dataFormatada} às ${ag.inicio} está confirmado.`,
      agendamento_id: ag.id,
    });

    // Web Push — título com nome do salão para o cliente identificar de qual estabelecimento é
    await enviarPushPortal(cliente.usuario_portal_id, {
      titulo: `✅ ${nomeSalao} — Reserva confirmada!`,
      corpo: `${ag.servico} em ${dataFormatada} às ${ag.inicio}. Sinal recebido com sucesso.`,
      tag: `sinal-${ag.id}`,
      url: '/portal',
    }).catch(() => {/* falha no push não deve derrubar o fluxo principal */});
  }

  return { ok: true };
}

/**
 * Extrai o agendamento_id do campo order_nsu/external_reference no formato "reserva_<uuid>".
 * Retorna null se o formato não bater.
 */
export function extrairAgendamentoIdDoSinal(referencia: string | null | undefined): string | null {
  if (!referencia) return null;
  const match = referencia.match(/^reserva_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return match ? match[1] : null;
}
