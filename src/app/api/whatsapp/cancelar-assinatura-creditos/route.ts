/**
 * src/app/api/whatsapp/cancelar-assinatura-creditos/route.ts
 *
 * Cancela a assinatura mensal recorrente de créditos WhatsApp de um pacote.
 * O acesso ao saldo já creditado continua normalmente — isso só impede a
 * PRÓXIMA cobrança/crédito automático do mês seguinte (mesma lógica de
 * /api/assinatura/cancelar-recorrencia, mas pra whatsapp_assinaturas_creditos
 * em vez de salao_modulos/saloes).
 */
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const { salao_id, pacote_id } = await request.json();

    if (!UUID_RE.test(String(salao_id)) || !UUID_RE.test(String(pacote_id))) {
      return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 });
    }

    // Nunca confiar em salao_id vindo do body sem confirmar que é de quem
    // está autenticado — mesma checagem de posse usada em criar-checkout.
    const { user, perfil, erro } = await autenticarRota(request, 'POST /api/whatsapp/cancelar-assinatura-creditos');
    if (erro) return erro;

    const { data: funcionario, error: erroFuncionario } = await supabaseAdmin
      .from('profissionais')
      .select('salao_id')
      .eq('id', user!.id)
      .maybeSingle();
    if (erroFuncionario) console.error('[cancelar-assinatura-creditos] Erro ao buscar profissionais:', erroFuncionario.message);

    const salaoDoChamador = perfil?.salao_id || funcionario?.salao_id;
    if (!salaoDoChamador || salaoDoChamador !== salao_id) {
      return NextResponse.json({ erro: 'Você não tem permissão para alterar essa assinatura.' }, { status: 403 });
    }

    const { data: assinatura, error: erroAssinatura } = await supabaseAdmin
      .from('whatsapp_assinaturas_creditos')
      .select('id, asaas_subscription_id')
      .eq('salao_id', salao_id)
      .eq('pacote_id', pacote_id)
      .eq('ativa', true)
      .maybeSingle();
    if (erroAssinatura) console.error('[cancelar-assinatura-creditos] Erro ao buscar assinatura:', erroAssinatura.message);

    if (!assinatura) {
      return NextResponse.json({ sucesso: true, cancelado: false });
    }

    const { data: contaAtiva } = await supabaseAdmin
      .from('plataforma_contas_recebimento')
      .select('asaas_api_key, asaas_environment')
      .eq('gateway', 'asaas')
      .order('ativa', { ascending: false })
      .limit(1)
      .maybeSingle();

    const asaasKey = (contaAtiva as any)?.asaas_api_key || process.env.ASAAS_API_KEY;
    if (!asaasKey) {
      return NextResponse.json({ erro: 'ASAAS_API_KEY não configurado — não foi possível cancelar no Asaas.' }, { status: 500 });
    }
    const asaasEnv = (contaAtiva as any)?.asaas_environment || process.env.ASAAS_ENVIRONMENT || 'production';
    const asaasBase = asaasEnv === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';

    const cancelResp = await fetch(`${asaasBase}/subscriptions/${assinatura.asaas_subscription_id}`, {
      method: 'DELETE',
      headers: { 'access_token': asaasKey },
    });

    // 404 = já não existe mais no Asaas — trata como sucesso, o objetivo
    // (não cobrar de novo) já está garantido.
    if (!cancelResp.ok && cancelResp.status !== 404) {
      const cancelData = await cancelResp.json().catch(() => ({}));
      return NextResponse.json({ erro: 'Falha ao cancelar no Asaas: ' + (cancelData.errors?.[0]?.description || JSON.stringify(cancelData)) }, { status: 400 });
    }

    await supabaseAdmin
      .from('whatsapp_assinaturas_creditos')
      .update({ ativa: false, cancelada_em: new Date().toISOString() })
      .eq('id', assinatura.id);

    return NextResponse.json({ sucesso: true, cancelado: true });

  } catch (err: any) {
    console.error('[cancelar-assinatura-creditos] Erro interno:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}
