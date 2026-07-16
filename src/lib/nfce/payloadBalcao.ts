/**
 * src/lib/nfce/payloadBalcao.ts
 *
 * Monta o corpo de /api/nfce/emitir a partir de uma venda de balcão fechada no
 * Fechamento de Caixa (itens tipo 'produto' com o objeto `fiscal`).
 *
 * ⚠️ A API (buildPayloadNFCe) usa moedaParaFloat, que espera valores em formato
 * BRASILEIRO ("10,50"). Por isso vUnCom/vProd/vPag são formatados com ptBR — se
 * mandarmos "10.50" a nota sai com valor errado.
 */

function ptBR(n: number): string {
  return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Formas de pagamento do Caixa → códigos SEFAZ (tPag)
const COD_TPAG: Record<string, string> = {
  dinheiro: '01',
  credito: '03',
  debito: '04',
  pix: '17',
  sinalOnline: '17',
  cheque: '99',
  prePago: '99',
};

export interface CorpoNFCe {
  itens: Array<{ cProd: string; xProd: string; NCM: string; CFOP: string; uCom: string; qCom: string; vUnCom: string; vProd: string; orig: string; CSOSN: string }>;
  consumidor?: { CPF: string; xNome?: string };
  pagamentos: Array<{ tPag: string; vPag: string }>;
  desconto: number;
}

export function construirPayloadNfceBalcao(dadosCaixa: any): CorpoNFCe {
  const produtos = (dadosCaixa?.servicos || []).filter((s: any) => s.tipo === 'produto');

  const itens = produtos.map((s: any) => {
    const f = s.fiscal || {};
    const qtd = Number(s.qtd) || 1;
    const preco = Number(s.preco) || 0;
    return {
      cProd: f.cprod || String(s.produto_id || '').substring(0, 8),
      xProd: f.xprod || s.nome,
      NCM: f.ncm || '',
      CFOP: f.cfop || '5102',
      uCom: f.unidade || 'UN',
      qCom: String(qtd),
      vUnCom: ptBR(preco),
      vProd: ptBR(preco * qtd),
      orig: f.origem || '0',
      CSOSN: f.csosn || '102',
    };
  });

  // Agrupa os valores pagos por código SEFAZ
  const p = dadosCaixa?.pagamentos || {};
  const buckets: Record<string, number> = {};
  for (const [chave, cod] of Object.entries(COD_TPAG)) {
    const v = Number(p[chave]) || 0;
    if (v > 0) buckets[cod] = (buckets[cod] || 0) + v;
  }
  const pagamentos = Object.entries(buckets).map(([tPag, v]) => ({ tPag, vPag: ptBR(v) }));

  const desconto = produtos.reduce((a: number, s: any) => a + (Number(s.desconto) || 0), 0);

  const consumidor = dadosCaixa?.clienteCpf
    ? { CPF: String(dadosCaixa.clienteCpf), xNome: dadosCaixa.clienteNome || undefined }
    : undefined;

  return { itens, consumidor, pagamentos, desconto };
}
