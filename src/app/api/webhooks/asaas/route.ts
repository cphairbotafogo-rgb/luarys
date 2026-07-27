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
import { parseReferenciaWhatsappCreditos, registrarCompraCreditosWhatsapp } from '@/lib/whatsappCreditos';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EVENTOS_APROVADOS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
// "PAYMENT_REFUSED" não existe na lista de eventos aceita pela API de
// cadastro de webhooks do Asaas (confirmado ao registrar o webhook) — recusa
// de cartão em assinatura aparece como cobrança que nunca chega a CONFIRMED e
// eventualmente OVERDUE, não como um evento de recusa dedicado.
const EVENTOS_REJEITADOS = new Set(['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_CHARGEBACK_REQUESTED']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Valida o token secreto enviado pelo Asaas no header (mesmo authToken
    // configurado ao cadastrar o webhook em /v3/webhooks). Obrigatório —
    // sem token configurado, a requisição é rejeitada (fail-closed, mesmo
    // padrão do webhook do Cielo).
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!webhookToken) {
      console.error('[webhook/asaas] ASAAS_WEBHOOK_TOKEN não configurado — requisição bloqueada.');
      return NextResponse.json({ erro: 'Configuração ausente.' }, { status: 500 });
    }
    const tokenRecebido = request.headers.get('asaas-access-token') || '';
    if (tokenRecebido !== webhookToken) {
      console.warn('[webhook/asaas] Token inválido — requisição rejeitada.');
      return NextResponse.json({ erro: 'Token inválido.' }, { status: 401 });
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

    // Resolve a referência do pagamento ANTES de qualquer coisa — cobranças
    // geradas automaticamente por uma subscription (ciclos recorrentes após o
    // primeiro, inclusive nas assinaturas mensais de créditos WhatsApp) nem
    // sempre repetem o externalReference da fatura original. O Asaas garante
    // isso no external reference da SUBSCRIPTION, então cai pra buscar por lá
    // quando a fatura não tiver um de forma direta. Precisa vir antes do
    // branch whatsapp x assinatura, senão uma renovação mensal de crédito
    // sem externalReference na fatura nunca seria identificada como tal.
    let referenciaBruta: string | undefined = pagamento.externalReference;
    if (!referenciaBruta && pagamento.subscription) {
      const subResp = await fetch(`${asaasBase}/subscriptions/${pagamento.subscription}`, {
        headers: { 'access_token': asaasKey },
      });
      if (subResp.ok) {
        const subData = await subResp.json();
        referenciaBruta = subData.externalReference;
      }
    }

    // Compra de créditos WhatsApp (avulsa OU assinatura mensal —
    // "whatsapp::salaoId::pacoteId") — checada ANTES de parseReferencia, que
    // não reconhece esse formato e (por só validar salaoId/moduloChave
    // não-vazios) interpretaria "whatsapp" como salaoId sem erro, corrompendo
    // o fluxo de assinatura de módulo/plano.
    const refCreditos = parseReferenciaWhatsappCreditos(referenciaBruta);
    if (refCreditos) {
      const statusFinal = eAprovado;
      const resultadoCreditos = await registrarCompraCreditosWhatsapp({
        salaoId:            refCreditos.salaoId,
        pacoteId:           refCreditos.pacoteId,
        meioPagamento:      pagamento.billingType === 'PIX' ? 'pix' : 'cartao_credito',
        pagamentoExternoId: paymentId,
        aprovado:           statusFinal,
      });
      return NextResponse.json({ recebido: true, ...resultadoCreditos });
    }

    const referencia = parseReferencia(referenciaBruta);

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
      asaasSubscriptionId: pagamento.subscription || undefined,
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
