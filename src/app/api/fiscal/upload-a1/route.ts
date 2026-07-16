/**
 * POST /api/fiscal/upload-a1
 * Recebe o certificado A1 (.pfx/.p12) e a senha do salão autenticado.
 *
 * Fluxo:
 *  1. Valida auth e arquivo
 *  2. Salva no Supabase Storage (bucket certificados-a1, privado)
 *  3. Tenta submeter automaticamente à Brasil NFe via submeterCertificadoA1()
 *     → Síncrono: salva CompanyToken, ativa módulo (status = 'ativo')
 *     → Assíncrono: salva protocolo, aguarda webhook (status = 'processando')
 *     → Sem configuração / erro: mantém 'pendente_a1' para ativação manual pelo admin
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { submeterCertificadoA1 } from '@/lib/nfse/brasilnfe';

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
  // A senha é armazenada em texto (por enquanto) — marcar como débito técnico
  // para criptografar com chave de servidor antes de ir a produção.
  const { error: updateErr } = await supabaseAdmin
    .from('saloes')
    .update({
      status_fiscal: 'pendente_a1',
      a1_path: caminho,
      a1_senha_enc: senha,        // TODO: encrypt with server-side key before production
      a1_enviado_em: new Date().toISOString(),
    })
    .eq('id', salaoId);

  if (updateErr) {
    console.error('[upload-a1] update error:', updateErr);
    return NextResponse.json({ erro: 'Certificado salvo, mas houve erro ao atualizar status.' }, { status: 500 });
  }

  // ── 6. Automação: submeter à Brasil NFe (se BRASIL_NFE_USER_TOKEN configurado) ──
  const userToken = process.env.BRASIL_NFE_USER_TOKEN;

  if (userToken) {
    try {
      // Buscar CNPJ do salão para enviar à Brasil NFe
      const { data: salao } = await supabaseAdmin
        .from('saloes')
        .select('cnpj')
        .eq('id', salaoId)
        .maybeSingle();

      const cnpj = salao?.cnpj?.replace(/\D/g, ''); // somente dígitos

      if (cnpj) {
        const certBase64 = Buffer.from(bytes).toString('base64');
        const resultado  = await submeterCertificadoA1(cnpj, certBase64, senha, userToken);

        if (resultado.companyToken) {
          // Cenário A: Brasil NFe respondeu de forma síncrona — ativar imediatamente
          await supabaseAdmin.from('saloes').update({
            status_fiscal:     'ativo',
            token_nfse_salao:  resultado.companyToken,
            fiscal_ativado_em: new Date().toISOString(),
          }).eq('id', salaoId);
          return NextResponse.json({ ok: true, ativado: true, mensagem: 'Certificado aceito e módulo fiscal ativado!' });
        }

        if (resultado.protocolo) {
          // Cenário B: Brasil NFe está processando — aguardar webhook
          await supabaseAdmin.from('saloes').update({
            status_fiscal:            'processando',
            a1_protocolo_brasilnfe:   resultado.protocolo,
          }).eq('id', salaoId);
          return NextResponse.json({ ok: true, processando: true, mensagem: 'Certificado enviado. Ativação automática em andamento.' });
        }

        // Submissão retornou erro — log, mas não bloquear (A1 já está salvo)
        console.warn('[upload-a1] Brasil NFe retornou erro na submissão do certificado:', resultado.erro);
      }
    } catch (e) {
      // Nunca bloquear o lojista por falha na automação — o admin faz manualmente
      console.error('[upload-a1] erro inesperado na automação Brasil NFe:', e);
    }
  }

  return NextResponse.json({ ok: true, mensagem: 'Certificado recebido. Aguardando ativação pelo administrador.' });
}
