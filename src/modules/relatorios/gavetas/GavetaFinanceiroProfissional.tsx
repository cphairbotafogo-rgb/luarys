'use client'

import { useState, useMemo } from 'react';
import { InputData } from '@/components/InputData';
import { C, brl, initials } from '@/lib/constants';
import { RAIO_XS, RAIO_SM, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import {
  FiUser, FiDownload, FiCalendar, FiArrowLeft,
  FiDollarSign, FiScissors, FiTag, FiPercent,
} from 'react-icons/fi';

// ─── Helpers ────────────────────────────────────────────────────────────────

function localStr(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);
}
function hoje() { return localStr(new Date()); }
function inicioSemana() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay()); return localStr(d);
}
function inicioMes() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }
function inicioAno() { return `${new Date().getFullYear()}-01-01`; }

const FORMAS_NORMA: Record<string, string> = {
  dinheiro: 'Dinheiro', cash: 'Dinheiro',
  credito: 'Cartão de Crédito', crédito: 'Cartão de Crédito', 'cartão de crédito': 'Cartão de Crédito',
  debito: 'Cartão de Débito', débito: 'Cartão de Débito', 'cartão de débito': 'Cartão de Débito',
  pix: 'Pix',
};
function normalizarForma(f: string): string {
  if (!f) return 'Outros';
  return FORMAS_NORMA[f.toLowerCase()] || 'Outros';
}

