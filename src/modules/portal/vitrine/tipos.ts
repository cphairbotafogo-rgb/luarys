// Tipos e constantes do módulo Vitrine de Produtos
// Sem 'use client', sem React — importado por todos os arquivos do módulo.

export interface ProdutoVitrine {
  id: string;
  nome_produto: string;
  categoria: string;
  subcategoria?: string;
  preco_venda: number;
  quantidade_atual: number;
  unidade_medida: string;
  imagem_url?: string;
  descricao_vitrine?: string;
}

export interface ItemCarrinho {
  produto: ProdutoVitrine;
  quantidade: number;
}

export interface VitrineConfig {
  salao_id: string;
  modo: 'desativada' | 'catalogo' | 'pedido' | 'compra';
  ativo: boolean;
}

export type ModoVitrine = VitrineConfig['modo'];

export const MODO_LABEL: Record<ModoVitrine, string> = {
  desativada: 'Desativada',
  catalogo:   'Só Catálogo',
  pedido:     'Pedido / Encomenda',
  compra:     'Compra com PIX',
};

export const MODO_DESCRICAO: Record<ModoVitrine, string> = {
  desativada: 'Vitrine não aparece para as clientes.',
  catalogo:   'Clientes veem os produtos, preços e descrições — sem compra.',
  pedido:     'Clientes montam a lista e enviam pedido via WhatsApp.',
  compra:     'Clientes compram direto com PIX — baixa automática de estoque.',
};

export function totalCarrinho(carrinho: ItemCarrinho[]): number {
  return carrinho.reduce((s, i) => s + i.produto.preco_venda * i.quantidade, 0);
}
