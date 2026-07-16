/**
 * src/modules/relatorios/hooks/useRankingPerformance.ts
 *
 * Busca dados diretamente do Supabase para cada período (A e B),
 * sem depender do range global carregado pelo AbaRelatorios.
 * Isso permite comparar qualquer dois períodos independentes.
 */
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { agruparEmVisitas, mapAgParaFin, valorServicoEmVisita, delta, type Visita } from '@/lib/visitasUtils';

function isoHoje() { return new Date().toISOString().split('T')[0]; }
function isoPrimeiroDia(offset = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toISOString().split('T')[0];
}
function isoUltimoDia(offset = -1) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset + 1, 0).toISOString().split('T')[0];
}

function filtrarFinalizados(ags: any[], ini: string, fim: string) {
  return ags.filter((ag: any) => {
    if (ag.status !== 'Finalizado') return false;
    const d = (ag.data || '').split('T')[0];
    return d >= ini && d <= fim;
  });
}

function ordenar(a: any, b: any, campo: string, dir: 'asc' | 'desc') {
  const vA = a[campo] ?? 0, vB = b[campo] ?? 0;
  const r = typeof vA === 'string' ? vA.localeCompare(vB) : vB - vA;
  return dir === 'asc' ? -r : r;
}

export type OrdemCampo = { campo: string; dir: 'asc' | 'desc' };

const AG_SEL   = 'id, cliente_nome, profissional_id, servico_id, data, inicio, status, valor_final, desconto, tipo_desconto, created_at, servicos(nome_servico, categoria)';
const FIN_SEL  = 'id, tipo, status, valor, data_movimentacao, os_numero, agendamento_ids, pagamentos';
const HIST_SEL = 'produto_id, tipo, quantidade, motivo, created_at';

async function fetchPeriodo(salaoId: string, ini: string, fim: string) {
  const [rAg, rFin, rHist] = await Promise.all([
    supabase.from('agendamentos').select(AG_SEL).eq('salao_id', salaoId).gte('data', ini).lte('data', fim).limit(2000),
    supabase.from('financeiro').select(FIN_SEL).eq('salao_id', salaoId).gte('data_movimentacao', `${ini}T00:00:00Z`).lte('data_movimentacao', `${fim}T23:59:59Z`).limit(2000),
    supabase.from('historico_estoque').select(HIST_SEL).eq('salao_id', salaoId).gte('created_at', `${ini}T00:00:00Z`).lte('created_at', `${fim}T23:59:59Z`).limit(2000),
  ]);
  return {
    agendamentos: rAg.data  || [],
    financeiro:   rFin.data || [],
    histEstoque:  rHist.data || [],
  };
}

