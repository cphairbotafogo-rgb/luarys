/**
 * src/lib/nfse/index.ts
 *
 * Barrel do módulo NFS-e — Brasil NFe é o único provedor (Focus NFe removido).
 */

export { BrasilNFeAdaptador } from './brasilnfe';
export { buildPayloadNFSe } from './payload';
export type { AdaptadorNFSe, PayloadNFSe, ResultadoEmissao } from './tipos';
