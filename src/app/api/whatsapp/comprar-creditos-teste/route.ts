/**
 * POST /api/whatsapp/comprar-creditos-teste
 *
 * Substitui a chamada direta do client à RPC `comprar_pacote_whatsapp`, que foi
 * revogada de authenticated/anon em
 * supabase/migrations-historico/20260717_c3_revoke_admin_rpcs.sql (ela creditava saldo
 * sem confirmar pagamento real — qualquer usuário logado podia chamá-la pelo
 * console do navegador e ganhar créditos de graça).
 *
 * Segurança:
 *   - Desabilitada por padrão (fail-closed). Só funciona se
 *     WHATSAPP_CREDITO_TESTE_HABILITADO=true. Nunca habilitar em produção com
 *     salões reais antes de existir um gateway de pagamento real integrado
 *     (ver aviso amarelo em PainelCarteiraWhatsapp.tsx / PainelCreditosMarketing.tsx).
 *   - Exige sessão válida (autenticarRota) — salao_id vem do perfil do
 *     usuário autenticado no servidor, nunca do body do cliente.
 *   - Rate limit por IP.
 *   - Credita via supabase/migrations-historico/20260722_c5_whatsapp_creditar_service.sql
 *     (creditar_pacote_whatsapp_service), que só service_role pode executar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { autenticarRota } from '@/lib/apiAuth';
import { rateLimitExcedido, obterIp } from '@/lib/rateLimiter';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEIOS_VALIDOS = ['pix', 'cartao_credito', 'cartao_debito'] as const;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  if (process.env.WHATSAPP_CREDITO_TESTE_HABILITADO !== 'true') {
    return NextResponse.json(
      { erro: 'Compra de créditos indisponível: gateway de pagamento ainda não integrado.' },
      { status: 403 },
    );
  }

  const ip = obterIp(req as any);
  if (await rateLimitExcedido(`whatsapp-credito-teste:${ip}`, 5, 600)) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }

  const { perfil, erro: erroAuth } = await autenticarRota(req, 'POST /api/whatsapp/comprar-creditos-teste');
  if (erroAuth) return erroAuth;

  try {
    const { pacoteId, meioPagamento } = await req.json();

    if (!UUID_RE.test(String(pacoteId))) {
      return NextResponse.json({ erro: 'Pacote inválido.' }, { status: 400 });
    }
    if (!MEIOS_VALIDOS.includes(meioPagamento)) {
      return NextResponse.json({ erro: 'Meio de pagamento inválido.' }, { status: 400 });
    }

    const { data, error } = await admin.rpc('creditar_pacote_whatsapp_service', {
      p_salao_id: perfil.salao_id,
      p_pacote_id: pacoteId,
      p_meio_pagamento: meioPagamento,
    });

    if (error) {
      console.error('[comprar-creditos-teste] Erro:', error);
      const msg = error.message?.includes('não encontrado')
        ? 'Pacote não encontrado ou inativo.'
        : 'Não foi possível processar a compra.';
      return NextResponse.json({ erro: msg }, { status: 400 });
    }

    const linha = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      saldoAtendimento: linha?.saldo_atendimento ?? 0,
      saldoCampanha: linha?.saldo_campanha ?? 0,
    });
  } catch (e: any) {
    console.error('[comprar-creditos-teste] Erro interno:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
