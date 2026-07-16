/**
 * src/lib/notificacoes.ts
 *
 * Dispara eventos de cobrança para o N8N via webhook.
 * O N8N cuida do template, envio de e-mail/WhatsApp e retry.
 *
 * Variável de ambiente: N8N_WEBHOOK_COBRANCA
 * (URL do workflow N8N que recebe esses eventos)
 */

export type EventoCobranca =
  | 'lembrete_vencimento'   // D-3 / D-30 — "seu plano vence em breve"
  | 'pagamento_atrasado'    // D+0 a D+6 — "renove agora"
  | 'segundo_aviso_atraso'  // D+7 — "último aviso antes do bloqueio em 74h"
  | 'acesso_bloqueado'      // D+10 (74h após 2º aviso) — "acesso suspenso"
  | 'pagamento_rejeitado';  // gateway rejeitou — "pagamento não aprovado"

export interface NotificacaoCobranca {
  evento: EventoCobranca;
  salao_id: string;
  salao_nome: string;
  email: string;
  item_nome: string;
  item_tipo: 'plano' | 'modulo';
  vencimento_em: string;    // ISO date
  url_renovacao: string;    // link para o salão renovar
}

export async function notificarCobranca(payload: NotificacaoCobranca): Promise<void> {
  const url = process.env.N8N_WEBHOOK_COBRANCA;
  if (!url) {
    console.warn(
      '[notificacoes] N8N_WEBHOOK_COBRANCA não configurada — notificação ignorada:',
      payload.evento, payload.salao_id
    );
    return;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[notificacoes] N8N retornou erro:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[notificacoes] Falha ao chamar N8N webhook:', err);
  }
}
