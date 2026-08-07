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
  /** CNAE do prestador, sem pontuacao (ex: 9602501). */
  codigo_cnae?: string;
  /** NBS do servico (Lei da Transparencia 12.741/12), ex: 126021000. */
  codigo_nbs?: string;
}

export interface PayloadNFSe {
  data_emissao: string;
  /**
   * Data da prestacao do servico. Define a competencia do ISS — sem ela o
   * provedor assume a data de emissao, jogando nota retroativa na competencia
   * errada.
   */
  data_competencia?: string;
  natureza_operacao?: 1 | 2 | 3 | 4 | 5 | 6;
  optante_simples_nacional?: boolean;
  /**
   * 0 sem regime especial | 1 microempresa municipal | 2 estimativa
   * 3 sociedade de profissionais | 4 cooperativa | 5 MEI Simples Nacional
   * 6 ME/EPP Simples Nacional
   */
  regime_especial_tributacao?: number;
  incentivador_cultural?: boolean;
  prestador: PrestadorNFSe;
  tomador?: TomadorNFSe;
  servicos: ServicoNFSe[];
}

export interface ResultadoEmissao {
  sucesso: boolean;
  status: 'autorizado' | 'processando' | 'erro';
  numero_nota?: string;
  link_pdf?: string;
  link_xml?: string;
  /** Caminho no bucket privado `notas-fiscais` (Brasil NFe devolve XML/PDF em base64, não como link público). */
  storage_path_pdf?: string;
  storage_path_xml?: string;
  mensagem_erro?: string;
  /** Chave de acesso: abre a nota no portal nacional, que é a fonte oficial. */
  chave_acesso?: string;
  rps_numero?: string;
  protocolo_sefaz?: string;
  /**
   * Não existe no padrão nacional — é campo da Nota Carioca. Mantido só para
   * nota antiga que ainda o tenha; quem faz esse papel hoje é a chave de acesso.
   */
  codigo_verificacao?: string;
  /**
   * `dhProc` do XML: quando a prefeitura processou de verdade. Diferente do
   * momento em que descobrimos — lote que fica dias em processamento seria
   * gravado na competência errada se usássemos a hora da consulta.
   */
  data_autorizacao?: string;
  /** Valores que a PREFEITURA apurou — comparar com o que enviamos revela enquadramento errado. */
  base_calculo?: number;
  valor_iss?: number;
  aliquota_apurada?: number;
}

export interface AdaptadorNFSe {
  emitir(referencia: string, payload: PayloadNFSe, token?: string): Promise<ResultadoEmissao>;
  consultar(referencia: string, token?: string): Promise<ResultadoEmissao>;
  /** codigoMotivo: 1 erro na emissao · 2 servico nao prestado · 3 duplicidade · 9 outros. */
  cancelar(referencia: string, justificativa: string, token?: string, codigoMotivo?: number): Promise<{ sucesso: boolean; erro?: string }>;
}
