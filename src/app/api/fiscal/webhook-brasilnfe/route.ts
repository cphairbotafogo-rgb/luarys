// Callback da Brasil NFe quando um certificado A1 é processado de forma
// assíncrona. Ativado quando upload-a1 retorna { processando: true } (Cenário B).
//
// Correções em relação à versão anterior:
//  1. FAIL-CLOSED: antes, se BRASIL_NFE_WEBHOOK_SECRET não estivesse configurado,
//     a validação era simplesmente PULADA — qualquer pessoa na internet podia
//     mandar um POST anônimo, sobrescrever o token_nfse_salao de um salão
//     (localizável por CNPJ) e ativar o módulo fiscal com um token forjado.
//     Agora, segredo ausente = requisição rejeitada (mesmo padrão dos webhooks
//     WhatsApp e Asaas).
//  2. Comparação de segredo com crypto.timingSafeEqual (antes era !==).
//  3. CNPJ do corpo do webhook não é mais interpolado dentro de um filtro
//     .or() em string — dado externo em string de filtro PostgREST permite
//     manipular a query. Agora usa .in() com valores.
//  4. Limpeza de CNPJ preserva letras ([A-Z0-9]) — CNPJ alfanumérico está em
//     vigor desde 01/07/2026; replace(/\D/g,'') corrompia o CNPJ novo.
//
// TODO (mantido — preencher quando tiver a documentação da Brasil NFe):
//  - Confirmar como a Brasil NFe autentica o webhook (HMAC-SHA256? Bearer? IP allowlist?)
//    e substituir a comparação de segredo estático pela validação oficial.
//  - Confirmar o formato real do payload e os valores possíveis de `status`.
//  - Registrar a URL com "www" (sem www há 308 e gateways não seguem redirect em POST):
//    https://www.luarys.com.br/api/fiscal/webhook-brasilnfe
//
// .env.local:
//   BRASIL_NFE_WEBHOOK_SECRET=<segredo combinado com a Brasil NFe>  — OBRIGATÓRIO

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { limparCnpj } from '@/lib/cnpj';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function segredoConfere(recebido: string | null | undefined, esperado: string): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // ── 1. Validar segredo — FAIL-CLOSED ─────────────────────────────────────────
  const webhookSecret = process.env.BRASIL_NFE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook-brasilnfe] BRASIL_NFE_WEBHOOK_SECRET não configurado — requisição bloqueada.');
    return NextResponse.json({ erro: 'Configuração ausente.' }, { status: 503 });
  }

  const assinatura =
    req.headers.get('x-brasilnfe-signature')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!segredoConfere(assinatura, webhookSecret)) {
    console.warn('[webhook-brasilnfe] assinatura ausente ou inválida — requisição rejeitada.');
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
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
  const statusBnfe:   string | undefined = body.status; // ex: 'ativo', 'erro', 'processando'

  console.info('[webhook-brasilnfe] recebido:', { cnpj, protocolo, statusBnfe, temToken: !!companyToken });

  // Sempre responder 200 para payloads incompletos — evita loop de retry
  if (!companyToken || (!cnpj && !protocolo)) {
    console.warn('[webhook-brasilnfe] payload sem company_token ou identificador.');
    return NextResponse.json({ ok: true });
  }

  // ── 3. Localizar o salão pelo protocolo ou CNPJ ──────────────────────────────
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
    // Preserva letras: CNPJ alfanumérico (IN RFB 2.229/2024, vigente desde 01/07/2026).
    const cnpjLimpo = limparCnpj(cnpj);
    const candidatos = Array.from(new Set([cnpjLimpo, cnpj].filter(Boolean)));
    const { data } = await supabaseAdmin
      .from('saloes')
      .select('id')
      .eq('status_fiscal', 'processando')
      .in('cnpj', candidatos)
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
    // 500 → Brasil NFe tenta novamente
    return NextResponse.json({ erro: 'Erro interno ao ativar.' }, { status: 500 });
  }

  console.info('[webhook-brasilnfe] módulo fiscal ativado para salão:', salaoId);
  return NextResponse.json({ ok: true });
}
