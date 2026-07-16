/**
 * POST /api/admin/brasilnfe/cadastrar
 *
 * Registra o CNPJ de um salão na Brasil NFe usando o UserToken (master Luarys).
 * Obtém um CompanyToken exclusivo para o CNPJ e armazena em
 * saloes.config_fiscal.brasilnfe_company_token.
 *
 * Apenas administradores da plataforma podem chamar esta rota.
 *
 * Body: { salao_id: string }
 *
 * ⚠️  Confirme os endpoints exatos com a Brasil NFe antes de usar em produção.
 *     A implementação abaixo segue o modelo multi-tenant descrito pela empresa.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { baseUrl } from '@/lib/nfse/brasilnfe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const { salao_id } = await req.json().catch(() => ({}));
  if (!salao_id) return NextResponse.json({ erro: 'salao_id obrigatório' }, { status: 400 });

  // ── Dados do salão ────────────────────────────────────────────────────────
  const { data: salao, error: salaoErr } = await supabaseAdmin
    .from('saloes')
    .select('cnpj, razao_social, nome_fantasia, inscricao_municipal, codigo_ibge, email_fiscal, config_fiscal')
    .eq('id', salao_id)
    .single();

  if (salaoErr || !salao) {
    return NextResponse.json({ erro: 'Salão não encontrado.' }, { status: 404 });
  }

  const cnpj = (salao.cnpj || '').replace(/\D/g, '');
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
  const resp = await fetch(`${baseUrl()}/company`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cnpj,
      razao_social:         salao.razao_social || salao.nome_fantasia || '',
      inscricao_municipal:  salao.inscricao_municipal || undefined,
      codigo_municipio_ibge: salao.codigo_ibge || undefined,
      email:                salao.email_fiscal || undefined,
    }),
  });

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const msg = json.mensagem ?? json.message ?? json.error ?? `HTTP ${resp.status}`;
    return NextResponse.json({ erro: `Brasil NFe recusou o cadastro: ${msg}` }, { status: 422 });
  }

  // A Brasil NFe retorna o CompanyToken exclusivo para este CNPJ
  const companyToken: string = json.company_token ?? json.token ?? json.access_token ?? '';
  const companyId: string    = json.company_id ?? json.id ?? '';

  if (!companyToken) {
    return NextResponse.json({
      erro: 'Brasil NFe não retornou o CompanyToken. Resposta: ' + JSON.stringify(json),
    }, { status: 502 });
  }

  // ── Persiste CompanyToken em config_fiscal do salão ───────────────────────
  const configFiscalAtual = salao.config_fiscal || {};
  const novoConfigFiscal = {
    ...configFiscalAtual,
    brasilnfe_company_token: companyToken,
    brasilnfe_company_id:    companyId || undefined,
    brasilnfe_cadastrado_em: new Date().toISOString(),
  };

  const { error: updateErr } = await supabaseAdmin
    .from('saloes')
    .update({ config_fiscal: novoConfigFiscal })
    .eq('id', salao_id);

  if (updateErr) {
    return NextResponse.json({ erro: 'Erro ao salvar CompanyToken: ' + updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    sucesso: true,
    mensagem: `Salão "${salao.nome_fantasia || salao.razao_social}" registrado com sucesso na Brasil NFe.`,
    cnpj,
    company_id: companyId,
  });
}
