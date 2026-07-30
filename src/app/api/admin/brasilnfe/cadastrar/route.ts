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
 * (npm) e brasilnfe.com.br/api/empresas#adicionar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cadastrarEmpresa } from '@/lib/nfse/brasilnfe';
import { limparCnpj } from '@/lib/cnpj';

// 1=Simples Nacional, 3=Regime Normal (Brasil NFe não distingue MEI de Simples aqui)
function crtDoRegime(regime?: string | null): number {
  const r = (regime || '').toLowerCase();
  if (r.includes('lucro')) return 3;
  return 1;
}

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

  // ── Dados do salão ────────────────────────────────────────────────────────
  const { data: salao, error: salaoErr } = await supabaseAdmin
    .from('saloes')
    .select('cnpj, razao_social, nome_fantasia, inscricao_municipal, codigo_ibge, email_fiscal, regime_tributario, config_fiscal')
    .eq('id', salao_id)
    .single();

  if (salaoErr || !salao) {
    return NextResponse.json({ erro: 'Salão não encontrado.' }, { status: 404 });
  }

  const cnpj = limparCnpj(salao.cnpj); // mantém letras — CNPJ alfanumérico (IN RFB 2.229/2024)
  if (cnpj.length !== 14) {
    return NextResponse.json({ erro: 'CNPJ do salão inválido ou não cadastrado.' }, { status: 422 });
  }

  // ── UserToken (master Luarys) ─────────────────────────────────────────────
  // Lido de plataforma_nfse_config onde o admin salvou via AbaNFSeConfig
  let userToken = process.env.BRASIL_NFE_USER_TOKEN || '';

  if (!userToken) {
    const { data: cfg } = await supabaseAdmin
      .from('plataforma_nfse_config')
      .select('token_brasilnfe')
      .eq('id', 1)
      .maybeSingle();

    userToken = cfg?.token_brasilnfe || '';
  }

  if (!userToken) {
    return NextResponse.json({
      erro: 'UserToken Brasil NFe não configurado. Acesse Admin → NFS-e e salve o token da conta Luarys.',
    }, { status: 422 });
  }

  // ── Registrar CNPJ como empresa na Brasil NFe ─────────────────────────────
  const resultado = await cadastrarEmpresa(userToken, {
    CNPJ: cnpj,
    RzSocial: salao.razao_social || salao.nome_fantasia || '',
    NmFantasia: salao.nome_fantasia || undefined,
    IM: salao.inscricao_municipal || undefined,
    CRT: crtDoRegime(salao.regime_tributario),
    CodigoInterno: salao_id,
    Contato: salao.email_fiscal ? { Email: salao.email_fiscal } : undefined,
  });

  if (resultado.erro || !resultado.token) {
    return NextResponse.json({ erro: `Brasil NFe recusou o cadastro: ${resultado.erro || 'token não recebido'}` }, { status: 422 });
  }

  // ── Persiste o Token da empresa em config_fiscal do salão ─────────────────
  const configFiscalAtual = salao.config_fiscal || {};
  const novoConfigFiscal = {
    ...configFiscalAtual,
    brasilnfe_company_token: resultado.token,
    brasilnfe_cadastrado_em: new Date().toISOString(),
  };

  const { error: updateErr } = await supabaseAdmin
    .from('saloes')
    .update({ config_fiscal: novoConfigFiscal })
    .eq('id', salao_id);

  if (updateErr) {
    return NextResponse.json({ erro: 'Erro ao salvar o token: ' + updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    sucesso: true,
    mensagem: `Salão "${salao.nome_fantasia || salao.razao_social}" registrado com sucesso na Brasil NFe.`,
    cnpj,
  });
}
