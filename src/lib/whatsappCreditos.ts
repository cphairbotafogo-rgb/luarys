/**
 * src/lib/whatsappCreditos.ts
 *
 * Compra de créditos de WhatsApp (avulsa, não recorrente) via Asaas.
 * Separado de assinaturas.ts porque não usa plano_chave/módulo — créditos são
 * consumíveis, não uma assinatura com renovação automática.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** externalReference no formato "whatsapp::salaoId::pacoteId" */
export function formatarReferenciaWhatsappCreditos(salaoId: string, pacoteId: string): string {
  return `whatsapp::${salaoId}::${pacoteId}`;
}

export function parseReferenciaWhatsappCreditos(
  ref: string | undefined | null
): { salaoId: string; pacoteId: string } | null {
  if (!ref) return null;
  const partes = ref.split('::');
  if (partes.length !== 3 || partes[0] !== 'whatsapp') return null;
  const [, salaoId, pacoteId] = partes;
  if (!salaoId || !pacoteId) return null;
  return { salaoId, pacoteId };
}

export async function registrarCompraCreditosWhatsapp({
  salaoId,
  pacoteId,
  meioPagamento,
  pagamentoExternoId,
  aprovado,
}: {
  salaoId: string;
  pacoteId: string;
  meioPagamento: string;
  pagamentoExternoId: string;
  aprovado: boolean;
}): Promise<{ creditado: boolean; erro?: string }> {
  if (!aprovado) {
    return { creditado: false };
  }

  const { error } = await supabaseAdmin.rpc('creditar_pacote_whatsapp_pago', {
    p_salao_id: salaoId,
    p_pacote_id: pacoteId,
    p_meio_pagamento: meioPagamento,
    p_pagamento_externo_id: pagamentoExternoId,
  });

  if (error) {
    console.error('[registrarCompraCreditosWhatsapp] Erro ao creditar:', error.message);
    return { creditado: false, erro: error.message };
  }

  return { creditado: true };
}
