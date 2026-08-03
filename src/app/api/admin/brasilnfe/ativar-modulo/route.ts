/**
 * POST /api/admin/brasilnfe/ativar-modulo
 *
 * Ativa/desativa NFS-e e/ou NFC-e para um salão (Brasil NFe) e sincroniza o
 * CompanyToken em nfe_config_empresa, saloes.token_nfse_salao e
 * saloes.config_fiscal.brasilnfe_company_token (fonte lida pela emissão real).
 *
 * A RPC admin_ativar_modulo_fiscal só é executável por service_role desde a
 * migration 20260717_c3_revoke_admin_rpcs.sql — por isso precisa passar por
 * uma rota server-side com checagem de admin, não ser chamada direto do
 * navegador (era o que GavetaFiscalSaloes.tsx fazia, e por isso falhava).
 *
 * Apenas administradores da plataforma podem chamar esta rota.
 * Body: { salao_id: string, nfse: boolean, nfce: boolean, company_token?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e: any) {
    return NextResponse.json({ erro: 'Erro inesperado: ' + (e?.message || String(e)) }, { status: 500 });
  }
}

async function handlePost(req: NextRequest) {
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

  const { salao_id, nfse, nfce, company_token } = await req.json().catch(() => ({}));
  if (!salao_id) return NextResponse.json({ erro: 'salao_id obrigatório' }, { status: 400 });
  if (!nfse && !nfce) return NextResponse.json({ erro: 'Selecione pelo menos um módulo (NFS-e ou NFC-e).' }, { status: 400 });

  const { error } = await supabaseAdmin.rpc('admin_ativar_modulo_fiscal', {
    p_salao_id: salao_id,
    p_nfse: !!nfse,
    p_nfce: !!nfce,
    p_company_token: company_token?.trim() || null,
  });

  if (error) return NextResponse.json({ erro: error.message }, { status: 422 });

  // Módulo ativado: o A1 guardado como fallback manual (upload-a1, sem
  // company_token na hora do envio) não tem mais razão de existir — a senha
  // do certificado nunca pode ficar retida além do necessário para ativar.
  await limparCertificadoArmazenado(salao_id);

  return NextResponse.json({ sucesso: true });
}

/** Apaga o .pfx do Storage e limpa a senha/caminho salvos em `saloes` após a ativação. */
async function limparCertificadoArmazenado(salaoId: string): Promise<void> {
  const { data: salao } = await supabaseAdmin
    .from('saloes')
    .select('a1_path')
    .eq('id', salaoId)
    .maybeSingle();

  if (!salao?.a1_path) return;

  const { error: removeErr } = await supabaseAdmin.storage.from('certificados-a1').remove([salao.a1_path]);
  if (removeErr) console.error('[ativar-modulo] falha ao remover A1 do storage:', removeErr);

  const { error: updateErr } = await supabaseAdmin
    .from('saloes')
    .update({ a1_path: null, a1_senha_enc: null })
    .eq('id', salaoId);
  if (updateErr) console.error('[ativar-modulo] falha ao limpar a1_path/a1_senha_enc:', updateErr);
}
