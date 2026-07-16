/**
 * GET /api/portal/dados-agendamento?salao_id=<uuid>
 *
 * Retorna serviços, profissionais ativos e dados públicos do salão para o
 * motor de agendamento do Portal do Cliente.
 *
 * MOTIVO DE USAR service_role:
 *   `servicos` e `profissionais` têm RLS que só permite leitura pelo dono do
 *   salão (authenticated). Clientes do portal não têm essa policy.
 *   O supabaseAdmin contorna o RLS com segurança porque:
 *     1. Toda query filtra EXPLICITAMENTE por salao_id validado como UUID.
 *     2. Serviços e dados públicos do salão são informação de cardápio —
 *        sem necessidade de login para leitura, como um menu de restaurante.
 *     3. Colunas sensíveis (custo_operacional, comissao_padrao, porcentagem_sinal,
 *        perfil_avancado) são excluídas do SELECT antes de retornar.
 *
 * SEGURANÇA:
 *   - UUID obrigatório e validado antes de qualquer query
 *   - Profissionais: apenas ativos e produtivos são retornados
 *   - Serviços: apenas com exibir_online = true
 *   - salao_id NÃO é retornado nos objetos de resposta (desnecessário para o cliente)
 *   - cobrar_sinal / porcentagem_sinal / custo_operacional / comissao_padrao
 *     são colunas de estratégia financeira interna — NUNCA retornar ao portal
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Instanciar dentro do handler para garantir que as env vars já estejam
  // resolvidas (evita inicialização no nível de módulo com vars ausentes)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const salaoId = request.nextUrl.searchParams.get('salao_id')
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!salaoId || !UUID_RE.test(salaoId)) {
      return NextResponse.json(
        { erro: 'salao_id inválido.' },
        { status: 400 }
      )
    }

    const [resServicos, resProfissionais, resSalao] = await Promise.all([
      // Serviços: apenas os habilitados para exibição online.
      // NÃO incluir: custo_operacional, comissao_padrao (estratégia financeira interna),
      // salao_id (desnecessário no payload do portal).
      supabaseAdmin
        .from('servicos')
        .select(
          'id, nome_servico, descricao, preco_padrao, tipo_preco, duracao_minutos, categoria, setor, exibir_online'
        )
        .eq('salao_id', salaoId)
        .eq('exibir_online', true)
        .order('nome_servico'),

      // Profissionais: apenas ativos e produtivos.
      // NÃO incluir: perfil_avancado (configuração interna), salao_id (desnecessário),
      // servicos_comissoes (dado de remuneração interna do salão).
      supabaseAdmin
        .from('profissionais')
        .select('id, nome, foto_url, ativo, produtivo')
        .eq('salao_id', salaoId)
        .eq('ativo', true)
        .eq('produtivo', true)
        .order('nome'),

      // Salão: apenas campos de exibição pública.
      // NÃO incluir: cobrar_sinal, porcentagem_sinal (estratégia financeira interna).
      // telefone: mantido — é o contato público para o cliente que precisa falar com o salão.
      supabaseAdmin
        .from('saloes')
        .select(
          'id, slug, nome_fantasia, telefone, horarios_funcionamento, ' +
          'logradouro, numero, complemento, bairro, cidade, estado, cep, ' +
          'sobre_nos, politica_cancelamento, instagram, site'
        )
        .eq('id', salaoId)
        .single(),
    ])

    // Verificar se o salão existe antes de retornar dados
    if (resSalao.error || !resSalao.data) {
      return NextResponse.json(
        { erro: 'Salão não encontrado.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        servicos: resServicos.data ?? [],
        profissionais: resProfissionais.data ?? [],
        salao: resSalao.data,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          // Impede que o browser ou proxy cache uma resposta com dados de salão
          'Pragma': 'no-cache',
        },
      }
    )
  } catch (error: any) {
    console.error('[/api/portal/dados-agendamento] Erro interno:', error?.message ?? error)
    return NextResponse.json(
      { erro: 'Erro interno do servidor.' },
      { status: 500 }
    )
  }
}
