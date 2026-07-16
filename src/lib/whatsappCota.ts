/**
 * src/lib/whatsappCota.ts
 *
 * Controle de créditos WhatsApp — modelo por mensagem (Meta, desde julho/2025).
 *
 * Categorias pagas (requerem template_nome no envio):
 *   marketing      → debita saldo_campanha
 *   utilidade      → debita saldo_atendimento
 *   autenticacao   → debita saldo_atendimento
 *
 * Texto livre (sem template_nome): sempre gratuito — não debita saldo.
 * Plano B (gestao_meta): Meta cobra o salão diretamente — sem controle de saldo aqui.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type CategoriaTemplate = 'marketing' | 'utilidade' | 'autenticacao';

export type ConfigWhatsappMestre = {
  provedor: string;
  token: string;
  phone_number_id: string;
  waba_id: string;
};

export type ResultadoVerificacao =
  | { permitido: true; tipoDebito: 'campanha' | 'atendimento' | 'gratuito'; saldoRestante: number }
  | { permitido: false; motivo: string };

/** Carrega as credenciais mestras da Luarys. Usar apenas em rotas de API (server). */
export async function carregarConfigMestra(admin: SupabaseClient): Promise<ConfigWhatsappMestre | null> {
  const { data } = await admin
    .from('plataforma_whatsapp_config')
    .select('provedor, token, phone_number_id, waba_id')
    .eq('id', 1)
    .maybeSingle();
  return data ?? null;
}

/**
 * Verifica saldo antes de enviar.
 * Texto livre (categoria = 'texto') → sempre permitido sem consumir saldo.
 * Templates → verifica whatsapp_carteira_creditos.
 */
export async function verificarSaldo(
  admin: SupabaseClient,
  salaoId: string,
  categoria: CategoriaTemplate | 'texto',
): Promise<ResultadoVerificacao> {
  if (categoria === 'texto') {
    return { permitido: true, tipoDebito: 'gratuito', saldoRestante: -1 };
  }

  const { data: carteira } = await admin
    .from('whatsapp_carteira_creditos')
    .select('saldo_atendimento, saldo_campanha')
    .eq('salao_id', salaoId)
    .maybeSingle();

  if (!carteira) {
    return {
      permitido: false,
      motivo: 'Nenhum crédito WhatsApp disponível. Adquira um pacote em Central de Comunicação.',
    };
  }

  if (categoria === 'marketing') {
    if ((carteira.saldo_campanha ?? 0) <= 0) {
      return { permitido: false, motivo: 'Saldo de campanha esgotado. Adquira créditos de campanha para continuar.' };
    }
    return { permitido: true, tipoDebito: 'campanha', saldoRestante: carteira.saldo_campanha - 1 };
  }

  if ((carteira.saldo_atendimento ?? 0) <= 0) {
    return { permitido: false, motivo: 'Saldo de atendimento esgotado. Adquira créditos de atendimento para continuar.' };
  }
  return { permitido: true, tipoDebito: 'atendimento', saldoRestante: carteira.saldo_atendimento - 1 };
}

/**
 * Debita 1 crédito e registra no log após envio confirmado pela API da Meta.
 * Usa a RPC debitar_credito_whatsapp (atômica, com FOR UPDATE).
 * Se o saldo zerou entre a verificação e o envio, apenas loga sem reverter
 * (a mensagem já foi entregue; a pequena discrepância é aceitável).
 */
export async function debitarMensagem(
  admin: SupabaseClient,
  salaoId: string,
  categoria: CategoriaTemplate,
  opts: {
    phoneNumberId: string;
    wamid?: string;
    clienteId?: string;
    campanhaId?: string;
  }
): Promise<void> {
  const origem = categoria === 'marketing' ? 'campanha' : 'atendimento';
  await admin.rpc('debitar_credito_whatsapp', {
    p_salao_id: salaoId,
    p_sub_waba_id: opts.phoneNumberId,
    p_categoria: categoria,
    p_origem: origem,
    p_custo_unitario: 1,
    p_meta_message_id: opts.wamid ?? null,
    p_cliente_id: opts.clienteId ?? null,
    p_campanha_id: opts.campanhaId ?? null,
  });
}
