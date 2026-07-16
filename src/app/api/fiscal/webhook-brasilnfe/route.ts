/**
 * POST /api/fiscal/webhook-brasilnfe
 *
 * Callback da Brasil NFe quando um certificado A1 é processado de forma assíncrona.
 * Ativado quando upload-a1 retorna { processando: true } (Cenário B).
 *
 * TODO (preencher quando tiver a documentação da Brasil NFe):
 *  - Confirmar como a Brasil NFe autentica o webhook (HMAC-SHA256? Bearer secret? IP allowlist?)
 *  - Confirmar o formato do payload: { cnpj, company_token, protocolo, status }
 *  - Confirmar o nome exato dos campos e valores possíveis de `status`
 *  - Registrar esta URL no painel/API da Brasil NFe:
 *    https://luarys.com.br/api/fiscal/webhook-brasilnfe (produção)
 *
 * Configurar em .env.local:
 *   BRASIL_NFE_WEBHOOK_SECRET=<segredo combinado com a Brasil NFe>
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(req: NextRequest) {
  // ── 1. Validar assinatura do webhook ────────────────────────────────────────
  // TODO: substituir pela validação real da Brasil NFe (ex: HMAC, header específico)
  const webhookSecret = process.env.BRASIL_NFE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const assinatura = req.headers.get('x-brasilnfe-signature')
      ?? req.headers.get('authorization')?.replace('Bearer ', '');
    if (assinatura !== webhookSecret) {
      console.warn('[webhook-brasilnfe] assinatura inválida');
      return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
    }
  }

  // ── 2. Parsear payload ───────────────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ erro: 'Body inválido.' }, { status: 400 });
  }

  // TODO: ajustar nomes dos campos conforme payload real da Brasil NFe
  const companyToken: string | undefined = body.company_token ?? body.companyToken;
  const cnpj:         string | undefined = body.cnpj;
  const protocolo:    string | undefined = body.protocolo ?? body.protocol;
  const statusBnfe:   string | undefined = body.status;  // ex: 'ativo', 'erro', 'processando'

  console.info('[webhook-brasilnfe] recebido:', { cnpj, protocolo, statusBnfe, temToken: !!companyToken });

  // Sempre responder 200 para evitar loop de retry da Brasil NFe
  if (!companyToken || (!cnpj && !protocolo)) {
    console.warn('[webhook-brasilnfe] payload sem company_token ou identificador:', body);
    return NextResponse.json({ ok: true });
  }

  // ── 3. Localizar o salão pelo protocolo ou CNPJ ─────────────────────────────
  let salaoId: string | null = null;

  if (protocolo) {
    const { data } = await supabaseAdmin
      .from('saloes')
      .select('id')
      .eq('a1_protocolo_brasilnfe', protocolo)
      .maybeSingle();
    salaoId = data?.id ?? null;
  }

  if (!salaoId && cnpj) {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    const { data } = await supabaseAdmin
      .from('saloes')
      .select('id')
      .eq('status_fiscal', 'processando')
      .or(`cnpj.eq.${cnpjLimpo},cnpj.eq.${cnpj}`)
      .maybeSingle();
    salaoId = data?.id ?? null;
  }

  if (!salaoId) {
    console.warn('[webhook-brasilnfe] nenhum salão encontrado para:', { cnpj, protocolo });
    return NextResponse.json({ ok: true });
  }

  // ── 4. Ativar módulo fiscal do salão ─────────────────────────────────────────
  const { error } = await supabaseAdmin
    .from('saloes')
    .update({
      token_nfse_salao:  companyToken,
      status_fiscal:     'ativo',
      fiscal_ativado_em: new Date().toISOString(),
    })
    .eq('id', salaoId);

  if (error) {
    console.error('[webhook-brasilnfe] erro ao ativar salão:', salaoId, error);
    // Retornar 500 para a Brasil NFe tentar novamente
    return NextResponse.json({ erro: 'Erro interno ao ativar.' }, { status: 500 });
  }

  console.info('[webhook-brasilnfe] módulo fiscal ativado para salão:', salaoId);
  return NextResponse.json({ ok: true });
}
