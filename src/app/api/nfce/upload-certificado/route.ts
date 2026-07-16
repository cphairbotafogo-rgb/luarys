import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadCertificadoFocus } from '@/lib/nfce/focusnfe';
import { baseUrl } from '@/lib/nfse/brasilnfe';
import { autenticarRota } from '@/lib/apiAuth';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de validação
// ─────────────────────────────────────────────────────────────────────────────

/** Tamanho máximo aceito: 5 MB. Certificados A1 reais raramente passam de 10 KB,
 *  mas damos margem generosa para formatos com cadeia completa. */
const MAX_TAMANHO_BYTES = 5 * 1024 * 1024; // 5 MB

/** Magic bytes de um arquivo PKCS#12 (.pfx / .p12).
 *  Todo arquivo PKCS#12 válido começa com a sequência DER: 30 82
 *  (SEQUENCE de comprimento em 2 bytes — padrão ASN.1/DER). */
const PKCS12_MAGIC = [0x30, 0x82] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Cliente admin (service_role — ignora RLS para logs de auditoria e queries de negócio)
// ─────────────────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Valida magic bytes do buffer para garantir que é realmente PKCS#12.
 *  Impede que o usuário envie arquivos de qualquer outro tipo com extensão .pfx. */
function isPkcs12(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === PKCS12_MAGIC[0] && buf[1] === PKCS12_MAGIC[1];
}

