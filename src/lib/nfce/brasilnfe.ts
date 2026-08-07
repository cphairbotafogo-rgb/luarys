/**
 * src/lib/nfce/brasilnfe.ts
 *
 * Adaptador Brasil NFe pra NFC-e — único provedor (Focus NFe removido). Ao
 * contrário da NFS-e (que é assíncrona, por lote), NFC-e é NF-e modelo 65:
 * `enviarNotaFiscal` responde de forma síncrona (autorizado/recusado na hora),
 * cancela por `ChaveNF` (não por número), e não usa CSC/CSC_ID — a Brasil NFe
 * gerencia isso do lado dela, por CNPJ já cadastrado (ver cadastrarEmpresaLuarys
 * em src/lib/nfse/brasilnfe.ts, compartilhado entre NFS-e e NFC-e).
 *
 * XML/DANFE vêm em base64 no corpo da resposta — sobem pro bucket privado
 * `notas-fiscais` (mesmo bucket usado pela NFS-e), caminho salvo em
 * nfce_emissoes.storage_path_xml/storage_path_danfe.
 */

import { createClient } from '@supabase/supabase-js';
import { BrasilNFe } from 'brasilnfe';
import type { PayloadNFCe, ResultadoNFCe, AdaptadorNFCe } from './tipos';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET_NOTAS = 'notas-fiscais';

/** Ambiente é por salão (já escolhido pelo dono em NFC-e → Configuração Fiscal). Default seguro: homologação (2). */
async function resolverTipoAmbiente(referencia: string): Promise<1 | 2> {
  const { data: emissao } = await supabaseAdmin.from('nfce_emissoes').select('salao_id').eq('referencia', referencia).maybeSingle();
  if (!emissao?.salao_id) return 2;

  const { data: config } = await supabaseAdmin
    .from('configuracoes_nfce_produtos')
    .select('ambiente')
    .eq('salao_id', emissao.salao_id)
    .maybeSingle();

  return config?.ambiente === '1' ? 1 : 2;
}

