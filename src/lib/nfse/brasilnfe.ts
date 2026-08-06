/**
 * src/lib/nfse/brasilnfe.ts
 *
 * Adaptador Brasil NFe — único provedor da plataforma (Focus NFe removido).
 *
 * Fluxo:
 *  1. Admin registra o CNPJ do salão via POST /api/admin/brasilnfe/cadastrar
 *     (usa bnfe.empresa.adicionarEmpresa com o UserToken master da Luarys)
 *     → Brasil NFe retorna um Token exclusivo por empresa/CNPJ
 *     → Armazenado em saloes.config_fiscal.brasilnfe_company_token
 *  2. Certificado A1 do salão é enviado com esse Token (não o UserToken) via
 *     bnfe.empresa.alterarCertificado — ver submeterCertificadoA1 abaixo.
 *  3. Emissão de NFS-e via bnfe.notaFiscal.enviarNotaFiscalServico — ver emitir()
 *     abaixo. TipoAmbiente (1=produção/2=homologação) é lido de
 *     plataforma_nfse_config.ambiente, nunca hardcoded como produção.
 *
 * XML/PDF vêm em base64 no corpo da resposta (não como link) — são baixados e
 * guardados no bucket privado `notas-fiscais` (ver persistirArquivoBase64),
 * porque `notas_fiscais.link_pdf/link_xml` foram desenhadas pra URL pública.
 */

import { createClient } from '@supabase/supabase-js';
import { BrasilNFe, Empresa } from 'brasilnfe';
import type { EmpresaEnvio, NFSInfo } from 'brasilnfe';
import type { PayloadNFSe, ResultadoEmissao, AdaptadorNFSe } from './tipos';
import { limparCnpj } from '@/lib/cnpj';

// URL real confirmada no SDK oficial (brasilnfe.js: url padrão + "Empresa/").
// Única para sandbox e produção — o ambiente é um campo no payload, não a URL.
const EMPRESA_URL = 'https://api.brasilnfe.com.br/services/Empresa/';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET_NOTAS = 'notas-fiscais';

/**
 * Lê o ambiente configurado pela plataforma (Admin → NFS-e Luarys). Default
 * seguro é homologação (2) — só vira produção (1) se o admin explicitamente
 * configurar 'producao' nessa tela. Nunca hardcoded como produção no código.
 */
async function resolverTipoAmbiente(): Promise<1 | 2> {
  const { data } = await supabaseAdmin
    .from('plataforma_nfse_config')
    .select('ambiente')
    .eq('id', 1)
    .maybeSingle();
  return data?.ambiente === 'producao' ? 1 : 2;
}

async function persistirCodLote(referencia: string, codLote: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notas_fiscais')
    .update({ cod_lote_brasilnfe: codLote })
    .eq('id', referencia);
  if (error) console.error('[brasilnfe] falha ao gravar cod_lote_brasilnfe:', error.message);
}

