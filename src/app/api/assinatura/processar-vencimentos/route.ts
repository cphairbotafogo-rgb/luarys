/**
 * POST /api/assinatura/processar-vencimentos
 *
 * Rota de cron — deve ser chamada 1x ao dia (ex: 08h00).
 * Protegida por x-cron-secret.
 *
 * Fluxo de inadimplência:
 *  1. Lembrete antecipado (3 dias antes para mensal, 30 para anual)
 *  2. Primeiro aviso  em D+0  → "pagamento_atrasado"
 *  3. Segundo aviso   em D+7  → "segundo_aviso_atraso" (último aviso antes do bloqueio)
 *  4. Suspensão       em D+10 → "acesso_bloqueado" (74h após o segundo aviso)
 *
 * Configure nas variáveis de ambiente:
 *   CRON_SECRET          → segredo para autenticar a chamada do cron
 *   N8N_WEBHOOK_COBRANCA → webhook N8N que envia o e-mail/WhatsApp
 *   NEXT_PUBLIC_APP_URL  → URL pública do app (para link de renovação)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { excluirEmpresaLuarys } from '@/lib/nfse/brasilnfe';
import { notificarCobranca, RODAPE_COBRANCA } from '@/lib/notificacoes';
import type { NotificacaoCobranca } from '@/lib/notificacoes';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const HORAS_PARA_SEGUNDO_AVISO = 7 * 24;   // 168h = D+7
const HORAS_GRACA_SEGUNDO_AVISO = 74;       // 74h após o 2º aviso = D+10
// Dois lembretes antecipados, nao um. O objetivo nao e cobrar — e dar tempo de
// conferir se o cartao ainda vale ou se o Pix vai sair. Um aviso so, tres dias
// antes, chega quando ninguem esta pensando nisso.
const DIAS_LEMBRETE_MENSAL = [2, 1];
const DIAS_LEMBRETE_ANUAL  = [30, 2, 1];

/**
 * Quem recebe: donos e gerentes do salao, nunca a equipe.
 *
 * Cobranca e assunto de quem responde pelo pagamento. Manicure e recepcionista
 * receberem "seu modulo sera suspenso" e constrangimento sem utilidade — nao
 * podem resolver e nao deviam saber.
 *
 * Cai para saloes.email_contato so quando nenhum usuario de gestao tem e-mail,
 * senao o salao ficaria sem aviso nenhum.
 */
const NIVEIS_GESTAO = ['dono', 'admin', 'gerente'];

/**
 * Confirma no Asaas se a cobranca daquela assinatura ja foi paga.
 *
 * A regua trabalha sobre `renovacao_em` do nosso banco, que so avanca quando o
 * webhook chega. Webhook perdido, fora do ar ou atrasado faz o salao adimplente
 * receber cobranca — e, dez dias depois, perder o modulo tendo pago. Antes de
 * dizer "atrasado", pergunta a quem recebeu o dinheiro.
 *
 * Na duvida (sem assinatura registrada, sem chave, API fora), devolve `false` e
 * a regua segue: nao da para presumir pagamento que ninguem confirmou. Mas erro
 * de rede nunca vira acusacao de atraso silenciosa — fica no log.
 */
async function pagamentoConfirmadoNoAsaas(subscriptionId: string | null | undefined): Promise<boolean> {
  if (!subscriptionId) return false;

  const chave = process.env.ASAAS_API_KEY;
  if (!chave) return false;

  const base = (process.env.ASAAS_ENVIRONMENT || 'production') === 'sandbox'
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3';

  try {
    const resp = await fetch(`${base}/payments?subscription=${subscriptionId}&limit=5`, {
      headers: { access_token: chave },
    });
    if (!resp.ok) return false;
    const json = await resp.json().catch(() => ({}));
    const pagos = (json?.data ?? []).filter((p: any) =>
      ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(String(p?.status)));
    if (pagos.length === 0) return false;

    // Pagamento de ATE 40 dias atras cobre o ciclo mensal corrente. Mais antigo
    // que isso e do ciclo passado e nao prova nada sobre este.
    const maisRecente = pagos
      .map((p: any) => new Date(p.paymentDate || p.confirmedDate || p.dateCreated).getTime())
      .filter((t: number) => Number.isFinite(t))
      .sort((a: number, b: number) => b - a)[0];
    if (!maisRecente) return false;
    return (Date.now() - maisRecente) / 86_400_000 <= 40;
  } catch (e: any) {
    console.error('[vencimentos] falha ao conferir pagamento no Asaas:', e?.message || e);
    return false;
  }
}

