/**
 * POST /api/fiscal/upload-a1
 * Recebe o certificado A1 (.pfx/.p12) e a senha do salão autenticado.
 *
 * Fluxo:
 *  1. Valida auth e arquivo
 *  2. Se o salão já foi cadastrado na Brasil NFe pelo admin (existe
 *     config_fiscal.brasilnfe_company_token), submete o certificado
 *     diretamente ao provedor via submeterCertificadoA1() — NUNCA persiste o
 *     .pfx/senha nesse caminho — e ativa o módulo (status = 'ativo').
 *     → Recusado pelo provedor: erro 422 devolvido ao usuário (senha errada etc.)
 *  3. Sem cadastro prévio (cadastro automático ainda não rodou/falhou): guarda
 *     no Supabase Storage (bucket certificados-a1, privado) só como fallback,
 *     para o admin baixar manualmente e ativar depois (GavetaFiscalSaloes).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { submeterCertificadoA1 } from '@/lib/nfse/brasilnfe';
import { encryptarSegredo } from '@/lib/cripto';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const BUCKET = 'certificados-a1';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Grava entrada na tabela de auditoria (best-effort — nunca bloqueia a resposta ao usuário). */
async function gravarAuditoria(params: {
  salaoId: string; usuarioId: string; nomeArquivo: string; tamanhoBytes: number;
  sucesso: boolean; mensagemErro?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('auditoria_certificados').insert({
    salao_id:      params.salaoId,
    usuario_id:    params.usuarioId,
    provedor:      'brasilnfe',
    nome_arquivo:  params.nomeArquivo,
    tamanho_bytes: params.tamanhoBytes,
    sucesso:       params.sucesso,
    mensagem_erro: params.mensagemErro ?? null,
  });
  if (error) console.error('[upload-a1] falha ao gravar auditoria:', error);
}

export async function POST(req: NextRequest) {
  // ── 1. Autenticar usuário e resolver salão ───────────────────────────────────
  const { user, perfil, erro } = await autenticarRota(req, 'POST /api/fiscal/upload-a1');
  if (erro) return erro;
  const salaoId = perfil!.salao_id;

  // ── 2. Extrair FormData ──────────────────────────────────────────────────────
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

  const bytes = await arquivo.arrayBuffer();

  // ── 4. Salão já cadastrado na Brasil NFe? ────────────────────────────────────
  // Exige que o admin já tenha cadastrado o CNPJ do salão na Brasil NFe
  // (POST /api/admin/brasilnfe/cadastrar) — só depois disso existe o Token
  // da empresa (config_fiscal.brasilnfe_company_token), exigido pelo endpoint
  // real de certificado (AlterarCertificado).
  const { data: salao } = await supabaseAdmin
    .from('saloes')
    .select('config_fiscal')
    .eq('id', salaoId)
    .maybeSingle();

  const companyToken: string = salao?.config_fiscal?.brasilnfe_company_token || '';

  // ── 5a. Com cadastro prévio: submete direto ao provedor, sem persistir nada ──
  // O .pfx e a senha nunca tocam disco/storage nesse caminho — trafegam só em
  // memória até a chamada HTTPS pra Brasil NFe.
  if (companyToken) {
    const certBase64 = Buffer.from(bytes).toString('base64');
    const resultado  = await submeterCertificadoA1(certBase64, senha, companyToken);

    if (resultado.sucesso) {
      await supabaseAdmin.from('saloes').update({
        status_fiscal:     'ativo',
        fiscal_ativado_em: new Date().toISOString(),
      }).eq('id', salaoId);

      await gravarAuditoria({ salaoId, usuarioId: user!.id, nomeArquivo: arquivo.name, tamanhoBytes: arquivo.size, sucesso: true });
      return NextResponse.json({ ok: true, ativado: true, mensagem: 'Certificado aceito e módulo fiscal ativado!' });
    }

    console.warn('[upload-a1] Brasil NFe recusou o certificado:', resultado.erro);
    await gravarAuditoria({ salaoId, usuarioId: user!.id, nomeArquivo: arquivo.name, tamanhoBytes: arquivo.size, sucesso: false, mensagemErro: resultado.erro });
    return NextResponse.json({ erro: `Brasil NFe recusou o certificado: ${resultado.erro ?? 'erro desconhecido'}` }, { status: 422 });
  }

  // ── 5b. Sem cadastro prévio: guarda no Storage como fallback manual ─────────
  // Cadastro automático ainda não rodou (ou falhou) — sem Token não há como
  // submeter agora. Guarda o A1 pro admin baixar (GavetaFiscalSaloes) e ativar
  // manualmente depois que o cadastro do CNPJ for concluído.
  const caminho = `${salaoId}/certificado.${ext}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(caminho, bytes, {
      contentType: 'application/x-pkcs12',
      upsert: true,
    });

  if (uploadErr) {
    console.error('[upload-a1] storage error:', uploadErr);
    await gravarAuditoria({ salaoId, usuarioId: user!.id, nomeArquivo: arquivo.name, tamanhoBytes: arquivo.size, sucesso: false, mensagemErro: uploadErr.message });
    return NextResponse.json({ erro: 'Erro ao salvar o certificado. Tente novamente.' }, { status: 500 });
  }

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

  await gravarAuditoria({ salaoId, usuarioId: user!.id, nomeArquivo: arquivo.name, tamanhoBytes: arquivo.size, sucesso: true, mensagemErro: 'sem company_token — aguardando cadastro/ativação manual' });
  return NextResponse.json({ ok: true, mensagem: 'Certificado recebido. Aguardando ativação pelo administrador.' });
}
