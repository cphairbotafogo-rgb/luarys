import { createClient } from '@supabase/supabase-js';
import { notificarCobranca } from './notificacoes';
import { cadastrarEmpresaLuarys } from './nfse/brasilnfe';

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

export async function ehPlanoBase(chave: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('planos')
    .select('chave')
    .eq('chave', chave)
    .maybeSingle();
  // Se a query falhar, "false" faz o chamador tratar como módulo avulso em
  // vez de plano base — errado silenciosamente, por isso loga sempre que
  // houver erro real (não apenas "não encontrado", que já é null sem erro).
  if (error) console.error('[ehPlanoBase] Erro ao consultar planos:', error.message);
  return !!data;
}

/**
 * Cancela a subscription recorrente no Asaas de um módulo ou do plano base
 * de um salão, e limpa o `asaas_subscription_id` correspondente. Extraído
 * de /api/assinatura/cancelar-recorrencia para ser reaproveitado por
 * qualquer caminho que desative um módulo/plano — inclusive as telas de
 * admin, que antes só desligavam `ativo` localmente sem tocar no Asaas,
 * deixando a cobrança recorrente rodando mesmo com o módulo "desativado".
 */
export async function cancelarAssinaturaAsaas(
  salaoId: string,
  moduloChave: string,
): Promise<{ cancelado: boolean; erro?: string }> {
  const ehPlano = await ehPlanoBase(moduloChave);
  const tabela = ehPlano ? 'saloes' : 'salao_modulos';
  const filtroId = ehPlano ? { id: salaoId } : { salao_id: salaoId, modulo_chave: moduloChave };

  const { data: registro } = await supabaseAdmin
    .from(tabela)
    .select('asaas_subscription_id')
    .match(filtroId)
    .maybeSingle();

  const subscriptionId = registro?.asaas_subscription_id;
  if (!subscriptionId) return { cancelado: false };

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
  if (!asaasKey) return { cancelado: false, erro: 'ASAAS_API_KEY não configurado — não foi possível cancelar a recorrência no Asaas.' };

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
    return { cancelado: false, erro: 'Falha ao cancelar a assinatura no Asaas: ' + (cancelData.errors?.[0]?.description || JSON.stringify(cancelData)) };
  }

  await supabaseAdmin.from(tabela).update({ asaas_subscription_id: null }).match(filtroId);
  return { cancelado: true };
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
  asaasSubscriptionId,
}: {
  salaoId: string;
  moduloChave: string;
  valor: number;
  status: 'approved' | 'pending' | 'rejected';
  gateway: string;
  pagamentoExternoId: string;
  periodo?: PeriodoAssinatura;
  /** Presente quando o pagamento veio de uma subscription Asaas (cobrança
   * recorrente no cartão) — grava o id em saloes/salao_modulos para permitir
   * cancelar a recorrência depois (ver /api/assinatura/cancelar-recorrencia). */
  asaasSubscriptionId?: string | null;
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
  // Depende de pagamento_externo_id ter constraint única (ver migração
  // 20260725_pagamentos_assinatura_unique_externo.sql) — sem ela, o upsert
  // falha com "42P10 no unique constraint" e, sem checar o erro, a tabela
  // fica vazia silenciosamente (era exatamente o que acontecia antes).
  const { error: erroUpsertPagamento } = await supabaseAdmin
    .from('pagamentos_assinatura')
    .upsert(
      { salao_id: salaoId, modulo_chave: moduloChave, valor, status: status === 'approved' ? 'pending' : status, gateway, pagamento_externo_id: pagamentoExternoId },
      { onConflict: 'pagamento_externo_id' }
    );
  if (erroUpsertPagamento) console.error('[registrarPagamentoAssinatura] Erro ao gravar pagamento pendente:', erroUpsertPagamento.message);

  // Info do salão para notificações
  const { data: salao, error: erroSalaoInfo } = await supabaseAdmin
    .from('saloes')
    .select('nome_fantasia, razao_social, email_contato')
    .eq('id', salaoId)
    .maybeSingle();
  if (erroSalaoInfo) console.error('[registrarPagamentoAssinatura] Erro ao buscar saloes:', erroSalaoInfo.message);

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
    const { data: salaoAtual, error: erroSalaoAtual } = await supabaseAdmin
      .from('saloes')
      .select('plano_chave')
      .eq('id', salaoId)
      .maybeSingle();
    if (erroSalaoAtual) console.error('[registrarPagamentoAssinatura] Erro ao buscar plano_chave atual:', erroSalaoAtual.message);

    // Erro aqui faz limite_profissionais não ser atualizado silenciosamente
    // ao trocar de plano — o salão pagaria por mais vagas sem o limite subir.
    const { data: plano, error: erroPlanoLimite } = await supabaseAdmin
      .from('planos')
      .select('nome, limite_profissionais')
      .eq('chave', moduloChave)
      .maybeSingle();
    if (erroPlanoLimite) console.error('[registrarPagamentoAssinatura] Erro ao buscar limite_profissionais do plano:', erroPlanoLimite.message);

    const updateSalao: Record<string, any> = {
      plano_chave: moduloChave,
      plano_periodo: periodo,
      plano_renovacao_em: renovacaoEm.toISOString(),
      status_assinatura: 'ativo',
      plano_aviso_enviado_em: null,
      plano_segundo_aviso_enviado_em: null,
      cancelamento_agendado: false,
    };

    if (plano?.limite_profissionais != null) {
      updateSalao.limite_profissionais = plano.limite_profissionais;
    }
    if (asaasSubscriptionId) {
      updateSalao.asaas_subscription_id = asaasSubscriptionId;
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
    const { error: erroAprovarPlano } = await supabaseAdmin.from('pagamentos_assinatura')
      .update({ status: 'approved' })
      .eq('pagamento_externo_id', pagamentoExternoId);
    if (erroAprovarPlano) console.error('[registrarPagamentoAssinatura] Erro ao marcar pagamento (plano) como approved:', erroAprovarPlano.message);

    return { registrado: true, ativado: true, tipo: 'plano', periodo };
  }

  // ── Módulo avulso → atualiza salao_modulos ───────────────────────────────────
  const dadosModulo: Record<string, any> = {
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
  };
  if (asaasSubscriptionId) {
    dadosModulo.asaas_subscription_id = asaasSubscriptionId;
  }

  const { error: erroModulo } = await supabaseAdmin
    .from('salao_modulos')
    .upsert(dadosModulo, { onConflict: 'salao_id,modulo_chave' });

  if (erroModulo) return { registrado: true, ativado: false, erro: erroModulo.message };

  // H2: só marca como 'approved' depois da ativação ter sucesso
  const { error: erroAprovarModulo } = await supabaseAdmin.from('pagamentos_assinatura')
    .update({ status: 'approved' })
    .eq('pagamento_externo_id', pagamentoExternoId);
  if (erroAprovarModulo) console.error('[registrarPagamentoAssinatura] Erro ao marcar pagamento (módulo) como approved:', erroAprovarModulo.message);

  // Módulo fiscal pago (nfse ou nfce) → cadastra o CNPJ na Brasil NFe
  // automaticamente, se ainda não tiver sido feito. Nunca bloqueia a
  // ativação do módulo — mesma regra do fechamento de conta ("falha na nota
  // não pode travar a venda"). Renovação de assinatura já cadastrada é
  // ignorada aqui (checa config_fiscal antes de chamar a Brasil NFe de novo).
  if (moduloChave === 'nfse' || moduloChave === 'nfce') {
    try {
      const { data: salaoFiscal } = await supabaseAdmin
        .from('saloes')
        .select('config_fiscal')
        .eq('id', salaoId)
        .maybeSingle();

      if (!salaoFiscal?.config_fiscal?.brasilnfe_company_token) {
        const resultadoCadastro = await cadastrarEmpresaLuarys(salaoId);
        if (resultadoCadastro.erro) {
          console.warn('[registrarPagamentoAssinatura] Cadastro automático na Brasil NFe falhou (módulo continua ativado, admin cadastra manualmente depois):', resultadoCadastro.erro);
        }
      }
    } catch (e: any) {
      console.error('[registrarPagamentoAssinatura] Erro inesperado no cadastro automático Brasil NFe:', e?.message || e);
    }
  }

  return { registrado: true, ativado: true, tipo: 'modulo', periodo };
}
