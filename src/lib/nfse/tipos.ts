export interface PrestadorNFSe {
  cnpj: string;
  inscricao_municipal?: string;
  codigo_municipio: string;
}

export interface TomadorNFSe {
  cpf?: string;
  cnpj?: string;
  razao_social?: string;
  email?: string;
  endereco?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    codigo_municipio: string;
    uf: string;
    cep: string;
  };
}

export interface ServicoNFSe {
  aliquota: number;
  base_calculo: number;
  descricao: string;
  iss_retido: boolean;
  item_lista_servico: string;
  valor_servico: number;
  valor_deducoes?: number;
  codigo_tributario_municipio?: string;
}

export interface PayloadNFSe {
  data_emissao: string;
  natureza_operacao?: 1 | 2 | 3 | 4 | 5 | 6;
  optante_simples_nacional?: boolean;
  incentivador_cultural?: boolean;
  prestador: PrestadorNFSe;
  tomador?: TomadorNFSe;
  servicos: ServicoNFSe[];
}

export interface RespostaFocusNFSe {
  status: 'autorizado' | 'processando' | 'erro' | 'cancelado';
  numero?: string;
  codigo_verificacao?: string;
  data_emissao?: string;
  link_pdf_nfse?: string;
  link_xml_nfse?: string;
  caminho_xml_nfse?: string;
  erros?: Array<{ codigo: string; mensagem: string; correcao?: string }>;
}

export interface ResultadoEmissao {
  sucesso: boolean;
  status: 'autorizado' | 'processando' | 'erro';
  numero_nota?: string;
  link_pdf?: string;
  link_xml?: string;
  mensagem_erro?: string;
}

export type ProvedorNFSe = 'focusnfe' | 'brasilnfe';

export interface AdaptadorNFSe {
  emitir(referencia: string, payload: PayloadNFSe, token?: string): Promise<ResultadoEmissao>;
  consultar(referencia: string, token?: string): Promise<ResultadoEmissao>;
  cancelar(referencia: string, justificativa: string, token?: string): Promise<{ sucesso: boolean; erro?: string }>;
}
