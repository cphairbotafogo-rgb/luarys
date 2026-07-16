export type TabNFSe = 'estabelecimento' | 'configuracoes' | 'informacoes' | 'certificado';

export interface FormEstabelecimento {
  nome_fantasia: string;
  cnpj: string;
  razao_social: string;
  inscricao_municipal: string;
}

export const CFG_INICIAL = {
  regime_tributario: 'Simples Nacional',
  aliquota_padrao: '2.00',
  modo_emissao: 'Lote Manual',
  codigo_ibge: '',
  item_lista_servico: '6.01',
  codigo_tributacao_municipio: '',
  optante_simples: true,
  cpf_emissor: '',
  pis_percentual: '0.65',
  cofins_percentual: '3.00',
  regime_especial_tributacao: '',
  cmc: '',
  cnae: '',
  nao_enviar_cnae: false,
  desconto_operadora: false,
  emitir_padrao_nacional: false,
};

export type FormConfiguracao = typeof CFG_INICIAL;

export const NBS_BELEZA = [
  { codigo: '1.2602.10.00', descricao: 'Cabeleireiros (corte, coloração, penteados e congêneres)' },
  { codigo: '1.2602.20.00', descricao: 'Manicure e pedicure' },
  { codigo: '1.2602.30.00', descricao: 'Tratamentos de beleza do rosto (limpeza de pele, hidratação, peelings)' },
  { codigo: '1.2602.40.00', descricao: 'Maquiagem' },
  { codigo: '1.2602.50.00', descricao: 'Depilação' },
  { codigo: '1.2602.60.00', descricao: 'Massagem, reflexologia e serviços de bem-estar' },
  { codigo: '1.2602.90.00', descricao: 'Outros serviços de cuidados pessoais de beleza e estética' },
];

export const LC116_BELEZA = [
  { item: '6.01', descricao: 'Barbearia, cabeleireiros, manicuros, pedicuros e congêneres' },
  { item: '6.02', descricao: 'Esteticistas, tratamento de pele, depilação e congêneres' },
  { item: '6.03', descricao: 'Banhos, duchas, sauna, massagens, ginástica e congêneres' },
  { item: '6.04', descricao: 'Centros de emagrecimento, spa e congêneres' },
  { item: '14.13', descricao: 'Tatuar e consertar bens / piercing' },
];
