/**
 * src/lib/nfse/index.ts
 *
 * Roteador de provedores NFS-e.
 * O provedor é definido em config_fiscal.provedor_nfse do salão.
 * Padrão: 'focusnfe' se não configurado.
 */

import type { AdaptadorNFSe, PayloadNFSe, ProvedorNFSe, ResultadoEmissao } from './tipos';
import { emitirNFSe, consultarNFSe, cancelarNFSe, buildPayloadNFSe } from './focusnfe';
import { BrasilNFeAdaptador } from './brasilnfe';

// Adaptador Focus NFe compatível com a interface AdaptadorNFSe
const FocusNFeAdaptador: AdaptadorNFSe = {
  emitir: emitirNFSe,
  consultar: consultarNFSe,
  cancelar: cancelarNFSe,
};

export function resolverAdaptador(provedor?: string): AdaptadorNFSe {
  switch ((provedor ?? 'focusnfe') as ProvedorNFSe) {
    case 'brasilnfe': return BrasilNFeAdaptador;
    case 'focusnfe':
    default:          return FocusNFeAdaptador;
  }
}

/**
 * Resolve o token correto de acordo com o provedor configurado.
 * O config_fiscal do salão pode ter:
 *   - focus_nfe_token          → token próprio do salão na Focus NFe
 *   - brasilnfe_company_token  → CompanyToken obtido pelo Luarys ao registrar o CNPJ
 *                                 na Brasil NFe (modelo multi-tenant)
 */
export function resolverToken(configFiscal: any, provedor?: string): string | undefined {
  switch ((provedor ?? 'focusnfe') as ProvedorNFSe) {
    case 'brasilnfe': return configFiscal?.brasilnfe_company_token || undefined;
    case 'focusnfe':
    default:          return configFiscal?.focus_nfe_token || process.env.FOCUS_NFE_TOKEN || undefined;
  }
}

// Re-exporta buildPayloadNFSe (único para todos os provedores — a conversão é interna a cada adaptador)
export { buildPayloadNFSe };
export type { PayloadNFSe, ResultadoEmissao, ProvedorNFSe, AdaptadorNFSe };
