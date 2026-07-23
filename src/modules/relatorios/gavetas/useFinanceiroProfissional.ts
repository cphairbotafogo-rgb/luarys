// src/modules/relatorios/gavetas/useFinanceiroProfissional.ts
// Tipos, helpers e lógica de agregação de GavetaFinanceiroProfissional.tsx —
// extraído para manter o componente principal abaixo de 400 linhas.
'use client'
import { useState, useMemo } from 'react';
import { RAIO_SM } from '@/lib/estiloGlobal';
import { C } from '@/lib/constants';

export type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'livre';

export function localStr(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);
}
export function hoje() { return localStr(new Date()); }
export function inicioSemana() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay()); return localStr(d);
}
export function inicioMes() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
export function inicioAno() { return `${new Date().getFullYear()}-01-01`; }

const FORMAS_NORMA: Record<string, string> = {
  dinheiro: 'Dinheiro', cash: 'Dinheiro',
  credito: 'Cartão de Crédito', crédito: 'Cartão de Crédito', 'cartão de crédito': 'Cartão de Crédito',
  debito: 'Cartão de Débito', débito: 'Cartão de Débito', 'cartão de débito': 'Cartão de Débito',
  pix: 'Pix',
};
export function normalizarForma(f: string): string {
  if (!f) return 'Outros';
  return FORMAS_NORMA[f.toLowerCase()] || 'Outros';
}

