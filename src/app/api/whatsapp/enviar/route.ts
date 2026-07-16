import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  carregarConfigMestra,
  verificarSaldo,
  debitarMensagem,
  type CategoriaTemplate,
} from '@/lib/whatsappCota';
import { autenticarRota } from '@/lib/apiAuth';
import { decryptarTokenWhatsapp } from '@/lib/whatsappCrypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const META_API_VERSION = 'v20.0';

/**
 * POST /api/whatsapp/enviar
 *
 * Plano B (gestao_meta): credenciais próprias do salão → Meta cobra direto, sem saldo aqui.
 * Plano A (modelo mestre): número da Luarys → verifica e debita whatsapp_carteira_creditos.
 *
 * Cobrança Meta (desde julho/2025): por mensagem entregue.
 *   template_nome ausente → texto livre → gratuito
 *   tipo_conversa 'marketing' → debita saldo_campanha
 *   tipo_conversa 'utilidade' | 'autenticacao' → debita saldo_atendimento
 */
export async function POST(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'POST /api/whatsapp/enviar');
  if (erro) return erro;

  const body = await req.json().catch(() => ({}));
  const {
    telefone,
    mensagem,
    template_nome,
    template_variaveis,
    tipo_conversa = 'utilidade',
    cliente_id,
    campanha_id,
  } = body as {
    telefone?: string;
    mensagem?: string;
    template_nome?: string;
    template_variaveis?: string[];
    tipo_conversa?: CategoriaTemplate;
    cliente_id?: string;
    campanha_id?: string;
  };

  if (!telefone) return NextResponse.json({ erro: 'Campo "telefone" obrigatório.' }, { status: 400 });
  if (!mensagem && !template_nome) return NextResponse.json({ erro: 'Informe "mensagem" ou "template_nome".' }, { status: 400 });

  const telefoneLimpo = telefone.replace(/\D/g, '');
  const telefoneFormatado = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

  // Sem template → texto livre → gratuito. Com template → usa tipo_conversa para determinar saldo.
  const categoria: CategoriaTemplate | 'texto' = template_nome ? tipo_conversa : 'texto';

  // ── Detecta plano do salão ────────────────────────────────────────────────
  const { data: configPlanoB, error: erroPlanoBQuery } = await supabaseAdmin
    .from('whatsapp_config_plano')
    .select('phone_number_id, token_criptografado')
    .eq('salao_id', perfil.salao_id)
    .eq('plano', 'gestao_meta')
    .eq('ativo', true)
    .maybeSingle();

  if (erroPlanoBQuery) {
    return NextResponse.json({ erro: 'Erro ao verificar configuração WhatsApp.' }, { status: 503 });
  }

  let tokenEnvio: string;
  let phoneNumberIdEnvio: string;
  let ehPlanoA = false;

  if (configPlanoB?.token_criptografado) {
    // ── Plano B: credenciais próprias — Meta cobra o salão diretamente ─────
    try {
      tokenEnvio = decryptarTokenWhatsapp(configPlanoB.token_criptografado);
    } catch {
      return NextResponse.json({
        erro: 'Credenciais WhatsApp inválidas. Reconfigure o token em Central de Comunicação → WhatsApp.',
      }, { status: 500 });
    }
    phoneNumberIdEnvio = configPlanoB.phone_number_id;
  } else {
    // ── Plano A: número da Luarys — verifica saldo antes de enviar ─────────
    ehPlanoA = true;

    const verificacao = await verificarSaldo(supabaseAdmin, perfil.salao_id, categoria);
    if (!verificacao.permitido) {
      return NextResponse.json({ erro: verificacao.motivo }, { status: 429 });
    }

    const config = await carregarConfigMestra(supabaseAdmin);
    if (!config?.token || !config?.phone_number_id) {
      return NextResponse.json({
        erro: 'WhatsApp não configurado na plataforma. Acesse Admin → WhatsApp Luarys.',
      }, { status: 503 });
    }

    tokenEnvio = config.token;
    phoneNumberIdEnvio = config.phone_number_id;
  }

  // ── Monta payload Meta ────────────────────────────────────────────────────
  const payloadMeta: Record<string, any> = template_nome
    ? {
        messaging_product: 'whatsapp',
        to: telefoneFormatado,
        type: 'template',
        template: {
          name: template_nome,
          language: { code: 'pt_BR' },
          ...(template_variaveis?.length
            ? { components: [{ type: 'body', parameters: template_variaveis.map(v => ({ type: 'text', text: String(v) })) }] }
            : {}),
        },
      }
    : {
        messaging_product: 'whatsapp',
        to: telefoneFormatado,
        type: 'text',
        text: { body: mensagem, preview_url: false },
      };

  // ── Envia ─────────────────────────────────────────────────────────────────
  let respostaMeta: Response;
  try {
    respostaMeta = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberIdEnvio}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenEnvio}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadMeta),
      }
    );
  } catch (err: any) {
    return NextResponse.json({ erro: 'Falha de conexão com a API da Meta: ' + err.message }, { status: 502 });
  }

  const dadosMeta = await respostaMeta.json().catch(() => ({}));

  if (!respostaMeta.ok) {
    return NextResponse.json({
      erro: dadosMeta?.error?.message ?? 'Erro na API da Meta.',
      codigo_meta: dadosMeta?.error?.code,
      detalhes: dadosMeta?.error?.error_data?.details,
    }, { status: 502 });
  }

  const wamid: string | undefined = dadosMeta?.messages?.[0]?.id;

  // ── Débita crédito após envio confirmado (Plano A + template) ────────────
  if (ehPlanoA && template_nome && categoria !== 'texto') {
    await debitarMensagem(supabaseAdmin, perfil.salao_id, categoria as CategoriaTemplate, {
      phoneNumberId: phoneNumberIdEnvio,
      wamid,
      clienteId: cliente_id,
      campanhaId: campanha_id,
    });
  }

  return NextResponse.json({ sucesso: true, wamid });
}
