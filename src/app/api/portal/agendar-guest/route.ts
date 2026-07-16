/**
 * POST /api/portal/agendar-guest
 *
 * Cria um agendamento via portal sem exigir login do cliente.
 * O cliente informa nome, telefone e e-mail; o sistema localiza ou
 * cria o registro em `clientes` e insere o agendamento.
 *
 * Segurança:
 *  - UUID obrigatório para salao_id, servico_id, profissional_id
 *  - O serviço deve ter exibir_online = true
 *  - Usa supabaseAdmin (service role) com filtros explícitos por salao_id
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const body = await req.json();
    const { salao_id, servico_id, profissional_id, data, inicio, cliente_nome, cliente_telefone, cliente_email } = body;

    // Validação básica
    for (const [k, v] of Object.entries({ salao_id, servico_id, profissional_id })) {
      if (!v || !UUID_RE.test(String(v))) {
        return NextResponse.json({ erro: `${k} inválido.` }, { status: 400 });
      }
    }
    if (!data || !inicio || !cliente_nome?.trim()) {
      return NextResponse.json({ erro: 'Campos obrigatórios ausentes.' }, { status: 400 });
    }

    // Verifica serviço
    const { data: servico } = await admin
      .from('servicos')
      .select('id, nome_servico, preco_padrao, duracao_minutos')
      .eq('id', servico_id)
      .eq('salao_id', salao_id)
      .eq('exibir_online', true)
      .maybeSingle();

    if (!servico) return NextResponse.json({ erro: 'Serviço não disponível.' }, { status: 404 });

    // Verifica conflito de horário: bloqueio ou outro cliente já agendado neste slot
    const { data: conflito } = await admin
      .from('agendamentos')
      .select('id')
      .eq('profissional_id', profissional_id)
      .eq('data', data)
      .eq('inicio', inicio)
      .not('status', 'in', '("Cancelado","Faltou")')
      .maybeSingle();

    if (conflito) {
      return NextResponse.json(
        { erro: 'Este horário não está mais disponível. Escolha outro horário.' },
        { status: 409 },
      );
    }

    // Localiza ou cria cliente
    let clienteId: string;
    const telefoneLimpo = (cliente_telefone || '').replace(/\D/g, '');
    const { data: clienteExistente } = await admin
      .from('clientes')
      .select('id')
      .eq('salao_id', salao_id)
      .or(`telefone.eq.${telefoneLimpo},email.eq.${cliente_email || '_nenhum_'}`)
      .maybeSingle();

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const { data: novo, error: erroCliente } = await admin
        .from('clientes')
        .insert({
          salao_id,
          nome_completo: cliente_nome.trim(),
          telefone: telefoneLimpo || null,
          email: cliente_email?.trim() || null,
        })
        .select('id')
        .single();

      if (erroCliente || !novo) {
        console.error('[agendar-guest] Erro ao criar cliente:', erroCliente);
        return NextResponse.json({ erro: 'Não foi possível registrar o cliente.' }, { status: 500 });
      }
      clienteId = novo.id;
    }

    // Cria o agendamento
    const { data: ag, error: erroAg } = await admin
      .from('agendamentos')
      .insert({
        salao_id,
        cliente_id: clienteId,
        profissional_id,
        servico_id,
        data,
        inicio,
        duracao_minutos: servico.duracao_minutos,
        status: 'Agendado',
        valor_final: Number(servico.preco_padrao) || 0,
        origem: 'portal',
        cliente_nome: cliente_nome.trim(),
        servico: servico.nome_servico,
      })
      .select('id')
      .single();

    if (erroAg || !ag) {
      if (erroAg?.code === '23505') {
        return NextResponse.json(
          { erro: 'Este horário foi reservado agora por outro cliente. Escolha outro horário.' },
          { status: 409 },
        );
      }
      console.error('[agendar-guest] Erro ao criar agendamento:', erroAg);
      return NextResponse.json({ erro: 'Não foi possível criar o agendamento.' }, { status: 500 });
    }

    // Notifica o salão
    const dataLabel = new Date(data + 'T12:00:00')
      .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    await admin.from('notificacoes').insert({
      salao_id,
      destinatario_tipo: 'salao',
      destinatario_id: salao_id,
      tipo: 'novo_agendamento',
      titulo: 'Novo agendamento pelo portal',
      mensagem: `${cliente_nome.trim()} agendou ${servico.nome_servico} para ${dataLabel} às ${inicio}.`,
      agendamento_id: ag.id,
    }).then(() => {});

    return NextResponse.json({ agendamentoId: ag.id, status: 'Agendado' });
  } catch (err: any) {
    console.error('[agendar-guest] Erro interno:', err);
    return NextResponse.json({ erro: 'Erro interno do servidor.' }, { status: 500 });
  }
}
