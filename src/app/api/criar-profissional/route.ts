/**
 * src/app/api/criar-profissional/route.ts
 *
 * Cria um novo profissional (login + ficha) OU reseta a senha de um
 * profissional já existente do MESMO salão do chamador.
 *
 * SEGURANÇA: esta rota usa SUPABASE_SERVICE_ROLE_KEY (ignora RLS), então
 * TODA chamada precisa:
 *  1. Vir com um token de sessão válido (Authorization: Bearer <token>);
 *  2. O chamador precisa ser o dono do salão OU ter `permissoes.editar_equipe`;
 *  3. O salao_id do profissional criado/editado precisa ser EXATAMENTE o
 *     salao_id do chamador (nunca o que vier do corpo da requisição).
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Confirma quem está chamando e a qual salão pertence, e se pode gerenciar a equipe
async function autenticarChamador(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) return { erro: 'Sessão ausente. Faça login novamente.', status: 401 } as const;

  const { data: { user }, error: erroUser } = await supabaseAdmin.auth.getUser(token);
  if (erroUser || !user) return { erro: 'Sessão inválida ou expirada. Faça login novamente.', status: 401 } as const;

  // 1. É o dono do salão?
  const { data: dono } = await supabaseAdmin
    .from('perfis_usuarios')
    .select('salao_id')
    .eq('id', user.id)
    .maybeSingle();

  if (dono?.salao_id) {
    return { salaoId: dono.salao_id, podeGerenciarEquipe: true } as const;
  }

  // 2. É um funcionário com permissão de gerenciar equipe?
  const { data: funcionario } = await supabaseAdmin
    .from('profissionais')
    .select('salao_id, permissoes')
    .eq('id', user.id)
    .maybeSingle();

  if (funcionario?.salao_id && funcionario.permissoes?.editar_equipe) {
    return { salaoId: funcionario.salao_id, podeGerenciarEquipe: true } as const;
  }

  return { erro: 'Você não tem permissão para gerenciar a equipe.', status: 403 } as const;
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, dadosProfissional, idExistente } = body

    const auth = await autenticarChamador(request);
    if ('erro' in auth) {
      return NextResponse.json({ error: auth.erro }, { status: auth.status })
    }

    // ─── RESET DE SENHA DE PROFISSIONAL JÁ EXISTENTE ───
    if (idExistente) {
      if (!password || password.length < 6) {
        return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres.' }, { status: 400 })
      }

      // O profissional alvo precisa pertencer ao MESMO salão do chamador
      const { data: alvo } = await supabaseAdmin
        .from('profissionais')
        .select('id, salao_id')
        .eq('id', idExistente)
        .maybeSingle();

      if (!alvo || alvo.salao_id !== auth.salaoId) {
        return NextResponse.json({ error: 'Profissional não encontrado neste salão.' }, { status: 404 })
      }

      const { error: erroSenha } = await supabaseAdmin.auth.admin.updateUserById(idExistente, { password })
      if (erroSenha) {
        return NextResponse.json({ error: `Erro ao resetar senha: ${erroSenha.message}` }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    // ─── CRIAÇÃO DE NOVO PROFISSIONAL ───
    if (!email || !password || !dadosProfissional) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    // O salao_id é SEMPRE o do chamador — nunca o que vier do corpo da requisição
    const dadosSeguro = { ...dadosProfissional, salao_id: auth.salaoId }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    })

    if (authError) {
      return NextResponse.json({ error: `Erro no Auth: ${authError.message}` }, { status: 400 })
    }

    const { data: profData, error: profError } = await supabaseAdmin
      .from('profissionais')
      .insert([
        {
          ...dadosSeguro,
          id: authUser.user.id
        }
      ])
      .select()

    if (profError) {
      // Deu erro ao salvar a ficha? Apaga o login para não sujar o banco
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: `Erro ao salvar a ficha: ${profError.message}` }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: profData })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}