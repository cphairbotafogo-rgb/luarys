/**
 * POST /api/admin/reajustar-assinaturas
 *
 * Aplica o preço ATUAL do catálogo (planos/modulos_catalogo) a todas as
 * assinaturas Asaas já ativas daquele plano/módulo — sem isso, trocar o
 * preço no admin só afeta quem assina dali pra frente (o valor da
 * subscription já criada no Asaas fica "congelado" no que era na hora
 * da contratação).
 *
 * Só atualiza o valor das PRÓXIMAS cobranças (ciclos futuros) — não mexe em
 * faturas já geradas e pendentes de pagamento.
 *
 * Body: { tipo: 'plano' | 'modulo', chave: string, preview?: boolean }
 *   preview=true → só lista quem seria afetado e o novo valor, sem executar.
 *
 * Apenas administradores da plataforma podem chamar esta rota.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Afetado = {
  salao_id: string;
  nome: string;
  periodo: string;
  asaas_subscription_id: string;
  preco_atual_cobrado: number | null;
  novo_preco: number;
};

export async function POST(req: NextRequest) {
  // ── Autenticação: apenas admin da plataforma ──────────────────────────────
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!authHeader) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader);
  if (authErr || !user) return NextResponse.json({ erro: 'Sessão inválida' }, { status: 401 });

  const { data: perfil } = await supabaseAdmin
    .from('perfis_usuarios')
    .select('is_plataforma_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil?.is_plataforma_admin) {
    return NextResponse.json({ erro: 'Acesso restrito a administradores da plataforma.' }, { status: 403 });
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  const { tipo, chave, preview } = await req.json().catch(() => ({}));
  if (tipo !== 'plano' && tipo !== 'modulo') {
    return NextResponse.json({ erro: 'tipo deve ser "plano" ou "modulo".' }, { status: 400 });
  }
  if (!chave || typeof chave !== 'string') {
    return NextResponse.json({ erro: 'chave obrigatória.' }, { status: 400 });
  }

  // ── Preço atual no catálogo (mensal/anual) ──────────────────────────────────
  const tabelaCatalogo = tipo === 'plano' ? 'planos' : 'modulos_catalogo';
  const { data: item, error: erroItem } = await supabaseAdmin
    .from(tabelaCatalogo)
    .select('nome, preco_mensal, preco_anual')
    .eq('chave', chave)
    .maybeSingle();

  if (erroItem || !item) {
    return NextResponse.json({ erro: 'Item não encontrado no catálogo.' }, { status: 404 });
  }

  // ── Assinantes ativos com subscription no Asaas ────────────────────────────
  let afetados: Afetado[] = [];

  if (tipo === 'plano') {
    const { data: saloes, error } = await supabaseAdmin
      .from('saloes')
      .select('id, nome_fantasia, razao_social, plano_periodo, asaas_subscription_id, valor_mensalidade')
      .eq('plano_chave', chave)
      .not('asaas_subscription_id', 'is', null);
    if (error) return NextResponse.json({ erro: 'Erro ao buscar salões: ' + error.message }, { status: 500 });

    afetados = (saloes || []).map(s => {
      const periodo = s.plano_periodo === 'anual' ? 'anual' : 'mensal';
      const novoPreco = periodo === 'anual' ? item.preco_anual : item.preco_mensal;
      return {
        salao_id: s.id,
        nome: s.nome_fantasia || s.razao_social || s.id,
        periodo,
        asaas_subscription_id: s.asaas_subscription_id as string,
        preco_atual_cobrado: s.valor_mensalidade != null ? Number(s.valor_mensalidade) : null,
        novo_preco: novoPreco != null ? Number(novoPreco) : NaN,
      };
    });
  } else {
    const { data: modulos, error } = await supabaseAdmin
      .from('salao_modulos')
      .select('salao_id, periodo, asaas_subscription_id, saloes(nome_fantasia, razao_social)')
      .eq('modulo_chave', chave)
      .eq('ativo', true)
      .not('asaas_subscription_id', 'is', null);
    if (error) return NextResponse.json({ erro: 'Erro ao buscar módulos: ' + error.message }, { status: 500 });

    afetados = (modulos || []).map((m: any) => {
      const periodo = m.periodo === 'anual' ? 'anual' : 'mensal';
      const novoPreco = periodo === 'anual' ? item.preco_anual : item.preco_mensal;
      const rel = Array.isArray(m.saloes) ? m.saloes[0] : m.saloes;
      return {
        salao_id: m.salao_id,
        nome: rel?.nome_fantasia || rel?.razao_social || m.salao_id,
        periodo,
        asaas_subscription_id: m.asaas_subscription_id as string,
        preco_atual_cobrado: null,
        novo_preco: novoPreco != null ? Number(novoPreco) : NaN,
      };
    });
  }

  // Sem preço definido pro período (ex: anual não configurado) — não dá pra reajustar
  const semPreco = afetados.filter(a => Number.isNaN(a.novo_preco));
  const comPreco = afetados.filter(a => !Number.isNaN(a.novo_preco));

  if (preview) {
    return NextResponse.json({
      sucesso: true,
      item_nome: item.nome,
      total_afetados: afetados.length,
      sem_preco_configurado: semPreco.map(a => ({ salao_id: a.salao_id, nome: a.nome, periodo: a.periodo })),
      afetados: comPreco,
    });
  }

  if (comPreco.length === 0) {
    return NextResponse.json({ sucesso: true, atualizados: 0, falhas: [], sem_preco_configurado: semPreco.length });
  }

  // ── Conta Asaas ativa (mesmo padrão de criar-checkout) ─────────────────────
  const { data: contaAtiva } = await supabaseAdmin
    .from('plataforma_contas_recebimento')
    .select('asaas_api_key, asaas_environment')
    .eq('ativa', true)
    .maybeSingle();

  const asaasKey = (contaAtiva as any)?.asaas_api_key || process.env.ASAAS_API_KEY;
  if (!asaasKey) {
    return NextResponse.json({ erro: 'ASAAS_API_KEY não configurado.' }, { status: 500 });
  }
  const asaasEnv = (contaAtiva as any)?.asaas_environment || process.env.ASAAS_ENVIRONMENT || 'production';
  const asaasBase = asaasEnv === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';

  // ── Atualiza cada subscription no Asaas (só afeta cobranças futuras) ───────
  const falhas: { salao_id: string; nome: string; erro: string }[] = [];
  let atualizados = 0;

  for (const a of comPreco) {
    try {
      const resp = await fetch(`${asaasBase}/subscriptions/${a.asaas_subscription_id}`, {
        method: 'PUT',
        headers: { 'access_token': asaasKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: a.novo_preco }),
      });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        falhas.push({ salao_id: a.salao_id, nome: a.nome, erro: dados?.errors?.[0]?.description || `HTTP ${resp.status}` });
        continue;
      }
      atualizados++;

      // Mantém saloes.valor_mensalidade em sincronia (só quando for plano — módulo não tem esse campo)
      if (tipo === 'plano') {
        await supabaseAdmin.from('saloes').update({ valor_mensalidade: a.novo_preco }).eq('id', a.salao_id);
      }
    } catch (err: any) {
      falhas.push({ salao_id: a.salao_id, nome: a.nome, erro: err.message });
    }
  }

  return NextResponse.json({
    sucesso: true,
    item_nome: item.nome,
    atualizados,
    falhas,
    sem_preco_configurado: semPreco.length,
  });
}
