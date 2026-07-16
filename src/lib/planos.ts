/**
 * Definição canônica dos planos do Luarys.
 * Fonte única de verdade para o que cada plano inclui.
 * O backend (webhook) e o frontend (sidebar, perfil) importam daqui.
 */

export type PlanoChave = 'trial' | 'basico' | 'profissional' | 'premium' | 'escala' | 'enterprise';
export type StatusAssinatura = 'trial' | 'ativo' | 'suspenso' | 'cancelado';

export interface DefinicaoPlano {
  chave: PlanoChave;
  nome: string;
  preco: number; // R$/mês
  descricao: string;
  cor: string; // badge color
}

export const PLANOS: Record<PlanoChave, DefinicaoPlano> = {
  trial: {
    chave: 'trial',
    nome: 'Trial',
    preco: 0,
    descricao: '14 dias grátis com acesso completo a todos os módulos',
    cor: '#6366F1',
  },
  basico: {
    chave: 'basico',
    nome: 'Básico',
    preco: 79,
    descricao: 'Até 2 profissionais ativos',
    cor: '#64748B',
  },
  profissional: {
    chave: 'profissional',
    nome: 'Profissional',
    preco: 149,
    descricao: 'Até 4 profissionais ativos',
    cor: '#0EA5E9',
  },
  premium: {
    chave: 'premium',
    nome: 'Premium',
    preco: 249,
    descricao: 'Até 6 profissionais ativos',
    cor: '#D4AF37',
  },
  escala: {
    chave: 'escala',
    nome: 'Escala',
    preco: 199,
    descricao: 'Até 8 profissionais ativos',
    cor: '#7C3AED',
  },
  enterprise: {
    chave: 'enterprise',
    nome: 'Enterprise',
    preco: 0,
    descricao: 'Vagas personalizadas — sob consulta.',
    cor: '#1F2937',
  },
};

export const ORDEM_PLANOS: PlanoChave[] = ['trial', 'basico', 'profissional', 'premium', 'escala', 'enterprise'];

/**
 * Deriva status de bloqueio e nome do plano.
 * Acesso a módulos específicos (fiscal, comunicação, etc.) vem de `salao_modulos`
 * — use `derivarModulos()` em page.tsx para isso.
 */
export function derivarAcessoPlano(
  planoAssinatura: string | null,
  statusAssinatura: string | null,
  acessoTotal?: boolean,
  trialExpiracao?: string | null,
): {
  planoBloqueado: boolean;
  planoNome: string;
} {
  if (acessoTotal) {
    return { planoBloqueado: false, planoNome: 'Admin' };
  }

  const status = (statusAssinatura ?? 'trial') as StatusAssinatura;

  // Trial vencido no relógio local — bloqueia mesmo antes do cron rodar
  const trialExpirou = status === 'trial'
    && !!trialExpiracao
    && new Date(trialExpiracao) < new Date();

  const bloqueado = status === 'suspenso' || status === 'cancelado' || trialExpirou;
  const plano = (planoAssinatura ?? 'trial') as PlanoChave;
  const def = PLANOS[plano] ?? PLANOS.trial;

  return {
    planoBloqueado: bloqueado,
    planoNome: def.nome,
  };
}
