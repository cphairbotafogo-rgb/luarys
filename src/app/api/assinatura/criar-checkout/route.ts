/**
 * src/app/api/assinatura/criar-checkout/route.ts
 *
 * Gera um link de pagamento para o salão ativar um módulo pago
 * (NFS-e, NFC-e, WhatsApp, Fidelidade, etc.).
 *
 * Gateway usado é o da PLATAFORMA (Luarys), escolhido pela env var
 * PLATFORM_GATEWAY = 'mercadopago' | 'infinitepay'.
 * NÃO confundir com saloes.gateway_pagamento (gateway de CADA salão
 * para receber de SEUS clientes — coisa totalmente separada).
 *
 * external_reference / order_nsu no formato "salaoId::moduloChave" é
 * o que os webhooks usam para saber o que liberar quando o pagamento
 * for aprovado.
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { salao_id, modulo_chave, periodo: periodoRaw } = await request.json();
    const periodo: 'mensal' | 'anual' = periodoRaw === 'anual' ? 'anual' : 'mensal';

    if (!salao_id || !modulo_chave) {
      return NextResponse.json({ erro: 'Dados incompletos.' }, { status: 400 });
    }

    // Confirma que quem está pedindo o checkout é o dono (ou funcionário com
    // permissão) do salão informado — sem isso, qualquer um poderia gerar
    // checkouts/registros "pending" para o salao_id de outra pessoa.
    const { user, perfil, erro } = await autenticarRota(request, 'POST /api/assinatura/criar-checkout');
    if (erro) return erro;

    // Esta rota aceita tanto dono (perfis_usuarios) quanto funcionário (profissionais).
    // O perfil de dono já foi resolvido por autenticarRota; busca funcionário como fallback.
    const { data: funcionario } = await supabaseAdmin
      .from('profissionais')
      .select('salao_id')
      .eq('id', user!.id)
      .maybeSingle();

    const salaoDoChamador = perfil?.salao_id || funcionario?.salao_id;
    if (!salaoDoChamador || salaoDoChamador !== salao_id) {
      return NextResponse.json({ erro: 'Você não tem permissão para gerar checkout para este salão.' }, { status: 403 });
    }

    // 1. Busca o item no catálogo (módulos avulsos) ou, se não achar, nos planos-base
    let nomeItem: string;
    let precoItem: number;

    const { data: modulo } = await supabaseAdmin
      .from('modulos_catalogo')
      .select('chave, nome, preco_mensal, preco_anual, ativo')
      .eq('chave', modulo_chave)
      .maybeSingle();

    if (modulo?.ativo) {
      nomeItem = modulo.nome;
      precoItem = periodo === 'anual' && modulo.preco_anual != null
        ? Number(modulo.preco_anual)
        : Number(modulo.preco_mensal);
    } else {
      const { data: plano } = await supabaseAdmin
        .from('planos')
        .select('chave, nome, preco_mensal, preco_anual, ativo')
        .eq('chave', modulo_chave)
        .maybeSingle();

      // Enterprise (preco_mensal NULL) é "fale com a gente" — não tem checkout self-service
      if (!plano || !plano.ativo || plano.preco_mensal == null) {
        return NextResponse.json({ erro: 'Item não encontrado ou indisponível.' }, { status: 404 });
      }

      nomeItem = plano.nome;
      precoItem = periodo === 'anual' && plano.preco_anual != null
        ? Number(plano.preco_anual)
        : Number(plano.preco_mensal);
    }

    if (precoItem <= 0) {
      return NextResponse.json({ erro: 'Este item não requer pagamento.' }, { status: 400 });
    }

    // 2. Confirma que o salão existe
    const { data: salao, error: erroSalao } = await supabaseAdmin
      .from('saloes')
      .select('id, nome_fantasia, razao_social, email_contato')
      .eq('id', salao_id)
      .maybeSingle();

    if (erroSalao || !salao) {
      return NextResponse.json({ erro: 'Salão não encontrado.' }, { status: 404 });
    }

    const referencia = `${salao_id}::${modulo_chave}::${periodo}`;
    const descricao = `Luarys — ${nomeItem} — ${periodo === 'anual' ? 'Anual' : 'Mensal'} (${salao.nome_fantasia || salao.razao_social || salao_id})`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    // Conta de recebimento ativa (multi-conta — permite trocar de CNPJ/conta
    // sem editar env vars). Se nenhuma estiver marcada como ativa, cai para
    // a config simples (plataforma_config) e depois para as env vars.
    const { data: contaAtivaRaw } = await supabaseAdmin
      .from('plataforma_contas_recebimento')
      .select('gateway, mercadopago_access_token, infinitepay_handle, cielo_merchant_id, cielo_merchant_key')
      .eq('ativa', true)
      .maybeSingle();
    const contaAtiva = contaAtivaRaw as any;

    let gatewayPlataforma: string;
    if (contaAtiva) {
      gatewayPlataforma = contaAtiva.gateway;
    } else {
      const { data: config } = await supabaseAdmin.from('plataforma_config').select('gateway_pagamento').eq('id', 1).maybeSingle();
      gatewayPlataforma = (config?.gateway_pagamento || process.env.PLATFORM_GATEWAY || 'mercadopago').toLowerCase();
    }

    let checkoutUrl: string;
    let pagamentoExternoId: string;

    // ─── MERCADO PAGO ───
    if (gatewayPlataforma === 'mercadopago') {
      const platformToken = contaAtiva?.mercadopago_access_token || process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN;
      if (!platformToken) {
        return NextResponse.json({ erro: 'Gateway Mercado Pago selecionado, mas nenhuma conta com Access Token foi configurada em /admin (Catálogo & Planos → Configuração de Recebimento).' }, { status: 500 });
      }

      const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${platformToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{
            title: `Luarys — ${nomeItem}`,
            description: descricao,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: precoItem,
          }],
          payer: salao.email_contato ? { email: salao.email_contato } : undefined,
          external_reference: referencia,
          // Somente à vista — sem parcelamento
          payment_methods: {
            installments: 1,
            default_installments: 1,
          },
          back_urls: {
            success: `${appUrl}/#configuracoes`,
            failure: `${appUrl}/#configuracoes`,
            pending: `${appUrl}/#configuracoes`,
          },
          auto_return: 'approved',
          notification_url: `${appUrl}/api/webhooks/mercadopago`,
        }),
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        return NextResponse.json({ erro: 'Falha ao gerar checkout (Mercado Pago): ' + (mpData.message || JSON.stringify(mpData)) }, { status: 400 });
      }

      checkoutUrl = mpData.init_point;
      pagamentoExternoId = mpData.id;

    // ─── INFINITEPAY ───
    } else if (gatewayPlataforma === 'infinitepay') {
      const handle = contaAtiva?.infinitepay_handle || process.env.INFINITEPAY_PLATFORM_HANDLE;
      if (!handle) {
        return NextResponse.json({ erro: 'Gateway InfinitePay selecionado, mas nenhuma conta com Handle foi configurada em /admin (Catálogo & Planos → Configuração de Recebimento).' }, { status: 500 });
      }

      const valorEmCentavos = Math.round(precoItem * 100);

      const ipResponse = await fetch('https://api.checkout.infinitepay.io/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: handle.replace('@', '').replace('$', '').trim(),
          order_nsu: referencia,
          redirect_url: `${appUrl}/#configuracoes`,
          webhook_url: `${appUrl}/api/webhooks/infinitepay`,
          // Somente à vista — InfinitePay usa max_installments
          max_installments: 1,
          items: [{ quantity: 1, price: valorEmCentavos, description: descricao }],
        }),
      });

      const ipData = await ipResponse.json();

      if (!ipResponse.ok) {
        return NextResponse.json({ erro: 'Falha ao gerar checkout (InfinitePay): ' + (ipData.message || JSON.stringify(ipData)) }, { status: 400 });
      }

      checkoutUrl = ipData.url || ipData.link;
      pagamentoExternoId = ipData.transaction_nsu || ipData.slug || referencia;

    // ─── CIELO ───
    } else if (gatewayPlataforma === 'cielo') {
      const merchantId  = contaAtiva?.cielo_merchant_id  || process.env.CIELO_MERCHANT_ID;
      const merchantKey = contaAtiva?.cielo_merchant_key || process.env.CIELO_MERCHANT_KEY;

      if (!merchantId || !merchantKey) {
        return NextResponse.json({ erro: 'Gateway Cielo selecionado, mas MerchantId/MerchantKey não estão configurados em /admin.' }, { status: 500 });
      }

      // ID único de 32 chars (sem hífens) para o OrderNumber da Cielo (limite: 50 chars)
      const cieloOrderNumber = crypto.randomUUID().replace(/-/g, '');
      const valorEmCentavos  = Math.round(precoItem * 100);

      const cieloResponse = await fetch('https://cieloecommerce.cielo.com.br/api/public/v2/orders', {
        method: 'POST',
        headers: {
          'clientId':     merchantId,
          'clientSecret': merchantKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          OrderNumber:    cieloOrderNumber,
          SoftDescriptor: 'Luarys',
          Cart: {
            Items: [{
              Name:        `Luarys — ${nomeItem}`,
              Description: descricao,
              UnitPrice:   valorEmCentavos,
              Quantity:    1,
              Type:        'Service',
            }],
          },
          Shipping: { Type: 'WithoutShipping' },
          Payment: {
            // Somente à vista — sem parcelamento
            MaxNumberOfInstallments: 1,
          },
          Customer: salao.email_contato ? { Email: salao.email_contato } : undefined,
          Settings: {
            ReturnUrl:       `${appUrl}/#configuracoes`,
            NotificationUrl: `${appUrl}/api/webhooks/cielo`,
          },
        }),
      });

      const cieloData = await cieloResponse.json();

      if (!cieloResponse.ok || !cieloData.shortUrl) {
        return NextResponse.json({ erro: 'Falha ao gerar checkout (Cielo): ' + (cieloData.message || JSON.stringify(cieloData)) }, { status: 400 });
      }

      checkoutUrl        = cieloData.shortUrl;
      pagamentoExternoId = cieloOrderNumber;

    } else {
      return NextResponse.json({ erro: `PLATFORM_GATEWAY inválido: "${gatewayPlataforma}". Use "mercadopago", "infinitepay" ou "cielo".` }, { status: 500 });
    }

    // 3. Registra a tentativa de pagamento como "pending"
    await supabaseAdmin.from('pagamentos_assinatura').insert([{
      salao_id,
      modulo_chave,
      valor: precoItem,
      status: 'pending',
      gateway: gatewayPlataforma,
      pagamento_externo_id: pagamentoExternoId,
      periodo,
    }]);

    return NextResponse.json({ sucesso: true, gateway: gatewayPlataforma, checkoutUrl });

  } catch (err: any) {
    console.error('Erro ao criar checkout de assinatura:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}