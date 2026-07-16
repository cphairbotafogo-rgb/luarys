/**
 * src/modules/configuracoes/duplicados/tipos.ts
 *
 * Detecção de duplicatas na base já cadastrada — diferente da checagem que
 * já existe em AbaCRM.tsx (que só verifica no momento de CRIAR um cliente
 * novo). Esta varre tudo que já está salvo e agrupa candidatos, do jeito que
 * o "mesclar contatos" do celular faz.
 */

// ─── NORMALIZAÇÃO E SIMILARIDADE DE TEXTO ────────────────────────────────────

export function normalizarTexto(texto: string): string {
  return (texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Distância de Levenshtein clássica — número mínimo de edições (inserir,
// remover, trocar caractere) para transformar uma string na outra.
function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // remoção
        d[i][j - 1] + 1,      // inserção
        d[i - 1][j - 1] + custo // substituição
      );
    }
  }
  return d[m][n];
}

/** Similaridade de 0 (nada a ver) a 1 (idêntico), baseada em Levenshtein. */
export function similaridade(a: string, b: string): number {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - distanciaLevenshtein(na, nb) / maxLen;
}

// ─── INTERFACES ───────────────────────────────────────────────────────────────

export type Confianca = 'alta' | 'media';

export interface GrupoDuplicataCliente {
  motivo: string;       // ex: "Mesmo CPF", "Telefone idêntico", "Nome muito parecido"
  confianca: Confianca;
  registros: any[];      // linhas completas de `clientes`, já com contagem de uso anexada
}

export interface GrupoDuplicataServico {
  motivo: string;
  confianca: Confianca;
  registros: any[];
}

export interface GrupoDuplicataProduto {
  motivo: string;
  confianca: Confianca;
  registros: any[];
}

// ─── DETECÇÃO — CLIENTES ───────────────────────────────────────────────────────
// Confiança alta: CPF, telefone ou e-mail idênticos (forte indício de ser a
// mesma pessoa). Confiança média: nome muito parecido (>= 90% de similaridade)
// mas sem nenhum dado de contato batendo — pode ser coincidência de nome.

// Normaliza telefone para comparação: remove tudo que não é dígito e tira o
// DDI "55" do início quando presente. Necessário porque o mesmo número pode
// estar salvo como "+55 21970260710" (cadastro manual no CRM) ou apenas
// "21970260710" (importação de CSV) — strings diferentes, mesmo telefone.
function normalizarTelefone(tel: string): string | null {
  if (!tel) return null;
  let digitos = tel.replace(/\D/g, '');
  if (digitos.length > 11 && digitos.startsWith('55')) {
    digitos = digitos.slice(2);
  }
  // Rejeita telefone inválido/placeholder para NÃO agrupar pessoas diferentes
  // que só compartilham um número-lixo (ex.: "2100000000", "00000000000").
  if (digitos.length < 10 || digitos.length > 11) return null; // fora do padrão BR (10-11 dígitos)
  if (/^(\d)\1+$/.test(digitos)) return null;                  // todos os dígitos iguais
  const assinante = digitos.slice(-8);                         // 8 dígitos finais (nº do assinante)
  if (/^(\d)\1+$/.test(assinante)) return null;                // assinante repetido: dd00000000, dd99999999
  return digitos;
}

