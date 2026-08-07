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
    // NAO e 'erro'. Excecao aqui e falha de comunicacao — timeout, conexao
    // caida, resposta ilegivel — e nenhuma delas diz se a Brasil NFe recebeu.
    // Marcar 'erro' liberava o reenvio (a rota aceita reemitir nota em 'Erro'),
    // e se a nota tinha sido aceita, o reenvio emite uma SEGUNDA nota do mesmo
    // servico. Duplicidade em nota fiscal e problema com a prefeitura, nao com
    // a tela.
    //
    // 'processando' obriga a passar pela consulta antes de reenviar, que e
    // exatamente o que resolve a duvida.
    console.error(`[brasilnfe] emissao ${referencia} sem resposta conclusiva: ${e?.message}`);
    return {
      sucesso: true,
      status: 'processando',
      mensagem_erro: 'Sem resposta da Brasil NFe. A nota pode ter sido emitida — consulte antes de tentar de novo.',
    };
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
/**
 * Lê o que a prefeitura devolveu direto do XML autorizado.
 *
 * A versão anterior procurava `nota.Chave`, `nota.CodVerificacao` e
 * `nota.Valores.*` no JSON da Brasil NFe. Esses nomes não existem na resposta:
 * de 486 notas emitidas, 486 guardaram o XML e apenas **uma** guardou a chave.
 * Todas as outras ficaram sem chave, sem protocolo e sem valor de ISS — e a
 * chave é o que prova a emissão fora do nosso banco.
 *
 * O XML é o padrão nacional (`sped.fazenda.gov.br/nfse`) e tem tudo:
 *
 *   infNFSe/@Id      NFS + 50 caracteres da chave de acesso
 *   nNFSe            número da NFS-e
 *   dhProc           data/hora em que a prefeitura processou — a emissão REAL
 *   nDFSe            número do documento no ambiente nacional (faz de protocolo)
 *   cStat            100 = autorizado
 *   infDPS/nDPS      número do DPS, equivalente ao RPS
 *   vServPrest/vServ base de cálculo
 *   vTotTribMun      ISS
 *
 * `codigo_verificacao` NÃO é preenchido de propósito: não existe no padrão
 * nacional. É campo da Nota Carioca, e quem faz esse papel aqui é a chave.
 *
 * Extração por expressão regular, não por parser de XML: a estrutura é fixa e
 * definida por leiaute, e não vale trazer dependência nova para ler sete campos.
 */
export function lerXmlNFSe(xml: string) {
  const tag = (nome: string) => {
    const m = xml.match(new RegExp(`<${nome}>([^<]*)</${nome}>`));
    return m?.[1]?.trim() || undefined;
  };
  const num = (v?: string) => (v === undefined || v === '' ? undefined : Number(v));

  // `NFS` + 50 dígitos. O prefixo é do atributo Id, não faz parte da chave.
  const chave = xml.match(/<infNFSe[^>]*\bId="NFS(\d{50})"/)?.[1];

  return {
    chave_acesso: chave,
    numero_nota: tag('nNFSe'),
    // Primeiro <nDPS> do documento está dentro do infDPS — é o nosso RPS.
    rps_numero: tag('nDPS'),
    protocolo_sefaz: tag('nDFSe'),
    autorizado: tag('cStat') === '100',
    data_autorizacao: tag('dhProc'),
    base_calculo: num(tag('vServ')),
    valor_iss: num(tag('vTotTribMun')),
  };
}