/** Grava entrada na tabela de auditoria usando service_role (ignora RLS). */
async function gravarAuditoria(params: {
  salaoId: string;
  usuarioId: string;
  provedor: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  ipOrigem: string | null;
  sucesso: boolean;
  mensagemErro?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('auditoria_certificados').insert({
    salao_id:      params.salaoId,
    usuario_id:    params.usuarioId,
    provedor:      params.provedor,
    nome_arquivo:  params.nomeArquivo,
    tamanho_bytes: params.tamanhoBytes,
    ip_origem:     params.ipOrigem,
    sucesso:       params.sucesso,
    mensagem_erro: params.mensagemErro ?? null,
  });

  if (error) {
    // Log estruturado — não bloqueia a resposta ao usuário, mas registra falha de auditoria
    console.error('[upload-certificado] Falha ao gravar auditoria', {
      salao_id:   params.salaoId,
      usuario_id: params.usuarioId,
      erro:       error.message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rota POST /api/nfce/upload-certificado
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Autenticação ────────────────────────────────────────────────────────
  // Não aceitamos salao_id vindo do body — sempre derivamos do perfil do usuário.
  // Isso impede que salão A envie certificado para o salão B.
  const { user, perfil, erro } = await autenticarRota(req, 'POST /api/nfce/upload-certificado');
  if (erro) return erro;
  // Após a guarda acima, user e perfil são garantidamente não-nulos
  const salaoId = perfil!.salao_id;
  const usuarioId = user!.id;

  const { data: salao } = await supabaseAdmin
    .from('saloes')
    .select('cnpj, config_fiscal')
    .eq('id', salaoId)
    .single();

  if (!salao?.cnpj) {
    return NextResponse.json({ erro: 'CNPJ não cadastrado. Configure em Dados da Empresa.' }, { status: 422 });
  }

  // ── 3. Leitura do FormData ─────────────────────────────────────────────────
  const form = await req.formData();
  const arquivo       = form.get('arquivo') as File | null;
  const senha         = form.get('senha') as string | null;
  const provedorParam = (form.get('provedor') as string | null) || 'focusnfe';

  if (!arquivo || !senha) {
    return NextResponse.json({ erro: 'Arquivo e senha são obrigatórios.' }, { status: 400 });
  }

  // ── 4. Validação de tamanho ────────────────────────────────────────────────
  if (arquivo.size > MAX_TAMANHO_BYTES) {
    return NextResponse.json(
      { erro: `Arquivo muito grande. O limite é 5 MB. Tamanho recebido: ${(arquivo.size / 1024).toFixed(0)} KB.` },
      { status: 413 },
    );
  }

  if (arquivo.size === 0) {
    return NextResponse.json({ erro: 'Arquivo vazio.' }, { status: 400 });
  }

  // ── 5. Leitura do buffer e validação de magic bytes (PKCS#12) ─────────────
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  if (!isPkcs12(buffer)) {
    return NextResponse.json(
      { erro: 'Arquivo inválido. Envie um certificado digital A1 no formato .pfx ou .p12 (PKCS#12).' },
      { status: 415 },
    );
  }

  // ── 6. Metadados para auditoria ────────────────────────────────────────────
  const ipOrigem = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? null;

  const metadados = {
    salaoId:      salaoId,
    usuarioId:    usuarioId,
    provedor:     provedorParam,
    nomeArquivo:  arquivo.name,
    tamanhoBytes: arquivo.size,
    ipOrigem,
  };

  // Log estruturado imediato (antes de chamar o provedor)
  console.log('[upload-certificado] Iniciando upload', {
    salao_id:    salaoId,
    usuario_id:  usuarioId,
    provedor:    provedorParam,
    nome_arquivo: arquivo.name,
    tamanho_kb:  (arquivo.size / 1024).toFixed(1),
    ip:          ipOrigem,
    ts:          new Date().toISOString(),
  });

  // ── 7. Roteamento por provedor ─────────────────────────────────────────────

  if (provedorParam === 'brasilnfe') {
    const companyToken: string = salao.config_fiscal?.brasilnfe_company_token || '';
    const companyId: string    = salao.config_fiscal?.brasilnfe_company_id    || '';

    if (!companyToken) {
      return NextResponse.json({
        erro: 'Salão não registrado na Brasil NFe. Solicite ao administrador do Luarys que faça o cadastro do CNPJ antes de enviar o certificado.',
      }, { status: 422 });
    }

    const formData = new FormData();
    formData.append('certificate', new Blob([buffer], { type: 'application/x-pkcs12' }), arquivo.name);
    formData.append('password', senha);

    const endpoint = companyId
      ? `${baseUrl()}/company/${companyId}/certificate`
      : `${baseUrl()}/company/certificate`;

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${companyToken}` },
      body: formData,
    });

    const json = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = json.mensagem ?? json.message ?? json.error ?? `HTTP ${resp.status}`;
      const mensagemErro = `Brasil NFe recusou o certificado: ${msg}`;

      await gravarAuditoria({ ...metadados, sucesso: false, mensagemErro });
      console.error('[upload-certificado] Falha no envio para Brasil NFe', {
        salao_id: salaoId,
        usuario_id: usuarioId,
        status_http: resp.status,
        erro: msg,
      });

      return NextResponse.json({ erro: mensagemErro }, { status: 422 });
    }

    // Registra metadados na tabela de configuração (sem a senha ou o arquivo)
    await supabaseAdmin
      .from('configuracoes_nfce_produtos')
      .upsert({
        salao_id: salaoId,
        cert_info: {
          instalado:        true,
          data_instalacao:  new Date().toISOString(),
          nome_arquivo:     arquivo.name,
          tamanho_bytes:    arquivo.size,
          provedor:         'brasilnfe',
          usuario_id:       usuarioId,
        },
      }, { onConflict: 'salao_id' });

    await gravarAuditoria({ ...metadados, sucesso: true });
    console.log('[upload-certificado] Sucesso — Brasil NFe', {
      salao_id:  salaoId,
      usuario_id: usuarioId,
      ts:        new Date().toISOString(),
    });

    return NextResponse.json({ sucesso: true });
  }

  // ── Focus NFe (padrão) ────────────────────────────────────────────────────
  const tokenFocus: string | undefined = salao.config_fiscal?.focus_nfe_token || undefined;
  const resultado = await uploadCertificadoFocus(salao.cnpj, buffer, senha, tokenFocus);

  if (!resultado.sucesso) {
    await gravarAuditoria({ ...metadados, sucesso: false, mensagemErro: resultado.erro });
    console.error('[upload-certificado] Falha no envio para Focus NFe', {
      salao_id:  salaoId,
      usuario_id: usuarioId,
      erro:       resultado.erro,
    });
    return NextResponse.json({ erro: resultado.erro }, { status: 422 });
  }

  // Registra metadados na tabela de configuração (sem a senha ou o arquivo)
  await supabaseAdmin
    .from('configuracoes_nfce_produtos')
    .upsert({
      salao_id: salaoId,
      cert_info: {
        instalado:       true,
        data_instalacao: new Date().toISOString(),
        nome_arquivo:    arquivo.name,
        tamanho_bytes:   arquivo.size,
        provedor:        'focusnfe',
        usuario_id:      usuarioId,
      },
    }, { onConflict: 'salao_id' });

  await gravarAuditoria({ ...metadados, sucesso: true });
  console.log('[upload-certificado] Sucesso — Focus NFe', {
    salao_id:  salaoId,
    usuario_id: usuarioId,
    ts:        new Date().toISOString(),
  });

  return NextResponse.json({ sucesso: true });
}