async function persistirArquivo(referencia: string, tipo: 'xml' | 'danfe', buffer?: Buffer | null): Promise<string | undefined> {
  if (!buffer) return undefined;
  const caminho = `nfce/${referencia}.${tipo === 'danfe' ? 'pdf' : 'xml'}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET_NOTAS).upload(caminho, buffer, {
    contentType: tipo === 'danfe' ? 'application/pdf' : 'application/xml',
    upsert: true,
  });
  if (error) {
    console.error(`[nfce/brasilnfe] falha ao subir ${tipo} da NFC-e ${referencia}:`, error.message);
    return undefined;
  }
  return caminho;
}

async function emitir(referencia: string, payload: PayloadNFCe, companyToken?: string): Promise<ResultadoNFCe> {
  if (!companyToken) {
    return {
      sucesso: false,
      status: 'erro',
      mensagem_erro: 'Salão não registrado na Brasil NFe. Solicite ao administrador do Luarys que faça o cadastro do CNPJ.',
    };
  }

  const tipoAmbiente = await resolverTipoAmbiente(referencia);
  const bnfe = new BrasilNFe(companyToken);

  try {
    const resp = await bnfe.notaFiscal.enviarNotaFiscal({
      TipoAmbiente: tipoAmbiente,
      ModeloDocumento: 65,
      Finalidade: 1,
      NaturezaOperacao: payload.natureza_operacao || 'VENDA AO CONSUMIDOR',
      IndicadorPresenca: payload.presenca_comprador,
      ConsumidorFinal: true,
      IdentificadorInterno: referencia,
      Serie: Number(payload.serie) || undefined,
      Numero: payload.numero,
      DataEmissao: payload.data_emissao,
      Cliente: payload.destinatario ? {
        CpfCnpj: payload.destinatario.cpf,
        NmCliente: payload.destinatario.nome,
        Contato: payload.destinatario.email ? { Email: payload.destinatario.email } : undefined,
      } : undefined,
      Produtos: payload.items.map(it => ({
        CodProdutoServico: it.codigo_produto,
        NmProduto: it.descricao,
        NCM: it.ncm,
        CFOP: Number(it.cfop) || 5102,
        UnidadeComercial: it.unidade_comercial,
        Quantidade: it.quantidade_comercial,
        ValorUnitario: it.valor_unitario_comercial,
        ValorTotal: it.valor_bruto,
        ValorDesconto: it.valor_desconto,
        OrigemProduto: Number(it.icms_origem) || 0,
        // CSOSN (Simples Nacional) vai no mesmo campo que CST de regime normal — a
        // API decide pela interpretação certa com base no CRT já cadastrado da
        // empresa (mesmo padrão confirmado no exemplo oficial do SDK pra NFC-e).
        Imposto: {
          ICMS: { CodSituacaoTributaria: it.icms_csosn },
          PIS: { CodSituacaoTributaria: it.pis_modalidade },
          COFINS: { CodSituacaoTributaria: it.cofins_modalidade },
          // Reforma Tributaria. A SEFAZ-RJ avisou em 09/07/2026 que a partir de
          // 03/08 rejeita documento fiscal eletronico sem IBS/CBS — vale para
          // NF-e, NFC-e e CT-e; NFS-e e municipal e nao entra.
          //
          // O cClassTrib depende do que a mercadoria e e de qual anexo ou
          // beneficio se aplica; cosmetico nao e alimento nem medicamento. Quem
          // responde e a contabilidade do salao. Sem valor cadastrado vai o
          // padrao documentado pelo provedor, que preenche as reducoes pela
          // tabela oficial quando os percentuais vem nulos.
          IBSCBS: { CodClassificacaoTributaria: String(it.cclasstrib ?? '').trim() || '000001' },
        },
      })),
      Pagamentos: payload.pagamentos.map(p => ({
        IndicadorPagamento: 0,
        FormaPagamento: p.forma_pagamento,
        VlPago: p.valor_pagamento,
      })),
    });

    if (resp.Error) return { sucesso: false, status: 'erro', mensagem_erro: resp.Error };
    if (!resp.ReturnNF?.Ok) {
      return { sucesso: false, status: 'erro', mensagem_erro: resp.ReturnNF?.DsStatusRespostaSefaz || 'Nota recusada pela SEFAZ.' };
    }

    const [storage_path_danfe, storage_path_xml] = await Promise.all([
      persistirArquivo(referencia, 'danfe', resp.Base64File ? Buffer.from(resp.Base64File, 'base64') : null),
      persistirArquivo(referencia, 'xml', resp.Base64Xml ? Buffer.from(resp.Base64Xml, 'base64') : null),
    ]);

    return {
      sucesso: true,
      status: 'autorizado',
      numero_nota: resp.ReturnNF.Numero != null ? String(resp.ReturnNF.Numero) : undefined,
      chave: resp.ReturnNF.ChaveNF,
      storage_path_danfe,
      storage_path_xml,
    };
  } catch (e: any) {
    return { sucesso: false, status: 'erro', mensagem_erro: e?.message || 'Erro ao comunicar com a Brasil NFe.' };
  }
}

async function consultar(referencia: string, companyToken?: string): Promise<ResultadoNFCe> {
  if (!companyToken) return { sucesso: false, status: 'erro', mensagem_erro: 'Salão não registrado na Brasil NFe.' };

  const { data: emissao } = await supabaseAdmin.from('nfce_emissoes').select('criado_em').eq('referencia', referencia).maybeSingle();
  if (!emissao) return { sucesso: false, status: 'erro', mensagem_erro: 'Emissão não encontrada.' };

  // TipoAmbiente não entra nos parâmetros de busca/arquivo (BuscarNotaFiscalEnvio,
  // PegarArquivoEnvio) — a chave de acesso já identifica o ambiente da nota.
  const bnfe = new BrasilNFe(companyToken);

  // Janela de busca de 24h antes da emissão até agora — a consulta da Brasil
  // NFe é por período + IdentificadorInterno, não por chave (que não temos
  // ainda se a nota ficou "processando" na emissão original).
  const dtInicio = new Date(new Date(emissao.criado_em).getTime() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const resp = await bnfe.consultas.obterNotasFiscais({
      TipoDocumentoFiscal: 1, // Saídas
      DtInicio: dtInicio,
      DtFim: new Date().toISOString(),
      IndentificadorInterno: referencia,
    });

    if (resp.Error) return { sucesso: false, status: 'erro', mensagem_erro: resp.Error };

    const nota = resp.Notas?.find(n => n.IdentificadorInterno === referencia);
    if (!nota) return { sucesso: true, status: 'processando' };

    if (nota.Status === 2) return { sucesso: false, status: 'erro', mensagem_erro: 'Nota cancelada.' };
    if (nota.Status === 3) return { sucesso: false, status: 'erro', mensagem_erro: 'Uso denegado pela SEFAZ.' };
    if (nota.Status !== 1) return { sucesso: true, status: 'processando' };

    let storage_path_xml: string | undefined;
    let storage_path_danfe: string | undefined;
    if (nota.Chave) {
      const [xmlBuf, danfeBuf] = await Promise.all([
        bnfe.arquivos.obterArquivoNotaFiscal({ ChaveNF: nota.Chave, FileType: 1, TipoDocumentoFiscal: 1 }).catch(() => null),
        bnfe.arquivos.obterArquivoNotaFiscal({ ChaveNF: nota.Chave, FileType: 2, TipoDocumentoFiscal: 1 }).catch(() => null),
      ]);
      storage_path_xml = await persistirArquivo(referencia, 'xml', xmlBuf);
      storage_path_danfe = await persistirArquivo(referencia, 'danfe', danfeBuf);
    }

    return {
      sucesso: true,
      status: 'autorizado',
      numero_nota: nota.Numero != null ? String(nota.Numero) : undefined,
      chave: nota.Chave,
      storage_path_danfe,
      storage_path_xml,
    };
  } catch (e: any) {
    return { sucesso: false, status: 'erro', mensagem_erro: e?.message || 'Erro ao comunicar com a Brasil NFe.' };
  }
}

async function cancelar(referencia: string, justificativa: string, companyToken?: string): Promise<{ sucesso: boolean; erro?: string }> {
  if (!companyToken) return { sucesso: false, erro: 'Salão não registrado na Brasil NFe.' };
  if ((justificativa || '').trim().length < 15) {
    return { sucesso: false, erro: 'Justificativa precisa ter pelo menos 15 caracteres.' };
  }

  const { data: emissao } = await supabaseAdmin.from('nfce_emissoes').select('chave_acesso').eq('referencia', referencia).maybeSingle();
  if (!emissao?.chave_acesso) {
    return { sucesso: false, erro: 'Nota sem chave de acesso — não é possível cancelar antes da emissão ser confirmada.' };
  }

  const tipoAmbiente = await resolverTipoAmbiente(referencia);
  const bnfe = new BrasilNFe(companyToken);

  try {
    const resp = await bnfe.eventos.cancelarNotaFiscal({
      TipoDocumento: 0, // 0 = NF-e/NFC-e (usa ChaveNF; TipoDocumento 1 é exclusivo de NFS-e)
      ChaveNF: emissao.chave_acesso,
      Justificativa: justificativa,
      TipoAmbiente: tipoAmbiente,
      DataEvento: new Date().toISOString(),
    });

    if (resp.Error || resp.Status === 3) {
      return { sucesso: false, erro: resp.Error || resp.DsMotivo || 'Cancelamento recusado pela SEFAZ.' };
    }
    return { sucesso: true };
  } catch (e: any) {
    return { sucesso: false, erro: e?.message || 'Erro ao comunicar com a Brasil NFe.' };
  }
}

export const BrasilNFeAdaptadorNFCe: AdaptadorNFCe = { emitir, consultar, cancelar };
