/**
 * POST /api/whatsapp/comprar-creditos
 *
 * Gera uma cobrança AVULSA (não recorrente) no Asaas para compra de créditos
 * de WhatsApp — PIX ou cartão de crédito à vista. O saldo só é creditado
 * quando o webhook /api/webhooks/asaas confirmar o pagamento (ver
 * src/lib/whatsappCreditos.ts).
 *
 * Substitui /api/whatsapp/comprar-creditos-teste (que credita direto, sem
 * confirmar pagamento real, e por isso fica desabilitada por padrão em
 * produção).
 */
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { autenticarRota } from '@/lib/apiAuth';
import { formatarReferenciaWhatsappCreditos } from '@/lib/whatsappCreditos';
import { rateLimitExcedido, obterIp } from '@/lib/rateLimiter';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEIOS_VALIDOS = ['pix', 'cartao_credito'] as const;

export async function POST(request: NextRequest) {
  try {
    const ip = obterIp(request as any);
    if (await rateLimitExcedido(`whatsapp-comprar-creditos:${ip}`, 10, 600)) {
      return NextResponse.json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const { user, perfil, erro } = await autenticarRota(request, 'POST /api/whatsapp/comprar-creditos');
    if (erro) return erro;

    const { pacoteId, meioPagamento } = await request.json();

    if (!UUID_RE.test(String(pacoteId))) {
      return NextResponse.json({ erro: 'Pacote inválido.' }, { status: 400 });
    }
    if (!MEIOS_VALIDOS.includes(meioPagamento)) {
      return NextResponse.json({ erro: 'Meio de pagamento inválido.' }, { status: 400 });
    }

    // Aceita dono (perfis_usuarios) ou funcionário com salao_id — mesmo
    // padrão de resolução usado em criar-checkout.
    const { data: funcionario, error: erroFuncionario } = await supabaseAdmin
      .from('profissionais')
      .select('salao_id')
      .eq('id', user!.id)
      .maybeSingle();
    if (erroFuncionario) console.error('[whatsapp/comprar-creditos] Erro ao buscar profissionais:', erroFuncionario.message);

    const salaoId = perfil?.salao_id || funcionario?.salao_id;
    if (!salaoId) {
      return NextResponse.json({ erro: 'Perfil sem salão associado.' }, { status: 403 });
    }

    // Preço/quantidade vêm do banco — nunca confiar em valor mandado pelo cliente
    const { data: pacote, error: erroPacote } = await supabaseAdmin
      .from('whatsapp_pacotes')
      .select('id, tipo, quantidade, preco, ativo')
      .eq('id', pacoteId)
      .maybeSingle();
    if (erroPacote) console.error('[whatsapp/comprar-creditos] Erro ao buscar whatsapp_pacotes:', erroPacote.message);

    if (!pacote?.ativo) {
      return NextResponse.json({ erro: 'Pacote não encontrado ou indisponível.' }, { status: 404 });
    }

    const { data: salao, error: erroSalao } = await supabaseAdmin
      .from('saloes')
      .select('id, nome_fantasia, razao_social, email_contato, cnpj, telefone')
      .eq('id', salaoId)
      .maybeSingle();
    if (erroSalao || !salao) {
      return NextResponse.json({ erro: 'Salão não encontrado.' }, { status: 404 });
    }

    const { data: contaAtivaRaw, error: erroContaAtiva } = await supabaseAdmin
      .from('plataforma_contas_recebimento')
      .select('gateway, asaas_api_key, asaas_environment')
      .eq('ativa', true)
      .maybeSingle();
    const contaAtiva = contaAtivaRaw as any;

    if (erroContaAtiva) console.error('[whatsapp/comprar-creditos] Erro ao buscar conta ativa:', erroContaAtiva.message);

    if (!contaAtiva || contaAtiva.gateway !== 'asaas') {
      return NextResponse.json({ erro: 'Compra de créditos indisponível: gateway de pagamento ainda não configurado.' }, { status: 503 });
    }

    const asaasKey = contaAtiva.asaas_api_key || process.env.ASAAS_API_KEY;
    if (!asaasKey) {
      return NextResponse.json({ erro: 'ASAAS_API_KEY não configurado.' }, { status: 500 });
    }

    const asaasEnv = contaAtiva.asaas_environment || process.env.ASAAS_ENVIRONMENT || 'production';
    const asaasBase = asaasEnv === 'sandbox'
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3';

    // Busca cliente pelo e-mail; cria se não existir (mesma lógica de criar-checkout)
    let asaasCustomerId = '';
    if (salao.email_contato) {
      const searchResp = await fetch(`${asaasBase}/customers?email=${encodeURIComponent(salao.email_contato)}`, {
        headers: { 'access_token': asaasKey },
      });
      if (!searchResp.ok) {
        const searchErrData = await searchResp.json().catch(() => ({}));
        return NextResponse.json({ erro: 'Falha ao consultar cliente no Asaas: ' + (searchErrData.errors?.[0]?.description || JSON.stringify(searchErrData)) }, { status: 400 });
      }
      const searchData = await searchResp.json();
      asaasCustomerId = searchData.data?.[0]?.id ?? '';
    }

    if (!asaasCustomerId) {
      const cnpjLimpo = (salao.cnpj || '').replace(/\D/g, '');
      if (!cnpjLimpo) {
        return NextResponse.json({ erro: 'Este salão não tem CNPJ cadastrado — obrigatório para gerar cobrança no Asaas.' }, { status: 400 });
      }
      const custResp = await fetch(`${asaasBase}/customers`, {
        method: 'POST',
        headers: { 'access_token': asaasKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:              salao.nome_fantasia || salao.razao_social || `Salão ${salaoId}`,
          email:             salao.email_contato || undefined,
          cpfCnpj:           cnpjLimpo,
          mobilePhone:       salao.telefone ? salao.telefone.replace(/\D/g, '') : undefined,
          externalReference: salaoId,
        }),
      });
      const custData = await custResp.json();
      if (!custResp.ok || !custData.id) {
        return NextResponse.json({ erro: 'Falha ao criar cliente no Asaas: ' + (custData.errors?.[0]?.description || JSON.stringify(custData)) }, { status: 400 });
      }
      asaasCustomerId = custData.id;
    }

    const venc = new Date();
    venc.setDate(venc.getDate() + 1);
    const vencStr = venc.toISOString().split('T')[0];

    const nomePacote = `${pacote.quantidade} créditos de ${pacote.tipo === 'campanha' ? 'campanha' : 'atendimento'}`;
    const descricao = `Luarys — Créditos WhatsApp — ${nomePacote} (${salao.nome_fantasia || salao.razao_social || salaoId})`;

    const paymentResp = await fetch(`${asaasBase}/payments`, {
      method: 'POST',
      headers: { 'access_token': asaasKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer:          asaasCustomerId,
        billingType:       meioPagamento === 'pix' ? 'PIX' : 'CREDIT_CARD',
        value:             Number(pacote.preco),
        dueDate:           vencStr,
        description:       descricao,
        externalReference: formatarReferenciaWhatsappCreditos(salaoId, pacote.id),
        // Somente à vista — sem parcelamento
        installmentCount:  1,
      }),
    });

    const paymentData = await paymentResp.json();

    if (!paymentResp.ok || !paymentData.id) {
      return NextResponse.json({ erro: 'Falha ao gerar cobrança no Asaas: ' + (paymentData.errors?.[0]?.description || JSON.stringify(paymentData)) }, { status: 400 });
    }

    return NextResponse.json({ sucesso: true, checkoutUrl: paymentData.invoiceUrl });

  } catch (err: any) {
    console.error('[whatsapp/comprar-creditos] Erro interno:', err);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
