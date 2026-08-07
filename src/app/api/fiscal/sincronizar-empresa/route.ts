/**
 * POST /api/fiscal/sincronizar-empresa
 *
 * Empurra os dados fiscais do salão para o cadastro dele na Brasil NFe.
 *
 * O cadastro lá é criado uma única vez, quando o módulo fiscal é ativado. Tudo
 * que o salão editar depois — inscrição estadual, CNAE, endereço, razão social —
 * fica só no nosso banco, e o provedor segue com o retrato antigo. Ninguém
 * percebe, porque a NFS-e continua saindo; o buraco só aparece na NFC-e, que
 * exige inscrição estadual.
 *
 * Foi exatamente o que aconteceu com o salão piloto: a IE estava preenchida na
 * tela desde sempre e chegava à Brasil NFe como "".
 *
 * Chamada depois de salvar Dados da Empresa. Falha aqui não desfaz o que já foi
 * gravado no nosso banco — o dado do salão é a fonte, o provedor é a cópia.
 */
import { NextRequest, NextResponse } from 'next/server';
import { autenticarRota } from '@/lib/apiAuth';
import { sincronizarEmpresaLuarys } from '@/lib/nfse/brasilnfe';

export async function POST(req: NextRequest) {
  const { perfil, erro } = await autenticarRota(req, 'POST /api/fiscal/sincronizar-empresa');
  if (erro) return erro;

  const resultado = await sincronizarEmpresaLuarys(perfil!.salao_id);

  // 422 e não 500: salão sem módulo fiscal ativo não é erro do sistema, é
  // estado normal — a maioria dos salões nunca vai ter empresa lá.
  if (!resultado.sucesso) {
    return NextResponse.json({ erro: resultado.erro }, { status: 422 });
  }
  return NextResponse.json({ sucesso: true, alterados: resultado.alterados ?? [] });
}