/** Dispara a mesma notificacao para cada responsavel. */
async function avisarGestao(
  base: Omit<NotificacaoCobranca, 'evento' | 'email'>,
  evento: NotificacaoCobranca['evento'],
  emails: string[],
): Promise<void> {
  for (const email of emails) {
    await notificarCobranca({ ...base, email, evento, nota_rodape: RODAPE_COBRANCA });
  }
}

/**
 * Qual lembrete antecipado cabe hoje: devolve a chave ('d2') do primeiro que
 * ainda nao foi enviado e cujo dia ja chegou. Sem isso, um lembrete apagaria o
 * outro e so o primeiro sairia.
 */
function lembretePendente(
  diasAteVencer: number,
  dias: number[],
  jaEnviados: Record<string, unknown> | null,
): string | null {
  for (const d of [...dias].sort((a, b) => a - b)) {
    const chave = `d${d}`;
    if (diasAteVencer <= d && !jaEnviados?.[chave]) return chave;
  }
  return null;
}

async function emailsDaGestao(salaoId: string, fallback: string | null): Promise<string[]> {
  const { data: perfis } = await supabaseAdmin
    .from('perfis_usuarios')
    .select('id, regra, nivel_acesso')
    .eq('salao_id', salaoId);

  const idsGestao = (perfis ?? [])
    .filter(p => NIVEIS_GESTAO.includes(String(p.nivel_acesso ?? '').toLowerCase())
              || NIVEIS_GESTAO.includes(String(p.regra ?? '').toLowerCase()))
    .map(p => p.id);

  const emails: string[] = [];
  for (const id of idsGestao) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    const email = data?.user?.email;
    if (email && !emails.includes(email)) emails.push(email);
  }

  if (emails.length === 0 && fallback) emails.push(fallback);
  return emails;
}


/**
 * Encerra o cadastro do CNPJ na Brasil NFe quando o salão deixa de ter QUALQUER
 * módulo de nota.
 *
 * A Brasil NFe não tem "suspender": só deletar a empresa para a cobrança
 * (confirmado por eles em 07/08/2026). Sem isto, salão que cancela continua
 * custando R$ 49,90/mês à Luarys para sempre.
 *
 * O cadastro é UM SÓ para NFS-e e NFC-e — `registrarPagamentoAssinatura` cria a
 * empresa quando qualquer um dos dois é pago. Por isso a exclusão só acontece
 * quando não sobrou nenhum dos dois ativo: cancelar só a NFC-e não pode derrubar
 * a emissão de NFS-e junto.
 */
async function encerrarCadastroFiscalSeSobrou(
  salaoId: string,
  moduloChave: string,
  resultado: any,
) {
  if (moduloChave !== 'nfse' && moduloChave !== 'nfce') return;

  const { data: aindaAtivos } = await supabaseAdmin
    .from('salao_modulos').select('modulo_chave')
    .eq('salao_id', salaoId).eq('ativo', true).in('modulo_chave', ['nfse', 'nfce']);
  if (aindaAtivos?.length) return;

  const r = await excluirEmpresaLuarys(salaoId);
  if (r.jaEstavaFora) return;
  if (!r.sucesso) {
    // Não desiste: sem token apagado, a próxima passada da régua tenta de novo.
    // Falhar em silêncio aqui é dinheiro saindo todo mês sem ninguém ver.
    console.error(`[processar-vencimentos] falha ao excluir empresa na Brasil NFe — salão ${salaoId}: ${r.erro}`);
    resultado.fiscal = { ...(resultado.fiscal ?? {}), falhas: (resultado.fiscal?.falhas ?? 0) + 1 };
    return;
  }
  resultado.fiscal = { ...(resultado.fiscal ?? {}), excluidos: (resultado.fiscal?.excluidos ?? 0) + 1 };
}

