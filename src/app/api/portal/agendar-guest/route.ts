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
import { rateLimitExcedido, obterIp } from '@/lib/rateLimiter';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  // A4: 10 tentativas por IP a cada 10 minutos
  const ip = obterIp(req as any);
  if (await rateLimitExcedido(`agendar-guest:${ip}`, 10, 600)) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }

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

    // O profissional precisa ser DESTE salão e estar ativo. Sem esta checagem
    // dava para agendar com profissional inativo, de outro salão, ou com um UUID
    // qualquer — a rota usa service_role e não passa por RLS.
    // (mesma validação que /api/portal/inserir-agendamento já fazia)
    const { data: prof } = await admin
      .from('profissionais')
      .select('id')
      .eq('id', profissional_id)
      .eq('salao_id', salao_id)
      .eq('ativo', true)
      .maybeSingle();

    if (!prof) return NextResponse.json({ erro: 'Profissional não disponível.' }, { status: 403 });

    // Verifica conflito de horário: bloqueio ou outro cliente já agendado neste slot
    const { data: conflito } = await admin
      .from('agendamentos')
      .select('id')
      .eq('salao_id', salao_id)
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

    // Localiza ou cria cliente.
    // NUNCA interpolar input do usuário numa string de filtro PostgREST (.or()):
    // `cliente_email` vinha cru do body e podia injetar condições extras, casando
    // clientes arbitrários do salão (rota pública + service_role, sem RLS).
    // Aqui as buscas são separadas e com .eq(), que envia o valor como parâmetro.
    let clienteId: string;
    const telefoneLimpo = (cliente_telefone || '').replace(/\D/g, '');
    const emailLimpo = (cliente_email || '').trim().toLowerCase();

    let clienteExistente: { id: string } | null = null;
    if (telefoneLimpo) {
      const { data } = await admin
        .from('clientes').select('id')
        .eq('salao_id', salao_id).eq('telefone', telefoneLimpo)
        .maybeSingle();
      clienteExistente = data ?? null;
    }
    if (!clienteExistente && emailLimpo) {
      const { data } = await admin
        .from('clientes').select('id')
        .eq('salao_id', salao_id).eq('email', emailLimpo)
        .maybeSingle();
      clienteExistente = data ?? null;
    }

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const { data: novo, error: erroCliente } = await admin
        .from('clientes')
        .insert({
          salao_id,
          nome_completo: cliente_nome.trim(),
          telefone: telefoneLimpo || null,
          // Grava normalizado (minúsculas), igual à busca acima — senão o mesmo
          // e-mail digitado com outra caixa cria um cliente duplicado na próxima vez.
          email: emailLimpo || null,
        })
        .select('id')
        .single();

      if (erroCliente || !novo) {
        console.error('[agendar-guest] Erro ao criar cliente:', erroCliente);
        return NextResponse.json({ erro: 'Não foi possível registrar o cliente.' }, { status: 500 });
      }
      clienteId = novo.id;
    }

    // Cria o agendamento.
    // ATENÇÃO ao conjunto de colunas: este insert usava três nomes que NÃO existem
    // em `agendamentos` — `duracao_minutos` (a coluna é `duracao_min`; `duracao_minutos`
    // é de `servicos`), `servico` (só existe `servico_id`) e `origem` (essa é de
    // `salao_modulos`). Qualquer uma delas derruba o INSERT inteiro com 42703, então
    // o agendamento de convidado nunca chegava a ser gravado — caía direto no 500
    // abaixo. Colunas conferidas contra /api/portal/inserir-agendamento e
    // useAbaAgenda.ts, que gravam agendamentos com sucesso hoje.
    const { data: ag, error: erroAg } = await admin
      .from('agendamentos')
      .insert({
        salao_id,
        cliente_id: clienteId,
        profissional_id,
        servico_id,
        data,
        inicio,
        duracao_min: servico.duracao_minutos || 30,
        status: 'Agendado',
        valor_final: Number(servico.preco_padrao) || 0,
        cliente_nome: cliente_nome.trim(),
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
    // await + erro checado: com `.then(() => {})` a rota serverless podia encerrar
    // antes da gravação, e o salão nunca era avisado do agendamento novo.
    const { error: erroNotif } = await admin.from('notificacoes').insert({
      salao_id,
      destinatario_tipo: 'salao',
      destinatario_id: salao_id,
      tipo: 'novo_agendamento',
      titulo: 'Novo agendamento pelo portal',
      mensagem: `${cliente_nome.trim()} agendou ${servico.nome_servico} para ${dataLabel} às ${inicio}.`,
      agendamento_id: ag.id,
    });
    if (erroNotif) console.error('[agendar-guest] Falha ao notificar o salão:', erroNotif.message);

    return NextResponse.json({ agendamentoId: ag.id, status: 'Agendado' });
  } catch (err: any) {
    console.error('[agendar-guest] Erro interno:', err);
    return NextResponse.json({ erro: 'Erro interno do servidor.' }, { status: 500 });
  }
}
