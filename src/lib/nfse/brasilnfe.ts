/**
 * src/lib/nfse/brasilnfe.ts
 *
 * Adaptador Brasil NFe — modelo MULTI-TENANT.
 *
 * Fluxo:
 *  1. Admin registra o CNPJ do salão via POST /api/admin/brasilnfe/cadastrar
 *     → Brasil NFe retorna um CompanyToken exclusivo por CNPJ
 *     → Armazenado em saloes.config_fiscal.brasilnfe_company_token
 *
 *  2. Para emitir, usamos o CompanyToken no header Authorization.
 *     Não há token global — cada salão tem o seu próprio.
 *
 * Documentação: https://brasilnfe.com.br/api (confirmar endpoints com a Brasil NFe antes de produção)
 */

import type { PayloadNFSe, ResultadoEmissao, AdaptadorNFSe } from './tipos';

const BASE_URL_PROD  = 'https://api.brasilnfe.com.br/v1';
const BASE_URL_HOMOL = 'https://homologacao.brasilnfe.com.br/v1';

// URL base usada para EMISSÃO (CompanyToken) e GESTÃO (UserToken)
export function baseUrl(): string {
  return process.env.BRASIL_NFE_AMBIENTE === 'producao' ? BASE_URL_PROD : BASE_URL_HOMOL;
}

// UserToken da Luarys (master) — lido do banco pelo admin route, nunca usado para emissão
export function userTokenHeaders(userToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${userToken}`,
    'Content-Type': 'application/json',
  };
}

function companyTokenHeaders(companyToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${companyToken}`,
    'Content-Type': 'application/json',
  };
}