function retornoDaPrefeitura(nota: any, protocolo?: string) {
  const num = (v: any) => (v === null || v === undefined || v === '' ? undefined : Number(v));

  // O XML manda: é o documento assinado que vale, e é o único lugar onde a
  // chave aparece. O JSON só completa o que ele não trouxer.
  const doXml = nota?.Base64Xml
    ? lerXmlNFSe(Buffer.from(nota.Base64Xml, 'base64').toString('utf8'))
    : undefined;

  return {
    chave_acesso: doXml?.chave_acesso || nota?.Chave || undefined,
    rps_numero: doXml?.rps_numero ?? (nota?.NumeroRPS != null ? String(nota.NumeroRPS) : undefined),
    protocolo_sefaz: doXml?.protocolo_sefaz || protocolo || undefined,
    data_autorizacao: doXml?.data_autorizacao,
    base_calculo: doXml?.base_calculo ?? num(nota?.Valores?.BaseCalculo),
    valor_iss: doXml?.valor_iss ?? num(nota?.Valores?.ValorISS),
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
    .select('cnpj, razao_social, nome_fantasia, inscricao_municipal, inscricao_estadual, cnae, codigo_ibge, email_fiscal, regime_tributario, config_fiscal, cep, logradouro, numero, complemento, bairro, cidade, estado')
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
    // IE e CNAE nao eram enviados, e a Brasil NFe guardava IE:"" e CNAE:null.
    // Para NFS-e nao fazia falta; para NFC-e faz: e documento ESTADUAL, e sem
    // inscricao estadual a SEFAZ nao autoriza. O dado ja estava no nosso
    // cadastro — so nunca chegava la.
    IE: String(salao.inscricao_estadual ?? '').replace(/\D/g, '') || undefined,
    CNAE: String(salao.cnae ?? '').replace(/\D/g, '') || undefined,
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

// ─── CSC da NFC-e ───────────────────────────────────────────────────────────
//
// O CSC (Código de Segurança do Contribuinte) é emitido pela SEFAZ do estado e
// assina o QR Code do DANFE NFC-e. Sem ele a NFC-e não é autorizada.
//
// Ele mora na CONFIGURAÇÃO DA EMPRESA na Brasil NFe, não no payload da nota —
// foi por ler o payload e não achar campo que eu concluí, errado, que "a Brasil
// NFe não usa CSC". Usa: Configuracao.NFCe.{IdCSC,CSC}{Homologacao,Producao}.
//
// Não guardamos o CSC no nosso banco, mesma regra do certificado A1: credencial
// de cliente atravessa o sistema e fica com o provedor. O que o salão digita vai
// direto para lá e não volta.
//
// editarEmpresa substitui o cadastro inteiro, então lê o atual antes de mesclar
// — mandar só o bloco NFCe apagaria endereço, IE e contato.
export async function submeterCscNFCe(
  companyToken: string,
  userToken: string,
  csc: { idHomologacao?: string; cscHomologacao?: string; idProducao?: string; cscProducao?: string },
): Promise<{ sucesso: boolean; erro?: string }> {
  if (!companyToken || !userToken) return { sucesso: false, erro: 'Salão não registrado na Brasil NFe.' };

  const informado = [csc.idHomologacao, csc.cscHomologacao, csc.idProducao, csc.cscProducao].some(v => String(v ?? '').trim());
  if (!informado) return { sucesso: false, erro: 'Informe ao menos um par de ID e código CSC.' };

  try {
    const bnfe = new BrasilNFe(companyToken, userToken);
    const atual = await bnfe.empresa.buscarEmpresa();
    if (!atual?.CNPJ) return { sucesso: false, erro: 'Não foi possível ler o cadastro na Brasil NFe.' };

    const limpo = (v?: string) => { const t = String(v ?? '').trim(); return t || undefined; };

    const resp = await bnfe.empresa.editarEmpresa({
      ...atual,
      Configuracao: {
        ...(atual.Configuracao ?? {}),
        NFCe: {
          ...(atual.Configuracao?.NFCe ?? {}),
          IdCSCHomologacao: limpo(csc.idHomologacao) ?? atual.Configuracao?.NFCe?.IdCSCHomologacao,
          CSCHomologacao:   limpo(csc.cscHomologacao) ?? atual.Configuracao?.NFCe?.CSCHomologacao,
          IdCSCProducao:    limpo(csc.idProducao) ?? atual.Configuracao?.NFCe?.IdCSCProducao,
          CSCProducao:      limpo(csc.cscProducao) ?? atual.Configuracao?.NFCe?.CSCProducao,
        },
      },
    });

    if (!resp?.status) return { sucesso: false, erro: resp?.Error || 'A Brasil NFe recusou a alteração.' };
    return { sucesso: true };
  } catch (e: any) {
    return { sucesso: false, erro: e?.message || 'Erro ao comunicar com a Brasil NFe.' };
  }
}

// ─── Sincronizar cadastro já existente ──────────────────────────────────────
//
// cadastrarEmpresaLuarys só roda uma vez, na criação. Se um dado do salão muda
// depois — ou se, como aconteceu, o código nunca enviou um campo — a empresa na
// Brasil NFe fica desatualizada e ninguém percebe: a NFS-e continua saindo, e o
// buraco só aparece na NFC-e, que exige IE.
//
// Esta função lê o cadastro atual lá, mescla o que temos aqui e devolve. Mescla
// em vez de substituir porque editarEmpresa troca o registro inteiro — e o CSC,
// que fica só do lado deles, seria apagado.
export async function sincronizarEmpresaLuarys(
  salaoId: string,
): Promise<{ sucesso: boolean; erro?: string; alterados?: string[] }> {
  const { data: salao } = await supabaseAdmin
    .from('saloes')
    .select('cnpj, razao_social, nome_fantasia, inscricao_municipal, inscricao_estadual, cnae, codigo_ibge, email_fiscal, regime_tributario, config_fiscal, cep, logradouro, numero, complemento, bairro, cidade, estado')
    .eq('id', salaoId)
    .maybeSingle();

  const companyToken = salao?.config_fiscal?.brasilnfe_company_token;
  if (!companyToken) return { sucesso: false, erro: 'Salão não cadastrado na Brasil NFe.' };

  const { data: cfg } = await supabaseAdmin
    .from('plataforma_nfse_config').select('token_brasilnfe').eq('id', 1).maybeSingle();
  const userToken = process.env.BRASIL_NFE_USER_TOKEN || cfg?.token_brasilnfe || '';
  if (!userToken) return { sucesso: false, erro: 'UserToken Brasil NFe não configurado.' };

  const soDigitos = (v: any) => String(v ?? '').replace(/\D/g, '') || undefined;

  try {
    const bnfe = new BrasilNFe(companyToken, userToken);
    const atual = await bnfe.empresa.buscarEmpresa();
    if (!atual?.CNPJ) return { sucesso: false, erro: 'Não foi possível ler o cadastro na Brasil NFe.' };

    const novo = {
      ...atual,
      RzSocial:  salao!.razao_social || atual.RzSocial,
      NmFantasia: salao!.nome_fantasia || atual.NmFantasia,
      IM: soDigitos(salao!.inscricao_municipal) ?? atual.IM,
      IE: soDigitos(salao!.inscricao_estadual) ?? atual.IE,
      CNAE: soDigitos(salao!.cnae) ?? atual.CNAE,
      CRT: crtDoRegime(salao!.regime_tributario) ?? atual.CRT,
      Endereco: {
        ...(atual.Endereco ?? {}),
        Cep: soDigitos(salao!.cep) ?? atual.Endereco?.Cep,
        Logradouro: salao!.logradouro || atual.Endereco?.Logradouro,
        Numero: salao!.numero || atual.Endereco?.Numero,
        Complemento: salao!.complemento || atual.Endereco?.Complemento,
        Bairro: salao!.bairro || atual.Endereco?.Bairro,
        CodMunicipio: soDigitos(salao!.codigo_ibge) ?? atual.Endereco?.CodMunicipio,
        Municipio: salao!.cidade || atual.Endereco?.Municipio,
        Uf: salao!.estado || atual.Endereco?.Uf,
      },
    };

    const alterados = (['IE', 'IM', 'CNAE', 'CRT'] as const)
      .filter(k => String(atual[k] ?? '') !== String(novo[k] ?? ''))
      .map(String);
    if (String(atual.Endereco?.Uf ?? '') !== String(novo.Endereco.Uf ?? '')) alterados.push('UF');

    const resp = await bnfe.empresa.editarEmpresa(novo);
    if (!resp?.status) return { sucesso: false, erro: resp?.Error || 'A Brasil NFe recusou a atualização.' };

    return { sucesso: true, alterados };
  } catch (e: any) {
    return { sucesso: false, erro: e?.message || 'Erro ao comunicar com a Brasil NFe.' };
  }
}

/**
 * Exclui a empresa do salão na Brasil NFe, para parar a cobrança daquele CNPJ.
 *
 * A Brasil NFe confirmou em 07/08/2026 que **não existe suspender**: a única
 * forma de deixar de pagar por um CNPJ é deletar a empresa. Reativar depois é
 * recadastrar. Sem esta chamada, salão que cancela o módulo fiscal continua
 * sendo cobrado de nós todo mês, para sempre — o Asaas para de cobrar o salão e
 * a conta fica com a Luarys.
 *
 * Duas garantias que eles deram e que este código depende:
 *  · os XML ficam guardados 5 anos e continuam consultáveis depois da exclusão,
 *    então não é preciso arquivar nada antes;
 *  · cancelando **antes do próximo ciclo** o boleto nem chega a ser gerado — por
 *    isso a chamada acontece no fim do período pago, junto com o desligamento do
 *    módulo, e não no clique de cancelar.
 *
 * O `brasilnfe_company_token` é PRESERVADO. Apagá-lo, como esta função fazia
 * antes, cegava a consulta das notas já emitidas: `consultar()` e `cancelar()`
 * recebem justamente esse token. A Brasil NFe guarda os XML por 5 anos, mas de
 * nada adianta se perdermos a chave para perguntar — e guarda fiscal de 5 anos
 * é obrigação do salão, não conveniência nossa.
 *
 * Quem passa a barrar a emissão é `brasilnfe_excluido_em`: enquanto estiver
 * preenchido, o CNPJ não está mais habilitado do lado deles, e tentar emitir só
 * produziria erro do provedor sem explicação para o salão.
 */
export async function excluirEmpresaLuarys(
  salaoId: string,
): Promise<{ sucesso: boolean; erro?: string; jaEstavaFora?: boolean }> {
  const { data: salao } = await supabaseAdmin
    .from('saloes').select('cnpj, config_fiscal').eq('id', salaoId).maybeSingle();

  const companyToken = salao?.config_fiscal?.brasilnfe_company_token;
  // Sem token não há o que excluir — e isso não é falha: é o estado de quem
  // nunca ativou o módulo fiscal, ou de quem já foi excluído antes.
  if (!companyToken) return { sucesso: true, jaEstavaFora: true };

  const { data: cfg } = await supabaseAdmin
    .from('plataforma_nfse_config').select('token_brasilnfe').eq('id', 1).maybeSingle();
  const userToken = process.env.BRASIL_NFE_USER_TOKEN || cfg?.token_brasilnfe || '';
  if (!userToken) return { sucesso: false, erro: 'UserToken Brasil NFe não configurado.' };

  try {
    const bnfe = new BrasilNFe(companyToken, userToken);
    const resp = await bnfe.empresa.deletarEmpresa();
    if (!resp?.status) {
      return { sucesso: false, erro: resp?.Error || 'A Brasil NFe recusou a exclusão.' };
    }
  } catch (e: any) {
    // Erro de rede não pode virar "excluído": apagar o token aqui deixaria a
    // empresa viva lá, cobrando, e sem nenhuma referência nossa para excluir
    // depois. Melhor falhar e tentar de novo no próximo ciclo da régua.
    return { sucesso: false, erro: e?.message || 'Erro ao comunicar com a Brasil NFe.' };
  }

  // O CSC sai: ele vivia do lado deles e foi embora com a empresa. O token fica,
  // para consultar o que já foi emitido.
  const { csc_enviado_em, ...resto } = (salao!.config_fiscal ?? {}) as Record<string, any>;
  await supabaseAdmin.from('saloes')
    .update({
      config_fiscal: { ...resto, brasilnfe_excluido_em: new Date().toISOString() },
      // Sem isto o módulo fiscal continuaria visível na tela: derivarModulos faz
      // `... || legacyFiscal`, e legacyFiscal é esta coluna. O salão abriria a
      // gaveta de notas de um CNPJ que não está mais habilitado a emitir.
      modulo_fiscal_liberado: false,
    })
    .eq('id', salaoId);

  console.warn(`[brasilnfe] empresa excluída — salão ${salaoId} · CNPJ ${salao!.cnpj} · cobrança encerrada`);
  return { sucesso: true };
}
