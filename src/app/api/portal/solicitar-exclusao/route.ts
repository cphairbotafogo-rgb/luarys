/**
 * POST /api/portal/solicitar-exclusao
 *
 * Etapa 1 de 2 do fluxo de exclusão de conta (LGPD Art. 18, VI).
 *
 * FLUXO:
 *   1. Titular autenticado chama este endpoint → registra solicitação em
 *      `lgpd_solicitacoes_exclusao` com status 'pendente' + gera token único
 *      de confirmação + envia e-mail com link de confirmação.
 *   2. Titular clica no link → chama /api/portal/confirmar-exclusao?token=<uuid>
 *      → anonimização executada e conta excluída.
 *
 * MOTIVO DA CONFIRMAÇÃO POR E-MAIL:
 *   LGPD exige que o titular prove sua identidade antes da exclusão.
 *   Um Bearer token JWT válido prova que a sessão existe, mas não prova que
 *   o titular (pessoa física) está presente naquele momento (sessão pode estar
 *   roubada). O e-mail de confirmação fecha essa lacuna e cria trilha de
 *   auditoria com data/hora do pedido explícito.
 *
 * PRAZO LGPD:
 *   O prazo de resposta de 15 dias (Art. 18 §3º) é rastreado em
 *   `lgpd_solicitacoes_exclusao.prazo_resposta_em` = solicitado_em + 15 dias.
 *   O campo `status` permite rastrear 'pendente' → 'confirmada' → 'processada'.
 *
 * SEGURANÇA:
 *   - Bearer token obrigatório (autenticação via Supabase Auth)
 *   - Token de confirmação: UUID v4 gerado no servidor (nunca do cliente)
 *   - Token expira em 24 horas
 *   - Idempotente: se já existe solicitação pendente, reenvia o e-mail sem
 *     criar duplicata
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  // Instanciar dentro do handler para garantir env vars resolvidas
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // ── 1. Autenticação obrigatória ───────────────────────────────────────────
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json(
      { erro: 'Não autorizado. Faça login antes de solicitar a exclusão da conta.' },
      { status: 401 }
    )
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json(
      { erro: 'Sessão inválida. Faça login novamente.' },
      { status: 401 }
    )
  }

  // ── 2. Verificar se já existe solicitação pendente ────────────────────────
  const { data: solicitacaoExistente } = await supabaseAdmin
    .from('lgpd_solicitacoes_exclusao')
    .select('id, token_confirmacao, token_expira_em, status')
    .eq('usuario_portal_id', user.id)
    .eq('status', 'pendente')
    .maybeSingle()

  // Token de confirmação: UUID v4 gerado com crypto (nunca vindo do cliente)
  const tokenConfirmacao = crypto.randomUUID()
  const agora = new Date()
  const expiraEm = new Date(agora.getTime() + 24 * 60 * 60 * 1000) // +24 horas
  // prazo de 15 dias (LGPD Art. 18 §3º) é calculado pelo banco no DEFAULT da tabela

  if (solicitacaoExistente) {
    // Já existe solicitação pendente — atualizar token (reenvio)
    const { error: errAtualizar } = await supabaseAdmin
      .from('lgpd_solicitacoes_exclusao')
      .update({
        token_confirmacao: tokenConfirmacao,
        token_expira_em: expiraEm.toISOString(),
        // Não resetar prazo_resposta_em — prazo LGPD conta da primeira solicitação
      })
      .eq('id', solicitacaoExistente.id)

    if (errAtualizar) {
      console.error('[/api/portal/solicitar-exclusao] Erro ao atualizar token:', errAtualizar.message)
      return NextResponse.json(
        { erro: 'Erro interno ao processar solicitação.' },
        { status: 500 }
      )
    }
  } else {
    // Nova solicitação
    const { error: errInserir } = await supabaseAdmin
      .from('lgpd_solicitacoes_exclusao')
      .insert({
        usuario_portal_id: user.id,
        usuario_email: user.email ?? null,
        status: 'pendente',
        token_confirmacao: tokenConfirmacao,
        token_expira_em: expiraEm.toISOString(),
        solicitado_em: agora.toISOString(),
        // prazo_resposta_em: calculado automaticamente pelo banco (DEFAULT now() + 15 days)
      })

    if (errInserir) {
      console.error('[/api/portal/solicitar-exclusao] Erro ao registrar solicitação:', errInserir.message)
      return NextResponse.json(
        { erro: 'Erro interno ao registrar solicitação.' },
        { status: 500 }
      )
    }

    // Marcar em usuarios_portal que há solicitação pendente (para visibilidade no painel)
    await supabaseAdmin
      .from('usuarios_portal')
      .update({ solicitacao_exclusao_em: agora.toISOString() })
      .eq('id', user.id)
  }

  // ── 3. Enviar e-mail de confirmação ──────────────────────────────────────
  // O link de confirmação aponta para /api/portal/confirmar-exclusao?token=<uuid>
  // O e-mail é enviado via Supabase Auth (método mais simples) ou via provedor
  // externo (Resend, SendGrid). Por ora, usar o e-mail do Auth para o link:
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.luarys.com.br'
  const linkConfirmacao = `${baseUrl}/api/portal/confirmar-exclusao?token=${tokenConfirmacao}`

  // Envio via Supabase Auth email invite (reutiliza o provedor de e-mail configurado)
  // Nota: se o projeto tiver Resend/SendGrid, substituir aqui pela API do provedor.
  const { error: errEmail } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email!,
    options: {
      redirectTo: linkConfirmacao,
    },
  })

  // Falha no e-mail não deve reverter o registro (a solicitação foi gravada;
  // o usuário pode pedir reenvio). Mas é registrada no log para diagnóstico.
  if (errEmail) {
    console.error(
      '[/api/portal/solicitar-exclusao] Falha ao enviar e-mail de confirmação:',
      errEmail.message
    )
    // Retornar sucesso parcial — solicitação registrada, e-mail pendente de reenvio
    return NextResponse.json({
      ok: true,
      mensagem:
        'Solicitação registrada. Houve um problema ao enviar o e-mail de confirmação. ' +
        'Entre em contato com o suporte para concluir a exclusão.',
      emailEnviado: false,
    })
  }

  return NextResponse.json({
    ok: true,
    mensagem:
      'Solicitação de exclusão registrada. ' +
      'Enviamos um e-mail de confirmação para o endereço cadastrado. ' +
      'Clique no link do e-mail para confirmar a exclusão. O link expira em 24 horas. ' +
      'Seu pedido será processado em até 15 dias conforme a Lei Geral de Proteção de Dados (LGPD).',
    emailEnviado: true,
  })
}
