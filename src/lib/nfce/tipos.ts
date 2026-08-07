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
  /**
   * Codigo de Classificacao Tributaria do IBS/CBS (Reforma Tributaria).
   * Vazio = usa o padrao "000001" do provedor. Depende do que a mercadoria e e
   * de qual anexo se aplica — quem define e a contabilidade do salao.
   */
  cclasstrib?: string;
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
  /** Vestigial — CSC era exigido pela Focus NFe; a Brasil NFe não usa, gerencia isso por CNPJ do lado dela. */
  csc?: string;
  csc_id?: string;
  informacoes_adicionais_contribuinte?: string;
}

export interface ResultadoNFCe {
  sucesso: boolean;
  status: 'autorizado' | 'processando' | 'erro';
  numero_nota?: string;
  chave?: string;
  /** Caminho no bucket privado `notas-fiscais` (Brasil NFe devolve XML/DANFE em base64, não como link público). */
  storage_path_danfe?: string;
  storage_path_xml?: string;
  mensagem_erro?: string;
}

export interface AdaptadorNFCe {
  emitir(referencia: string, payload: PayloadNFCe, token?: string): Promise<ResultadoNFCe>;
  consultar(referencia: string, token?: string): Promise<ResultadoNFCe>;
  cancelar(referencia: string, justificativa: string, token?: string): Promise<{ sucesso: boolean; erro?: string }>;
}
