/**
 * src/lib/whatsappEnviar.ts
 *
 * Envio de template WhatsApp via API da Meta, para uso server-to-server
 * (sem sessão de usuário) — ex: disparo automático de confirmação de
 * agendamento. Duplica a lógica de envio de /api/whatsapp/enviar de
 * propósito (em vez de importar a rota) para não arriscar mexer nesse
 * endpoint já em uso.
 *
 * Exige um template aprovado pela Meta com o nome passado em templateNome —
 * sem isso a API da Meta rejeita o envio (mensagem business-initiated fora
 * da janela de 24h exige template aprovado).
 */
import { createClient } from '@supabase/supabase-js';
import { carregarConfigMestra, verificarSaldo, debitarMensagem, type CategoriaTemplate } from './whatsappCota';
import { decryptarTokenWhatsapp } from './whatsappCrypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const META_API_VERSION = 'v20.0';

export async function enviarWhatsappTemplate({
  salaoId,
  telefone,
  templateNome,
  templateVariaveis,
  tipoConversa = 'utilidade',
  clienteId,
}: {
  salaoId: string;
  telefone: string;
  templateNome: string;
  templateVariaveis?: string[];
  tipoConversa?: CategoriaTemplate;
  clienteId?: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const telefoneLimpo = (telefone || '').replace(/\D/g, '');
  if (!telefoneLimpo) return { ok: false, erro: 'Telefone ausente.' };
  const telefoneFormatado = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

  const { data: configPlanoB } = await supabaseAdmin
    .from('whatsapp_config_plano')
    .select('phone_number_id, token_criptografado')
    .eq('salao_id', salaoId)
    .eq('plano', 'gestao_meta')
    .eq('ativo', true)
    .maybeSingle();

  let tokenEnvio: string;
  let phoneNumberIdEnvio: string;
  let ehPlanoA = false;

  if (configPlanoB?.token_criptografado) {
    try {
      tokenEnvio = decryptarTokenWhatsapp(configPlanoB.token_criptografado);
    } catch {
      return { ok: false, erro: 'Credenciais WhatsApp inválidas.' };
    }
    phoneNumberIdEnvio = configPlanoB.phone_number_id;
  } else {
    ehPlanoA = true;
    const verificacao = await verificarSaldo(supabaseAdmin, salaoId, tipoConversa);
    if (!verificacao.permitido) return { ok: false, erro: verificacao.motivo };

    const config = await carregarConfigMestra(supabaseAdmin);
    if (!config?.token || !config?.phone_number_id) {
      return { ok: false, erro: 'WhatsApp não configurado na plataforma.' };
    }
    tokenEnvio = config.token;
    phoneNumberIdEnvio = config.phone_number_id;
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: telefoneFormatado,
    type: 'template',
    template: {
      name: templateNome,
      language: { code: 'pt_BR' },
      ...(templateVariaveis?.length
        ? { components: [{ type: 'body', parameters: templateVariaveis.map(v => ({ type: 'text', text: String(v) })) }] }
        : {}),
    },
  };

  let resp: Response;
  try {
    resp = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneNumberIdEnvio}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenEnvio}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    return { ok: false, erro: 'Falha de conexão com a API da Meta: ' + err.message };
  }

  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { ok: false, erro: dados?.error?.message ?? 'Erro na API da Meta.' };
  }

  const wamid: string | undefined = dados?.messages?.[0]?.id;

  if (ehPlanoA) {
    await debitarMensagem(supabaseAdmin, salaoId, tipoConversa, {
      phoneNumberId: phoneNumberIdEnvio,
      wamid,
      clienteId,
    });
  }

  return { ok: true };
}