async function fetchComRetry(url: string, options: RequestInit, tentativas = 3): Promise<Response> {
  const delays = [2000, 5000];
  for (let i = 0; i < tentativas; i++) {
    try {
      const resp = await fetch(url, options);
      if (resp.status < 500) return resp;
      if (i < tentativas - 1) await new Promise(r => setTimeout(r, delays[i]));
    } catch (err) {
      if (i === tentativas - 1) throw err;
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
  throw new Error('Brasil NFe não respondeu após 3 tentativas.');
}

function converterPayload(payload: PayloadNFSe): Record<string, any> {
  const servico = payload.servicos[0];
  return {
    prestador_cnpj:               payload.prestador.cnpj,
    prestador_inscricao_municipal: payload.prestador.inscricao_municipal,
    prestador_codigo_municipio:    payload.prestador.codigo_municipio,

    ...(payload.tomador ? {
      tomador_razao_social: payload.tomador.razao_social,
      tomador_cpf:          payload.tomador.cpf,
      tomador_cnpj:         payload.tomador.cnpj,
      tomador_email:        payload.tomador.email,
    } : {}),

    servico_descricao:    servico.descricao,
    servico_valor:        servico.valor_servico,
    servico_aliquota_iss: servico.aliquota * 100,
    servico_item_lista:   servico.item_lista_servico,
    servico_iss_retido:   servico.iss_retido,
    servico_base_calculo: servico.base_calculo,

    data_emissao:            payload.data_emissao,
    natureza_operacao:       payload.natureza_operacao ?? 1,
    optante_simples_nacional: payload.optante_simples_nacional ?? false,
    incentivador_cultural:   payload.incentivador_cultural ?? false,
  };
}

async function emitir(referencia: string, payload: PayloadNFSe, companyToken?: string): Promise<ResultadoEmissao> {
  if (!companyToken) {
    return {
      sucesso: false,
      status: 'erro',
      mensagem_erro: 'Salão não registrado na Brasil NFe. Solicite ao administrador do Luarys que faça o cadastro do CNPJ.',
    };
  }

  const resp = await fetchComRetry(
    `${baseUrl()}/nfse?referencia=${referencia}`,
    {
      method: 'POST',
      headers: companyTokenHeaders(companyToken),
      body: JSON.stringify(converterPayload(payload)),
    }
  );

  const json = await resp.json().catch(() => ({}));

  if (json.status === 'autorizado' || json.situacao === 'autorizado') {
    return {
      sucesso: true,
      status: 'autorizado',
      numero_nota: json.numero_nfse ?? json.numero,
      link_pdf: json.url_pdf ?? json.link_pdf,
      link_xml: json.url_xml ?? json.link_xml,
    };
  }

  if (json.status === 'processando' || json.situacao === 'em_processamento') {
    return { sucesso: true, status: 'processando' };
  }

  const msgErro = json.mensagem
    ?? json.erros?.map((e: any) => `[${e.codigo}] ${e.mensagem}`).join('; ')
    ?? `HTTP ${resp.status}`;

  return { sucesso: false, status: 'erro', mensagem_erro: msgErro };
}

async function consultar(referencia: string, companyToken?: string): Promise<ResultadoEmissao> {
  if (!companyToken) return { sucesso: false, status: 'erro', mensagem_erro: 'Salão não registrado na Brasil NFe.' };

  const resp = await fetch(`${baseUrl()}/nfse/${referencia}`, {
    headers: companyTokenHeaders(companyToken),
  });

  const json = await resp.json().catch(() => ({}));

  if (json.status === 'autorizado' || json.situacao === 'autorizado') {
    return {
      sucesso: true,
      status: 'autorizado',
      numero_nota: json.numero_nfse ?? json.numero,
      link_pdf: json.url_pdf ?? json.link_pdf,
      link_xml: json.url_xml ?? json.link_xml,
    };
  }

  if (json.status === 'processando' || json.situacao === 'em_processamento') {
    return { sucesso: true, status: 'processando' };
  }

  return { sucesso: false, status: 'erro', mensagem_erro: json.mensagem ?? `HTTP ${resp.status}` };
}

async function cancelar(referencia: string, justificativa: string, companyToken?: string): Promise<{ sucesso: boolean; erro?: string }> {
  if (!companyToken) return { sucesso: false, erro: 'Salão não registrado na Brasil NFe.' };

  const resp = await fetch(`${baseUrl()}/nfse/${referencia}/cancelar`, {
    method: 'POST',
    headers: companyTokenHeaders(companyToken),
    body: JSON.stringify({ justificativa }),
  });

  return { sucesso: resp.ok, erro: resp.ok ? undefined : `HTTP ${resp.status}` };
}

export const BrasilNFeAdaptador: AdaptadorNFSe = { emitir, consultar, cancelar };

// ── Certificado A1 ──────────────────────────────────────────────────────────

export interface ResultadoCertificado {
  /** Retornado quando a Brasil NFe processa de forma síncrona */
  companyToken?: string;
  /** Retornado quando o processamento é assíncrono (webhook entrega o token depois) */
  protocolo?: string;
  erro?: string;
}

/**
 * Envia o certificado A1 do salão para a Brasil NFe.
 *
 * TODO (preencher quando tiver a documentação):
 *  - Confirmar o endpoint: provavelmente POST /company/{cnpj}/certificate
 *  - Confirmar se aceita base64 no body JSON ou multipart/form-data
 *  - Confirmar se a resposta é síncrona (devolve company_token) ou assíncrona (devolve protocolo + webhook)
 *  - Confirmar o nome exato dos campos no body e na response
 *
 * Referência do padrão de auth: UserToken da Luarys (não CompanyToken do salão).
 * O UserToken fica em process.env.BRASIL_NFE_USER_TOKEN.
 */
export async function submeterCertificadoA1(
  cnpj: string,
  certificadoBase64: string,
  senha: string,
  userToken: string,
): Promise<ResultadoCertificado> {
  // TODO: ajustar URL e body conforme documentação da Brasil NFe
  const resp = await fetchComRetry(
    `${baseUrl()}/company/${cnpj}/certificate`,
    {
      method: 'POST',
      headers: userTokenHeaders(userToken),
      body: JSON.stringify({ certificado: certificadoBase64, senha }),
    },
  );

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    return { erro: json.mensagem ?? json.message ?? `HTTP ${resp.status}` };
  }

  // Cenário A — síncrono: Brasil NFe devolve o CompanyToken já processado
  if (json.company_token ?? json.companyToken) {
    return { companyToken: json.company_token ?? json.companyToken };
  }

  // Cenário B — assíncrono: Brasil NFe devolve um protocolo e manda webhook depois
  if (json.protocolo ?? json.protocol) {
    return { protocolo: json.protocolo ?? json.protocol };
  }

  return { erro: 'Resposta inesperada da Brasil NFe. Verificar documentação do endpoint de certificado.' };
}
