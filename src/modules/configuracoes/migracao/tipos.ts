/**
 * src/modules/configuracoes/migracao/tipos.ts
 *
 * Lógica pura de leitura/parsing de arquivo, sem React.
 * Extraído de AbaMigracao.tsx (que passou de 700 linhas) seguindo o padrão
 * de divisão da skill eleva-padroes.
 */

// ─── LEITURA DE ARQUIVO COM DETECÇÃO DE ENCODING ─────────────────────────────
// Arquivos exportados do Excel ou de outros sistemas (Avec/Trinks) no Windows
// costumam vir em Windows-1252, não UTF-8. Ler sempre como UTF-8 corrompe
// acentos (ç, ã, é...) ANTES da normalização de cabeçalho rodar, fazendo a
// validação de colunas obrigatórias falhar mesmo quando a coluna existe.
// Esta função tenta UTF-8 primeiro (modo "fatal" — rejeita se inválido) e
// cai para Windows-1252 automaticamente se a decodificação falhar.
export function lerArquivoTexto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      try {
        const decoderUtf8 = new TextDecoder('utf-8', { fatal: true });
        resolve(decoderUtf8.decode(buffer));
      } catch {
        // UTF-8 inválido — quase certamente Windows-1252 (Excel/Avec/Trinks no Windows)
        const decoderLegado = new TextDecoder('windows-1252');
        resolve(decoderLegado.decode(buffer));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// ─── DICIONÁRIO DE COLUNAS ───────────────────────────────────────────────────
export const DICIONARIO_COLUNAS: Record<string, { obrigatorias: string[], opcionais: string[] }> = {
  clientes: {
    obrigatorias: ['nome_completo'],
    opcionais: ['telefone_whatsapp', 'telefone 2', 'email', 'cpf', 'nascimento', 'data de cadastro', 'genero', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'observacoes', 'instagram', 'como nos conheceu', 'ultimo agendamento', 'recebe sms', 'recebe e-mails']
  },
  servicos: {
    obrigatorias: ['nome_servico', 'preco_padrao'],
    opcionais: ['descricao', 'categoria', 'duracao_minutos', 'tipo_preco', 'preco_promocional', 'custo_produto', 'custo_produto_prof', 'custo_descartaveis', 'custo_op_estabelecimento', 'custo_op_profissional']
  },
  produtos: {
    obrigatorias: ['nome_produto', 'preco_venda'],
    opcionais: ['codigo_sku', 'preco_custo', 'quantidade_estoque', 'marca', 'categoria', 'unidade_medida']
  }
};

// ─── PARSER CSV CORRETO ───────────────────────────────────────────────────────
// Substitui o regex frágil que cortava valores com espaços (ex: "A partir de", "Barba Modelada")
export function parseLinha(linha: string, sep: string): string[] {
  const resultado: string[] = [];
  let atual = '';
  let dentroAspas = false;

  for (let k = 0; k < linha.length; k++) {
    const ch = linha[k];
    if (ch === '"') {
      // Aspas duplas escapadas dentro de campo ("" → ")
      if (dentroAspas && linha[k + 1] === '"') {
        atual += '"';
        k++;
      } else {
        dentroAspas = !dentroAspas;
      }
    } else if (ch === sep && !dentroAspas) {
      resultado.push(atual.trim());
      atual = '';
    } else {
      atual += ch;
    }
  }
  resultado.push(atual.trim());
  return resultado;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
export function parseDuracao(texto: string): number {
  if (!texto) return 0;
  const str = String(texto).toLowerCase();
  let min = 0;
  const horasMatch = str.match(/(\d+)\s*h/);
  const minMatch = str.match(/(\d+)\s*m/);
  if (horasMatch) min += parseInt(horasMatch[1]) * 60;
  if (minMatch) min += parseInt(minMatch[1]);
  return min || parseInt(str.replace(/\D/g, '')) || 0;
}

export function parsePreco(texto: string): number {
  if (!texto) return 0;
  // Suporta "1.234,56" (BR) e "1234.56" (EN)
  const limpo = String(texto).replace(/[^\d,.-]/g, '');
  // Se tem vírgula depois de ponto → formato BR: 1.234,56
  if (limpo.includes(',') && limpo.lastIndexOf(',') > limpo.lastIndexOf('.')) {
    return parseFloat(limpo.replace('.', '').replace(',', '.')) || 0;
  }
  return parseFloat(limpo.replace(',', '.')) || 0;
}

// ─── MAPEAMENTO DE LINHA → REGISTRO (por entidade) ───────────────────────────
// Lógica pura: dado o array de cabeçalhos normalizados e os valores de uma
// linha, monta o objeto pronto para insert. Sem dependência de estado/React —
// só o hook (useMigracao.ts) decide o que fazer com o resultado.

export function mapearLinhaServico(cabecalhos: string[], valores: string[]): any | null {
  const obj: any = {};

  cabecalhos.forEach((cab, idx) => {
    const val = valores[idx] ?? '';
    if (!val && val !== '0') return;

    if (cab === 'nome' || cab.includes('nome servico') || cab === 'servico') {
      obj.nome_servico = val;
    } else if (cab.includes('descri')) {
      obj.descricao = val;
    } else if (cab === 'categoria' || cab === 'categoria padrao') {
      if (!obj.categoria) obj.categoria = val; // primeira que aparecer ganha
    } else if (cab.includes('duracao') || cab.includes('tempo')) {
      obj.duracao_minutos = parseDuracao(val);
    } else if (cab.includes('tipo de preco') || cab === 'tipo preco' || cab === 'tipo') {
      obj.tipo_preco = val.toLowerCase().includes('partir') ? 'a_partir_de' : 'fixo';
    } else if (cab === 'preco padrao' || (cab.includes('preco') && !cab.includes('promocional') && !cab.includes('custo') && !cab.includes('produto'))) {
      obj.preco_padrao = parsePreco(val);
    } else if (cab.includes('preco promocional') || cab.includes('promocao') || cab.includes('promocional')) {
      const v = parsePreco(val);
      if (v > 0) obj.preco_promocional = v;
    } else if (cab.includes('custo medio dos produtos') && !cab.includes('profis')) {
      obj.custo_produto = parsePreco(val);
    } else if (cab.includes('custo medio dos produtos') && cab.includes('profis')) {
      obj.custo_produto_prof = parsePreco(val);
    } else if (cab.includes('descartav')) {
      obj.custo_descartaveis = parsePreco(val);
    } else if (cab.includes('operacional') && (cab.includes('estab') || (!cab.includes('profis')))) {
      if (!obj.custo_op_estabelecimento) obj.custo_op_estabelecimento = parsePreco(val);
    } else if (cab.includes('operacional') && cab.includes('profis')) {
      obj.custo_op_profissional = parsePreco(val);
    }
  });

  if (!obj.nome_servico) return null; // campo obrigatório ausente — descarta a linha
  if (obj.preco_padrao === undefined) obj.preco_padrao = 0;
  return obj;
}

// Converte "DD/MM/AAAA" (com ou sem hora colada) para "AAAA-MM-DD". Aceita
// também formato já ISO ("AAAA-MM-DD...") sem alteração.
function parseDataBr(val: string): string | null {
  const dataLimpa = val.split(' ')[0];
  if (dataLimpa.includes('/')) {
    const p = dataLimpa.split('/');
    if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
    return null;
  }
  if (dataLimpa.includes('-')) return dataLimpa;
  return null;
}

function valSignificaSim(val: string): boolean {
  return val.toLowerCase().trim() === 'sim';
}

export interface MapeamentoCliente {
  global: any;  // vai para a tabela `clientes` (registro global)
  local: any;   // vai para a tabela `crm_clientes` (vínculo por salão)
}

/**
 * Captura bem mais que nome/telefone/email — inclui também: segundo telefone,
 * complemento de endereço, Instagram, como conheceu o salão, preferências de
 * contato (SMS/e-mail → aceita_notificacoes/aceita_campanhas) e a data do
 * último agendamento (→ crm_clientes.data_ultima_visita). Esse último campo é
 * o que faz o Luarys Cresce já reconhecer "clientes em risco/perdidos" desde o
 * primeiro dia após a migração, em vez de tratar todo mundo como novo cliente.
 *
 * Não importados (sem coluna correspondente confirmada no banco ainda):
 * "Primeiro agendamento", "Status do primeiro/último agendamento", "Pode
 * agendar online". Se precisar desses no futuro, é necessário criar as
 * colunas correspondentes antes de mapear.
 */
export function mapearLinhaCliente(cabecalhos: string[], valores: string[]): MapeamentoCliente | null {
  const global: any = {};
  const local: any = {};
  let recebeSms: boolean | null = null;
  let recebeEmailGeral: boolean | null = null;
  let recebeEmailPromo: boolean | null = null;
  let telefonesExtras: string[] = [];

  cabecalhos.forEach((cab, idx) => {
    const val = valores[idx] ?? '';
    if (!val) return;

    if (cab.includes('nome') || cab.includes('cliente')) {
      global.nome_completo = val;
    } else if (cab.includes('telefone') || cab.includes('whatsapp') || cab.includes('celular')) {
      const numeroLimpo = val.replace(/\D/g, '');
      // Mesmo formato usado pelo CRM ao cadastrar manualmente ("+55 21999999999")
      // — sem isso, o mesmo telefone fica em formatos diferentes dependendo de
      // onde o cliente foi cadastrado, e o detector de duplicatas não casa os dois.
      const comDdi = numeroLimpo ? `+55 ${numeroLimpo}` : '';
      if (!global.telefone_whatsapp) global.telefone_whatsapp = comDdi;
      else telefonesExtras.push(numeroLimpo); // "Telefone 2", "Telefone 3"...
    } else if (cab === 'email' || cab === 'e-mail') {
      global.email = val;
    } else if (cab.includes('cpf')) {
      global.cpf = val.replace(/\D/g, '');
    } else if (cab.includes('nascimento')) {
      global.nascimento = parseDataBr(val);
    } else if (cab.includes('cadastro') || cab.includes('criado')) {
      const iso = parseDataBr(val);
      if (iso) global.created_at = `${iso}T12:00:00Z`;
    } else if (cab === 'instagram') {
      global.instagram = val;
    } else if (cab.includes('conheceu')) {
      global.como_conheceu = val;
    } else if (cab === 'complemento') {
      global.complemento = val;
    } else if (['genero', 'cep', 'logradouro', 'numero', 'bairro', 'cidade', 'estado', 'observacoes'].includes(cab)) {
      global[cab] = val;
    } else if (cab.includes('recebe') && cab.includes('sms')) {
      recebeSms = valSignificaSim(val);
    } else if (cab.includes('recebe') && cab.includes('email') && cab.includes('promo')) {
      recebeEmailPromo = valSignificaSim(val);
    } else if (cab.includes('recebe') && cab.includes('email')) {
      recebeEmailGeral = valSignificaSim(val);
    } else if (cab.includes('ultimo') && cab.includes('agend')) {
      // Vai para crm_clientes — alimenta diretamente o Luarys Cresce
      local.data_ultima_visita = parseDataBr(val);
    }
  });

  if (!global.nome_completo) return null; // campo obrigatório ausente — descarta a linha

  if (telefonesExtras.length > 0) {
    global.telefones = telefonesExtras.map(numero => ({
      ddi: '55', ddd: numero.slice(0, 2), numero: numero.slice(2), tipo: 'Celular',
    }));
  }

  // Preferência de contato: SMS e e-mail geral juntos formam o consentimento
  // operacional (lembretes de agendamento). O e-mail "sobre promoções" — se
  // a coluna existir separadamente — alimenta o consentimento de marketing
  // (aceita_campanhas), que é o que libera a ação de WhatsApp no Luarys Cresce
  // e no Fidelidade. Se essa coluna específica não existir no arquivo, usa o
  // mesmo valor do consentimento geral como aproximação razoável.
  if (recebeSms !== null || recebeEmailGeral !== null) {
    local.aceita_notificacoes = recebeSms === true || recebeEmailGeral === true;
  }
  local.aceita_campanhas = recebeEmailPromo !== null
    ? recebeEmailPromo
    : (local.aceita_notificacoes ?? false);

  return { global, local };
}

export function mapearLinhaProduto(cabecalhos: string[], valores: string[]): any {
  const obj: any = {};
  cabecalhos.forEach((cab, idx) => {
    if (valores[idx] && cab !== 'id' && cab !== 'created_at') obj[cab] = valores[idx];
  });
  return obj;
}

// ─── DETECÇÃO DE METADADO DE RELATÓRIO (em vez de cabeçalho real) ────────────
// Sinal forte: a "primeira linha" virou só 1 coluna (não tinha separador de
// verdade) e contém palavras típicas de título de relatório, não de nome de
// campo de cadastro. Isso é exatamente o que acontece quando o dono exporta
// um relatório filtrado (ex: "Clientes que não retornaram") em vez da
// exportação bruta do cadastro completo.
export function pareceMetadadoDeRelatorio(cabecalhos: string[]): boolean {
  const texto = cabecalhos.join(' ');
  return cabecalhos.length === 1 && /filtrad|relatorio|gerado em|exportad em/.test(texto);
}

// ─── VALIDAÇÃO DE COLUNAS OBRIGATÓRIAS ───────────────────────────────────────
export function validarColunasObrigatorias(entidade: string, cabecalhos: string[]): string[] {
  const colunasFaltando: string[] = [];

  if (entidade === 'clientes') {
    const temNome = cabecalhos.some(c => c.includes('nome') || c.includes('cliente'));
    if (!temNome) colunasFaltando.push('nome_completo (ou "Cliente")');
  } else if (entidade === 'produtos') {
    const temNome = cabecalhos.some(c => c.includes('nome') || c.includes('produto'));
    const temPreco = cabecalhos.some(c => c.includes('preco') || c.includes('venda') || c.includes('valor'));
    if (!temNome) colunasFaltando.push('nome_produto');
    if (!temPreco) colunasFaltando.push('preco_venda');
  } else if (entidade === 'servicos') {
    const temNome = cabecalhos.some(c => c.includes('nome') || c.includes('servico'));
    const temPreco = cabecalhos.some(c => c.includes('preco') || c.includes('valor'));
    if (!temNome) colunasFaltando.push('nome_servico (ou "Nome")');
    if (!temPreco) colunasFaltando.push('preco_padrao (ou "Preço Padrão")');
  }

  return colunasFaltando;
}