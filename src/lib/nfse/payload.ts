import { resolverLc116 } from './lc116';
import { validarCnpj, formatarCnpj } from '../cnpj';
import { regimePermiteSalaoParceiro } from '../salaoParceiro';
import { cpfParaNota } from '../cpf';
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
    cnae?: string;
    regime_tributario?: string;  // campo direto de saloes (Dados da Empresa)
    config_fiscal?: any;
  };
  nota: {
    cliente_nome?: string;
    cliente_cpf?: string;
    descricao_servico: string;
    valor: number;
    item_lista_servico?: string;
    /** ISS do serviço prestado (servicos.aliquota_iss). Ver comentário abaixo. */
    aliquota_iss?: number | null;
    /** Código de tributação da prefeitura (cTribMun), complementar ao cTribNac. */
    codigo_tributacao_municipio?: string | null;
    /** NBS do serviço (Lei da Transparência 12.741/12). */
    nbs?: string | null;
    // campos de cota-parte (Fatia 5 — discriminação gDed na NFS-e)
    cnpj_profissional?: string | null;
    tipo_parceiro?: string | null;
    valor_cota_profissional?: number | null;
    valor_cota_salao?: number | null;
  };
}): PayloadNFSe {
  const { salao, nota } = opts;

  // A alíquota de ISS é do SERVIÇO, não do salão: cada item da lista tem a sua
  // na legislação municipal. O cadastro de serviços já pede esse percentual
  // (Serviços → Tributação de Serviço), mas ele era ignorado aqui e todas as
  // notas saíam com a alíquota geral do salão — declarando ISS diferente do
  // configurado. Só cai no valor do salão quando o serviço não tem alíquota
  // própria; zero é valor legítimo (serviço isento), por isso o teste é por
  // null/undefined e não por falsy.
  const aliquotaServico = nota.aliquota_iss;
  const aliquota = (aliquotaServico !== null && aliquotaServico !== undefined && Number.isFinite(Number(aliquotaServico)))
    ? Number(aliquotaServico) / 100
    : parseFloat(salao.config_fiscal?.aliquota_padrao || '2.00') / 100;
  // Regime tributário: usa o campo direto do salão (Dados da Empresa) primeiro,
  // e cai para config_fiscal se não estiver preenchido (compatibilidade com configuração do admin)
  const regime = salao.regime_tributario || salao.config_fiscal?.regime_tributario || '';
  const simples = ['Simples Nacional', 'MEI'].includes(regime);

  // Regime especial de tributação, na codificação do provedor:
  //   0 sem regime especial | 1 microempresa municipal | 2 estimativa
  //   3 sociedade de profissionais | 4 cooperativa | 5 MEI | 6 ME/EPP
  //
  // A tela Configurar NFS-e tem um seletor próprio para isto. Ele manda: são
  // conceitos distintos — "Simples Nacional" é o regime da empresa, enquanto o
  // regime especial é como o MUNICÍPIO enquadra o prestador, e um salão pode
  // ser Simples e estar enquadrado como sociedade de profissionais. Derivar do
  // regime tributário, como fazíamos, ignorava a escolha do usuário.
  //
  // Só quando o seletor está em "— Nenhum —" caímos na derivação, para não
  // deixar o campo vazio em quem nunca configurou.
  const REGIME_ESPECIAL_POR_NOME: Record<string, number> = {
    'Sem Regime Especial':        0,
    'Microempresa Municipal':     1,
    'Estimativa':                 2,
    'Sociedade de Profissionais': 3,
    'Cooperativa':                4,
    'MEI':                        5,
    'Microempresa ou EPP':        6,
  };
  const escolhido = String(salao.config_fiscal?.regime_especial_tributacao ?? '').trim();
  const regimeEspecial = escolhido in REGIME_ESPECIAL_POR_NOME
    ? REGIME_ESPECIAL_POR_NOME[escolhido]
    : (regime === 'MEI' ? 5 : regime === 'Simples Nacional' ? 6 : 0);

  // Horário de Brasília (UTC-3) — evita registrar data do dia seguinte na SEFAZ
  // quando a nota é emitida depois das 21h local (servidor em UTC)
  const agora = new Date();
  const localBrasilia = agora.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const dataEmissao = localBrasilia.replace(' ', 'T') + '-03:00';

  // gDed — dedução da cota do profissional parceiro com CNPJ (Lei 13.352/2016 +
  // Resolução CGSN 140/2018). Só aplicável quando tipo_parceiro = 'parceiro_cnpj'
  // e há valor de cota positivo. A base do ISS cai para a cota do salão.
  // Valor monetário na NFS-e tem 2 casas. A cota do profissional vem de um
  // cálculo de percentual e chega aqui com fração de centavo (ex: 1.972488) —
  // ia direto pro XML assim. Arredonda antes de qualquer conta para que a base
  // de cálculo derive do mesmo número que vai declarado como dedução, senão as
  // duas divergiriam em centavos.
  const centavos = (v: number | null | undefined) => Math.round((Number(v) || 0) * 100) / 100;
  /** R$ com 2 casas para o texto da discriminacao (pt-BR, sem simbolo duplicado). */
  const moeda = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');

  // A dedução exige CNPJ válido do parceiro. Sem ele a prefeitura não consegue
  // substanciar o repasse, e dedução que não se sustenta é problema fiscal do
  // salão (desde 2026 o cruzamento NFS-e Nacional x PGDAS é imediato e a
  // divergência descaracteriza a parceria). Na dúvida, deduzir de menos é o
  // lado seguro: o salão paga mais ISS, mas não declara o que não comprova.
  // Art. 1º-A, § 11: o salão-parceiro não pode ser MEI. Sendo, não existe
  // parceria válida — logo não há cota-parte a deduzir. Deduzir aqui declararia
  // ao município um repasse amparado numa parceria que a lei não admite.
  const salaoPodeTerParceria = regimePermiteSalaoParceiro(regime);

  const cnpjParceiroValido = validarCnpj(nota.cnpj_profissional);
  const ehParceiroComCnpj = nota.tipo_parceiro === 'parceiro_cnpj' && cnpjParceiroValido && salaoPodeTerParceria;

  if (nota.tipo_parceiro === 'parceiro_cnpj' && !salaoPodeTerParceria) {
    console.warn(
      '[nfse] Cota de parceiro não deduzida: salão no regime %s, vedado ao salão-parceiro pela Lei 13.352/2016.',
      regime,
    );
  }
  const valorDeducoes = ehParceiroComCnpj && Number(nota.valor_cota_profissional) > 0
    ? centavos(nota.valor_cota_profissional)
    : 0;

  if (nota.tipo_parceiro === 'parceiro_cnpj' && !cnpjParceiroValido && Number(nota.valor_cota_profissional) > 0) {
    console.warn(
      '[nfse] Cota de parceiro não deduzida: CNPJ inválido (%s). Corrija em Minha Equipe → Contrato.',
      nota.cnpj_profissional,
    );
  }
  // Algumas prefeituras rejeitam base_calculo = 0 (ex: São Paulo código E10).
  // Limita a dedução para que a base mínima seja R$ 0,01 quando há valor de serviço.
  const baseCalculo = nota.valor > 0
    ? Math.max(0.01, centavos(nota.valor - valorDeducoes))
    : 0;

  // Discriminação da cota-parte (Lei 13.352/2016).
  //
  // O salão-parceiro emite UMA nota ao cliente, pelo total, discriminando o
  // repasse ao profissional-parceiro. A NFS-e não tem campo estruturado para
  // isso — a orientação para optante do Simples é preencher a "Discriminação
  // dos serviços" com o CNPJ do parceiro, o valor repassado e o código do
  // serviço que ele prestou. Sem esse texto a dedução do gDed fica sem a
  // contrapartida que a prefeitura procura.
  //
  // Só entra quando a dedução realmente se aplica: se o CNPJ é inválido não
  // deduzimos (acima), e então declarar o repasse aqui seria incoerente com o
  // valor tributado.
  const descricaoBase = nota.descricao_servico || 'Serviços de beleza';
  const descricao = valorDeducoes > 0
    ? [
        descricaoBase,
        `Profissional-parceiro: ${formatarCnpj(nota.cnpj_profissional)}`,
        `Cota-parte repassada: ${moeda(valorDeducoes)} - cod. ${resolverLc116(nota.item_lista_servico)}`,
        `Cota-parte do salao: ${moeda(centavos(nota.valor) - valorDeducoes)}`,
        'Operacao sob a Lei 13.352/2016 (salao-parceiro).',
      ].join('\n')
    : descricaoBase;

  const payload: PayloadNFSe = {
    data_emissao: dataEmissao,
    natureza_operacao: 1,
    optante_simples_nacional: simples,
    regime_especial_tributacao: regimeEspecial,
    incentivador_cultural: false,
    prestador: {
      cnpj: (salao.cnpj || '').replace(/[.\-\/\s]/g, '').toUpperCase(),
      inscricao_municipal: salao.inscricao_municipal || undefined,
      codigo_municipio: salao.codigo_ibge || '',
    },
    servicos: [{
      aliquota,
      base_calculo: baseCalculo,
      descricao,
      iss_retido: false,
      // resolverLc116 garante cTribNac de 6 digitos aqui, ultima barreira antes
      // do XML: aceita o valor ja correto, converte NBS/"06.01" legados e cai no
      // padrao quando vazio. Nunca deixa passar codigo que a prefeitura recusaria.
      item_lista_servico: resolverLc116(nota.item_lista_servico),
      // Complemento municipal do enquadramento. O adaptador ja repassava este
      // campo ao provedor, mas ele nunca era preenchido aqui — saia undefined
      // em toda nota, deixando a prefeitura sem o codigo dela para reconhecer o
      // servico (rejeicao E0312).
      codigo_tributario_municipio: String(nota.codigo_tributacao_municipio ?? '').trim() || undefined,
      // CNAE do prestador e NBS do serviço: o provedor aceita os dois e a
      // prefeitura usa ambos no enquadramento. Estavam cadastrados e não iam.
      codigo_cnae: String(salao.cnae ?? '').replace(/\D/g, '') || undefined,
      codigo_nbs: String(nota.nbs ?? '').replace(/\D/g, '') || undefined,
      valor_servico: centavos(nota.valor),
      valor_deducoes: valorDeducoes > 0 ? valorDeducoes : undefined,
    }],
  };

  if (nota.cliente_nome) {
    payload.tomador = {
      razao_social: nota.cliente_nome,
      // CPF invalido e omitido em vez de enviado: o campo e opcional na NFS-e,
      // entao mandar lixo transforma um dado dispensavel numa nota recusada
      // ("CPF/CNPJ do tomador invalido"). Sem CPF a nota sai como consumidor
      // nao identificado, que e o resultado util.
      cpf: cpfParaNota(nota.cliente_cpf),
    };
  }

  return payload;
}
