/**
 * GET /api/portal/confirmar-exclusao?token=<uuid>
 *
 * Etapa 2 de 2 do fluxo de exclusão de conta (LGPD Art. 18, VI).
 *
 * Chamado quando o titular clica no link do e-mail de confirmação enviado
 * pelo endpoint /api/portal/solicitar-exclusao.
 *
 * PROCESSO:
 *   1. Valida o token (existe, não expirou, status = 'pendente')
 *   2. Anonimiza os dados pessoais do titular em `clientes` (todos os salões)
 *   3. Exclui o registro em `usuarios_portal`
 *   4. Exclui o usuário do Supabase Auth (impede login futuro)
 *   5. Marca a solicitação como 'processada' em `lgpd_solicitacoes_exclusao`
 *
 * MOTIVO DE NÃO APAGAR REGISTROS FINANCEIROS:
 *   O registro da linha em `clientes` é mantido (só os campos identificadores
 *   são apagados) para não quebrar vínculos em `agendamentos`, `financeiro` e
 *   `comissoes`. A LGPD (Art. 16, I) permite reter dado necessário para
 *   cumprimento de obrigação legal/regulatória — escrituração contábil
 *   é uma dessas obrigações (Lei 9.606/99 e legislação fiscal).
 *
 * SEGURANÇA:
 *   - Token de confirmação é UUID v4 gerado no servidor (nunca do cliente)
 *   - Token expira em 24 horas
 *   - Token é de uso único: marcado como 'processada' após uso
 *   - Nenhum dado sensível é logado (sem CPF, telefone, e-mail nos logs)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const token = req.nextUrl.searchParams.get('token')
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  // ── 1. Validar formato do token ───────────────────────────────────────────
  if (!token || !UUID_RE.test(token)) {
    return NextResponse.redirect(
      new URL('/portal/exclusao?erro=token_invalido', req.url)
    )
  }

  // ── 2. Buscar solicitação pelo token ──────────────────────────────────────
  const { data: solicitacao, error: errBusca } = await supabaseAdmin
    .from('lgpd_solicitacoes_exclusao')
    .select('id, usuario_portal_id, usuario_email, status, token_expira_em')
    .eq('token_confirmacao', token)
    .eq('status', 'pendente')
    .maybeSingle()

  if (errBusca) {
    console.error('[/api/portal/confirmar-exclusao] Erro ao buscar solicitação:', errBusca.message)
    return NextResponse.redirect(
      new URL('/portal/exclusao?erro=erro_interno', req.url)
    )
  }

  if (!solicitacao) {
    // Token não encontrado ou já processado
    return NextResponse.redirect(
      new URL('/portal/exclusao?erro=token_invalido', req.url)
    )
  }

  // ── 3. Verificar expiração do token ───────────────────────────────────────
  if (new Date(solicitacao.token_expira_em) < new Date()) {
    return NextResponse.redirect(
      new URL('/portal/exclusao?erro=token_expirado', req.url)
    )
  }

  const usuarioId = solicitacao.usuario_portal_id

  // ── 4. Anonimizar dados pessoais do titular em todos os salões ────────────
  // O registro (linha) é mantido para não quebrar agendamentos e financeiro.
  // Apenas os campos identificadores e sensíveis são apagados.
  // ATENÇÃO: o campo de telefone no schema é "telefone_whatsapp", não "telefone".
  const { error: errClientes } = await supabaseAdmin
    .from('clientes')
    .update({
      nome_completo: 'Cliente Excluído',
      email: null,
      telefone_whatsapp: null,  // nome correto conforme schema-banco.md
      cpf: null,
      anamnese: null,
      usuario_portal_id: null,
    })
    .eq('usuario_portal_id', usuarioId)

  if (errClientes) {
    console.error(
      '[/api/portal/confirmar-exclusao] Erro ao anonimizar clientes para usuário [ID omitido]:',
      errClientes.message
    )
    return NextResponse.redirect(
      new URL('/portal/exclusao?erro=erro_interno', req.url)
    )
  }

  // ── 5. Remover registro em usuarios_portal ────────────────────────────────
  await supabaseAdmin
    .from('usuarios_portal')
    .delete()
    .eq('id', usuarioId)

  // ── 6. Excluir usuário do Supabase Auth (impede login futuro) ─────────────
  const { error: errAuth } = await supabaseAdmin.auth.admin.deleteUser(usuarioId)

  if (errAuth) {
    console.error(
      '[/api/portal/confirmar-exclusao] Erro ao excluir credenciais [ID omitido]:',
      errAuth.message
    )
    // Marcar como processada mesmo assim — dados já foram anonimizados
    // O usuário não consegue mais fazer nada útil com a conta
  }

  // ── 7. Marcar solicitação como processada (trilha de auditoria LGPD) ──────
  await supabaseAdmin
    .from('lgpd_solicitacoes_exclusao')
    .update({
      status: 'processada',
      processado_em: new Date().toISOString(),
      token_confirmacao: null, // invalidar token após uso
    })
    .eq('id', solicitacao.id)

  // Redirecionar para página de confirmação no portal
  return NextResponse.redirect(
    new URL('/portal/exclusao?ok=1', req.url)
  )
}
