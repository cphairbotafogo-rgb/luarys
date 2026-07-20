import { createClient } from '@supabase/supabase-js';
import { notificarCobranca } from './notificacoes';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type PeriodoAssinatura = 'mensal' | 'anual';

/** Formato: salaoId::moduloChave ou salaoId::moduloChave::periodo */
export function parseReferencia(ref: string | undefined | null): {
  salaoId: string;
  moduloChave: string;
  periodo: PeriodoAssinatura;
} | null {
  if (!ref) return null;
  const [salaoId, moduloChave, periodo] = ref.split('::');
  if (!salaoId || !moduloChave) return null;
  return {
    salaoId,
    moduloChave,
    periodo: periodo === 'anual' ? 'anual' : 'mensal',
  };
}

async function ehPlanoBase(chave: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('planos')
    .select('chave')
    .eq('chave', chave)
    .maybeSingle();
  return !!data;
}

function calcularRenovacao(periodo: PeriodoAssinatura): Date {
  const d = new Date();
  d.setDate(d.getDate() + (periodo === 'anual' ? 365 : 30));
  return d;
}

export async function registrarPagamentoAssinatura({
  salaoId,
  moduloChave,
  valor,
  status,
  gateway,
  pagamentoExternoId,
  periodo = 'mensal',
}: {
  salaoId: string;
  moduloChave: string;
  valor: number;
  status: 'approved' | 'pending' | 'rejected';
  gateway: string;
  pagamentoExternoId: string;
  periodo?: PeriodoAssinatura;
}) {
  // ── Idempotência ──────────────────────────────────────────────────────────────
  const { data: registroExistente } = await supabaseAdmin
    .from('pagamentos_assinatura')
    .select('id, status')
    .eq('pagamento_externo_id', pagamentoExternoId)
    .maybeSingle();

  if (registroExistente?.status === 'approved') {
    return { registrado: true, ativado: true, duplicado: true };
  }

  // H2: registra pagamento como 'pending' primeiro — só marca 'approved' depois
  // de ativar o módulo. Se a ativação falhar, fica 'pending' e o webhook pode
  // ser reenviado. Evita estado inconsistente (pago mas módulo inativo).
  await supabaseAdmin
    .from('pagamentos_assinatura')
    .upsert(
      { salao_id: salaoId, modulo_chave: moduloChave, valor, status: status === 'approved' ? 'pending' : status, gateway, pagamento_externo_id: pagamentoExternoId },
      { onConflict: 'pagamento_externo_id' }
    );

  // Info do salão para notificações
  const { data: salao } = await supabaseAdmin
    .from('saloes')
    .select('nome_fantasia, razao_social, email_contato')
    .eq('id', salaoId)
    .maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // ── Pagamento rejeitado ───────────────────────────────────────────────────────
  if (status === 'rejected' && salao?.email_contato) {
    const ehPlano = await ehPlanoBase(moduloChave);
    let itemNome = moduloChave;
    if (ehPlano) {
      const { data: p } = await supabaseAdmin.from('planos').select('nome').eq('chave', moduloChave).maybeSingle();
      itemNome = p?.nome ?? moduloChave;
    } else {
      const { data: m } = await supabaseAdmin.from('modulos_catalogo').select('nome').eq('chave', moduloChave).maybeSingle();
      itemNome = m?.nome ?? moduloChave;
    }
    await notificarCobranca({
      evento: 'pagamento_rejeitado',
      salao_id: salaoId,
      salao_nome: salao.nome_fantasia || salao.razao_social || salaoId,
      email: salao.email_contato,
      item_nome: itemNome,
      item_tipo: ehPlano ? 'plano' : 'modulo',
      vencimento_em: new Date().toISOString(),
      url_renovacao: `${appUrl}/#configuracoes`,
    });
  }

  if (status !== 'approved') {
    return { registrado: true, ativado: false };
  }

  const renovacaoEm = calcularRenovacao(periodo);

  // ── Plano base → atualiza saloes ─────────────────────────────────────────────
  if (await ehPlanoBase(moduloChave)) {
    const { data: salaoAtual } = await supabaseAdmin
      .from('saloes')
      .select('plano_chave')
      .eq('id', salaoId)
      .maybeSingle();

    const { data: plano } = await supabaseAdmin
      .from('planos')
      .select('nome, limite_profissionais')
      .eq('chave', moduloChave)
      .maybeSingle();

    const updateSalao: Record<string, any> = {
      plano_chave: moduloChave,
      plano_periodo: periodo,
      plano_renovacao_em: renovacaoEm.toISOString(),
      status_assinatura: 'ativo',
      plano_aviso_enviado_em: null,
      plano_segundo_aviso_enviado_em: null,
    };

    if (plano?.limite_profissionais != null) {
      updateSalao.limite_profissionais = plano.limite_profissionais;
    }

    const { error: erroPlano } = await supabaseAdmin
      .from('saloes')
      .update(updateSalao)
      .eq('id', salaoId);

    if (erroPlano) return { registrado: true, ativado: false, erro: erroPlano.message };

    await supabaseAdmin.from('salao_planos_historico').insert({
      salao_id: salaoId,
      plano_anterior: salaoAtual?.plano_chave ?? null,
      plano_novo: moduloChave,
      alterado_por: null,
    });

    // H2: só marca como 'approved' depois da ativação ter sucesso
    await supabaseAdmin.from('pagamentos_assinatura')
      .update({ status: 'approved' })
      .eq('pagamento_externo_id', pagamentoExternoId);

    return { registrado: true, ativado: true, tipo: 'plano', periodo };
  }

  // ── Módulo avulso → atualiza salao_modulos ───────────────────────────────────
  const { error: erroModulo } = await supabaseAdmin
    .from('salao_modulos')
    .upsert(
      {
        salao_id: salaoId,
        modulo_chave: moduloChave,
        ativo: true,
        origem: 'pagamento',
        ativado_em: new Date().toISOString(),
        renovacao_em: renovacaoEm.toISOString(),
        periodo,
        cancelamento_agendado: false,
        aviso_enviado_em: null,
        segundo_aviso_enviado_em: null,
      },
      { onConflict: 'salao_id,modulo_chave' }
    );

  if (erroModulo) return { registrado: true, ativado: false, erro: erroModulo.message };

  // H2: só marca como 'approved' depois da ativação ter sucesso
  await supabaseAdmin.from('pagamentos_assinatura')
    .update({ status: 'approved' })
    .eq('pagamento_externo_id', pagamentoExternoId);

  return { registrado: true, ativado: true, tipo: 'modulo', periodo };
}
