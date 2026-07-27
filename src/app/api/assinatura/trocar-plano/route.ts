/**
 * src/app/api/assinatura/trocar-plano/route.ts
 *
 * Troca o PLANO BASE de um salão que já tem assinatura recorrente ativa no
 * Asaas (upgrade ou downgrade) — atualiza o valor da MESMA subscription
 * (PUT /v3/subscriptions/{id}) em vez de criar uma cobrança nova, então o
 * salão não precisa recadastrar o cartão. Efeito imediato no limite de
 * profissionais; a cobrança no novo valor vale a partir do próximo ciclo.
 *
 * Se o salão NÃO tem assinatura ativa ainda (trial, ou plano cancelado),
 * esta rota não serve — o frontend deve usar /api/assinatura/criar-checkout
 * normalmente nesse caso (ver AbaMeuPlano.tsx).
 */
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { autenticarRota } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { salao_id, novo_plano_chave, periodo: periodoRaw } = await request.json();
    const periodo: 'mensal' | 'anual' = periodoRaw === 'anual' ? 'anual' : 'mensal';

    if (!salao_id || !novo_plano_chave) {
      return NextResponse.json({ erro: 'Dados incompletos.' }, { status: 400 });
    }

    const { user, perfil, erro } = await autenticarRota(request, 'POST /api/assinatura/trocar-plano');
    if (erro) return erro;

    const { data: funcionario, error: erroFuncionario } = await supabaseAdmin
      .from('profissionais')
      .select('salao_id')
      .eq('id', user!.id)
      .maybeSingle();
    if (erroFuncionario) console.error('[trocar-plano] Erro ao buscar profissionais:', erroFuncionario.message);

    const salaoDoChamador = perfil?.salao_id || funcionario?.salao_id;
    if (!salaoDoChamador || salaoDoChamador !== salao_id) {
      return NextResponse.json({ erro: 'Você não tem permissão para alterar o plano deste salão.' }, { status: 403 });
    }

    const { data: novoPlano, error: erroNovoPlano } = await supabaseAdmin
      .from('planos')
      .select('chave, nome, preco_mensal, preco_anual, limite_profissionais, ativo')
      .eq('chave', novo_plano_chave)
      .maybeSingle();
    if (erroNovoPlano) console.error('[trocar-plano] Erro ao buscar novo plano:', erroNovoPlano.message);

    if (!novoPlano?.ativo || novoPlano.preco_mensal == null) {
      return NextResponse.json({ erro: 'Plano não encontrado ou indisponível para contratação direta.' }, { status: 404 });
    }

    const novoPreco = periodo === 'anual' ? novoPlano.preco_anual : novoPlano.preco_mensal;
    if (novoPreco == null) {
      return NextResponse.json({ erro: `Este plano não tem preço configurado para o período ${periodo}.` }, { status: 400 });
    }

    const { data: salao, error: erroSalao } = await supabaseAdmin
      .from('saloes')
      .select('plano_chave, plano_periodo, asaas_subscription_id')
      .eq('id', salao_id)
      .maybeSingle();
    if (erroSalao || !salao) {
      return NextResponse.json({ erro: 'Salão não encontrado.' }, { status: 404 });
    }

    if (!salao.asaas_subscription_id) {
      return NextResponse.json({ erro: 'Este salão ainda não tem uma assinatura recorrente ativa — use o checkout normal.', semAssinaturaAtiva: true }, { status: 409 });
    }

    if (salao.plano_chave === novo_plano_chave && salao.plano_periodo === periodo) {
      return NextResponse.json({ erro: 'Você já está neste plano.' }, { status: 400 });
    }

    // Downgrade: nunca deixar o salão com mais profissionais ativos do que o
    // novo plano permite — nunca confiar só na checagem já feita no frontend.
    if (novoPlano.limite_profissionais != null) {
      const { count: vagasUsadas } = await supabaseAdmin
        .from('profissionais')
        .select('id', { count: 'exact', head: true })
        .eq('salao_id', salao_id)
        .eq('ativo', true)
        .eq('produtivo', true);

      if ((vagasUsadas || 0) > novoPlano.limite_profissionais) {
        return NextResponse.json({
          erro: `Este plano permite até ${novoPlano.limite_profissionais} profissionais, mas o salão tem ${vagasUsadas} ativos. Inative profissionais na aba Equipe antes de trocar.`,
        }, { status: 409 });
      }
    }

    const { data: contaAtiva } = await supabaseAdmin
      .from('plataforma_contas_recebimento')
      .select('asaas_api_key, asaas_environment')
      .eq('ativa', true)
      .maybeSingle();

    const asaasKey = (contaAtiva as any)?.asaas_api_key || process.env.ASAAS_API_KEY;
    if (!asaasKey) {
      return NextResponse.json({ erro: 'ASAAS_API_KEY não configurado.' }, { status: 500 });
    }
    const asaasEnv = (contaAtiva as any)?.asaas_environment || process.env.ASAAS_ENVIRONMENT || 'production';
    const asaasBase = asaasEnv === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';

    const putResp = await fetch(`${asaasBase}/subscriptions/${salao.asaas_subscription_id}`, {
      method: 'PUT',
      headers: { 'access_token': asaasKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: Number(novoPreco),
        cycle: periodo === 'anual' ? 'YEARLY' : 'MONTHLY',
        description: `Luarys — ${novoPlano.nome} — ${periodo === 'anual' ? 'Anual' : 'Mensal'}`,
      }),
    });
    const putData = await putResp.json();
    if (!putResp.ok) {
      return NextResponse.json({ erro: 'Falha ao atualizar a assinatura no Asaas: ' + (putData.errors?.[0]?.description || JSON.stringify(putData)) }, { status: 400 });
    }

    const { error: erroUpdate } = await supabaseAdmin.from('saloes').update({
      plano_chave: novo_plano_chave,
      plano_periodo: periodo,
      valor_mensalidade: Number(novoPreco),
      limite_profissionais: novoPlano.limite_profissionais,
      cancelamento_agendado: false,
      preco_legado: null, // troca de plano encerra qualquer preço legado congelado
    }).eq('id', salao_id);

    if (erroUpdate) {
      console.error('[trocar-plano] Assinatura atualizada no Asaas mas falhou ao salvar no banco:', erroUpdate.message);
      return NextResponse.json({ erro: 'Plano trocado no Asaas, mas houve um erro ao salvar no sistema. Contate o suporte.' }, { status: 500 });
    }

    return NextResponse.json({ sucesso: true, plano_chave: novo_plano_chave, novo_preco: novoPreco });

  } catch (err: any) {
    console.error('[trocar-plano] Erro interno:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}
