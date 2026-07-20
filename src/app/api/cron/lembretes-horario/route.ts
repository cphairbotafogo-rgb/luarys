import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente admin — ignora RLS, acessa todos os salões.
// Este endpoint só é chamado pelo Vercel Cron (ou por nós em teste).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Converte qualquer formato BR para E.164 sem o "+": 5511999999999
function normalizarTelefone(tel: string): string {
  let n = tel.replace(/\D/g, '');
  if (n.length <= 11) n = '55' + n;
  return n;
}

// ---------------------------------------------------------------
// Meta Cloud API — envia mensagem de texto simples.
//
// PRÉ-REQUISITOS para funcionar:
//   WHATSAPP_API_TOKEN    → token do System User (Meta for Developers)
//   WHATSAPP_PHONE_NUMBER_ID → Phone Number ID do painel da Meta
//                             (fica em WhatsApp > Getting Started)
//
// ATENÇÃO (produção):
//   Mensagens iniciadas pelo negócio fora da janela de 24 h
//   exigem templates aprovados pela Meta.
//   Para testes: adicione seu número como "test contact" no painel da Meta
//   e mensagens de texto livre funcionam sem aprovação de template.
//   Quando os templates forem aprovados, trocar type:'text' por type:'template'
//   e mapear os placeholders para os parâmetros do template.
// ---------------------------------------------------------------
async function enviarViaWhatsApp(
  telefone: string,
  mensagem: string
): Promise<boolean> {
  const apiToken     = process.env.WHATSAPP_API_TOKEN;
  const phoneNumId   = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!apiToken || !phoneNumId) return false;

  const resp = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to:                normalizarTelefone(telefone),
        type:              'text',
        text: {
          preview_url: false,
          body:        mensagem,
        },
      }),
    }
  );

  if (!resp.ok) {
    const detalhe = await resp.text().catch(() => '');
    console.error('[cron/lembretes] Meta API erro:', resp.status, detalhe);
  }

  return resp.ok;
}

// ---------------------------------------------------------------
// Substitui as variáveis do template pelo dados reais do agendamento.
// A linha que contém {profissional} é suprimida quando não houver prof.
// ---------------------------------------------------------------
function montarMensagem(
  template: string,
  dados: {
    cliente_nome: string;
    data_hora_inicio: string;
    nome_servico: string;
    nome_profissional: string;
    salao_nome: string;
  }
): string {
  const primeiroNome = (dados.cliente_nome || '').split(' ')[0] || 'cliente';
  const dt = new Date(dados.data_hora_inicio);

  const data = dt.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });

  const horario = dt.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });

  let msg = template
    .replace(/\{nome_do_cliente\}/g, primeiroNome)
    .replace(/\{data\}/g,            data)
    .replace(/\{horario\}/g,         horario)
    .replace(/\{servico\}/g,         dados.nome_servico || '')
    .replace(/\{nome_salao\}/g,      dados.salao_nome   || '');

  if (dados.nome_profissional) {
    msg = msg.replace(/\{profissional\}/g, dados.nome_profissional);
  } else {
    // Remove a linha inteira que contém o placeholder vazio
    msg = msg.split('\n').filter(l => !l.includes('{profissional}')).join('\n');
  }

  return msg.trim();
}

// ---------------------------------------------------------------
// GET  — chamado pelo Vercel Cron a cada hora (0 * * * *)
// ---------------------------------------------------------------
export async function GET(request: NextRequest) {
  // Vercel injeta "Authorization: Bearer <CRON_SECRET>" automaticamente.
  // Em testes manuais, passe o mesmo header.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token !== cronSecret) {
      return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
    }
  }

  // Janela de ±35 min → cobre qualquer agendamento entre as execuções horárias
  const { data: agendamentos, error } = await supabaseAdmin.rpc(
    'buscar_agendamentos_para_lembrete',
    { p_janela_min: 35 }
  );

  if (error) {
    console.error('[cron/lembretes] Erro ao buscar agendamentos:', error.message);
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  if (!agendamentos || agendamentos.length === 0) {
    return NextResponse.json({ processados: 0, mensagem: 'Nenhum lembrete a enviar neste ciclo.' });
  }

  let enviados = 0;
  let pendentesApiIndisponivel = 0;
  let erros = 0;

  for (const ag of agendamentos) {
    if (!ag.msg_template) {
      erros++;
      continue;
    }

    const mensagem = montarMensagem(ag.msg_template, ag);
    const enviou = await enviarViaWhatsApp(ag.telefone, mensagem);

    if (enviou) {
      const { error: errMarca } = await supabaseAdmin
        .from('agendamentos')
        .update({ lembrete_enviado_em: new Date().toISOString() })
        .eq('id', ag.ag_id);

      if (errMarca) {
        console.error('[cron/lembretes] Falha ao marcar lembrete_enviado_em:', ag.ag_id, errMarca.message);
        erros++;
      } else {
        enviados++;
      }
    } else {
      // API ainda não configurada — o próximo ciclo tentará novamente.
      // Não marca lembrete_enviado_em para não perder a chance de enviar.
      pendentesApiIndisponivel++;
      console.info(
        `[cron/lembretes] API não configurada. Agendamento ${ag.ag_id} — ${ag.cliente_nome} — ${ag.data_hora_inicio}`
      );
    }
  }

  console.log(
    `[cron/lembretes] ciclo concluído: encontrados=${agendamentos.length} enviados=${enviados} aguardandoApi=${pendentesApiIndisponivel} erros=${erros}`
  );

  return NextResponse.json({
    processados:             agendamentos.length,
    enviados,
    aguardandoApi:           pendentesApiIndisponivel,
    erros,
  });
}
