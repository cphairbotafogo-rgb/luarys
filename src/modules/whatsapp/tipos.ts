export type CategoriaMensagemWhatsapp =
  | 'servico'
  | 'utilidade'
  | 'marketing'
  | 'autenticacao';

export type TipoCarteira = 'atendimento' | 'campanha';
export type MeioPagamento = 'pix' | 'cartao_credito' | 'cartao_debito';

export interface SaldoWhatsapp {
  saldoAtendimento: number;
  saldoCampanha: number;
}

export interface PacoteWhatsapp {
  id: string;
  tipo: TipoCarteira;
  quantidade: number;
  preco: number;
}

export interface ConsumoAgrupado {
  categoria: CategoriaMensagemWhatsapp;
  origem: TipoCarteira | 'automatico';
  quantidade: number;
  custoTotal: number;
}

export type NivelSaldo = 'confortavel' | 'baixo' | 'zerado';

const LIMITE_SALDO_BAIXO = 50;

export function calcularNivelSaldo(saldo: number): NivelSaldo {
  if (saldo <= 0) return 'zerado';
  if (saldo <= LIMITE_SALDO_BAIXO) return 'baixo';
  return 'confortavel';
}

export interface DetalheCustoPacote {
  precoTotal: number;
  custoMeta: number;
  taxaPagamento: number;
  imposto: number;
  liquidoReal: number;
  margemPercentual: number;
}

const CUSTO_META_ATENDIMENTO = 0.035;
const CUSTO_META_CAMPANHA    = 0.3217;

export function calcularDetalheCustoPacote(
  pacote: PacoteWhatsapp,
  meioPagamento: MeioPagamento,
  aliquotaSimples: number,
): DetalheCustoPacote {
  const taxaPercentual =
    meioPagamento === 'pix'           ? 0.0099 :
    meioPagamento === 'cartao_debito' ? 0.0199 : 0.0399;

  const custoMetaUnitario = pacote.tipo === 'atendimento' ? CUSTO_META_ATENDIMENTO : CUSTO_META_CAMPANHA;
  const custoMeta    = pacote.quantidade * custoMetaUnitario;
  const taxaPagamento = pacote.preco * taxaPercentual;
  const imposto      = pacote.preco * aliquotaSimples;
  const liquidoReal  = pacote.preco - custoMeta - taxaPagamento - imposto;

  return {
    precoTotal: pacote.preco,
    custoMeta,
    taxaPagamento,
    imposto,
    liquidoReal,
    margemPercentual: pacote.preco > 0 ? (liquidoReal / pacote.preco) * 100 : 0,
  };
}
