/**
 * GET /api/assinatura/cartao-salvo
 *
 * Diz se o salão já tem cartão cadastrado e qual — para a tela poder perguntar
 * "confirmar R$ X no Mastercard •8829?" antes de cobrar.
 *
 * Devolve bandeira e últimos quatro dígitos. NUNCA o token: com ele daria para
 * disparar cobrança, e o navegador não precisa dele para nada. Quem cobra é o
 * servidor.
 */
import { NextRequest, NextResponse } from 'next/server';
import { autenticarRota } from '@/lib/apiAuth';
import { cartaoSalvoDoSalao } from '@/lib/assinaturas';

export async function GET(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'GET /api/assinatura/cartao-salvo');
  if (erro) return erro;

  const cartao = await cartaoSalvoDoSalao(perfil!.salao_id);
  if (!cartao) return NextResponse.json({ tem: false });

  return NextResponse.json({
    tem: true,
    ultimos4: cartao.ultimos4,
    bandeira: cartao.bandeira,
  });
}
