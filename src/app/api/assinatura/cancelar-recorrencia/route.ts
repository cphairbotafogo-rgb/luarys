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
import { cancelarAssinaturaAsaas } from '@/lib/assinaturas';

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

    const resultado = await cancelarAssinaturaAsaas(salao_id, modulo_chave);
    if (resultado.erro) return NextResponse.json({ erro: resultado.erro }, { status: 400 });

    return NextResponse.json({ sucesso: true, cancelado: resultado.cancelado });

  } catch (err: any) {
    console.error('Erro ao cancelar recorrência Asaas:', err);
    return NextResponse.json({ erro: 'Erro interno no servidor.' }, { status: 500 });
  }
}