export function useRankingPerformance(dados: any, perfil?: any) {
  const [dataInicio,  setDataInicio]  = useState(isoPrimeiroDia(0));
  const [dataFim,     setDataFim]     = useState(isoHoje());
  const [modoCompara, setModoCompara] = useState(false);
  const [dataInicioB, setDataInicioB] = useState(isoPrimeiroDia(-1));
  const [dataFimB,    setDataFimB]    = useState(isoUltimoDia(-1));

  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [buscaServico,    setBuscaServico]    = useState('');
  const [ordemClientes,  setOrdemClientes]  = useState<OrdemCampo>({ campo: 'total', dir: 'desc' });
  const [ordemProfs,     setOrdemProfs]     = useState<OrdemCampo>({ campo: 'total', dir: 'desc' });
  const [ordemServicos,  setOrdemServicos]  = useState<OrdemCampo>({ campo: 'total', dir: 'desc' });
  const [ordemProdutos,  setOrdemProdutos]  = useState<OrdemCampo>({ campo: 'total', dir: 'desc' });

  // Dados buscados do Supabase para cada período
  const [dadosA, setDadosA] = useState<{ agendamentos: any[]; financeiro: any[]; histEstoque: any[] } | null>(null);
  const [dadosB, setDadosB] = useState<{ agendamentos: any[]; financeiro: any[]; histEstoque: any[] } | null>(null);

  const salaoId: string | undefined = perfil?.salao_id;

  // Busca período A (debounced 400ms)
  useEffect(() => {
    if (!salaoId) return;
    let active = true;
    const t = setTimeout(async () => {
      const d = await fetchPeriodo(salaoId, dataInicio, dataFim);
      if (active) setDadosA(d);
    }, 400);
    return () => { active = false; clearTimeout(t); };
  }, [salaoId, dataInicio, dataFim]);

  // Busca período B (só quando comparação ativa, debounced 400ms)
  useEffect(() => {
    if (!salaoId || !modoCompara) { setDadosB(null); return; }
    let active = true;
    const t = setTimeout(async () => {
      const d = await fetchPeriodo(salaoId, dataInicioB, dataFimB);
      if (active) setDadosB(d);
    }, 400);
    return () => { active = false; clearTimeout(t); };
  }, [salaoId, modoCompara, dataInicioB, dataFimB]);

  // Dados de referência (sem filtro de período) — vêm do global dados
  const clientesDb: any[] = dados?.clientes || [];
  const profsDb:    any[] = dados?.profs    || [];
  const servicosDb: any[] = dados?.servicos || [];
  const produtosDb: any[] = dados?.produtos || [];

  // Enquanto o fetch do período A não retorna, usa o global como fallback
  const agA   = dadosA?.agendamentos ?? (dados?.agendamentos || []);
  const finA  = dadosA?.financeiro   ?? (dados?.financeiro   || []);
  const histA = dadosA?.histEstoque  ?? (dados?.histEstoque  || []);
  const agB   = dadosB?.agendamentos ?? [];
  const finB  = dadosB?.financeiro   ?? [];
  const histB = dadosB?.histEstoque  ?? [];

  // Todos os agendamentos para calcular "primeiro atendimento" (novo cliente)
  const agendamentosAll: any[] = dados?.agendamentos || [];

  const mAgFinA = useMemo(() => mapAgParaFin(finA), [finA]);
  const mAgFinB = useMemo(() => mapAgParaFin(finB), [finB]);

  const primeiroAgs = useMemo(() => {
    const m: Record<string, string> = {};
    agendamentosAll.forEach((ag: any) => {
      const nome = ag.cliente_nome;
      if (!nome || ag.status === 'Cancelado') return;
      const d = (ag.data || '').split('T')[0];
      if (!m[nome] || d < m[nome]) m[nome] = d;
    });
    return m;
  }, [agendamentosAll]);

  const agsA = useMemo(() => filtrarFinalizados(agA, dataInicio, dataFim),   [agA, dataInicio, dataFim]);
  const agsB = useMemo(() => modoCompara ? filtrarFinalizados(agB, dataInicioB, dataFimB) : [], [agB, dataInicioB, dataFimB, modoCompara]);

  const visitasA = useMemo(() => agruparEmVisitas(agsA, finA, agA), [agsA, finA, agA]);
  const visitasB = useMemo(() => modoCompara ? agruparEmVisitas(agsB, finB, agB) : [], [agsB, finB, agB, modoCompara]);

  function finEntradas(fin: any[], ini: string, fim: string) {
    return fin.filter((f: any) => {
      if (f.tipo !== 'entrada' || f.status === 'Estornado') return false;
      const d = (f.data_movimentacao || '').split('T')[0];
      return d >= ini && d <= fim;
    });
  }

  const finRowsA = useMemo(() => finEntradas(finA, dataInicio, dataFim),   [finA, dataInicio, dataFim]);
  const finRowsB = useMemo(() => modoCompara ? finEntradas(finB, dataInicioB, dataFimB) : [], [finB, dataInicioB, dataFimB, modoCompara]);

  function calcResumo(visitas: Visita[], finRows: any[]) {
    const total   = visitas.length;
    const receita = finRows.reduce((s: number, f: any) => s + Number(f.valor || 0), 0);
    return { total, receita, ticket: total > 0 ? receita / total : 0 };
  }

  const resumoA = useMemo(() => calcResumo(visitasA, finRowsA), [visitasA, finRowsA]);
  const resumoB = useMemo(() => modoCompara ? calcResumo(visitasB, finRowsB) : null, [visitasB, finRowsB, modoCompara]);

  const deltaReceita = resumoB ? delta(resumoA.receita, resumoB.receita) : null;
  const deltaVisitas = resumoB ? delta(resumoA.total,   resumoB.total)   : null;
  const deltaTicket  = resumoB ? delta(resumoA.ticket,  resumoB.ticket)  : null;

  // ── Ranking Clientes ──────────────────────────────────────────────────────

  function buildClientes(visitas: Visita[]) {
    const mapa: Record<string, any> = {};
    visitas.forEach(v => {
      const nome = v.cliente_nome || '—';
      if (!mapa[nome]) {
        const ref = clientesDb.find((c: any) => c.nome_completo === nome || c.nome === nome);
        mapa[nome] = { nome, dataNasc: ref?.data_nascimento || null, dataCadastro: ref?.created_at || null, ultimoAtendimento: v.data, visitas: 0, total: 0, servicos: {} as Record<string, number> };
      }
      mapa[nome].visitas++;
      mapa[nome].total += v.valorTotal;
      if (v.data > mapa[nome].ultimoAtendimento) mapa[nome].ultimoAtendimento = v.data;
      v.agendamentos.forEach((ag: any) => {
        const serv = servicosDb.find((s: any) => s.id === ag.servico_id);
        const emb  = ag.servicos as any;
        const nm   = serv?.nome_servico || emb?.nome_servico || '(sem serviço)';
        const cat  = serv?.categoria    || emb?.categoria    || '';
        const ch   = nm + (cat ? ` [${cat}]` : '');
        mapa[nome].servicos[ch] = (mapa[nome].servicos[ch] || 0) + 1;
      });
    });
    return Object.values(mapa).map(c => ({
      ...c,
      ticket: c.visitas > 0 ? c.total / c.visitas : 0,
      topServicos: Object.entries(c.servicos as Record<string, number>)
        .sort(([, a], [, b]) => b - a)
        .map(([nome, count]) => ({ nome, count })),
    }));
  }

  const rankingClientes  = useMemo(() => buildClientes(visitasA).sort((a, b) => ordenar(a, b, ordemClientes.campo, ordemClientes.dir)), [visitasA, clientesDb, servicosDb, ordemClientes]);
  const rankingClientesB = useMemo(() => modoCompara ? buildClientes(visitasB) : [], [visitasB, clientesDb, servicosDb, modoCompara]);

  // ── Ranking Profissionais ────────────────────────────────────────────────

  function buildProfs(visitas: Visita[], dInicio: string) {
    const mapa: Record<string, any> = {};
    visitas.forEach(v => {
      const profId   = v.profissional_id || 'sem';
      const prof     = profsDb.find((p: any) => p.id === profId);
      const nomeProf = prof?.nome || 'Sem profissional';
      if (!mapa[profId]) mapa[profId] = { nome: nomeProf, atendimentos: 0, clientesDistintos: new Set<string>(), novosClientes: new Set<string>(), total: 0, servicos: {} as Record<string, number> };
      mapa[profId].atendimentos++;
      if (v.cliente_nome) {
        mapa[profId].clientesDistintos.add(v.cliente_nome);
        const primeiro = primeiroAgs[v.cliente_nome];
        if (primeiro && primeiro >= dInicio) mapa[profId].novosClientes.add(v.cliente_nome);
      }
      mapa[profId].total += v.valorTotal;
      v.agendamentos.forEach((ag: any) => {
        const serv = servicosDb.find((s: any) => s.id === ag.servico_id);
        const emb  = ag.servicos as any;
        const nm   = serv?.nome_servico || emb?.nome_servico || '(sem serviço)';
        const cat  = serv?.categoria    || emb?.categoria    || '';
        const ch   = nm + (cat ? ` [${cat}]` : '');
        mapa[profId].servicos[ch] = (mapa[profId].servicos[ch] || 0) + 1;
      });
    });
    const totalGeral = Object.values(mapa).reduce((s: number, p: any) => s + p.total, 0);
    return Object.values(mapa).map((p: any) => {
      const dist  = p.clientesDistintos.size;
      const novos = p.novosClientes.size;
      const topServicos = Object.entries(p.servicos)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([nome, count]) => ({ nome, count: count as number }));
      return { nome: p.nome, atendimentos: p.atendimentos, clientesDistintos: dist, novosClientes: novos, pctRecorrentes: dist > 0 ? Math.round((dist - novos) / dist * 100) : 0, total: p.total, ticket: p.atendimentos > 0 ? p.total / p.atendimentos : 0, pctTotal: totalGeral > 0 ? p.total / totalGeral * 100 : 0, topServicos };
    });
  }

  const rankingProfissionais  = useMemo(() => buildProfs(visitasA, dataInicio).sort((a, b) => ordenar(a, b, ordemProfs.campo, ordemProfs.dir)), [visitasA, profsDb, dataInicio, primeiroAgs, servicosDb, ordemProfs]);
  const rankingProfissionaisB = useMemo(() => modoCompara ? buildProfs(visitasB, dataInicioB) : [], [visitasB, profsDb, dataInicioB, primeiroAgs, servicosDb, modoCompara]);

  // ── Ranking Serviços ─────────────────────────────────────────────────────

  const categoriasUnicas = useMemo(() => {
    const fromDb  = servicosDb.map((s: any) => s.categoria);
    const fromAgs = agA.map((ag: any) => (ag.servicos as any)?.categoria);
    return [...new Set([...fromDb, ...fromAgs].filter(Boolean))].sort() as string[];
  }, [servicosDb, agA]);

  function buildServicos(ags: any[], mFinMap: Map<string, any>) {
    const mapa: Record<string, any> = {};
    ags.forEach((ag: any) => {
      const serv = servicosDb.find((s: any) => s.id === ag.servico_id);
      const emb  = ag.servicos as any;
      const nome = serv?.nome_servico || emb?.nome_servico || '(serviço removido)';
      const cat  = serv?.categoria    || emb?.categoria    || '—';
      if (filtroCategoria && cat !== filtroCategoria) return;
      if (buscaServico && !nome.toLowerCase().includes(buscaServico.toLowerCase())) return;
      const key = ag.servico_id || nome;
      if (!mapa[key]) mapa[key] = { nome, categoria: cat, execucoes: 0, clientesDistintos: new Set<string>(), visitasUnicas: new Set<string>(), total: 0, profs: {} as Record<string, number> };
      mapa[key].execucoes++;
      if (ag.cliente_nome) mapa[key].clientesDistintos.add(ag.cliente_nome);
      const fin = mFinMap.get(ag.id) || null;
      mapa[key].visitasUnicas.add(fin?.id || ag.id);
      mapa[key].total += valorServicoEmVisita(ag, fin);
      if (ag.profissional_id) {
        const nm = profsDb.find((p: any) => p.id === ag.profissional_id)?.nome || 'Sem profissional';
        mapa[key].profs[nm] = (mapa[key].profs[nm] || 0) + 1;
      }
    });
    const totalGeral = Object.values(mapa).reduce((s: number, v: any) => s + v.total, 0);
    return Object.values(mapa).map((s: any) => ({
      nome: s.nome, categoria: s.categoria, execucoes: s.execucoes,
      clientesDistintos: s.clientesDistintos.size,
      visitasUnicas: s.visitasUnicas.size,
      mediaPorAtendimento: s.visitasUnicas.size > 0 ? s.execucoes / s.visitasUnicas.size : 0,
      total: s.total, ticket: s.execucoes > 0 ? s.total / s.execucoes : 0,
      pctTotal: totalGeral > 0 ? s.total / totalGeral * 100 : 0,
      topProfs: Object.entries(s.profs).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5).map(([nome, count]) => ({ nome, count: count as number })),
    }));
  }

  const rankingServicos  = useMemo(() => buildServicos(agsA, mAgFinA).sort((a, b) => ordenar(a, b, ordemServicos.campo, ordemServicos.dir)), [agsA, servicosDb, mAgFinA, filtroCategoria, buscaServico, ordemServicos]);
  const rankingServicosB = useMemo(() => modoCompara ? buildServicos(agsB, mAgFinB) : [], [agsB, servicosDb, mAgFinB, filtroCategoria, buscaServico, modoCompara]);

  // ── Ranking Produtos ─────────────────────────────────────────────────────

  function buildProdutos(hist: any[]) {
    const movimentos = hist.filter((h: any) => h.tipo === 'Saída' && (h.motivo || '').toLowerCase().includes('venda'));
    const mapa: Record<string, any> = {};
    movimentos.forEach((h: any) => {
      const prod = produtosDb.find((p: any) => p.id === h.produto_id);
      if (!prod) return;
      const key  = prod.id;
      const qtd  = Number(h.quantidade) || 0;
      const preco = prod.preco_venda || 0;
      if (!mapa[key]) mapa[key] = { nome: prod.nome_produto || '—', categoria: prod.categoria || '—', preco, unidadesVendidas: 0, clientesDistintos: new Set<string>(), total: 0 };
      mapa[key].unidadesVendidas += qtd;
      mapa[key].total += preco * qtd;
      if (h.cliente_nome) mapa[key].clientesDistintos.add(h.cliente_nome);
    });
    const totalGeral = Object.values(mapa).reduce((s: number, p: any) => s + p.total, 0);
    return Object.values(mapa).map((p: any) => ({
      nome: p.nome, categoria: p.categoria, unidadesVendidas: p.unidadesVendidas,
      clientesDistintos: p.clientesDistintos.size, total: p.total,
      ticket: p.unidadesVendidas > 0 ? p.total / p.unidadesVendidas : 0,
      pctTotal: totalGeral > 0 ? p.total / totalGeral * 100 : 0,
    }));
  }

  const rankingProdutos  = useMemo(() => buildProdutos(histA).sort((a, b) => ordenar(a, b, ordemProdutos.campo, ordemProdutos.dir)), [histA, produtosDb, ordemProdutos]);
  const rankingProdutosB = useMemo(() => modoCompara ? buildProdutos(histB) : [], [histB, produtosDb, modoCompara]);

  return {
    dataInicio, setDataInicio, dataFim, setDataFim,
    modoCompara, setModoCompara,
    dataInicioB, setDataInicioB, dataFimB, setDataFimB,
    filtroCategoria, setFiltroCategoria, buscaServico, setBuscaServico, categoriasUnicas,
    ordemClientes, setOrdemClientes, ordemProfs, setOrdemProfs, ordemServicos, setOrdemServicos,
    ordemProdutos, setOrdemProdutos,
    rankingClientes, rankingClientesB,
    rankingProfissionais, rankingProfissionaisB,
    rankingServicos, rankingServicosB,
    rankingProdutos, rankingProdutosB,
    resumoA, resumoB, deltaReceita, deltaVisitas, deltaTicket,
    agsA,
  };
}
