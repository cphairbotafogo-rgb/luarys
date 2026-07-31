/**
 * POST /api/admin/whatsapp/reajustar-assinaturas
 *
 * Mesmo padrão de /api/admin/reajustar-assinaturas, mas para pacotes de
 * créditos WhatsApp (whatsapp_pacotes / whatsapp_assinaturas_creditos) —
 * um sistema de assinatura separado dos módulos/planos (não usa
 * salao_modulos), por isso precisa de rota própria.
 *
 * Aplica o preço ATUAL de whatsapp_pacotes a todas as assinaturas Asaas já
 * ativas daquele pacote. Só atualiza o valor das PRÓXIMAS cobranças — não
 * mexe em faturas já geradas.
 *
 * Body: { pacote_id: string, preview?: boolean }
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
  asaas_subscription_id: string;
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
  const { pacote_id, preview } = await req.json().catch(() => ({}));
  if (!pacote_id || typeof pacote_id !== 'string') {
    return NextResponse.json({ erro: 'pacote_id obrigatório.' }, { status: 400 });
  }

  // ── Preço atual do pacote ────────────────────────────────────────────────
  const { data: pacote, error: erroPacote } = await supabaseAdmin
    .from('whatsapp_pacotes')
    .select('tipo, quantidade, preco')
    .eq('id', pacote_id)
    .maybeSingle();

  if (erroPacote || !pacote) {
    return NextResponse.json({ erro: 'Pacote não encontrado.' }, { status: 404 });
  }

  const nomePacote = `${pacote.quantidade} créditos de ${pacote.tipo === 'campanha' ? 'campanha' : 'atendimento'}`;
  const novoPreco = Number(pacote.preco);

  // ── Assinantes ativos com subscription no Asaas ────────────────────────────
  const { data: assinaturas, error: erroAssinaturas } = await supabaseAdmin
    .from('whatsapp_assinaturas_creditos')
    .select('salao_id, asaas_subscription_id, saloes(nome_fantasia, razao_social)')
    .eq('pacote_id', pacote_id)
    .eq('ativa', true)
    .not('asaas_subscription_id', 'is', null);

  if (erroAssinaturas) return NextResponse.json({ erro: 'Erro ao buscar assinaturas: ' + erroAssinaturas.message }, { status: 500 });

  const afetados: Afetado[] = (assinaturas || []).map((a: any) => {
    const rel = Array.isArray(a.saloes) ? a.saloes[0] : a.saloes;
    return {
      salao_id: a.salao_id,
      nome: rel?.nome_fantasia || rel?.razao_social || a.salao_id,
      asaas_subscription_id: a.asaas_subscription_id,
      novo_preco: novoPreco,
    };
  });

  if (preview) {
    return NextResponse.json({ sucesso: true, item_nome: nomePacote, total_afetados: afetados.length, afetados });
  }

  if (afetados.length === 0) {
    return NextResponse.json({ sucesso: true, atualizados: 0, falhas: [] });
  }

  // ── Conta Asaas ativa (mesmo padrão de comprar-creditos) ───────────────────
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

  for (const a of afetados) {
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
    } catch (err: any) {
      falhas.push({ salao_id: a.salao_id, nome: a.nome, erro: err.message });
    }
  }

  return NextResponse.json({ sucesso: true, item_nome: nomePacote, atualizados, falhas });
}
