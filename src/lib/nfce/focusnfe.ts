import type { PayloadNFCe, RespostaFocusNFCe, ResultadoNFCe } from './tipos';
import {
  FOCUS_BASE_URL as BASE_URL,
  focusAuthHeader as authHeader,
  resolverTokenFocus,
  formatarErrosFocus,
} from '@/lib/fiscal/shared';

function resolverToken(tokenDb?: string): string {
  return resolverTokenFocus(tokenDb);
}

export async function emitirNFCe(referencia: string, payload: PayloadNFCe, tokenDb?: string): Promise<ResultadoNFCe> {
  const token = resolverToken(tokenDb);
  if (!token) {
    return { sucesso: false, status: 'erro', mensagem_erro: 'Token Focus NFe não configurado. Acesse Configurações → Nota Fiscal.' };
  }

  const resp = await fetch(`${BASE_URL}/nfce?ref=${referencia}`, {
    method: 'POST',
    headers: { Authorization: authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json: RespostaFocusNFCe = await resp.json();

  if (json.status === 'autorizado') {
    return {
      sucesso: true,
      status: 'autorizado',
      numero_nota: json.numero,
      chave: json.chave_nfe,
      link_danfe: json.caminho_danfe,
      link_xml: json.caminho_xml,
    };
  }

  if (json.status === 'processando') {
    return { sucesso: true, status: 'processando' };
  }

  return { sucesso: false, status: 'erro', mensagem_erro: formatarErrosFocus(json.erros, json.status) };
}

export async function consultarNFCe(referencia: string, tokenDb?: string): Promise<ResultadoNFCe> {
  const token = resolverToken(tokenDb);
  if (!token) return { sucesso: false, status: 'erro', mensagem_erro: 'Token Focus NFe não configurado.' };

  const resp = await fetch(`${BASE_URL}/nfce/${referencia}`, {
    headers: { Authorization: authHeader(token) },
  });

  const json: RespostaFocusNFCe = await resp.json();

  if (json.status === 'autorizado') {
    return {
      sucesso: true,
      status: 'autorizado',
      numero_nota: json.numero,
      chave: json.chave_nfe,
      link_danfe: json.caminho_danfe,
      link_xml: json.caminho_xml,
    };
  }

  if (json.status === 'processando') return { sucesso: true, status: 'processando' };

  return { sucesso: false, status: 'erro', mensagem_erro: formatarErrosFocus(json.erros, json.status) };
}

export async function uploadCertificadoFocus(cnpj: string, arquivo: Buffer, senha: string, tokenDb?: string): Promise<{ sucesso: boolean; erro?: string }> {
  const token = resolverToken(tokenDb);
  if (!token) return { sucesso: false, erro: 'Token Focus NFe não configurado.' };

  const form = new FormData();
  form.append('certificado', new Blob([new Uint8Array(arquivo)], { type: 'application/x-pkcs12' }), 'cert.pfx');
  form.append('senha', senha);

  const resp = await fetch(`${BASE_URL}/empresas/${cnpj.replace(/[.\-\/\s]/g, '').toUpperCase()}/certificado_pkcs12`, {
    method: 'PUT',
    headers: { Authorization: authHeader(token) },
    body: form,
  });

  if (resp.ok) return { sucesso: true };

  let erro = `HTTP ${resp.status}`;
  try { const j = await resp.json(); erro = j?.erros?.[0]?.mensagem || erro; } catch {}
  return { sucesso: false, erro };
}

export function buildPayloadNFCe(opts: {
  numero: number;
  salao: { cnpj: string; inscricao_estadual?: string; razao_social?: string; nome_fantasia?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string; cep?: string; codigo_ibge?: string; telefone?: string; config_fiscal?: any };
  config: { crt: string; serie: string; csc_token: string; csc_id: string };
  itens: Array<{ cProd: string; xProd: string; NCM: string; CFOP: string; uCom: string; qCom: string; vUnCom: string; vProd: string; orig: string; CSOSN: string }>;
  consumidor?: { CPF?: string; xNome?: string; email?: string };
  pagamentos: Array<{ tPag: string; vPag: string }>;
  desconto: number;
}): PayloadNFCe {
  const { numero, salao, config, itens, consumidor, pagamentos, desconto } = opts;
  const moedaParaFloat = (v: string | number) => parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;

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
    csc: config.csc_token,
    csc_id: config.csc_id,
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
