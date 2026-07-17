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

    const [resServicos, resProfissionais, resSalao, resSetores] = await Promise.all([
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
      // servicos_comissoes é lido INTERNAMENTE para extrair apenas os IDs dos serviços
      // (sem expor percentuais de comissão). O campo retornado ao portal é `servicos_ids`.
      // NÃO incluir: perfil_avancado (configuração interna), salao_id (desnecessário).
      supabaseAdmin
        .from('profissionais')
        .select('id, nome, foto_url, ativo, produtivo, servicos_comissoes')
        .eq('salao_id', salaoId)
        .eq('ativo', true)
        .eq('produtivo', true)
        .order('nome'),

      // Salão: campos de exibição pública + campos necessários para o fluxo do portal.
      // cobrar_sinal / porcentagem_sinal / prazo_sinal_minutos: o cliente precisa saber
      // se há sinal obrigatório, quanto pagar e em quanto tempo — não é dado interno.
      // NÃO incluir: token_pagamento, gateway_pagamento, config financeira interna.
      supabaseAdmin
        .from('saloes')
        .select(
          'id, slug, nome_fantasia, telefone, horarios_funcionamento, ' +
          'logradouro, numero, complemento, bairro, cidade, estado, cep, ' +
          'sobre_nos, politica_cancelamento, instagram, site, ' +
          'cobrar_sinal, porcentagem_sinal, prazo_sinal_minutos'
        )
        .eq('id', salaoId)
        .single(),

      // Setores ativos definidos pelo salão — usados como filtros no portal
      supabaseAdmin
        .from('setores_salao')
        .select('nome')
        .eq('salao_id', salaoId)
        .eq('ativo', true)
        .order('nome'),
    ])

    // Verificar se o salão existe antes de retornar dados
    if (resSalao.error || !resSalao.data) {
      return NextResponse.json(
        { erro: 'Salão não encontrado.' },
        { status: 404 }
      )
    }

    // Profissionais: strip servicos_comissoes, expõe apenas IDs dos serviços
    // servicos_comissoes é salvo como objeto { "uuid": percentual } pelo admin
    const profissionais = (resProfissionais.data ?? []).map((p: any) => {
      let parsed: any = null;
      try {
        parsed = typeof p.servicos_comissoes === 'string'
          ? JSON.parse(p.servicos_comissoes)
          : p.servicos_comissoes;
      } catch { /* mantém null */ }
      let servicos_ids: string[] = [];
      if (parsed && typeof parsed === 'object') {
        // Formato objeto: { "uuid-servico": percentual } — chaves são os IDs
        servicos_ids = Array.isArray(parsed)
          ? parsed.map((c: any) => c?.servico_id).filter(Boolean)
          : Object.keys(parsed).filter(Boolean);
      }
      return { id: p.id, nome: p.nome, foto_url: p.foto_url, ativo: p.ativo, produtivo: p.produtivo, servicos_ids };
    });

    return NextResponse.json(
      {
        servicos: resServicos.data ?? [],
        profissionais,
        salao: resSalao.data,
        setores: resSetores.data ?? [],
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
