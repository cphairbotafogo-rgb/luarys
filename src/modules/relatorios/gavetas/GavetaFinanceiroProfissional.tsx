'use client'

import { InputData } from '@/components/InputData';
import { C, brl, initials } from '@/lib/constants';
import { RAIO_XS, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import {
  FiUser, FiDownload, FiCalendar, FiArrowLeft,
  FiDollarSign, FiScissors, FiTag, FiPercent,
} from 'react-icons/fi';
import { KpiCard, BadgeStatus } from './componentesFinanceiroProfissional';
import { useFinanceiroProfissional, PERIODOS, fmtData, normalizarForma, exportarCSV } from './useFinanceiroProfissional';

export function GavetaFinanceiroProfissional({ dados }: any) {
  const g = useFinanceiroProfissional(dados);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Filtros */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL,
        padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>

        {/* Select profissional */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FiUser size={15} color={C.textMuted} />
          <select value={g.profId} onChange={e => g.setProfId(e.target.value)}
            style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '6px 10px',
              fontSize: 13, color: C.textMain, background: C.bg }}>
            <option value="todos">Todos os Profissionais</option>
            {g.profs.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>

        {/* Atalhos de período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <FiCalendar size={15} color={C.textMuted} />
          {PERIODOS.map(p => (
            <button key={p.id} style={g.btnPeriodo(p.id)} onClick={() => g.selecionarPeriodo(p.id)}>{p.label}</button>
          ))}
        </div>

        {/* Datas livres */}
        {g.periodo === 'livre' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <InputData value={g.dataInicio} onChange={v => g.setDataInicio(v)}
              style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '6px 8px', fontSize: 13 }} />
            <span style={{ color: C.textMuted }}>até</span>
            <InputData value={g.dataFim} onChange={v => g.setDataFim(v)}
              style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '6px 8px', fontSize: 13 }} />
          </div>
        )}

        {/* Exportar CSV */}
        <button onClick={() => {
          const linhas = g.profId === 'todos' ? g.agsFiltrados : g.agsProf;
          const nome = g.profSelecionado?.nome ?? 'Todos';
          exportarCSV(linhas, nome);
        }} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: RAIO_MD, background: C.sidebarBg,
          color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <FiDownload size={14} /> Exportar CSV
        </button>
      </div>

      {/* Visão Individual */}
      {g.profSelecionado ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Header individual */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => g.setProfId('todos')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                color: C.sidebarBg, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              <FiArrowLeft size={15} /> Ver Todos
            </button>
            <span style={{ color: C.border }}>|</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: C.textMain }}>{g.profSelecionado.nome}</span>
            {g.profSelecionado.cargo && (
              <span style={{ fontSize: 12, color: C.textMuted, background: C.bg,
                border: `1px solid ${C.border}`, borderRadius: RAIO_XS, padding: '2px 8px' }}>
                {g.profSelecionado.cargo}
              </span>
            )}
          </div>

          {/* KPIs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <KpiCard icon={<FiDollarSign size={18} />} label="Faturamento Bruto" valor={brl(g.kpis.fat)} />
            <KpiCard icon={<FiScissors size={18} />} label="Total de Atendimentos" valor={String(g.kpis.qtd)} />
            <KpiCard icon={<FiTag size={18} />} label="Ticket Médio" valor={brl(g.kpis.ticket)} />
            <KpiCard icon={<FiPercent size={18} />} label="Descontos Concedidos" valor={brl(g.kpis.desc)} />
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
                  {g.agsProf.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: C.textLight }}>
                      Nenhum atendimento neste período.
                    </td></tr>
                  ) : g.agsProf.map((ag: any) => (
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
          {g.distribuicaoFormas.length > 0 && (
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '16px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.textMain, marginBottom: 14 }}>
                Distribuição por Forma de Pagamento
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {g.distribuicaoFormas.map(({ forma, val, pct }) => (
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
          {g.profs.map((p: any) => {
            const m = g.metricasPorProf[p.id] ?? { ags: [], fat: 0, desc: 0 };
            const qtd = m.ags.filter((ag: any) => ag.status === 'Finalizado').length;
            const ticket = qtd > 0 ? m.fat / qtd : 0;
            return (
              <div key={p.id} onClick={() => g.setProfId(p.id)}
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
          {g.profs.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: C.textLight }}>
              Nenhum profissional cadastrado.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
