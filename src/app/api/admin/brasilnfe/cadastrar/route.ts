/**
 * POST /api/admin/brasilnfe/cadastrar
 *
 * Registra o CNPJ de um salão na Brasil NFe usando o UserToken (master Luarys).
 * Obtém um Token exclusivo para a empresa e armazena em
 * saloes.config_fiscal.brasilnfe_company_token.
 *
 * Apenas administradores da plataforma podem chamar esta rota.
 *
 * Body: { salao_id: string }
 *
 * Endpoint/campos confirmados em 30/07/2026 contra o SDK oficial `brasilnfe`
 * (npm) e brasilnfe.com.br/api/empresas#adicionar. A lógica de cadastro em si
 * (busca dados do salão, chama a Brasil NFe, persiste o token) fica em
 * cadastrarEmpresaLuarys() — compartilhada com a automação disparada pelo
 * webhook de pagamento em src/lib/assinaturas.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cadastrarEmpresaLuarys } from '@/lib/nfse/brasilnfe';

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
  const { salao_id } = await req.json().catch(() => ({}));
  if (!salao_id) return NextResponse.json({ erro: 'salao_id obrigatório' }, { status: 400 });

  const resultado = await cadastrarEmpresaLuarys(salao_id);

  if (resultado.erro || !resultado.token) {
    return NextResponse.json({ erro: `Brasil NFe recusou o cadastro: ${resultado.erro || 'token não recebido'}` }, { status: 422 });
  }

  return NextResponse.json({ sucesso: true, mensagem: 'Salão registrado com sucesso na Brasil NFe.' });
}
