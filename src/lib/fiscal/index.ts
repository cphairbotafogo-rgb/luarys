/**
 * src/lib/fiscal/index.ts
 *
 * Ponto de entrada unificado para o módulo fiscal do Luarys.
 * Re-exporta o core compartilhado e os adaptadores de cada nota fiscal.
 *
 * Uso:
 *   import { FOCUS_BASE_URL, focusAuthHeader } from '@/lib/fiscal';
 *   import * as nfse from '@/lib/nfse/focusnfe';
 *   import * as nfce from '@/lib/nfce/focusnfe';
 */

export * from './shared';

// Os adaptadores específicos são importados diretamente dos seus módulos
// para não criar acoplamento circular. Use os caminhos abaixo:
//   NFS-e: '@/lib/nfse/focusnfe' ou '@/lib/nfse' (roteador de provedores)
//   NFC-e: '@/lib/nfce/focusnfe'
