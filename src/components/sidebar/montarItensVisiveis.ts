/**
 * Aplica, NESSA ORDEM:
 *   1. Permissão/RBAC — sempre primeiro, nunca pode ser pulado
 *   2. Preferência pessoal de ordem/ocultos, só sobre os itens editáveis
 *
 * Itens fixos (ItemSidebar.fixo === true) nunca são afetados pelo passo 2
 * — sempre aparecem, sempre na posição original do catálogo.
 */
import type { ItemSidebar } from './catalogoItensSidebar';
import type { PreferenciasSidebar } from './usePreferenciasSidebar';

export function montarItensVisiveis(
  catalogo: ItemSidebar[],
  perfil: any,
  preferencias: PreferenciasSidebar
): ItemSidebar[] {
  // Passo 1 — RBAC filtra o que existe para esse login
  const permitidos = catalogo.filter(item => item.condicao(perfil));

  const fixos = permitidos.filter(item => item.fixo);
  const editaveis = permitidos.filter(item => !item.fixo);

  // Passo 2 — remove ocultos e ordena conforme preferência do login
  const visiveis = editaveis.filter(item => !preferencias.ocultos.includes(item.id));

  const ordenados = [...visiveis].sort((a, b) => {
    const posA = preferencias.ordem.indexOf(a.id);
    const posB = preferencias.ordem.indexOf(b.id);
    // Sem posição salva → vai para o final, mantendo a ordem padrão do catálogo
    if (posA === -1 && posB === -1) return 0;
    if (posA === -1) return 1;
    if (posB === -1) return -1;
    return posA - posB;
  });

  return mesclarPorSecao(catalogo, ordenados, fixos);
}

function mesclarPorSecao(
  catalogoCompleto: ItemSidebar[],
  editaveisOrdenados: ItemSidebar[],
  fixos: ItemSidebar[]
): ItemSidebar[] {
  const secoes: ItemSidebar['secao'][] = ['Operação', 'Gestão & Negócio', 'Fiscal & Ajustes'];
  const resultado: ItemSidebar[] = [];

  secoes.forEach(secao => {
    resultado.push(
      ...editaveisOrdenados.filter(i => i.secao === secao),
      ...fixos.filter(i => i.secao === secao),
    );
  });

  return resultado;
}
