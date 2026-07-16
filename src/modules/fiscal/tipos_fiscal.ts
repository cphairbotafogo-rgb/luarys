export type AmbienteFiscal      = 'homologacao' | 'producao';
export type ModoFaturamento     = 'direto' | 'centralizado';
export type StatusCertificado   = 'pendente' | 'enviado' | 'valido' | 'expirado' | 'invalido';
export type TipoDocumentoFiscal = 'nfse' | 'nfce';

export interface StatusFiscal {
  cnpj: string;
  ambiente: AmbienteFiscal;
  nfseAtivo: boolean;
  nfseFaturamento: ModoFaturamento | null;
  nfceAtivo: boolean;
  nfceFaturamento: ModoFaturamento | null;
  certificadoStatus: StatusCertificado;
  certificadoValidade: string | null;
}

export interface EmissaoFiscal {
  id: string;
  tipo: TipoDocumentoFiscal;
  numeroDocumento: string | null;
  chaveAcesso: string | null;
  status: 'emitida' | 'rejeitada' | 'cancelada';
  valor: number | null;
  criadoEm: string;
}

export interface AtivarModuloFiscalInput {
  salaoId: string;
  tipo: TipoDocumentoFiscal;
  faturamento: ModoFaturamento;
  ambiente: AmbienteFiscal;
}

export function certificadoPrecisaAtencao(status: StatusCertificado): boolean {
  return status === 'pendente' || status === 'expirado' || status === 'invalido';
}

export function moduloPodeEmitir(statusFiscal: StatusFiscal, tipo: TipoDocumentoFiscal): boolean {
  const ativo = tipo === 'nfse' ? statusFiscal.nfseAtivo : statusFiscal.nfceAtivo;
  return ativo && statusFiscal.certificadoStatus === 'valido' && statusFiscal.ambiente === 'producao';
}
