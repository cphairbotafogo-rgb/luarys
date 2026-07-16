import type { PayloadNFSe, RespostaFocusNFSe, ResultadoEmissao } from './tipos';
import {
  FOCUS_BASE_URL as BASE_URL,
  focusAuthHeader as authHeader,
  resolverTokenFocus,
  fetchFocusComRetry as fetchComRetry,
  formatarErrosFocus,
} from '@/lib/fiscal/shared';

function resolverToken(tokenDb?: string): string {
  return resolverTokenFocus(tokenDb);
}

export async function emitirNFSe(referencia: string, payload: PayloadNFSe, tokenDb?: string): Promise<ResultadoEmissao> {
  const token = resolverToken(tokenDb);
  if (!token) {
    return { sucesso: false, status: 'erro', mensagem_erro: 'Token Focus NFe não configurado. Acesse Configurações → Nota Fiscal.' };
  }

  const resp = await fetchComRetry(`${BASE_URL}/nfse?ref=${referencia}`, {
    method: 'POST',
    headers: { Authorization: authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json: RespostaFocusNFSe = await resp.json();

  if (json.status === 'autorizado') {
    return {
      sucesso: true,
      status: 'autorizado',
      numero_nota: json.numero,
      link_pdf: json.link_pdf_nfse,
      link_xml: json.link_xml_nfse,
    };
  }

  if (json.status === 'processando') {
    return { sucesso: true, status: 'processando' };
  }

  return { sucesso: false, status: 'erro', mensagem_erro: formatarErrosFocus(json.erros, json.status) };
}

export async function consultarNFSe(referencia: string, tokenDb?: string): Promise<ResultadoEmissao> {
  const token = resolverToken(tokenDb);
  if (!token) return { sucesso: false, status: 'erro', mensagem_erro: 'Token Focus NFe não configurado.' };

  const resp = await fetch(`${BASE_URL}/nfse/${referencia}?completa=1`, {
    headers: { Authorization: authHeader(token) },
  });

  const json: RespostaFocusNFSe = await resp.json();

  if (json.status === 'autorizado') {
    return {
      sucesso: true,
      status: 'autorizado',
      numero_nota: json.numero,
      link_pdf: json.link_pdf_nfse,
      link_xml: json.link_xml_nfse,
    };
  }

  if (json.status === 'processando') {
    return { sucesso: true, status: 'processando' };
  }

  return { sucesso: false, status: 'erro', mensagem_erro: formatarErrosFocus(json.erros, json.status) };
}

export async function cancelarNFSe(referencia: string, justificativa: string, tokenDb?: string): Promise<{ sucesso: boolean; erro?: string }> {
  const token = resolverToken(tokenDb);
  if (!token) return { sucesso: false, erro: 'Token Focus NFe não configurado.' };

  const resp = await fetch(`${BASE_URL}/nfse/${referencia}`, {
    method: 'DELETE',
    headers: { Authorization: authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ justificativa }),
  });

  return { sucesso: resp.ok, erro: resp.ok ? undefined : `HTTP ${resp.status}` };
}

export function buildPayloadNFSe(opts: {
  salao: {
    cnpj: string;
    inscricao_municipal?: string;
    codigo_ibge?: string;
    regime_tributario?: string;  // campo direto de saloes (Dados da Empresa)
    config_fiscal?: any;
  };
  nota: { cliente_nome?: string; cliente_cpf?: string; descricao_servico: string; valor: number; item_lista_servico?: string };
}): PayloadNFSe {
  const { salao, nota } = opts;
  const aliquota = parseFloat(salao.config_fiscal?.aliquota_padrao || '2.00') / 100;
  // Regime tributário: usa o campo direto do salão (Dados da Empresa) primeiro,
  // e cai para config_fiscal se não estiver preenchido (compatibilidade com configuração do admin)
  const regime = salao.regime_tributario || salao.config_fiscal?.regime_tributario || '';
  const simples = ['Simples Nacional', 'MEI'].includes(regime);

  // Horário de Brasília (UTC-3) — evita registrar data do dia seguinte na SEFAZ
  // quando a nota é emitida depois das 21h local (servidor em UTC)
  const agora = new Date();
  const localBrasilia = agora.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const dataEmissao = localBrasilia.replace(' ', 'T') + '-03:00';

  const payload: PayloadNFSe = {
    data_emissao: dataEmissao,
    natureza_operacao: 1,
    optante_simples_nacional: simples,
    incentivador_cultural: false,
    prestador: {
      cnpj: (salao.cnpj || '').replace(/[.\-\/\s]/g, '').toUpperCase(),
      inscricao_municipal: salao.inscricao_municipal || undefined,
      codigo_municipio: salao.codigo_ibge || '',
    },
    servicos: [{
      aliquota,
      base_calculo: nota.valor,
      descricao: nota.descricao_servico || 'Serviços de beleza',
      iss_retido: false,
      item_lista_servico: nota.item_lista_servico || '06.01',
      valor_servico: nota.valor,
    }],
  };

  if (nota.cliente_nome) {
    payload.tomador = {
      razao_social: nota.cliente_nome,
      cpf: nota.cliente_cpf ? nota.cliente_cpf.replace(/\D/g, '') : undefined,
    };
  }

  return payload;
}
