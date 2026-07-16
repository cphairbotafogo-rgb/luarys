/**
 * src/lib/fiscal/shared.ts
 *
 * Core compartilhado entre os adaptadores Focus NFe de NFS-e e NFC-e.
 * Elimina duplicação de URL base, autenticação e tipos de erro comuns.
 */

// ─── URL base ───────────────────────────────────────────────────────────────

export const FOCUS_BASE_URL: string =
  process.env.FOCUS_NFE_AMBIENTE === 'producao'
    ? 'https://api.focusnfe.com.br/v2'
    : 'https://homologacao.focusnfe.com.br/v2';

// ─── Autenticação ────────────────────────────────────────────────────────────

/** Gera o valor completo do header Authorization (Basic Auth com senha vazia). */
export function focusAuthHeader(token: string): string {
  return 'Basic ' + Buffer.from(`${token}:`).toString('base64');
}

// ─── Resolução de token ──────────────────────────────────────────────────────

/**
 * Retorna o token correto de acordo com o provedor.
 * - Focus NFe: usa token do salão (config_fiscal.focus_nfe_token) ou env FOCUS_NFE_TOKEN.
 * - Brasil NFe: usa token da empresa registrada (config_fiscal.brasilnfe_company_token).
 * - Uso sem provedor (ex: nfce/focusnfe.ts): passa apenas tokenDb — cai no default Focus.
 */
export function resolverTokenFocus(configFiscal?: any, provedor?: string): string {
  if (!provedor || provedor === 'focusnfe') {
    const token = (typeof configFiscal === 'string' ? configFiscal : configFiscal?.focus_nfe_token)
      || process.env.FOCUS_NFE_TOKEN
      || '';
    return token;
  }
  if (provedor === 'brasilnfe') {
    return configFiscal?.brasilnfe_company_token || '';
  }
  return '';
}

// ─── Retry para instabilidade de prefeituras ─────────────────────────────────

/**
 * Faz fetch com re-tentativa automática para erros de rede e status 5xx.
 * Prefeituras conectadas à Focus NFe podem ter instabilidade pontual.
 */
export async function fetchFocusComRetry(
  url: string,
  options: RequestInit,
  tentativas = 3,
): Promise<Response> {
  const delays = [2000, 5000];
  for (let i = 0; i < tentativas; i++) {
    try {
      const resp = await fetch(url, options);
      if (resp.status < 500) return resp;
      if (i < tentativas - 1) await new Promise(r => setTimeout(r, delays[i]));
    } catch (err) {
      if (i === tentativas - 1) throw err;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
  throw new Error('Focus NFe não respondeu após 3 tentativas.');
}

// ─── Tipos compartilhados ────────────────────────────────────────────────────

/** Erro retornado pela API da Focus NFe no array `erros`. */
export interface FocusErro {
  codigo: string;
  mensagem: string;
}

/**
 * Status possíveis de uma nota na Focus NFe.
 * Compartilhado entre NFS-e e NFC-e.
 */
export type FocusStatusNota =
  | 'autorizado'
  | 'processando'
  | 'cancelado'
  | 'erro'
  | 'denegado';

/** Formata o array de erros da Focus NFe em string legível. */
export function formatarErrosFocus(erros?: FocusErro[], statusFallback?: string): string {
  return erros?.map(e => `[${e.codigo}] ${e.mensagem}`).join('; ')
    || `Status: ${statusFallback ?? 'desconhecido'}`;
}
