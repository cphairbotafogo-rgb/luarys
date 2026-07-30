/**
 * POST /api/fiscal/upload-a1
 * Recebe o certificado A1 (.pfx/.p12) e a senha do salão autenticado.
 *
 * Fluxo:
 *  1. Valida auth e arquivo
 *  2. Salva no Supabase Storage (bucket certificados-a1, privado)
 *  3. Se o salão já foi cadastrado na Brasil NFe pelo admin (existe
 *     config_fiscal.brasilnfe_company_token), tenta submeter o certificado
 *     automaticamente via submeterCertificadoA1() e ativa o módulo (status = 'ativo').
 *     → Sem cadastro prévio / erro: mantém 'pendente_a1' para ativação manual pelo admin
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { submeterCertificadoA1 } from '@/lib/nfse/brasilnfe';
import { encryptarSegredo } from '@/lib/cripto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const BUCKET = 'certificados-a1';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  // ── 1. Autenticar usuário ────────────────────────────────────────────────────
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (!bearer) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(bearer);
  if (authErr || !user) return NextResponse.json({ erro: 'Sessão inválida.' }, { status: 401 });

  // ── 2. Buscar salao_id do perfil ─────────────────────────────────────────────
  const { data: perfil } = await supabaseAdmin
    .from('perfis_usuarios')
    .select('salao_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil?.salao_id) {
    return NextResponse.json({ erro: 'Perfil de salão não encontrado.' }, { status: 403 });
  }

  const salaoId = perfil.salao_id as string;

  // ── 3. Extrair FormData ──────────────────────────────────────────────────────
  const form = await req.formData();
  const arquivo = form.get('certificado') as File | null;
  const senha   = (form.get('senha') as string | null)?.trim();

  if (!arquivo) return NextResponse.json({ erro: 'Arquivo não encontrado no request.' }, { status: 400 });
  if (!senha)   return NextResponse.json({ erro: 'Senha do certificado obrigatória.' }, { status: 400 });

  const ext = arquivo.name.split('.').pop()?.toLowerCase();
  if (!['pfx', 'p12'].includes(ext ?? '')) {
    return NextResponse.json({ erro: 'Formato inválido. Envie .pfx ou .p12.' }, { status: 400 });
  }
  if (arquivo.size > MAX_BYTES) {
    return NextResponse.json({ erro: 'Arquivo muito grande. Máximo 5 MB.' }, { status: 400 });
  }

  // ── 4. Upload para o Storage ─────────────────────────────────────────────────
  const bytes    = await arquivo.arrayBuffer();
  const caminho  = `${salaoId}/certificado.${ext}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(caminho, bytes, {
      contentType: 'application/x-pkcs12',
      upsert: true,
    });

  if (uploadErr) {
    console.error('[upload-a1] storage error:', uploadErr);
    return NextResponse.json({ erro: 'Erro ao salvar o certificado. Tente novamente.' }, { status: 500 });
  }

  // ── 5. Atualizar salão ───────────────────────────────────────────────────────
  // C6: senha do A1 criptografada em repouso (AES-256-GCM) via SEGREDO_ENCRYPTION_KEY.
  // O certificado A1 dá poder de emitir nota em nome do salão — nunca em texto puro.
  const { error: updateErr } = await supabaseAdmin
    .from('saloes')
    .update({
      status_fiscal: 'pendente_a1',
      a1_path: caminho,
      a1_senha_enc: encryptarSegredo(senha),
      a1_enviado_em: new Date().toISOString(),
    })
    .eq('id', salaoId);

  if (updateErr) {
    console.error('[upload-a1] update error:', updateErr);
    return NextResponse.json({ erro: 'Certificado salvo, mas houve erro ao atualizar status.' }, { status: 500 });
  }

  // ── 6. Automação: submeter à Brasil NFe ──────────────────────────────────────
  // Exige que o admin já tenha cadastrado o CNPJ do salão na Brasil NFe
  // (POST /api/admin/brasilnfe/cadastrar) — só depois disso existe o Token
  // da empresa (config_fiscal.brasilnfe_company_token), exigido pelo endpoint
  // real de certificado (AlterarCertificado). Sem esse Token não há como
  // submeter automaticamente; o admin ativa manualmente depois.
  try {
    const { data: salao } = await supabaseAdmin
      .from('saloes')
      .select('config_fiscal')
      .eq('id', salaoId)
      .maybeSingle();

    const companyToken: string = salao?.config_fiscal?.brasilnfe_company_token || '';

    if (companyToken) {
      const certBase64 = Buffer.from(bytes).toString('base64');
      const resultado  = await submeterCertificadoA1(certBase64, senha, companyToken);

      if (resultado.sucesso) {
        await supabaseAdmin.from('saloes').update({
          status_fiscal:     'ativo',
          fiscal_ativado_em: new Date().toISOString(),
        }).eq('id', salaoId);
        return NextResponse.json({ ok: true, ativado: true, mensagem: 'Certificado aceito e módulo fiscal ativado!' });
      }

      // Submissão retornou erro — log, mas não bloquear (A1 já está salvo)
      console.warn('[upload-a1] Brasil NFe recusou o certificado:', resultado.erro);
    }
  } catch (e) {
    // Nunca bloquear o lojista por falha na automação — o admin faz manualmente
    console.error('[upload-a1] erro inesperado na automação Brasil NFe:', e);
  }

  return NextResponse.json({ ok: true, mensagem: 'Certificado recebido. Aguardando ativação pelo administrador.' });
}
