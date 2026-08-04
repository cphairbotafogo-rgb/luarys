/**
 * GET /api/cron/resumo-diario
 *
 * Enviado de madrugada pelo Vercel Cron: cada salão recebe por e-mail como foi o
 * fechamento de ontem e a agenda de hoje, com a agenda também em CSV anexo (o
 * contador/recepção abre sem precisar de login).
 *
 * Cron em vercel.json: "0 4 * * *" (UTC) = 01:00 no horário de Brasília.
 *
 * Escopo definido com o Ari (04/08/2026):
 *   - Sem telefone do cliente no corpo (ver src/lib/resumoDiario.ts).
 *   - Envia mesmo em dia sem movimento, para manter o hábito.
 *   - Sem bloco de caixa físico (o Luarys não tem sessão de caixa hoje).
 *
 * Fail-closed no CRON_SECRET, mesmo padrão de /api/cron/lembretes-horario:
 * sem o segredo, qualquer um na internet dispararia e-mail para todos os salões.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enviarEmail } from '@/lib/email';
import {
  dataBrasilia, calcularResumo, csvAgenda, montarHtmlResumo,
  type LinhaFinanceiro, type LinhaAgendamento,
} from '@/lib/resumoDiario';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/** dd/mm a partir de YYYY-MM-DD, sem depender do fuso do servidor. */
function rotuloData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/resumo-diario] CRON_SECRET não configurado — requisição bloqueada.');
    return NextResponse.json({ erro: 'Configuração ausente.' }, { status: 503 });
  }
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (token !== cronSecret) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const ontem = dataBrasilia(-1);
  const hoje  = dataBrasilia(0);

  // Só salões ativos e com e-mail cadastrado — sem destinatário não há o que enviar.
  const { data: saloes, error: erroSaloes } = await supabaseAdmin
    .from('saloes')
    .select('id, nome_fantasia, razao_social, email_contato')
    .not('email_contato', 'is', null);

  if (erroSaloes) {
    console.error('[cron/resumo-diario] Erro ao listar salões:', erroSaloes.message);
    return NextResponse.json({ erro: erroSaloes.message }, { status: 500 });
  }

  let enviados = 0;
  let falhas = 0;

  for (const salao of saloes ?? []) {
    try {
      // Entradas de ontem. O intervalo usa o dia inteiro em horário local —
      // data_movimentacao é gravada ao meio-dia local pelo fechamento, então
      // qualquer janela do dia pega o registro certo.
      const [resFin, resAgs] = await Promise.all([
        supabaseAdmin
          .from('financeiro')
          .select('valor, categoria, status, cliente_nome, pagamentos')
          .eq('salao_id', salao.id)
          .eq('tipo', 'entrada')
          .neq('status', 'Estornado')
          .gte('data_movimentacao', `${ontem}T00:00:00`)
          .lte('data_movimentacao', `${ontem}T23:59:59`),
        supabaseAdmin
          .from('agendamentos')
          .select('inicio, cliente_nome, status, servicos(nome_servico), profissionais(nome)')
          .eq('salao_id', salao.id)
          .eq('data', hoje)
          .not('status', 'in', '("Cancelado","Bloqueado")')
          .order('inicio', { ascending: true }),
      ]);

      if (resFin.error) console.error(`[cron/resumo-diario] financeiro salão ${salao.id}:`, resFin.error.message);
      if (resAgs.error) console.error(`[cron/resumo-diario] agendamentos salão ${salao.id}:`, resAgs.error.message);

      const linhasFin = (resFin.data ?? []) as unknown as LinhaFinanceiro[];
      const agendamentos = (resAgs.data ?? []) as unknown as LinhaAgendamento[];

      const resumo = calcularResumo(linhasFin);
      const nomeSalao = salao.nome_fantasia || salao.razao_social || 'Seu salão';

      const html = montarHtmlResumo({
        nomeSalao,
        dataOntemLabel: rotuloData(ontem),
        dataHojeLabel: rotuloData(hoje),
        resumo,
        agendamentos,
      });

      const csv = csvAgenda(agendamentos);
      const resultado = await enviarEmail({
        to: salao.email_contato!,
        subject: `Resumo de ${rotuloData(ontem)} e agenda de hoje — ${nomeSalao}`,
        html,
        anexos: [{
          filename: 'agendamentos.csv',
          content: Buffer.from(csv, 'utf-8').toString('base64'),
        }],
      });

      if (resultado.ok) enviados++;
      else {
        falhas++;
        console.error(`[cron/resumo-diario] Falha ao enviar para salão ${salao.id}:`, resultado.erro);
      }
    } catch (e: any) {
      // Um salão com problema não pode impedir o envio para os demais.
      falhas++;
      console.error(`[cron/resumo-diario] Erro inesperado no salão ${salao.id}:`, e?.message || e);
    }
  }

  return NextResponse.json({ ok: true, referencia: ontem, enviados, falhas });
}
