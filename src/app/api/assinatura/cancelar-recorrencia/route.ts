/**
 * src/app/api/assinatura/cancelar-recorrencia/route.ts
 *
 * Cancela a cobrança recorrente automática (subscription) no Asaas de um
 * módulo ou do plano base de um salão. Necessário porque, diferente de uma
 * cobrança avulsa, uma subscription continua gerando e cobrando faturas
 * sozinha até ser cancelada explicitamente na API do Asaas — só desativar
 * localmente (salao_modulos.ativo=false) não impede a próxima cobrança.
 *
 * O acesso ao módulo/plano continua até o fim do período já pago (mesma
 * regra de sempre); esta rota só impede a PRÓXIMA cobrança automática.
 */
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { autenticarRota } from '@/lib/apiAuth';
import { ehPlanoBase } from '@/lib/assinaturas';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { salao_id, modulo_chave } = await request.json();

    if (!salao_id || !modulo_chave) {
      return NextResponse.json({ erro: 'Dados incompletos.' }, { status: 400 });
    }

    // Mesma checagem de posse usada em criar-checkout — nunca confiar em
    // salao_id vindo do body sem confirmar que é de quem está autenticado.
    const { user, perfil, erro } = await autenticarRota(request, 'POST /api/assinatura/cancelar-recorrencia');
    if (erro) return erro;

    const { data: funcionario, error: erroFuncionario } = await supabaseAdmin
      .from('profissionais')
      .select('salao_id')
      .eq('id', user!.id)
      .maybeSingle();
    if (erroFuncionario) console.error('[cancelar-recorrencia] Erro ao buscar profissionais:', erroFuncionario.message);

    const salaoDoChamador = perfil?.salao_id || funcionario?.salao_id;
    if (!salaoDoChamador || salaoDoChamador !== salao_id) {
      return NextResponse.json({ erro: 'Você não tem permissão para alterar a assinatura deste salão.' }, { status: 403 });
    }

    const ehPlano = await ehPlanoBase(modulo_chave);
    const tabela = ehPlano ? 'saloes' : 'salao_modulos';
    const filtroId = ehPlano ? { id: salao_id } : { salao_id, modulo_chave };

    const { data: registro } = await supabaseAdmin
      .from(tabela)
      .select('asaas_subscription_id')
      .match(filtroId)
      .maybeSingle();

    const subscriptionId = registro?.asaas_subscription_id;

    if (!subscriptionId) {
      // Nada a cancelar no Asaas (cobrança avulsa de outro gateway, ou já cancelado antes)
      return NextResponse.json({ sucesso: true, cancelado: false });
    }

    // Busca pela conta Asaas especificamente (gateway='asaas'), não pela conta
    // "ativa" — a assinatura foi criada com a chave da conta Asaas de então, e
    // precisa continuar cancelável mesmo que a plataforma tenha trocado o
    // gateway ativo pra outro depois. Prioriza a ativa se houver mais de uma
    // conta Asaas cadastrada (troca de CNPJ).
    const { data: contasAsaas } = await supabaseAdmin
      .from('plataforma_contas_recebimento')
      .select('asaas_api_key, asaas_environment, ativa')
      .eq('gateway', 'asaas')
      .order('ativa', { ascending: false })
      .limit(1);
    const contaAtiva = contasAsaas?.[0] as any;

    const asaasKey = contaAtiva?.asaas_api_key || process.env.ASAAS_API_KEY;
    if (!asaasKey) {
      return NextResponse.json({ erro: 'ASAAS_API_KEY não configurado — não foi possível cancelar a recorrência no Asaas.' }, { status: 500 });
    }
    const asaasEnv = contaAtiva?.asaas_environment || process.env.ASAAS_ENVIRONMENT || 'production';
    const asaasBase = asaasEnv === 'sandbox'
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3';

    const cancelResp = await fetch(`${asaasBase}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: { 'access_token': asaasKey },
    });

    // 404 = já não existe mais no Asaas (cancelada por outro caminho) — trata
    // como sucesso, o objetivo (não cobrar de novo) já está garantido.
    if (!cancelResp.ok && cancelResp.status !== 404) {
      const cancelData = await cancelResp.json().catch(() => ({}));
      return NextResponse.json({ erro: 'Falha ao cancelar a assinatura no Asaas: ' + (cancelData.errors?.[0]?.description || JSON.stringify(cancelData)) }, { status: 400 });
    }

    await supabaseAdmin.from(tabela).update({ asaas_subscription_id: null }).match(filtroId);

    return NextResponse.json({ sucesso: true, cancelado: true });

  } catch (err: any) {
    console.error('Erro ao cancelar recorrência Asaas:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}
