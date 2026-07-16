/**
 * src/app/api/webhooks/cielo/route.ts
 *
 * Recebe notificações do Cielo Checkout para pagamentos de assinatura da plataforma.
 *
 * Cielo envia um POST com corpo form-encoded ou JSON contendo:
 *   - merchant_order_number  → nosso OrderNumber (cieloOrderId salvo em pagamentos_assinatura)
 *   - checkout_cielo_order_number → ID interno do Cielo (usado para confirmar via API)
 *   - payment_status → 2 = Pago | 3 = Negado | 4 = Expirado | 5 = Cancelado
 *
 * SEGURANÇA: nunca confiamos só na notificação — confirmamos via API da Cielo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { registrarPagamentoAssinatura } from '@/lib/assinaturas';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CIELO_API = 'https://cieloecommerce.cielo.com.br/api/public/v2/orders';

async function confirmarPagamentoCielo(
  cieloOrderId: string,
  merchantId: string,
  merchantKey: string
): Promise<{ pago: boolean; valor: number } | null> {
  try {
    const res = await fetch(`${CIELO_API}/${cieloOrderId}`, {
      headers: { clientId: merchantId, clientSecret: merchantKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // payment_status: 2 = Pago
    const pago = data.payment_status === 2 || data.payment?.status === 2;
    const valor = data.amount != null ? Number(data.amount) / 100 : 0;
    return { pago, valor };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Cielo pode enviar form-encoded ou JSON
    const contentType = request.headers.get('content-type') || '';
    let campos: Record<string, string> = {};

    if (contentType.includes('application/json')) {
      campos = await request.json();
    } else {
      const texto = await request.text();
      new URLSearchParams(texto).forEach((v, k) => { campos[k] = v; });
    }

    const merchantOrderNumber   = campos['merchant_order_number']          // nosso OrderNumber
                                || campos['MerchantOrderNumber']
                                || campos['ordernumber'];
    const cieloOrderId          = campos['checkout_cielo_order_number']    // ID interno Cielo
                                || campos['CheckoutCieloOrderNumber'];
    const paymentStatusRaw      = campos['payment_status'] || campos['PaymentStatus'];

    if (!merchantOrderNumber) {
      return NextResponse.json({ recebido: true });
    }

    // Busca o registro pending pelo pagamento_externo_id que gravamos ao criar o checkout
    const { data: pagPendente } = await supabaseAdmin
      .from('pagamentos_assinatura')
      .select('id, salao_id, modulo_chave, valor')
      .eq('pagamento_externo_id', merchantOrderNumber)
      .maybeSingle();

    if (!pagPendente) {
      console.warn('[webhook/cielo] pagamento_externo_id não encontrado:', merchantOrderNumber);
      return NextResponse.json({ recebido: true });
    }

    // Busca credenciais Cielo da conta ativa
    const { data: contaAtiva } = await supabaseAdmin
      .from('plataforma_contas_recebimento')
      .select('gateway, cielo_merchant_id, cielo_merchant_key')
      .eq('ativa', true)
      .maybeSingle();

    // Rejeita silenciosamente se o gateway ativo não for Cielo
    if (contaAtiva && contaAtiva.gateway !== 'cielo') {
      return NextResponse.json({ recebido: true });
    }

    const merchantId  = contaAtiva?.cielo_merchant_id  || process.env.CIELO_MERCHANT_ID;
    const merchantKey = contaAtiva?.cielo_merchant_key || process.env.CIELO_MERCHANT_KEY;

    if (!merchantId || !merchantKey) {
      console.error('[webhook/cielo] Credenciais Cielo não configuradas.');
      return NextResponse.json({ erro: 'Configuração ausente.' }, { status: 500 });
    }

    // Confirma via API da Cielo (não confia no corpo do webhook sozinho)
    let aprovado = false;
    let valorConfirmado = pagPendente.valor;

    if (cieloOrderId) {
      const confirmacao = await confirmarPagamentoCielo(cieloOrderId, merchantId, merchantKey);
      if (confirmacao) {
        aprovado = confirmacao.pago;
        if (confirmacao.valor > 0) valorConfirmado = confirmacao.valor;
      }
    } else {
      // Sem ID interno, usa payment_status da notificação como fallback
      aprovado = paymentStatusRaw === '2';
    }

    const resultado = await registrarPagamentoAssinatura({
      salaoId:           pagPendente.salao_id,
      moduloChave:       pagPendente.modulo_chave,
      valor:             valorConfirmado,
      status:            aprovado ? 'approved' : 'pending',
      gateway:           'cielo',
      pagamentoExternoId: merchantOrderNumber,
    });

    return NextResponse.json({ recebido: true, ...resultado });

  } catch (err: any) {
    console.error('[webhook/cielo] Erro interno:', err);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

// Cielo faz GET para validar a URL do webhook
export async function GET() {
  return NextResponse.json({ ok: true });
}
