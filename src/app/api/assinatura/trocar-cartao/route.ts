/**
 * POST /api/assinatura/trocar-cartao
 *
 * Troca o cartão de uma assinatura recorrente SEM que o número do cartão passe
 * pelo Luarys.
 *
 * O Asaas tem `PUT /v3/subscriptions/{id}/creditCard`, que faria isso em uma
 * chamada — mas exige os dados do cartão, e a tokenização que evitaria isso
 * também exige a chave de API no cabeçalho, que não pode ir para o navegador.
 * Ou seja: usar aquele endpoint colocaria número, validade e CVV atravessando
 * nosso servidor, e o Luarys em escopo PCI-DSS. Hoje o cartão nunca encosta
 * aqui; não vale trocar isso por um botão.
 *
 * O caminho seguro cria uma assinatura nova com a MESMA data de vencimento e
 * devolve o checkout hospedado do Asaas. O salão cadastra o cartão lá, o ciclo
 * continua na mesma data e ninguém perde dia pago.
 *
 * Ordem das operações importa: cria a nova, confirma que veio link de pagamento,
 * e SÓ ENTÃO cancela a antiga. Se o cancelamento falhar, desfaz a nova e aborta
 * — duas assinaturas ativas cobram duas vezes, e é pior que não ter trocado.
 *
 * Body: { modulo_chave: string }   // chave do plano ou do módulo
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { autenticarRota } from '@/lib/apiAuth';
import { ehPlanoBase } from '@/lib/assinaturas';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'POST /api/assinatura/trocar-cartao');
  if (erro) return erro;

  const { modulo_chave } = await req.json().catch(() => ({}));
  if (!modulo_chave) return NextResponse.json({ erro: 'modulo_chave obrigatório.' }, { status: 400 });

  const salaoId = perfil!.salao_id;
  const ehPlano = await ehPlanoBase(modulo_chave);
  const tabela = ehPlano ? 'saloes' : 'salao_modulos';
  const filtro = ehPlano ? { id: salaoId } : { salao_id: salaoId, modulo_chave };
  const campoRenovacao = ehPlano ? 'plano_renovacao_em' : 'renovacao_em';
  const campoPeriodo = ehPlano ? 'plano_periodo' : 'periodo';

  const { data: atual } = await supabaseAdmin
    .from(tabela)
    .select(`asaas_subscription_id, ${campoRenovacao}, ${campoPeriodo}`)
    .match(filtro)
    .maybeSingle();

  const assinaturaAntiga = (atual as any)?.asaas_subscription_id;
  const renovacaoEm = (atual as any)?.[campoRenovacao];
  if (!assinaturaAntiga) {
    return NextResponse.json({
      erro: 'Não há assinatura recorrente ativa para este item. Contrate normalmente em vez de trocar o cartão.',
    }, { status: 409 });
  }
  if (!renovacaoEm) {
    return NextResponse.json({ erro: 'Assinatura sem data de renovação — fale com o suporte antes de trocar o cartão.' }, { status: 409 });
  }

  const { data: conta } = await supabaseAdmin
    .from('plataforma_contas_recebimento')
    .select('asaas_api_key, asaas_environment')
    .eq('ativa', true).maybeSingle();
  const chave = conta?.asaas_api_key || process.env.ASAAS_API_KEY;
  if (!chave) return NextResponse.json({ erro: 'Gateway não configurado. Fale com o suporte.' }, { status: 500 });

  const base = (conta?.asaas_environment || process.env.ASAAS_ENVIRONMENT || 'production') === 'sandbox'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';
  const cab = { access_token: chave, 'Content-Type': 'application/json' };

  // Lê a assinatura atual no Asaas para copiar valor, ciclo e cliente. Não
  // recalculamos o preço aqui: trocar o cartão não é momento de reajustar, e
  // pegar do catálogo poderia mudar o valor pelas costas do salão.
  const respAntiga = await fetch(`${base}/subscriptions/${assinaturaAntiga}`, { headers: cab });
  if (!respAntiga.ok) {
    return NextResponse.json({ erro: 'Não foi possível ler a assinatura atual no Asaas.' }, { status: 502 });
  }
  const antiga = await respAntiga.json();

  // 1. Cria a nova preservando a data — sem cobrança imediata.
  const respNova = await fetch(`${base}/subscriptions`, {
    method: 'POST',
    headers: cab,
    body: JSON.stringify({
      customer: antiga.customer,
      billingType: 'CREDIT_CARD',
      cycle: antiga.cycle,
      value: antiga.value,
      nextDueDate: String(renovacaoEm).slice(0, 10),
      description: antiga.description,
      externalReference: antiga.externalReference,
    }),
  });
  const nova = await respNova.json().catch(() => ({}));
  if (!respNova.ok || !nova?.id) {
    return NextResponse.json({
      erro: 'Falha ao criar a assinatura nova: ' + (nova?.errors?.[0]?.description || 'erro desconhecido'),
    }, { status: 502 });
  }

  const desfazerNova = async () => {
    await fetch(`${base}/subscriptions/${nova.id}`, { method: 'DELETE', headers: cab }).catch(() => {});
  };

  // 2. Sem link de pagamento a troca não se completa — desfaz.
  const respFaturas = await fetch(`${base}/payments?subscription=${nova.id}`, { headers: cab });
  const faturas = await respFaturas.json().catch(() => ({}));
  const invoiceUrl = faturas?.data?.[0]?.invoiceUrl;
  if (!invoiceUrl) {
    await desfazerNova();
    return NextResponse.json({ erro: 'A assinatura nova foi criada mas não gerou link de pagamento. Nada foi alterado.' }, { status: 502 });
  }

  // 3. Cancela a antiga. Falhando aqui, desfaz a nova: duas assinaturas ativas
  // cobrariam o salão duas vezes na mesma data.
  const respCancel = await fetch(`${base}/subscriptions/${assinaturaAntiga}`, { method: 'DELETE', headers: cab });
  if (!respCancel.ok && respCancel.status !== 404) {
    await desfazerNova();
    return NextResponse.json({
      erro: 'Não foi possível cancelar a assinatura antiga. Nada foi alterado — tente de novo em alguns minutos.',
    }, { status: 502 });
  }

  // 4. Aponta para a nova. O webhook do pagamento confirma e avança a renovação
  // pelo caminho normal; `renovacao_em` fica intocada aqui, então o acesso do
  // salão não muda enquanto ele não pagar.
  await supabaseAdmin.from(tabela).update({ asaas_subscription_id: nova.id }).match(filtro);

  console.warn(`[trocar-cartao] salão ${salaoId} · ${modulo_chave} · ${assinaturaAntiga} → ${nova.id} · vencimento mantido em ${String(renovacaoEm).slice(0, 10)}`);

  return NextResponse.json({
    sucesso: true,
    checkoutUrl: invoiceUrl,
    vencimento_mantido: String(renovacaoEm).slice(0, 10),
  });
}
