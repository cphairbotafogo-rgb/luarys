/**
 * POST /api/portal/inserir-agendamento
 *
 * Insere ou atualiza um agendamento pelo portal do cliente usando service role,
 * contornando o RLS (clientes do portal não têm sessão Supabase Auth).
 *
 * Segurança:
 *   - Rate limit por IP (mesmo padrão de agendar-guest)
 *   - salao_id, cliente_id, profissional_id e servico_id devem ser UUIDs válidos
 *   - O serviço deve estar com exibir_online = true para aquele salão
 *   - O profissional deve pertencer àquele salão e estar ativo
 *   - O cliente deve pertencer àquele salão
 *   - duracao_min vem do serviço no servidor, nunca do body (evita agendamento
 *     com duração arbitrária)
 *   - status restrito a um conjunto fixo (evita pular etapas do fluxo, ex.
 *     criar já como "Finalizado")
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimitExcedido, obterIp } from '@/lib/rateLimiter';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_INICIAL_PERMITIDO = ['Agendado', 'Aguardando', 'Confirmado'] as const;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// POST — cria agendamento
export async function POST(req: NextRequest) {
  // Mesmo limite usado em agendar-guest: 10 tentativas por IP a cada 10 min
  const ip = obterIp(req as any);
  if (await rateLimitExcedido(`inserir-agendamento:${ip}`, 10, 600)) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { salao_id, cliente_id, profissional_id, servico_id, data, inicio,
      status, cliente_nome, observacao, valor_sinal } = body;

    for (const [campo, val] of Object.entries({ salao_id, cliente_id, profissional_id, servico_id })) {
      if (!UUID_RE.test(String(val))) {
        return NextResponse.json({ erro: `${campo} inválido.` }, { status: 400 });
      }
    }

    if (status != null && !STATUS_INICIAL_PERMITIDO.includes(status)) {
      return NextResponse.json({ erro: 'Status inicial não permitido.' }, { status: 400 });
    }

    // Garante que o serviço pertence ao salão e está visível online;
    // duração vem daqui, nunca do body.
    const { data: serv } = await admin
      .from('servicos')
      .select('id, duracao_minutos')
      .eq('id', servico_id)
      .eq('salao_id', salao_id)
      .eq('exibir_online', true)
      .maybeSingle();

    if (!serv) return NextResponse.json({ erro: 'Serviço não disponível.' }, { status: 403 });

    // Garante que o profissional pertence a este salão e está ativo
    const { data: prof } = await admin
      .from('profissionais')
      .select('id')
      .eq('id', profissional_id)
      .eq('salao_id', salao_id)
      .eq('ativo', true)
      .maybeSingle();

    if (!prof) return NextResponse.json({ erro: 'Profissional não disponível.' }, { status: 403 });

    // Garante que o cliente pertence a este salão
    const { data: cli } = await admin
      .from('clientes')
      .select('id')
      .eq('id', cliente_id)
      .eq('salao_id', salao_id)
      .maybeSingle();

    if (!cli) return NextResponse.json({ erro: 'Cliente não encontrado.' }, { status: 403 });

    const { data: ag, error } = await admin
      .from('agendamentos')
      .insert({
        salao_id, cliente_id, profissional_id, servico_id,
        data, inicio, duracao_min: serv.duracao_minutos || 30,
        status: status || 'Agendado',
        cliente_nome, observacao,
        ...(valor_sinal != null && { valor_sinal }),
      })
      .select('id')
      .single();

    if (error || !ag) {
      if (error?.code === '23505') {
        return NextResponse.json({ erro: 'Horário reservado por outro cliente. Escolha outro.' }, { status: 409 });
      }
      console.error('[inserir-agendamento] Erro:', error);
      return NextResponse.json({ erro: 'Não foi possível criar o agendamento.' }, { status: 500 });
    }

    return NextResponse.json({ id: ag.id });
  } catch (e: any) {
    console.error('[inserir-agendamento] Erro interno:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

// PATCH — atualiza status de agendamento do portal
// A3: só permite transições seguras e verifica estado atual para evitar
// que qualquer pessoa com um par (id, salao_id) cancele agendamentos alheios.
const STATUS_PERMITIDOS = ['Cancelado', 'Confirmado'] as const;
const STATUS_ORIGEM_VALIDA = ['Aguardando'] as const;

export async function PATCH(req: NextRequest) {
  const ip = obterIp(req as any);
  if (await rateLimitExcedido(`inserir-agendamento-patch:${ip}`, 10, 600)) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
  }

  try {
    const { id, salao_id, status } = await req.json();

    if (!UUID_RE.test(String(id)) || !UUID_RE.test(String(salao_id))) {
      return NextResponse.json({ erro: 'Parâmetros inválidos.' }, { status: 400 });
    }

    if (!STATUS_PERMITIDOS.includes(status)) {
      return NextResponse.json({ erro: 'Status não permitido.' }, { status: 400 });
    }

    // Verifica estado atual — só transiciona a partir de 'Aguardando'
    const { data: ag } = await admin
      .from('agendamentos')
      .select('status')
      .eq('id', id)
      .eq('salao_id', salao_id)
      .maybeSingle();

    if (!ag) {
      return NextResponse.json({ erro: 'Agendamento não encontrado.' }, { status: 404 });
    }

    if (!STATUS_ORIGEM_VALIDA.includes(ag.status as any)) {
      return NextResponse.json({ erro: 'Agendamento não pode ser alterado neste estado.' }, { status: 409 });
    }

    const { error } = await admin
      .from('agendamentos')
      .update({ status })
      .eq('id', id)
      .eq('salao_id', salao_id);

    if (error) {
      console.error('[inserir-agendamento PATCH] Erro:', error);
      return NextResponse.json({ erro: 'Não foi possível atualizar.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[inserir-agendamento PATCH] Erro interno:', e);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}
