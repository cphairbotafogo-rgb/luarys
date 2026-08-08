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
  | 'lembrete_vencimento'   // D-2 e D-1 — "confira se o pagamento está em dia"
  | 'vence_hoje'            // D+0 — "vence hoje". NÃO é atraso: o dia do
                            //       vencimento ainda é prazo, e chamar de
                            //       atraso quem tem até hoje para pagar é
                            //       cobrar antes da hora.
  | 'pagamento_atrasado'    // D+1 a D+6 — "renove agora"
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
  /**
   * Texto de rodapé que TODA mensagem de cobrança deve trazer.
   *
   * O aviso sai de uma leitura do nosso banco, e pagamento leva tempo para ser
   * confirmado — cartão pode estar em processamento, boleto compensa em dias.
   * Sem esta linha, quem pagou ontem recebe uma cobrança e acha que o dinheiro
   * sumiu. É o mesmo cuidado de qualquer aviso automático: dizer o que fazer
   * quando a mensagem chega errada.
   */
  nota_rodape?: string;
}

export const RODAPE_COBRANCA =
  'Se o pagamento já foi realizado, desconsidere esta mensagem — pode levar algumas horas até a confirmação chegar até nós.';

/**
 * Devolve `true` só quando o aviso REALMENTE saiu.
 *
 * Antes era `Promise<void>`: falhava em silêncio e quem chamava marcava
 * `aviso_enviado_em` do mesmo jeito. Sem a variável configurada — que é o estado
 * do Vercel hoje — o sistema registrava que avisou, ninguém recebia nada, e o
 * aviso seguinte era pulado porque "já tinha avisado". O salão só descobria ao
 * ser suspenso, sem ter recebido um único aviso.
 *
 * Agora quem chama decide o que fazer com o falso, e a régua só carimba o que
 * saiu de fato.
 */
export async function notificarCobranca(payload: NotificacaoCobranca): Promise<boolean> {
  const url = process.env.N8N_WEBHOOK_COBRANCA;
  if (!url) {
    console.error(
      '[notificacoes] N8N_WEBHOOK_COBRANCA não configurada — NENHUM aviso de cobrança está sendo entregue:',
      payload.evento, payload.salao_id
    );
    return false;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[notificacoes] N8N retornou erro:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[notificacoes] Falha ao chamar N8N webhook:', err);
    return false;
  }
}