export function fmtData(iso: string) {
  if (!iso) return '-';
  const [y, m, d] = iso.substring(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function exportarCSV(linhas: any[], profNome: string) {
  const cabecalho = 'Data,Profissional,Cliente,Serviço,Valor,Desconto,Forma de Pagamento,Status';
  const corpo = linhas.map(r =>
    [fmtData(r.data), profNome, r.cliente_nome ?? '', r.servico_id ?? '',
     r.valor_final ?? 0, r.desconto ?? 0, normalizarForma(r.forma_pagamento), r.status ?? '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([`${cabecalho}\n${corpo}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `financeiro_profissional_${profNome.replace(/\s+/g, '_')}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'hoje', label: 'Hoje' }, { id: 'semana', label: 'Esta Semana' },
  { id: 'mes', label: 'Este Mês' }, { id: 'ano', label: 'Este Ano' }, { id: 'livre', label: 'Período Livre' },
];

export function useFinanceiroProfissional(dados: any) {
  const { agendamentos = [], profs = [], financeiro = [] } = dados ?? {};

  const [profId, setProfId] = useState<string>('todos');
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [dataInicio, setDataInicio] = useState(inicioMes());
  const [dataFim, setDataFim] = useState(hoje());

  // Ajusta datas ao mudar período
  function selecionarPeriodo(p: Periodo) {
    setPeriodo(p);
    if (p === 'hoje')   { setDataInicio(hoje());       setDataFim(hoje()); }
    if (p === 'semana') { setDataInicio(inicioSemana()); setDataFim(hoje()); }
    if (p === 'mes')    { setDataInicio(inicioMes());  setDataFim(hoje()); }
    if (p === 'ano')    { setDataInicio(inicioAno());  setDataFim(hoje()); }
  }

  const agsFiltrados = useMemo(() =>
    agendamentos.filter((ag: any) => {
      const d = ag.data?.substring(0, 10) ?? '';
      return d >= dataInicio && d <= dataFim;
    }),
    [agendamentos, dataInicio, dataFim]
  );

  // Mapa profissional_id → nome
  const profMap = useMemo(() => {
    const m: Record<string, any> = {};
    profs.forEach((p: any) => { m[p.id] = p; });
    return m;
  }, [profs]);

  // Map agendamento_id → financeiro (para buscar o valor real pago)
  const mAgFin = useMemo(() => {
    const m = new Map<string, any>();
    financeiro.forEach((fin: any) => {
      if (Array.isArray(fin.agendamento_ids)) {
        fin.agendamento_ids.forEach((aid: string) => { if (typeof aid === 'string') m.set(aid, fin); });
      }
    });
    return m;
  }, [financeiro]);

  // Métricas por profissional — usa financeiro.valor como valor real da visita
  const metricasPorProf = useMemo(() => {
    const mp: Record<string, { ags: any[]; fat: number; desc: number; finIds: Set<string> }> = {};
    agsFiltrados.forEach((ag: any) => {
      const pid = ag.profissional_id ?? 'sem_prof';
      if (!mp[pid]) mp[pid] = { ags: [], fat: 0, desc: 0, finIds: new Set() };
      mp[pid].ags.push(ag);
      if (ag.status === 'Finalizado') {
        const fin = mAgFin.get(ag.id);
        // Soma financeiro.valor uma vez por visita (evita duplicar quando multi-serviço)
        if (fin && !mp[pid].finIds.has(fin.id)) {
          mp[pid].finIds.add(fin.id);
          mp[pid].fat += Number(fin.valor ?? 0);
        } else if (!fin) {
          mp[pid].fat += Number(ag.valor_final ?? 0);
        }
      }
      if ((ag.desconto ?? 0) > 0) mp[pid].desc += Number(ag.desconto);
    });
    return mp;
  }, [agsFiltrados, mAgFin]);

  const profSelecionado = profId !== 'todos' ? profMap[profId] : null;

  const agsProf = useMemo(() =>
    profId === 'todos' ? [] : agsFiltrados.filter((ag: any) => ag.profissional_id === profId),
    [agsFiltrados, profId]
  );

  const kpis = useMemo(() => {
    const finalizados = agsProf.filter((ag: any) => ag.status === 'Finalizado');
    // Usa financeiro.valor somando uma vez por visita (evita duplicação multi-serviço)
    const finVistos = new Set<string>();
    let fat = 0;
    finalizados.forEach((ag: any) => {
      const fin = mAgFin.get(ag.id);
      if (fin && !finVistos.has(fin.id)) { finVistos.add(fin.id); fat += Number(fin.valor ?? 0); }
      else if (!fin) fat += Number(ag.valor_final ?? 0);
    });
    // Qtd de visitas (financeiros únicos ou agendamentos sem financeiro)
    const finVistosQ = new Set<string>();
    let qtd = 0;
    finalizados.forEach((ag: any) => {
      const fin = mAgFin.get(ag.id);
      const key = fin?.id || ag.id;
      if (!finVistosQ.has(key)) { finVistosQ.add(key); qtd++; }
    });
    const ticket = qtd > 0 ? fat / qtd : 0;
    const desc = agsProf.reduce((s: number, ag: any) => s + ((ag.desconto ?? 0) > 0 ? Number(ag.desconto) : 0), 0);
    return { fat, qtd, ticket, desc };
  }, [agsProf, mAgFin]);

  const distribuicaoFormas = useMemo(() => {
    // Lê forma de pagamento do financeiro (valor real), não do agendamento
    const mp: Record<string, number> = {};
    const finVistos = new Set<string>();
    agsProf.filter((ag: any) => ag.status === 'Finalizado').forEach((ag: any) => {
      const fin = mAgFin.get(ag.id);
      if (fin && !finVistos.has(fin.id)) {
        finVistos.add(fin.id);
        const f = normalizarForma(fin.forma_pagamento || fin.metodo_pagamento);
        mp[f] = (mp[f] ?? 0) + Number(fin.valor ?? 0);
      } else if (!fin) {
        const f = normalizarForma(ag.forma_pagamento);
        mp[f] = (mp[f] ?? 0) + Number(ag.valor_final ?? 0);
      }
    });
    const total = Object.values(mp).reduce((s, v) => s + v, 0);
    return Object.entries(mp).sort((a, b) => b[1] - a[1]).map(([forma, val]) => ({
      forma, val, pct: total > 0 ? (val / total) * 100 : 0,
    }));
  }, [agsProf, mAgFin]);

  function btnPeriodo(id: Periodo) {
    const ativo = periodo === id;
    return {
      padding: '6px 12px', borderRadius: RAIO_SM, border: `1px solid ${ativo ? C.sidebarBg : C.border}`,
      background: ativo ? C.sidebarBg : C.bgCard, color: ativo ? '#fff' : C.textMuted,
      fontSize: 12, fontWeight: ativo ? 700 : 400, cursor: 'pointer',
    };
  }

  return {
    profs, profId, setProfId, periodo, dataInicio, setDataInicio, dataFim, setDataFim,
    selecionarPeriodo, agsFiltrados, profSelecionado, agsProf, metricasPorProf,
    kpis, distribuicaoFormas, btnPeriodo,
  };
}
