export interface EmitenteNFCe {
  cnpj: string;
  inscricao_estadual?: string;
  regime_tributario: 1 | 2 | 3; // 1=Simples, 2=Lucro Presumido, 3=Lucro Real
  nome: string;
  fantasia?: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  codigo_municipio: string;
  pais?: string;
  telefone?: string;
}

export interface DestinatarioNFCe {
  cpf?: string;
  nome?: string;
  email?: string;
}

export interface ItemNFCe {
  numero_item: string;
  codigo_produto: string;
  codigo_ean: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade_comercial: string;
  quantidade_comercial: number;
  valor_unitario_comercial: number;
  valor_bruto: number;
  codigo_ean_tributavel: string;
  unidade_tributavel: string;
  quantidade_tributavel: number;
  valor_unitario_tributavel: number;
  inclui_no_total: 0 | 1;
  valor_desconto?: number;
  icms_modalidade: string;
  icms_csosn: string;
  icms_origem: string;
  pis_modalidade: string;
  cofins_modalidade: string;
}

export interface PagamentoNFCe {
  forma_pagamento: string;
  valor_pagamento: number;
}

export interface PayloadNFCe {
  numero: number;
  serie: string;
  data_emissao: string;
  finalidade_emissao: 1 | 2 | 3 | 4;
  consumidor_final: 0 | 1;
  presenca_comprador: 1 | 2 | 3 | 4 | 5 | 9;
  natureza_operacao: string;
  emitente: EmitenteNFCe;
  destinatario?: DestinatarioNFCe;
  items: ItemNFCe[];
  pagamentos: PagamentoNFCe[];
  valor_produtos: number;
  valor_desconto: number;
  valor_total: number;
  valor_pis: number;
  valor_cofins: number;
  csc: string;
  csc_id: string;
  informacoes_adicionais_contribuinte?: string;
}

export interface RespostaFocusNFCe {
  status: 'autorizado' | 'processando' | 'erro' | 'cancelado' | 'denegado';
  numero?: string;
  serie?: string;
  chave_nfe?: string;
  data_emissao?: string;
  caminho_danfe?: string;
  caminho_xml?: string;
  erros?: Array<{ codigo: string; mensagem: string; correcao?: string }>;
}

export interface ResultadoNFCe {
  sucesso: boolean;
  status: 'autorizado' | 'processando' | 'erro';
  numero_nota?: string;
  chave?: string;
  link_danfe?: string;
  link_xml?: string;
  mensagem_erro?: string;
}