// CPF válido para comparação: 11 dígitos e não pode ser todos iguais
// (00000000000, 11111111111... são placeholders comuns de importação).
function cpfValidoParaMatch(cpf: string | null | undefined): string | null {
  const d = (cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return null;
  if (/^(\d)\1+$/.test(d)) return null;
  return d;
}

export function detectarDuplicatasClientes(clientes: any[]): GrupoDuplicataCliente[] {
  const grupos: GrupoDuplicataCliente[] = [];
  const jaAgrupados = new Set<string>();

  function agrupar(chaveFn: (c: any) => string | null, motivo: string) {
    const porChave: Record<string, any[]> = {};
    clientes.forEach(c => {
      const chave = chaveFn(c);
      if (!chave) return;
      if (!porChave[chave]) porChave[chave] = [];
      porChave[chave].push(c);
    });
    Object.values(porChave).forEach(lista => {
      if (lista.length < 2) return;
      const idsNovos = lista.filter(c => !jaAgrupados.has(c.id));
      if (idsNovos.length < 2) return;
      idsNovos.forEach(c => jaAgrupados.add(c.id));
      grupos.push({ motivo, confianca: 'alta', registros: idsNovos });
    });
  }

  agrupar(c => cpfValidoParaMatch(c.cpf), 'Mesmo CPF');
  agrupar(c => normalizarTelefone(c.telefone_whatsapp), 'Telefone idêntico');
  agrupar(c => (c.email || '').toLowerCase().trim() || null, 'E-mail idêntico');

  // Confiança média: nomes muito parecidos, comparação par a par (O(n²) —
  // aceitável para bases de até alguns milhares de clientes)
  const restantes = clientes.filter(c => !jaAgrupados.has(c.id));
  const usadosNomeMatch = new Set<string>();
  for (let i = 0; i < restantes.length; i++) {
    if (usadosNomeMatch.has(restantes[i].id)) continue;
    const similares = [restantes[i]];
    for (let j = i + 1; j < restantes.length; j++) {
      if (usadosNomeMatch.has(restantes[j].id)) continue;
      if (similaridade(restantes[i].nome_completo, restantes[j].nome_completo) >= 0.9) {
        similares.push(restantes[j]);
      }
    }
    if (similares.length >= 2) {
      similares.forEach(c => usadosNomeMatch.add(c.id));
      grupos.push({ motivo: 'Nome muito parecido', confianca: 'media', registros: similares });
    }
  }

  return grupos;
}

// ─── DETECÇÃO — SERVIÇOS ───────────────────────────────────────────────────────
// Confiança alta: nome idêntico após normalizar (resolve exatamente o caso
// "Manicure" cadastrado 2x com espaço/maiúscula diferente). Confiança média:
// nomes muito parecidos (>= 88%) — limiar um pouco mais permissivo que
// clientes, mas ainda conservador para não confundir "Corte" com "Corte +
// Escova", que são serviços genuinamente diferentes.

export function detectarDuplicatasServicos(servicos: any[]): GrupoDuplicataServico[] {
  const grupos: GrupoDuplicataServico[] = [];
  const jaAgrupados = new Set<string>();

  const porNomeNormalizado: Record<string, any[]> = {};
  servicos.forEach(s => {
    const chave = normalizarTexto(s.nome_servico);
    if (!chave) return;
    if (!porNomeNormalizado[chave]) porNomeNormalizado[chave] = [];
    porNomeNormalizado[chave].push(s);
  });
  Object.values(porNomeNormalizado).forEach(lista => {
    if (lista.length < 2) return;
    lista.forEach(s => jaAgrupados.add(s.id));
    grupos.push({ motivo: 'Nome idêntico', confianca: 'alta', registros: lista });
  });

  const restantes = servicos.filter(s => !jaAgrupados.has(s.id));
  const usados = new Set<string>();
  for (let i = 0; i < restantes.length; i++) {
    if (usados.has(restantes[i].id)) continue;
    const similares = [restantes[i]];
    for (let j = i + 1; j < restantes.length; j++) {
      if (usados.has(restantes[j].id)) continue;
      if (similaridade(restantes[i].nome_servico, restantes[j].nome_servico) >= 0.88) {
        similares.push(restantes[j]);
      }
    }
    if (similares.length >= 2) {
      similares.forEach(s => usados.add(s.id));
      grupos.push({ motivo: 'Nome muito parecido', confianca: 'media', registros: similares });
    }
  }

  return grupos;
}

// ─── DETECÇÃO — PRODUTOS ───────────────────────────────────────────────────────
// Confiança alta: mesmo código SKU (quando preenchido) OU nome idêntico
// normalizado. Confiança média: nomes muito parecidos.

export function detectarDuplicatasProdutos(produtos: any[]): GrupoDuplicataProduto[] {
  const grupos: GrupoDuplicataProduto[] = [];
  const jaAgrupados = new Set<string>();

  function agruparPorChave(chaveFn: (p: any) => string | null, motivo: string) {
    const porChave: Record<string, any[]> = {};
    produtos.forEach(p => {
      const chave = chaveFn(p);
      if (!chave) return;
      if (!porChave[chave]) porChave[chave] = [];
      porChave[chave].push(p);
    });
    Object.values(porChave).forEach(lista => {
      const novos = lista.filter(p => !jaAgrupados.has(p.id));
      if (novos.length < 2) return;
      novos.forEach(p => jaAgrupados.add(p.id));
      grupos.push({ motivo, confianca: 'alta', registros: novos });
    });
  }

  agruparPorChave(p => p.codigo_sku || null, 'Mesmo código SKU');
  agruparPorChave(p => normalizarTexto(p.nome_produto) || null, 'Nome idêntico');

  const restantes = produtos.filter(p => !jaAgrupados.has(p.id));
  const usados = new Set<string>();
  for (let i = 0; i < restantes.length; i++) {
    if (usados.has(restantes[i].id)) continue;
    const similares = [restantes[i]];
    for (let j = i + 1; j < restantes.length; j++) {
      if (usados.has(restantes[j].id)) continue;
      if (similaridade(restantes[i].nome_produto, restantes[j].nome_produto) >= 0.88) {
        similares.push(restantes[j]);
      }
    }
    if (similares.length >= 2) {
      similares.forEach(p => usados.add(p.id));
      grupos.push({ motivo: 'Nome muito parecido', confianca: 'media', registros: similares });
    }
  }

  return grupos;
}