export async function POST(req: NextRequest) {
  // Aceita os DOIS formatos de propósito:
  //  - "Authorization: Bearer <CRON_SECRET>" é o que o Vercel injeta sozinho
  //    no cron agendado em vercel.json;
  //  - "x-cron-secret" é o que /api/admin/rodar-cron usa no disparo manual.
  //
  // Esta rota só olhava o segundo. Ou seja: o cron do Vercel batia aqui todo
  // dia às 11h e levava 401 — a régua nunca rodou em produção. Efeito prático:
  // módulo cancelado nunca era desligado no fim do período pago, e ninguém era
  // avisado nem suspenso por falta de pagamento. Só o disparo manual do admin
  // funcionava, e por isso o defeito passou despercebido.
  const esperado = process.env.CRON_SECRET;
  if (!esperado) {
    console.error('[processar-vencimentos] CRON_SECRET não configurado — requisição bloqueada.');
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }
  const viaHeader = req.headers.get('x-cron-secret');
  const viaBearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (viaHeader !== esperado && viaBearer !== esperado) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const agora = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const urlRenovacao = `${appUrl}/#configuracoes`;

  const resultado = {
    trials: { lembretes: 0, bloqueados: 0 },
    planos: { lembretes: 0, primeiros_avisos: 0, segundos_avisos: 0, bloqueados: 0 },
    modulos: { lembretes: 0, primeiros_avisos: 0, segundos_avisos: 0, bloqueados: 0 },
  };

  // ── TRIALS ───────────────────────────────────────────────────────────────────
  // Trials não têm plano_renovacao_em — usam trial_expiracao separado.
  // Mantém a lógica original (lembrete 2 dias antes + bloqueio imediato ao vencer).

  const { data: trialsAtivos } = await supabaseAdmin
    .from('saloes')
    .select('id, nome_fantasia, razao_social, email_contato, trial_expiracao')
    .in('status_assinatura', ['trial'])
    .not('trial_expiracao', 'is', null)
    .eq('acesso_total', false);

  for (const s of trialsAtivos || []) {
    if (!s.email_contato || !s.trial_expiracao) continue;
    const expiracao = new Date(s.trial_expiracao);
    const diasAteVencer = (expiracao.getTime() - agora.getTime()) / 86_400_000;
    const jaExpirou = agora > expiracao;
    const basePayload: Omit<NotificacaoCobranca, 'evento'> = {
      salao_id: s.id,
      salao_nome: s.nome_fantasia || s.razao_social || s.id,
      email: s.email_contato,
      item_nome: 'Trial gratuito',
      item_tipo: 'plano',
      vencimento_em: expiracao.toISOString(),
      url_renovacao: urlRenovacao,
    };

    const destinatarios = await emailsDaGestao(s.id, s.email_contato);
    if (destinatarios.length === 0) continue;

    if (jaExpirou) {
      await supabaseAdmin.from('saloes')
        .update({ status_assinatura: 'suspenso' })
        .eq('id', s.id);
      await avisarGestao(basePayload, 'acesso_bloqueado', destinatarios);
      resultado.trials.bloqueados++;
    } else if (diasAteVencer <= 2 && diasAteVencer > 0) {
      await avisarGestao(basePayload, 'lembrete_vencimento', destinatarios);
      resultado.trials.lembretes++;
    }
  }

  // ── PLANOS ───────────────────────────────────────────────────────────────────

  const { data: saloes } = await supabaseAdmin
    .from('saloes')
    .select(`id, nome_fantasia, razao_social, email_contato, plano_chave, plano_periodo,
             plano_renovacao_em, plano_aviso_enviado_em, plano_segundo_aviso_enviado_em,
             status_assinatura, acesso_total, cancelamento_agendado,
             asaas_subscription_id, lembretes_enviados`)
    .not('plano_renovacao_em', 'is', null)
    .eq('acesso_total', false)
    .neq('status_assinatura', 'suspenso');

  if (saloes) {
    const chavesPlanos = [...new Set(saloes.map(s => s.plano_chave).filter(Boolean))];
    const { data: planosDb } = await supabaseAdmin
      .from('planos')
      .select('chave, nome')
      .in('chave', chavesPlanos as string[]);
    const nomePlano: Record<string, string> = {};
    (planosDb || []).forEach(p => { nomePlano[p.chave] = p.nome; });

    for (const s of saloes) {
      if (!s.email_contato || !s.plano_renovacao_em) continue;

      const renovacao = new Date(s.plano_renovacao_em);
      const diasAteVencer = (renovacao.getTime() - agora.getTime()) / 86_400_000;
      const horasAposVencer = (agora.getTime() - renovacao.getTime()) / 3_600_000;

      // Cancelamento pedido pelo próprio salão (AbaMeuPlano → "Cancelar
      // Plano") — ao vencer o período já pago, só suspende, sem os avisos de
      // "pagamento atrasado"/"cobrança em risco": não é atraso, foi decisão
      // do salão, e a subscription no Asaas já foi cancelada na hora
      // (ver desativarPlano em AbaMeuPlano.tsx).
      if (s.cancelamento_agendado) {
        if (horasAposVencer > 0) {
          await supabaseAdmin.from('saloes').update({
            status_assinatura: 'suspenso',
            plano_renovacao_em: null,
          }).eq('id', s.id);
          resultado.planos.bloqueados++;
        }
        continue;
      }

      const destinatarios = await emailsDaGestao(s.id, s.email_contato);
      if (destinatarios.length === 0) continue;

      const basePayload: Omit<NotificacaoCobranca, 'evento'> = {
        salao_id: s.id,
        salao_nome: s.nome_fantasia || s.razao_social || s.id,
        email: s.email_contato,
        item_nome: nomePlano[s.plano_chave] ?? s.plano_chave ?? 'Plano',
        item_tipo: 'plano',
        vencimento_em: renovacao.toISOString(),
        url_renovacao: urlRenovacao,
      };

      // 4. Suspensão: 74h após o segundo aviso (≈ D+10)
      if (s.plano_segundo_aviso_enviado_em) {
        const horasDesdeSegundoAviso =
          (agora.getTime() - new Date(s.plano_segundo_aviso_enviado_em).getTime()) / 3_600_000;
        if (horasDesdeSegundoAviso >= HORAS_GRACA_SEGUNDO_AVISO) {
          await supabaseAdmin.from('saloes').update({
            status_assinatura: 'suspenso',
            plano_renovacao_em: null,
          }).eq('id', s.id);
          await avisarGestao(basePayload, 'acesso_bloqueado', destinatarios);
          resultado.planos.bloqueados++;
          continue;
        }
      }

      // 3. Segundo aviso: D+7
      if (horasAposVencer >= HORAS_PARA_SEGUNDO_AVISO && !s.plano_segundo_aviso_enviado_em) {
        await supabaseAdmin.from('saloes').update({
          plano_segundo_aviso_enviado_em: agora.toISOString(),
        }).eq('id', s.id);
        await avisarGestao(basePayload, 'segundo_aviso_atraso', destinatarios);
        resultado.planos.segundos_avisos++;
        continue;
      }

      // 2. Dia do vencimento (D+0) e atraso (D+1 em diante).
      //
      // Sao mensagens diferentes de proposito: quem tem ate hoje para pagar nao
      // esta atrasado, e chamar de atraso e cobrar antes da hora. Ja o aviso de
      // atraso so sai depois de PERGUNTAR AO ASAAS — a regua le `renovacao_em`,
      // que so avanca quando o webhook chega, e webhook perdido faria o salao
      // adimplente ser cobrado e perder o modulo dez dias depois tendo pago.
      if (horasAposVencer > 0 && horasAposVencer < 24 && !s.plano_aviso_enviado_em) {
        await supabaseAdmin.from('saloes').update({ plano_aviso_enviado_em: agora.toISOString() }).eq('id', s.id);
        await avisarGestao(basePayload, 'vence_hoje', destinatarios);
        resultado.planos.primeiros_avisos++;
        continue;
      }

      if (horasAposVencer >= 24 && !s.plano_aviso_enviado_em) {
        if (await pagamentoConfirmadoNoAsaas((s as any).asaas_subscription_id)) continue;
        await supabaseAdmin.from('saloes').update({ plano_aviso_enviado_em: agora.toISOString() }).eq('id', s.id);
        await avisarGestao(basePayload, 'pagamento_atrasado', destinatarios);
        resultado.planos.primeiros_avisos++;
        continue;
      }

      // 1. Lembrete antecipado — nao grava plano_aviso_enviado_em, que e do
      // aviso de D+0. Marcar aqui apagava o aviso do dia do vencimento.
      const diasLembretePlano = s.plano_periodo === 'anual' ? DIAS_LEMBRETE_ANUAL : DIAS_LEMBRETE_MENSAL;
      const chavePlano = diasAteVencer > 0
        ? lembretePendente(diasAteVencer, diasLembretePlano, (s as any).lembretes_enviados)
        : null;
      if (chavePlano) {
        await supabaseAdmin.from('saloes').update({
          lembretes_enviados: { ...((s as any).lembretes_enviados ?? {}), [chavePlano]: agora.toISOString() },
        }).eq('id', s.id);
        await avisarGestao(basePayload, 'lembrete_vencimento', destinatarios);
        resultado.planos.lembretes++;
      }
    }
  }

  // ── MÓDULOS ──────────────────────────────────────────────────────────────────

  const { data: modulos } = await supabaseAdmin
    .from('salao_modulos')
    .select('salao_id, modulo_chave, renovacao_em, aviso_enviado_em, segundo_aviso_enviado_em, ativo, periodo, cancelamento_agendado, lembretes_enviados, asaas_subscription_id')
    .not('renovacao_em', 'is', null)
    .eq('ativo', true);

  if (modulos && modulos.length > 0) {
    const salaoIds = [...new Set(modulos.map(m => m.salao_id))];
    const moduloChaves = [...new Set(modulos.map(m => m.modulo_chave))];

    const [resSaloes, resCatalogo] = await Promise.all([
      supabaseAdmin.from('saloes').select('id, nome_fantasia, razao_social, email_contato, acesso_total').in('id', salaoIds),
      supabaseAdmin.from('modulos_catalogo').select('chave, nome').in('chave', moduloChaves),
    ]);

    const salaoMap: Record<string, any> = {};
    (resSaloes.data || []).forEach(s => { salaoMap[s.id] = s; });

    const moduloMap: Record<string, string> = {};
    (resCatalogo.data || []).forEach(m => { moduloMap[m.chave] = m.nome; });

    for (const mod of modulos) {
      const salao = salaoMap[mod.salao_id];
      if (!salao?.email_contato || salao.acesso_total) continue;

      const renovacao = new Date(mod.renovacao_em);
      const diasAteVencer = (renovacao.getTime() - agora.getTime()) / 86_400_000;
      const horasAposVencer = (agora.getTime() - renovacao.getTime()) / 3_600_000;

      // Mesma lógica do cancelamento de plano: quem cancelou o módulo não
      // deve receber aviso de "pagamento atrasado" — só desativa ao vencer.
      if (mod.cancelamento_agendado) {
        if (horasAposVencer > 0) {
          await supabaseAdmin.from('salao_modulos').update({ ativo: false })
            .eq('salao_id', mod.salao_id)
            .eq('modulo_chave', mod.modulo_chave);
          resultado.modulos.bloqueados++;
          await encerrarCadastroFiscalSeSobrou(mod.salao_id, mod.modulo_chave, resultado);
        }
        continue;
      }

      const destinatarios = await emailsDaGestao(mod.salao_id, salao.email_contato);
      if (destinatarios.length === 0) continue;

      const basePayload: Omit<NotificacaoCobranca, 'evento'> = {
        salao_id: mod.salao_id,
        salao_nome: salao.nome_fantasia || salao.razao_social || mod.salao_id,
        email: salao.email_contato,
        item_nome: moduloMap[mod.modulo_chave] ?? mod.modulo_chave,
        item_tipo: 'modulo',
        vencimento_em: renovacao.toISOString(),
        url_renovacao: urlRenovacao,
      };

      // 4. Suspensão: 74h após o segundo aviso
      if (mod.segundo_aviso_enviado_em) {
        const horasDesdeSegundoAviso =
          (agora.getTime() - new Date(mod.segundo_aviso_enviado_em).getTime()) / 3_600_000;
        if (horasDesdeSegundoAviso >= HORAS_GRACA_SEGUNDO_AVISO) {
          await supabaseAdmin.from('salao_modulos').update({ ativo: false })
            .eq('salao_id', mod.salao_id)
            .eq('modulo_chave', mod.modulo_chave);
          await avisarGestao(basePayload, 'acesso_bloqueado', destinatarios);
          resultado.modulos.bloqueados++;
          continue;
        }
      }

      // 3. Segundo aviso: D+7
      if (horasAposVencer >= HORAS_PARA_SEGUNDO_AVISO && !mod.segundo_aviso_enviado_em) {
        await supabaseAdmin.from('salao_modulos').update({
          segundo_aviso_enviado_em: agora.toISOString(),
        }).eq('salao_id', mod.salao_id).eq('modulo_chave', mod.modulo_chave);
        await avisarGestao(basePayload, 'segundo_aviso_atraso', destinatarios);
        resultado.modulos.segundos_avisos++;
        continue;
      }

      // 2. Dia do vencimento e atraso — ver comentario no bloco do plano.
      if (horasAposVencer > 0 && horasAposVencer < 24 && !mod.aviso_enviado_em) {
        await supabaseAdmin.from('salao_modulos').update({ aviso_enviado_em: agora.toISOString() }).eq('salao_id', mod.salao_id).eq('modulo_chave', mod.modulo_chave);
        await avisarGestao(basePayload, 'vence_hoje', destinatarios);
        resultado.modulos.primeiros_avisos++;
        continue;
      }

      if (horasAposVencer >= 24 && !mod.aviso_enviado_em) {
        if (await pagamentoConfirmadoNoAsaas((mod as any).asaas_subscription_id)) continue;
        await supabaseAdmin.from('salao_modulos').update({ aviso_enviado_em: agora.toISOString() }).eq('salao_id', mod.salao_id).eq('modulo_chave', mod.modulo_chave);
        await avisarGestao(basePayload, 'pagamento_atrasado', destinatarios);
        resultado.modulos.primeiros_avisos++;
        continue;
      }

      // 1. Lembrete antecipado — ver comentario no bloco do plano.
      const diasLembreteModulo = mod.periodo === 'anual' ? DIAS_LEMBRETE_ANUAL : DIAS_LEMBRETE_MENSAL;
      const chaveMod = diasAteVencer > 0
        ? lembretePendente(diasAteVencer, diasLembreteModulo, (mod as any).lembretes_enviados)
        : null;
      if (chaveMod) {
        await supabaseAdmin.from('salao_modulos').update({
          lembretes_enviados: { ...((mod as any).lembretes_enviados ?? {}), [chaveMod]: agora.toISOString() },
        }).eq('salao_id', mod.salao_id).eq('modulo_chave', mod.modulo_chave);
        await avisarGestao(basePayload, 'lembrete_vencimento', destinatarios);
        resultado.modulos.lembretes++;
      }
    }
  }

  console.log('[processar-vencimentos]', agora.toISOString(), resultado);
  return NextResponse.json({ sucesso: true, processado_em: agora.toISOString(), resultado });
}

// Permite GET para teste manual no browser (com o secret no header)
export async function GET(req: NextRequest) {
  return POST(req);
}
