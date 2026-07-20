/**
 * POST /api/portal/solicitar-exclusao
 *
 * Exclusão imediata de conta (LGPD Art. 18, VI).
 *
 * PROCESSO (único passo — sem e-mail intermediário):
 *   1. Valida o Bearer JWT do titular autenticado
 *   2. Registra trilha de auditoria em `lgpd_solicitacoes_exclusao` (status = 'processada')
 *   3. Anonimiza dados pessoais do titular em `clientes` (todos os salões)
 *   4. Remove registro em `usuarios_portal`
 *   5. Remove usuário do Supabase Auth (impede login futuro)
 *
 * MOTIVO DE NÃO APAGAR REGISTROS FINANCEIROS:
 *   O registro da linha em `clientes` é mantido para não quebrar vínculos em
 *   `agendamentos`, `financeiro` e `comissoes`. LGPD (Art. 16, I) permite reter
 *   dado necessário para cumprimento de obrigação legal/regulatória.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
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

  const usuarioId = user.id
  const agora = new Date().toISOString()

  // ── 2. Registrar trilha de auditoria LGPD ────────────────────────────────
  await supabaseAdmin
    .from('lgpd_solicitacoes_exclusao')
    .upsert({
      usuario_portal_id: usuarioId,
      usuario_email: user.email ?? null,
      status: 'processada',
      token_confirmacao: null,
      token_expira_em: null,
      solicitado_em: agora,
      processado_em: agora,
    }, { onConflict: 'usuario_portal_id' })

  // ── 3. Anonimizar dados pessoais do titular em todos os salões ────────────
  const { error: errClientes } = await supabaseAdmin
    .from('clientes')
    .update({
      nome_completo: 'Cliente Excluído',
      email: null,
      telefone_whatsapp: null,
      cpf: null,
      anamnese: null,
      usuario_portal_id: null,
    })
    .eq('usuario_portal_id', usuarioId)

  if (errClientes) {
    console.error('[/api/portal/solicitar-exclusao] Erro ao anonimizar clientes:', errClientes.message)
    return NextResponse.json({ erro: 'Erro interno ao processar exclusão.' }, { status: 500 })
  }

  // ── 4. Remover registro em usuarios_portal ────────────────────────────────
  await supabaseAdmin
    .from('usuarios_portal')
    .delete()
    .eq('id', usuarioId)

  // ── 5. Excluir usuário do Supabase Auth ───────────────────────────────────
  const { error: errAuth } = await supabaseAdmin.auth.admin.deleteUser(usuarioId)
  if (errAuth) {
    console.error('[/api/portal/solicitar-exclusao] Erro ao excluir credenciais:', errAuth.message)
    // Dados já anonimizados — retornar sucesso mesmo assim
  }

  return NextResponse.json({ ok: true })
}
