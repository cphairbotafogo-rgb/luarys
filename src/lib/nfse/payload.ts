import type { PayloadNFSe } from './tipos';

/**
 * Monta o payload de NFS-e a partir dos dados do salão e da nota — genérico,
 * independente de provedor (a conversão pro formato específico da API é feita
 * dentro do adaptador, ver `brasilnfe.ts`).
 */
export function buildPayloadNFSe(opts: {
  salao: {
    cnpj: string;
    inscricao_municipal?: string;
    codigo_ibge?: string;
    regime_tributario?: string;  // campo direto de saloes (Dados da Empresa)
    config_fiscal?: any;
  };
  nota: {
    cliente_nome?: string;
    cliente_cpf?: string;
    descricao_servico: string;
    valor: number;
    item_lista_servico?: string;
    // campos de cota-parte (Fatia 5 — discriminação gDed na NFS-e)
    cnpj_profissional?: string | null;
    tipo_parceiro?: string | null;
    valor_cota_profissional?: number | null;
    valor_cota_salao?: number | null;
  };
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

  // gDed — dedução da cota do profissional parceiro com CNPJ (Lei 13.352/2016 +
  // Resolução CGSN 140/2018). Só aplicável quando tipo_parceiro = 'parceiro_cnpj'
  // e há valor de cota positivo. A base do ISS cai para a cota do salão.
  const ehParceiroComCnpj = nota.tipo_parceiro === 'parceiro_cnpj';
  const valorDeducoes = ehParceiroComCnpj && Number(nota.valor_cota_profissional) > 0
    ? Number(nota.valor_cota_profissional)
    : 0;
  // Algumas prefeituras rejeitam base_calculo = 0 (ex: São Paulo código E10).
  // Limita a dedução para que a base mínima seja R$ 0,01 quando há valor de serviço.
  const baseCalculo = nota.valor > 0
    ? Math.max(0.01, nota.valor - valorDeducoes)
    : 0;

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
      base_calculo: baseCalculo,
      descricao: nota.descricao_servico || 'Serviços de beleza',
      iss_retido: false,
      item_lista_servico: nota.item_lista_servico || '06.01',
      valor_servico: nota.valor,
      valor_deducoes: valorDeducoes > 0 ? valorDeducoes : undefined,
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
