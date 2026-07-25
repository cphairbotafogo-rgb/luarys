/**
 * src/lib/notificarAgendamento.ts
 *
 * Dispara a confirmação de agendamento pelo canal preferido do cliente
 * (clientes.canal_notificacao_preferido: 'whatsapp' | 'email'), com
 * fallback automático pra e-mail se o WhatsApp falhar (template não
 * aprovado ainda na Meta, sem crédito, não configurado, etc) — nunca
 * bloqueia a criação do agendamento, erros só são logados.
 *
 * Requer, pra funcionar de fato:
 *   - WhatsApp: template aprovado na Meta com o nome em
 *     WHATSAPP_TEMPLATE_CONFIRMACAO_AGENDAMENTO (padrão:
 *     "confirmacao_agendamento") e credenciais em Admin → WhatsApp Luarys.
 *   - E-mail: RESEND_API_KEY configurado (ver src/lib/email.ts).
 * Sem nenhum dos dois configurado, a chamada não faz nada (loga e retorna).
 */
import { createClient } from '@supabase/supabase-js';
import { enviarEmail } from './email';
import { enviarWhatsappTemplate } from './whatsappEnviar';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEMPLATE_CONFIRMACAO = process.env.WHATSAPP_TEMPLATE_CONFIRMACAO_AGENDAMENTO || 'confirmacao_agendamento';

export async function notificarConfirmacaoAgendamento(agendamentoId: string): Promise<void> {
  try {
    const { data: ag, error: erroAg } = await supabaseAdmin
      .from('agendamentos')
      .select('salao_id, cliente_id, data, inicio, servico, profissional_id')
      .eq('id', agendamentoId)
      .maybeSingle();
    if (erroAg) console.error('[notificarConfirmacaoAgendamento] Erro ao buscar agendamento:', erroAg.message);
    if (!ag?.cliente_id) return;

    const [{ data: cliente }, { data: salao }, resProf] = await Promise.all([
      supabaseAdmin.from('clientes').select('nome_completo, telefone_whatsapp, email, canal_notificacao_preferido').eq('id', ag.cliente_id).maybeSingle(),
      supabaseAdmin.from('saloes').select('nome_fantasia, razao_social').eq('id', ag.salao_id).maybeSingle(),
      ag.profissional_id
        ? supabaseAdmin.from('profissionais').select('nome').eq('id', ag.profissional_id).maybeSingle()
        : Promise.resolve({ data: null } as { data: { nome: string } | null }),
    ]);
    if (!cliente) return;

    const nomeSalao = salao?.nome_fantasia || salao?.razao_social || 'Salão';
    const dataFormatada = ag.data
      ? new Date(ag.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : '';
    const nomeProf = resProf?.data?.nome || '';

    // Extraídos em variáveis simples (não o objeto `ag`, que o TS não
    // consegue provar como não-nulo dentro das closures abaixo).
    const salaoId = ag.salao_id;
    const clienteIdAg = ag.cliente_id;
    const horario = ag.inicio;
    const servico = ag.servico;
    const nomeCliente = cliente.nome_completo;
    const telefoneCliente = cliente.telefone_whatsapp;
    const emailCliente = cliente.email;

    async function tentarWhatsapp(): Promise<boolean> {
      if (!telefoneCliente) return false;
      // Ordem das variáveis precisa bater com o corpo do template aprovado
      // na Meta — ajustar aqui quando o template for criado de verdade.
      const resultado = await enviarWhatsappTemplate({
        salaoId,
        telefone: telefoneCliente,
        templateNome: TEMPLATE_CONFIRMACAO,
        templateVariaveis: [nomeCliente, dataFormatada, horario, servico, nomeProf, nomeSalao].filter(Boolean),
        tipoConversa: 'utilidade',
        clienteId: clienteIdAg,
      });
      if (!resultado.ok) console.warn('[notificarConfirmacaoAgendamento] WhatsApp falhou:', resultado.erro);
      return resultado.ok;
    }

    async function tentarEmail(): Promise<boolean> {
      if (!emailCliente) return false;
      const resultado = await enviarEmail({
        to: emailCliente,
        subject: `Agendamento confirmado — ${nomeSalao}`,
        html: `
          <p>Olá, ${nomeCliente}!</p>
          <p>Seu horário está confirmado:</p>
          <p><strong>${dataFormatada} às ${horario}</strong><br/>${servico}${nomeProf ? ` · ${nomeProf}` : ''}</p>
          <p>${nomeSalao}</p>
        `,
      });
      if (!resultado.ok) console.warn('[notificarConfirmacaoAgendamento] E-mail falhou:', resultado.erro);
      return resultado.ok;
    }

    // Tenta o canal preferido primeiro; se não tiver dado disponível ou o
    // envio falhar, cai pro outro canal — nunca deixa de tentar avisar o
    // cliente só porque o canal escolhido não está disponível.
    const canalPreferido = cliente.canal_notificacao_preferido === 'email' ? 'email' : 'whatsapp';
    const ordem = canalPreferido === 'email' ? [tentarEmail, tentarWhatsapp] : [tentarWhatsapp, tentarEmail];
    for (const tentar of ordem) {
      if (await tentar()) break;
    }
  } catch (err: any) {
    console.error('[notificarConfirmacaoAgendamento] Erro interno:', err);
  }
}
