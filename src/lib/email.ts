/**
 * src/lib/email.ts
 *
 * Envio de e-mail transacional via Resend.
 *
 * Variáveis de ambiente:
 *   RESEND_API_KEY   — obrigatória. ⚠️ NÃO está configurada em produção hoje;
 *                      sem ela nada é enviado (esta função devolve {ok:false}).
 *   EMAIL_REMETENTE  — remetente oficial do Luarys:
 *                      "Luarys <contato@luarys.com.br>"
 *                      O domínio precisa estar verificado no Resend; enquanto
 *                      não estiver, o fallback onboarding@resend.dev só entrega
 *                      para o e-mail da própria conta Resend (bom para teste).
 */
export interface AnexoEmail {
  /** Nome do arquivo como o destinatário vai vê-lo (ex: 'agendamentos.csv'). */
  filename: string;
  /** Conteúdo do arquivo já em base64 — é o formato que a API do Resend espera. */
  content: string;
}

export async function enviarEmail({
  to,
  subject,
  html,
  anexos,
}: {
  to: string;
  subject: string;
  html: string;
  /** Opcional. Usado pelo resumo diário para mandar a agenda em CSV. */
  anexos?: AnexoEmail[];
}): Promise<{ ok: boolean; erro?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, erro: 'RESEND_API_KEY não configurado.' };
  }

  const remetente = process.env.EMAIL_REMETENTE || 'Luarys <onboarding@resend.dev>';

  try {
    const corpo: Record<string, unknown> = { from: remetente, to: [to], subject, html };
    if (anexos?.length) corpo.attachments = anexos;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });

    if (!resp.ok) {
      const dados = await resp.json().catch(() => ({}));
      return { ok: false, erro: dados?.message || `Resend HTTP ${resp.status}` };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: 'Falha de conexão com o Resend: ' + err.message };
  }
}
