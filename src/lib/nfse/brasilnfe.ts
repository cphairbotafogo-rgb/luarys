/**
 * src/lib/nfse/brasilnfe.ts
 *
 * Adaptador Brasil NFe — modelo MULTI-TENANT.
 *
 * Fluxo (confirmado em 30/07/2026 contra o SDK oficial `brasilnfe` no npm
 * e a documentação real em brasilnfe.com.br/api — as funções abaixo que
 * dependiam de endpoint/URL adivinhados foram corrigidas):
 *  1. Admin registra o CNPJ do salão via POST /api/admin/brasilnfe/cadastrar
 *     (usa bnfe.empresa.adicionarEmpresa com o UserToken master da Luarys)
 *     → Brasil NFe retorna um Token exclusivo por empresa/CNPJ
 *     → Armazenado em saloes.config_fiscal.brasilnfe_company_token
 *  2. Certificado A1 do salão é enviado com esse Token (não o UserToken) via
 *     bnfe.empresa.alterarCertificado — ver submeterCertificadoA1 abaixo.
 *
 * ⚠️ emitir/consultar/cancelar (emissão de NFS-e) AINDA NÃO foram reescritos
 * contra o SDK real — continuam no modelo antigo (endpoint adivinhado) e vão
 * falhar até essa etapa ser feita. A API real devolve XML/PDF em base64 no
 * corpo da resposta (não como link), o que exige decidir onde armazenar esses
 * arquivos (Supabase Storage) antes de implementar — não adivinhar aqui.
 */

import { createClient } from '@supabase/supabase-js';
import { Empresa } from 'brasilnfe';
import type { EmpresaEnvio } from 'brasilnfe';
import type { PayloadNFSe, ResultadoEmissao, AdaptadorNFSe } from './tipos';
import { limparCnpj } from '@/lib/cnpj';

// URL real confirmada no SDK oficial (brasilnfe.js: url padrão + "Empresa/").
// Única para sandbox e produção — o ambiente é um campo no payload, não a URL.
const EMPRESA_URL = 'https://api.brasilnfe.com.br/services/Empresa/';

const BASE_URL_PROD  = 'https://api.brasilnfe.com.br/v1';
const BASE_URL_HOMOL = 'https://homologacao.brasilnfe.com.br/v1'; // ⚠️ domínio não existe — só usado pelas funções antigas abaixo, ainda não corrigidas