function fmtData(iso: string) {
  if (!iso) return '-';
  const [y, m, d] = iso.substring(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function exportarCSV(linhas: any[], profNome: string) {
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

// ─── Tipos internos ──────────────────────────────────────────────────────────

type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'livre';

// ─── Componente KPI Card ─────────────────────────────────────────────────────

function KpiCard({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL,
      padding: '16px 20px', flex: 1, minWidth: 140 }}>
      <div style={{ color: C.textLight, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.textMain }}>{valor}</div>
    </div>
  );
}

// ─── Badge de status ─────────────────────────────────────────────────────────

function BadgeStatus({ status }: { status: string }) {
  const verde = status === 'Finalizado';
  const vermelho = status === 'Cancelado' || status === 'Faltou';
  const bg = verde ? C.successBg : vermelho ? C.dangerBg : C.border;
  const cor = verde ? C.successText : vermelho ? C.dangerText : C.textMuted;
  return (
    <span style={{ background: bg, color: cor, borderRadius: RAIO_XS,
      padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function GavetaFinanceiroProfissional({ dados, perfil }: any) {
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

  // ─── Estilos reutilizados ────────────────────────────────────────────────

  const periodos: { id: Periodo; label: string }[] = [
    { id: 'hoje', label: 'Hoje' }, { id: 'semana', label: 'Esta Semana' },
    { id: 'mes', label: 'Este Mês' }, { id: 'ano', label: 'Este Ano' }, { id: 'livre', label: 'Período Livre' },
  ];

  function btnPeriodo(id: Periodo) {
    const ativo = periodo === id;
    return {
      padding: '6px 12px', borderRadius: RAIO_SM, border: `1px solid ${ativo ? C.sidebarBg : C.border}`,
      background: ativo ? C.sidebarBg : C.bgCard, color: ativo ? '#fff' : C.textMuted,
      fontSize: 12, fontWeight: ativo ? 700 : 400, cursor: 'pointer',
    };
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Filtros */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL,
        padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>

        {/* Select profissional */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FiUser size={15} color={C.textMuted} />
          <select value={profId} onChange={e => setProfId(e.target.value)}
            style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '6px 10px',
              fontSize: 13, color: C.textMain, background: C.bg }}>
            <option value="todos">Todos os Profissionais</option>
            {profs.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>

        {/* Atalhos de período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <FiCalendar size={15} color={C.textMuted} />
          {periodos.map(p => (
            <button key={p.id} style={btnPeriodo(p.id)} onClick={() => selecionarPeriodo(p.id)}>{p.label}</button>
          ))}
        </div>

        {/* Datas livres */}
        {periodo === 'livre' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <InputData value={dataInicio} onChange={v => setDataInicio(v)}
              style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '6px 8px', fontSize: 13 }} />
            <span style={{ color: C.textMuted }}>até</span>
            <InputData value={dataFim} onChange={v => setDataFim(v)}
              style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '6px 8px', fontSize: 13 }} />
          </div>
        )}

        {/* Exportar CSV */}
        <button onClick={() => {
          const linhas = profId === 'todos' ? agsFiltrados : agsProf;
          const nome = profSelecionado?.nome ?? 'Todos';
          exportarCSV(linhas, nome);
        }} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: RAIO_MD, background: C.sidebarBg,
          color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <FiDownload size={14} /> Exportar CSV
        </button>
      </div>

      {/* Visão Individual */}
      {profSelecionado ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Header individual */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setProfId('todos')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                color: C.sidebarBg, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <FiArrowLeft size={15} /> Ver Todos
            </button>
            <span style={{ color: C.border }}>|</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: C.textMain }}>{profSelecionado.nome}</span>
            {profSelecionado.cargo && (
              <span style={{ fontSize: 12, color: C.textMuted, background: C.bg,
                border: `1px solid ${C.border}`, borderRadius: RAIO_XS, padding: '2px 8px' }}>
                {profSelecionado.cargo}
              </span>
            )}
          </div>

          {/* KPIs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <KpiCard icon={<FiDollarSign size={18} />} label="Faturamento Bruto" valor={brl(kpis.fat)} />
            <KpiCard icon={<FiScissors size={18} />} label="Total de Atendimentos" valor={String(kpis.qtd)} />
            <KpiCard icon={<FiTag size={18} />} label="Ticket Médio" valor={brl(kpis.ticket)} />
            <KpiCard icon={<FiPercent size={18} />} label="Descontos Concedidos" valor={brl(kpis.desc)} />
          </div>

          {/* Tabela de atendimentos */}
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
              fontWeight: 700, fontSize: 14, color: C.textMain }}>Atendimentos no Período</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {['Data', 'Cliente', 'Serviço', 'Valor', 'Desconto', 'Pagamento', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left',
                        color: C.textMuted, fontWeight: 600, fontSize: 11,
                        borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agsProf.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: C.textLight }}>
                      Nenhum atendimento neste período.
                    </td></tr>
                  ) : agsProf.map((ag: any) => (
                    <tr key={ag.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '10px 14px', color: C.textMuted }}>{fmtData(ag.data)}</td>
                      <td style={{ padding: '10px 14px', color: C.textMain }}>{ag.cliente_nome ?? '-'}</td>
                      <td style={{ padding: '10px 14px', color: C.textMuted }}>{ag.servico_id ?? '-'}</td>
                      <td style={{ padding: '10px 14px', color: C.textMain, fontWeight: 600 }}>{brl(ag.valor_final ?? 0)}</td>
                      <td style={{ padding: '10px 14px', color: (ag.desconto ?? 0) > 0 ? C.warning : C.textLight }}>
                        {(ag.desconto ?? 0) > 0 ? brl(ag.desconto) : '-'}
                      </td>
                      <td style={{ padding: '10px 14px', color: C.textMuted }}>{normalizarForma(ag.forma_pagamento)}</td>
                      <td style={{ padding: '10px 14px' }}><BadgeStatus status={ag.status ?? '-'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Distribuição por forma de pagamento */}
          {distribuicaoFormas.length > 0 && (
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '16px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.textMain, marginBottom: 14 }}>
                Distribuição por Forma de Pagamento
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {distribuicaoFormas.map(({ forma, val, pct }) => (
                  <div key={forma}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: C.textMain }}>{forma}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>{brl(val)}</span>
                    </div>
                    <div style={{ background: C.border, borderRadius: RAIO_XS, height: 6 }}>
                      <div style={{ background: C.sidebarBg, borderRadius: RAIO_XS,
                        height: 6, width: `${pct}%`, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      ) : (
        /* Visão Geral — todos os profissionais */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {profs.map((p: any) => {
            const m = metricasPorProf[p.id] ?? { ags: [], fat: 0, desc: 0 };
            const qtd = m.ags.filter((ag: any) => ag.status === 'Finalizado').length;
            const ticket = qtd > 0 ? m.fat / qtd : 0;
            return (
              <div key={p.id} onClick={() => setProfId(p.id)}
                style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL,
                  padding: 20, cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.sidebarBg)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>

                {/* Avatar + info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: C.sidebarBg,
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {initials(p.nome)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.textMain }}>{p.nome}</div>
                    {p.cargo && <div style={{ fontSize: 11, color: C.textMuted }}>{p.cargo}</div>}
                  </div>
                </div>

                {/* Métricas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>Faturamento</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{brl(m.fat)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>Atendimentos</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>{qtd}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>Ticket Médio</span>
                    <span style={{ fontSize: 13, color: C.textMain }}>{brl(ticket)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>Descontos</span>
                    <span style={{ fontSize: 13, color: (m.desc > 0) ? C.warning : C.textLight }}>
                      {m.desc > 0 ? brl(m.desc) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {profs.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: C.textLight }}>
              Nenhum profissional cadastrado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
