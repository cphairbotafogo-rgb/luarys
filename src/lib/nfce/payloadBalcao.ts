/**
 * src/lib/nfce/payloadBalcao.ts
 *
 * Monta o corpo de /api/nfce/emitir a partir de uma venda de balcão fechada no
 * Fechamento de Caixa (itens tipo 'produto' com o objeto `fiscal`), e depois
 * converte esse corpo (junto com dados do salão) no PayloadNFCe genérico que
 * o adaptador de provedor (src/lib/nfce/brasilnfe.ts) consome.
 *
 * ⚠️ A API (buildPayloadNFCe) usa moedaParaFloat, que espera valores em formato
 * BRASILEIRO ("10,50"). Por isso vUnCom/vProd/vPag são formatados com ptBR — se
 * mandarmos "10.50" a nota sai com valor errado.
 */
import type { PayloadNFCe } from './tipos';

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

function moedaParaFloat(v: string | number): number {
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}

export function buildPayloadNFCe(opts: {
  numero: number;
  salao: { cnpj: string; inscricao_estadual?: string; razao_social?: string; nome_fantasia?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string; cep?: string; codigo_ibge?: string; telefone?: string; config_fiscal?: any };
  config: { crt: string; serie: string };
  itens: Array<{ cProd: string; xProd: string; NCM: string; CFOP: string; uCom: string; qCom: string; vUnCom: string; vProd: string; orig: string; CSOSN: string }>;
  consumidor?: { CPF?: string; xNome?: string; email?: string };
  pagamentos: Array<{ tPag: string; vPag: string }>;
  desconto: number;
}): PayloadNFCe {
  const { numero, salao, config, itens, consumidor, pagamentos, desconto } = opts;

  const crtNum = parseInt(config.crt);
  const regime: 1 | 2 | 3 = (crtNum >= 1 && crtNum <= 3) ? (crtNum as 1 | 2 | 3) : 1;

  const items = itens.map((it, idx) => {
    const qtd = parseFloat(it.qCom) || 1;
    const vUnit = moedaParaFloat(it.vUnCom);
    const vBruto = moedaParaFloat(it.vProd);
    return {
      numero_item: String(idx + 1),
      codigo_produto: it.cProd || String(idx + 1).padStart(3, '0'),
      codigo_ean: 'SEM GTIN',
      descricao: it.xProd,
      ncm: (it.NCM || '33049900').replace(/[.\-\/\s]/g, '').toUpperCase(),
      cfop: it.CFOP || '5102',
      // Reforma Tributaria: vazio deixa o adaptador usar o padrao do provedor.
      cclasstrib: (it as any).cClassTrib || undefined,
      unidade_comercial: it.uCom || 'UN',
      quantidade_comercial: qtd,
      valor_unitario_comercial: vUnit,
      valor_bruto: vBruto,
      codigo_ean_tributavel: 'SEM GTIN',
      unidade_tributavel: it.uCom || 'UN',
      quantidade_tributavel: qtd,
      valor_unitario_tributavel: vUnit,
      inclui_no_total: 1 as const,
      valor_desconto: 0,
      icms_modalidade: it.CSOSN || '102',
      icms_csosn: it.CSOSN || '102',
      icms_origem: it.orig || '0',
      pis_modalidade: '07',
      cofins_modalidade: '07',
    };
  });

  const totalProdutos = items.reduce((acc, it) => acc + it.valor_bruto, 0);
  const totalFinal = Math.max(0, totalProdutos - desconto);

  const pags = pagamentos.map(p => ({
    forma_pagamento: p.tPag,
    valor_pagamento: moedaParaFloat(p.vPag),
  })).filter(p => p.valor_pagamento > 0);

  const payload: PayloadNFCe = {
    numero,
    serie: config.serie || '001',
    data_emissao: new Date().toISOString(),
    finalidade_emissao: 1,
    consumidor_final: 1,
    presenca_comprador: 1,
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    emitente: {
      cnpj: (salao.cnpj || '').replace(/[.\-\/\s]/g, '').toUpperCase(),
      inscricao_estadual: salao.inscricao_estadual || undefined,
      regime_tributario: regime,
      nome: salao.razao_social || salao.nome_fantasia || '',
      fantasia: salao.nome_fantasia || undefined,
      logradouro: salao.logradouro || '',
      numero: salao.numero || 'S/N',
      complemento: salao.complemento || undefined,
      bairro: salao.bairro || '',
      municipio: salao.cidade || '',
      uf: salao.estado || '',
      cep: (salao.cep || '').replace(/[.\-\/\s]/g, '').toUpperCase(),
      codigo_municipio: salao.codigo_ibge || '',
      pais: '1058',
      telefone: salao.telefone ? salao.telefone.replace(/\D/g, '') : undefined,
    },
    items,
    pagamentos: pags,
    valor_produtos: totalProdutos,
    valor_desconto: desconto,
    valor_total: totalFinal,
    valor_pis: 0,
    valor_cofins: 0,
  };

  if (consumidor?.CPF) {
    payload.destinatario = {
      cpf: consumidor.CPF.replace(/[.\-\/\s]/g, '').toUpperCase(),
      nome: consumidor.xNome || undefined,
      email: consumidor.email || undefined,
    };
  }

  return payload;
}
