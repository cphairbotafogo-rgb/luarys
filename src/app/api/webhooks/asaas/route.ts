/**
 * src/app/api/webhooks/asaas/route.ts
 *
 * Recebe notificações do Asaas para pagamentos de assinatura da plataforma.
 *
 * Verificação: re-busca o pagamento na API do Asaas usando o ID recebido
 * no webhook — nunca confia só no payload. Suporta PAYMENT_RECEIVED e
 * PAYMENT_CONFIRMED (PIX confirma com CONFIRMED, cartão com RECEIVED).
 *
 * Variáveis de ambiente necessárias:
 *   ASAAS_API_KEY         — chave da conta Luarys no Asaas
 *   ASAAS_ENVIRONMENT     — "sandbox" ou "production" (padrão: production)
 *   ASAAS_WEBHOOK_TOKEN   — token secreto configurado no painel Asaas
 *                           (Configurações → Integrações → Webhooks)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { registrarPagamentoAssinatura, parseReferencia } from '@/lib/assinaturas';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EVENTOS_APROVADOS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const EVENTOS_REJEITADOS = new Set(['PAYMENT_REFUSED', 'PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_CHARGEBACK_REQUESTED']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Valida o token secreto enviado pelo Asaas no header (configurado no painel)
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (webhookToken) {
      const tokenRecebido = request.headers.get('asaas-access-token') || '';
      if (tokenRecebido !== webhookToken) {
        console.warn('[webhook/asaas] Token inválido — requisição rejeitada.');
        return NextResponse.json({ erro: 'Token inválido.' }, { status: 401 });
      }
    }

    const evento    = body.event as string | undefined;
    const paymentId = body.payment?.id as string | undefined;

    if (!evento || !paymentId) {
      return NextResponse.json({ recebido: true });
    }

    // Ignora eventos que não sejam de pagamento finalizado ou rejeitado
    const eAprovado  = EVENTOS_APROVADOS.has(evento);
    const eRejeitado = EVENTOS_REJEITADOS.has(evento);
    if (!eAprovado && !eRejeitado) {
      return NextResponse.json({ recebido: true });
    }

    // Busca conta ativa para obter a chave da API
    const { data: contaAtiva } = await supabaseAdmin
      .from('plataforma_contas_recebimento')
      .select('gateway, asaas_api_key, asaas_environment')
      .eq('ativa', true)
      .maybeSingle();

    // Rejeita silenciosamente se o gateway ativo não for Asaas
    if (contaAtiva && contaAtiva.gateway !== 'asaas') {
      return NextResponse.json({ recebido: true });
    }

    const asaasKey = (contaAtiva as any)?.asaas_api_key || process.env.ASAAS_API_KEY;
    if (!asaasKey) {
      console.error('[webhook/asaas] ASAAS_API_KEY não configurado.');
      return NextResponse.json({ erro: 'Configuração ausente.' }, { status: 500 });
    }

    const asaasEnv  = (contaAtiva as any)?.asaas_environment || process.env.ASAAS_ENVIRONMENT || 'production';
    const asaasBase = asaasEnv === 'sandbox'
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3';

    // Re-busca o pagamento na API (nunca confiar só no payload do webhook)
    const pagResp = await fetch(`${asaasBase}/payments/${paymentId}`, {
      headers: { 'access_token': asaasKey },
    });

    if (!pagResp.ok) {
      console.error(`[webhook/asaas] Falha ao buscar pagamento ${paymentId} na API.`);
      return NextResponse.json({ erro: 'Não foi possível consultar o pagamento no Asaas.' }, { status: 400 });
    }

    const pagamento = await pagResp.json();
    const referencia = parseReferencia(pagamento.externalReference);

    if (!referencia) {
      // Cobrança sem referência — não é do sistema de assinaturas
      return NextResponse.json({ recebido: true });
    }

    const statusFinal: 'approved' | 'rejected' | 'pending' = eAprovado ? 'approved' : 'rejected';

    const resultado = await registrarPagamentoAssinatura({
      salaoId:           referencia.salaoId,
      moduloChave:       referencia.moduloChave,
      valor:             pagamento.value,
      status:            statusFinal,
      gateway:           'asaas',
      pagamentoExternoId: paymentId,
      periodo:           referencia.periodo,
    });

    return NextResponse.json({ recebido: true, ...resultado });

  } catch (err: any) {
    console.error('[webhook/asaas] Erro interno:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}

// Asaas pode fazer GET para validar a URL
export async function GET() {
  return NextResponse.json({ ok: true });
}
