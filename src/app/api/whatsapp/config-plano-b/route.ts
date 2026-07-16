/**
 * GET  /api/whatsapp/config-plano-b  — retorna status da config do Plano B (sem expor o token)
 * POST /api/whatsapp/config-plano-b  — salva/atualiza credenciais do Plano B (token criptografado)
 *
 * Plano B = "Gestão Meta": o salão usa sua própria conta WABA + cartão na Meta.
 * O token deve ser um System User permanente gerado no Business Settings da Meta.
 * Nunca aceitar tokens temporários (expiram em 24h/60 dias sem aviso).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { autenticarRota } from '@/lib/apiAuth';
import { encryptarTokenWhatsapp } from '@/lib/whatsappCrypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Retorna a configuração atual do Plano B sem expor o token */
export async function GET(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'GET /api/whatsapp/config-plano-b');
  if (erro) return erro;

  const { data, error: dbErr } = await supabaseAdmin
    .from('whatsapp_config_plano')
    .select('plano, waba_id, phone_number_id, linha_credito_compartilhada, ativo, provisionado_em')
    .eq('salao_id', perfil.salao_id)
    .maybeSingle();

  if (dbErr) {
    return NextResponse.json({ erro: 'Erro ao buscar configuração WhatsApp.' }, { status: 500 });
  }
  return NextResponse.json(data ?? null);
}

/** Salva as credenciais do Plano B, criptografando o token antes de persistir */
export async function POST(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'POST /api/whatsapp/config-plano-b');
  if (erro) return erro;

  const body = await req.json().catch(() => ({}));
  const { token, phone_number_id, waba_id } = body as {
    token?: string;
    phone_number_id?: string;
    waba_id?: string;
  };

  if (!token?.trim() || !phone_number_id?.trim() || !waba_id?.trim()) {
    return NextResponse.json(
      { erro: 'token, phone_number_id e waba_id são obrigatórios.' },
      { status: 400 }
    );
  }

  // Token temporário da Meta começa com "EAA" e tem ~200 chars.
  // System User permanente também começa com "EAA" mas não há como validar isso
  // só pelo formato — a instrução para o usuário é a proteção real.
  if (token.trim().length < 50) {
    return NextResponse.json(
      { erro: 'Token inválido. Verifique se copiou o token de System User permanente completo.' },
      { status: 400 }
    );
  }

  let tokenCriptografado: string;
  try {
    tokenCriptografado = encryptarTokenWhatsapp(token.trim());
  } catch (e: any) {
    return NextResponse.json(
      { erro: 'Erro interno de criptografia: ' + e.message },
      { status: 500 }
    );
  }

  const { error: dbErr } = await supabaseAdmin
    .from('whatsapp_config_plano')
    .upsert({
      salao_id:                   perfil.salao_id,
      plano:                      'gestao_meta',
      waba_id:                    waba_id.trim(),
      phone_number_id:            phone_number_id.trim(),
      token_criptografado:        tokenCriptografado,
      linha_credito_compartilhada: false, // Plano B nunca compartilha linha de crédito
      ativo:                      true,
      provisionado_em:            new Date().toISOString(),
      atualizado_em:              new Date().toISOString(),
    }, { onConflict: 'salao_id' });

  if (dbErr) {
    return NextResponse.json({ erro: 'Erro ao salvar: ' + dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plano: 'gestao_meta' });
}