/** Sobe o XML/PDF (base64 devolvido pela Brasil NFe) pro bucket privado — devolve o caminho salvo, não uma URL. */
async function persistirArquivoBase64(referencia: string, tipo: 'pdf' | 'xml', base64?: string): Promise<string | undefined> {
  if (!base64) return undefined;
  const caminho = `nfse/${referencia}.${tipo}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET_NOTAS).upload(caminho, Buffer.from(base64, 'base64'), {
    contentType: tipo === 'pdf' ? 'application/pdf' : 'application/xml',
    upsert: true,
  });
  if (error) {
    console.error(`[brasilnfe] falha ao subir ${tipo} da NFS-e ${referencia}:`, error.message);
    return undefined;
  }
  return caminho;
}

function montarTomador(payload: PayloadNFSe): NFSInfo['Tomador'] | undefined {
  const t = payload.tomador;
  if (!t) return undefined;
  return {
    CpfCnpj: t.cnpj || t.cpf,
    NmTomador: t.razao_social,
    Endereco: t.endereco ? {
      Logradouro: t.endereco.logradouro,
      Numero: t.endereco.numero,
      Complemento: t.endereco.complemento,
      Bairro: t.endereco.bairro,
      CodMunicipio: t.endereco.codigo_municipio,
      Uf: t.endereco.uf,
      Cep: t.endereco.cep,
    } : undefined,
    Contato: t.email ? { Email: t.email } : undefined,
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

  const servico = payload.servicos[0];
  const tipoAmbiente = await resolverTipoAmbiente();
  const bnfe = new BrasilNFe(companyToken);

  try {
    const resp = await bnfe.notaFiscal.enviarNotaFiscalServico({
      TipoAmbiente: tipoAmbiente,
      nFSInfo: [{
        IdentificadorInterno: referencia,
        DataEmissao: payload.data_emissao,
        // Competencia do ISS. Omitido, o provedor usa a data de emissao.
        DataCompetencia: payload.data_competencia,
        Tomador: montarTomador(payload),
        Servico: {
          Descricao: servico.descricao,
          ItemListaServico: servico.item_lista_servico,
          NaturezaOperacao: payload.natureza_operacao ?? 1,
          IncentivadorCultural: payload.incentivador_cultural ?? false,
          IssRetido: servico.iss_retido,
          CodTributacaoMunicipio: servico.codigo_tributario_municipio,
          // Sem o regime especial a prefeitura nao sabe que o prestador e
          // optante do Simples, e o enquadramento do servico nao fecha.
          RegimeEspecialTributacao: payload.regime_especial_tributacao,
          CodigoCnae: servico.codigo_cnae,
          CodNBS: servico.codigo_nbs,
          Valores: {
            ValorServico: servico.valor_servico,
            Aliquota: servico.aliquota * 100, // SDK espera percentual (%), payload interno guarda fração
            ValorDeducoes: servico.valor_deducoes,
          },
        },
      }],
    });

    if (resp.Error) return { sucesso: false, status: 'erro', mensagem_erro: resp.Error };

    if (resp.CodLote) await persistirCodLote(referencia, resp.CodLote);

    // StatusLote: 1=processado, 2=aguardando processamento na prefeitura
    if (resp.StatusLote === 2) return { sucesso: true, status: 'processando' };

    const nota = resp.Notas?.[0];
    if (!nota || nota.Status !== 1) {
      return { sucesso: false, status: 'erro', mensagem_erro: nota?.Erro || 'Erro desconhecido ao emitir NFS-e.' };
    }

    const [storage_path_pdf, storage_path_xml] = await Promise.all([
      persistirArquivoBase64(referencia, 'pdf', nota.Base64Doc),
      persistirArquivoBase64(referencia, 'xml', nota.Base64Xml),
    ]);

    return {
      sucesso: true,
      status: 'autorizado',
      numero_nota: nota.NumeroNFSe,
      storage_path_pdf,
      storage_path_xml,
      ...retornoDaPrefeitura(nota, resp.Protocolo),
    };
  } catch (e: any) {
    return { sucesso: false, status: 'erro', mensagem_erro: e?.message || 'Erro ao comunicar com a Brasil NFe.' };
  }
}

/**
 * Campos que a prefeitura devolve junto com a nota e que antes eram descartados.
 *
 * A chave de acesso e a que abre a nota no portal nacional — fonte oficial, vale
 * mais que PDF guardado. Os Valores sao o que a PREFEITURA apurou: comparar com
 * o que enviamos e a unica forma de perceber enquadramento errado sem abrir nota
 * por nota (uma aliquota devolvida diferente da enviada e o sintoma).
 */
function retornoDaPrefeitura(nota: any, protocolo?: string) {
  const num = (v: any) => (v === null || v === undefined || v === '' ? undefined : Number(v));
  return {
    chave_acesso: nota?.Chave || undefined,
    rps_numero: nota?.NumeroRPS != null ? String(nota.NumeroRPS) : undefined,
    codigo_verificacao: nota?.CodVerificacao || undefined,
    protocolo_sefaz: protocolo || undefined,
    base_calculo: num(nota?.Valores?.BaseCalculo),
    valor_iss: num(nota?.Valores?.ValorISS),
    aliquota_apurada: num(nota?.Valores?.Aliquota),
  };
}

async function consultar(referencia: string, companyToken?: string): Promise<ResultadoEmissao> {
  if (!companyToken) return { sucesso: false, status: 'erro', mensagem_erro: 'Salão não registrado na Brasil NFe.' };

  const { data: nota } = await supabaseAdmin
    .from('notas_fiscais')
    .select('cod_lote_brasilnfe')
    .eq('id', referencia)
    .maybeSingle();

  if (!nota?.cod_lote_brasilnfe) {
    return { sucesso: false, status: 'erro', mensagem_erro: 'Nota sem lote registrado — emita novamente antes de consultar.' };
  }

  const tipoAmbiente = await resolverTipoAmbiente();
  const bnfe = new BrasilNFe(companyToken);

  try {
    const resp = await bnfe.consultas.buscarNotaFiscalServico({ codLote: nota.cod_lote_brasilnfe });
    if (resp.Error) return { sucesso: false, status: 'erro', mensagem_erro: resp.Error };

    if (resp.StatusLote === 2) return { sucesso: true, status: 'processando' };

    const notaInfo = resp.Notas?.[0];
    if (!notaInfo || notaInfo.Status !== 1) {
      return { sucesso: false, status: 'erro', mensagem_erro: notaInfo?.Erro || 'Erro desconhecido ao consultar NFS-e.' };
    }

    const [storage_path_pdf, storage_path_xml] = await Promise.all([
      persistirArquivoBase64(referencia, 'pdf', notaInfo.Base64Doc),
      persistirArquivoBase64(referencia, 'xml', notaInfo.Base64Xml),
    ]);

    return {
      sucesso: true,
      status: 'autorizado',
      numero_nota: notaInfo.NumeroNFSe,
      storage_path_pdf,
      storage_path_xml,
      ...retornoDaPrefeitura(notaInfo, resp.Protocolo),
    };
  } catch (e: any) {
    return { sucesso: false, status: 'erro', mensagem_erro: e?.message || 'Erro ao comunicar com a Brasil NFe.' };
  }
}

async function cancelar(referencia: string, justificativa: string, companyToken?: string, codigoMotivo: number = 1): Promise<{ sucesso: boolean; erro?: string }> {
  if (!companyToken) return { sucesso: false, erro: 'Salão não registrado na Brasil NFe.' };
  if ((justificativa || '').trim().length < 15) {
    return { sucesso: false, erro: 'Justificativa precisa ter pelo menos 15 caracteres.' };
  }

  const { data: nota } = await supabaseAdmin
    .from('notas_fiscais')
    .select('numero_nota')
    .eq('id', referencia)
    .maybeSingle();

  if (!nota?.numero_nota) {
    return { sucesso: false, erro: 'Nota sem número — não é possível cancelar antes da emissão ser confirmada.' };
  }

  const tipoAmbiente = await resolverTipoAmbiente();
  const bnfe = new BrasilNFe(companyToken);

  try {
    const resp = await bnfe.eventos.cancelarNotaFiscal({
      TipoDocumento: 1, // 1 = NFS-e (usa NumeroNFSe, não ChaveNF)
      NumeroNFSe: nota.numero_nota,
      // 1 erro na emissão · 2 serviço não prestado · 3 duplicidade · 9 outros.
      // É este código que a prefeitura lê; a justificativa em texto é
      // complemento. Ficava fixo em 1, então cancelar por serviço não prestado
      // declarava erro nosso na emissão — informação falsa ao fisco.
      CodCancelamentoNFSe: codigoMotivo,
      TipoAmbiente: tipoAmbiente,
      Justificativa: justificativa,
      DataEvento: new Date().toISOString(),
    });

    if (resp.Error) return { sucesso: false, erro: resp.Error };
    return { sucesso: true };
  } catch (e: any) {
    return { sucesso: false, erro: e?.message || 'Erro ao comunicar com a Brasil NFe.' };
  }
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