// URL base usada pelas funções antigas (emitir/consultar/cancelar) — NÃO usar em código novo
function baseUrl(): string {
  return process.env.BRASIL_NFE_AMBIENTE === 'producao' ? BASE_URL_PROD : BASE_URL_HOMOL;
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
// Confirmado contra o SDK oficial: bnfe.empresa.alterarCertificado, método
// "AlterarCertificado". Exige o Token DA EMPRESA (devolvido por
// adicionarEmpresa e salvo em config_fiscal.brasilnfe_company_token) — não o
// UserToken master. Ou seja, o salão só pode enviar o certificado DEPOIS de o
// admin ter cadastrado o CNPJ dele na Brasil NFe (ver /api/admin/brasilnfe/cadastrar).
// A resposta (CertificadoRetorno) não devolve nenhum token novo — só confirma
// o status e a validade do certificado.

export interface ResultadoCertificado {
  sucesso?: boolean;
  expirado?: boolean;
  dataExpiracao?: string;
  erro?: string;
}

/**
 * Envia o certificado A1 do salão para a Brasil NFe.
 * @param companyToken Token da empresa (config_fiscal.brasilnfe_company_token) — NÃO o UserToken.
 */
export async function submeterCertificadoA1(
  certificadoBase64: string,
  senha: string,
  companyToken: string,
): Promise<ResultadoCertificado> {
  try {
    const empresa = new Empresa(companyToken, EMPRESA_URL, '');
    const resp = await empresa.alterarCertificado({
      Base64CertificateFile: certificadoBase64,
      Senha: senha,
    });

    if (resp.Error) return { erro: resp.Error };

    return {
      sucesso: resp.status !== false,
      expirado: resp.Expirado,
      dataExpiracao: resp.DtExpiracao,
    };
  } catch (e: any) {
    return { erro: e?.message || 'Erro ao comunicar com a Brasil NFe.' };
  }
}

// ── Cadastro de empresa (Admin → Registrar Salão na Brasil NFe) ─────────────
// Confirmado contra o SDK oficial e a doc pública (brasilnfe.com.br/api/empresas#adicionar):
// POST .../Empresa/AdicionarEmpresa, headers Token (vazio aqui — empresa ainda
// não existe) + UserToken (master Luarys), devolve `token` exclusivo da empresa.

export interface ResultadoCadastroEmpresa {
  token?: string;
  erro?: string;
}

export async function cadastrarEmpresa(
  userToken: string,
  dados: EmpresaEnvio,
): Promise<ResultadoCadastroEmpresa> {
  try {
    const empresa = new Empresa('', EMPRESA_URL, userToken);
    const resp = await empresa.adicionarEmpresa(dados);

    if (resp.Error) return { erro: resp.Error };
    if (!resp.token) return { erro: 'Brasil NFe não retornou o token da empresa. Resposta: ' + JSON.stringify(resp) };

    return { token: resp.token };
  } catch (e: any) {
    return { erro: e?.message || 'Erro ao comunicar com a Brasil NFe.' };
  }
}

// ── Cadastro automático (chamado pelo admin OU pelo webhook de pagamento) ───
// Fluxo único compartilhado: busca CNPJ/endereço do salão, busca o UserToken
// master da Luarys, chama cadastrarEmpresa e persiste o token retornado em
// config_fiscal. Nunca lança — quem chamar decide se trata o erro como
// bloqueante (rota manual) ou apenas loga (automação pós-pagamento).

// 1=Simples Nacional, 3=Regime Normal (Brasil NFe não distingue MEI de Simples aqui)
function crtDoRegime(regime?: string | null): number {
  const r = (regime || '').toLowerCase();
  if (r.includes('lucro')) return 3;
  return 1;
}

export async function cadastrarEmpresaLuarys(salaoId: string): Promise<ResultadoCadastroEmpresa> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: salao, error: salaoErr } = await supabaseAdmin
    .from('saloes')
    .select('cnpj, razao_social, nome_fantasia, inscricao_municipal, codigo_ibge, email_fiscal, regime_tributario, config_fiscal, cep, logradouro, numero, complemento, bairro, cidade, estado')
    .eq('id', salaoId)
    .single();

  if (salaoErr || !salao) return { erro: 'Salão não encontrado.' };

  const cnpj = limparCnpj(salao.cnpj);
  if (cnpj.length !== 14) return { erro: 'CNPJ do salão inválido ou não cadastrado.' };
  if (!salao.cep) return { erro: 'CEP do salão não cadastrado (Dados da Empresa).' };

  const { data: cfg } = await supabaseAdmin
    .from('plataforma_nfse_config')
    .select('token_brasilnfe')
    .eq('id', 1)
    .maybeSingle();
  const userToken = process.env.BRASIL_NFE_USER_TOKEN || cfg?.token_brasilnfe || '';
  if (!userToken) return { erro: 'UserToken Brasil NFe não configurado (Admin → NFS-e Luarys).' };

  const resultado = await cadastrarEmpresa(userToken, {
    CNPJ: cnpj,
    RzSocial: salao.razao_social || salao.nome_fantasia || '',
    NmFantasia: salao.nome_fantasia || undefined,
    IM: salao.inscricao_municipal || undefined,
    CRT: crtDoRegime(salao.regime_tributario),
    CodigoInterno: salaoId,
    Contato: salao.email_fiscal ? { Email: salao.email_fiscal } : undefined,
    Endereco: {
      Cep: salao.cep,
      Logradouro: salao.logradouro || undefined,
      Numero: salao.numero || undefined,
      Complemento: salao.complemento || undefined,
      Bairro: salao.bairro || undefined,
      CodMunicipio: salao.codigo_ibge || undefined,
      Municipio: salao.cidade || undefined,
      Uf: salao.estado || undefined,
    },
  });

  if (resultado.erro || !resultado.token) return resultado;

  const novoConfigFiscal = {
    ...(salao.config_fiscal || {}),
    brasilnfe_company_token: resultado.token,
    brasilnfe_cadastrado_em: new Date().toISOString(),
  };

  const { error: updateErr } = await supabaseAdmin
    .from('saloes')
    .update({ config_fiscal: novoConfigFiscal })
    .eq('id', salaoId);

  if (updateErr) return { erro: 'Cadastrado na Brasil NFe, mas falhou ao salvar o token: ' + updateErr.message };

  return { token: resultado.token };
}
