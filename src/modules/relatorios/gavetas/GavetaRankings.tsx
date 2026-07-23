'use client'
import { useState } from 'react';
import { C, brl } from '@/lib/constants';
import { InputData } from '@/components/InputData';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiAward, FiUsers, FiScissors, FiUser, FiCalendar, FiPackage } from 'react-icons/fi';
import { useRankingPerformance } from '@/modules/relatorios/hooks/useRankingPerformance';
import { fmtPer, DeltaBadge, inputStyle } from './rankings/componentes';
import { TabelaClientes } from './rankings/TabelaClientes';
import { TabelaProfissionais } from './rankings/TabelaProfissionais';
import { TabelaServicos } from './rankings/TabelaServicos';
import { TabelaProdutos } from './rankings/TabelaProdutos';

export function GavetaRankings({ dados, perfil }: any) {
  const r = useRankingPerformance(dados, perfil);
  const [aba, setAba] = useState<'clientes' | 'profissionais' | 'servicos' | 'produtos'>('clientes');
  const labelA = fmtPer(r.dataInicio, r.dataFim);
  const labelB = fmtPer(r.dataInicioB, r.dataFimB);

  const tabStyle = (ativa: boolean): React.CSSProperties => ({
    flex: 1, justifyContent: 'center',
    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 12px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none',
    borderBottom: ativa ? `2px solid ${C.sidebarBg}` : '2px solid transparent',
    color: ativa ? C.sidebarBg : C.textLight,
    textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 0.2s',
  });

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 24 }}>
        <div style={{ background: C.sidebarBg, padding: 12, borderRadius: RAIO_XL, color: '#fff' }}>
          <FiAward size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '1px' }}>Rankings de Performance</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>Clientes, profissionais e serviços ordenados por receita, atendimentos e mais.</p>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '20px 24px', marginBottom: 20 }}>
        {/* Período A */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', marginBottom: 6 }}><FiCalendar size={11} style={{ display: 'inline', marginRight: 4 }} />Período Principal</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <InputData value={r.dataInicio} onChange={r.setDataInicio} style={inputStyle} />
              <span style={{ color: C.textMuted, fontSize: 12 }}>à</span>
              <InputData value={r.dataFim} onChange={r.setDataFim} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Este mês', fn: () => { const d = new Date(); r.setDataInicio(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]); r.setDataFim(new Date().toISOString().split('T')[0]); } },
              { label: 'Mês anterior', fn: () => { const d = new Date(); r.setDataInicio(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]); r.setDataFim(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]); } },
              { label: 'Este ano', fn: () => { const d = new Date(); r.setDataInicio(`${d.getFullYear()}-01-01`); r.setDataFim(`${d.getFullYear()}-12-31`); } },
            ].map(p => <button key={p.label} onClick={p.fn} style={{ background: 'transparent', border: `1px solid ${C.borderMid}`, color: C.textMain, borderRadius: 20, padding: '8px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{p.label}</button>)}
          </div>
          <button
            onClick={() => r.setModoCompara(!r.modoCompara)}
            style={{ marginLeft: 'auto', padding: '9px 18px', borderRadius: RAIO_MD, border: `1px solid ${r.modoCompara ? C.sidebarBg : C.borderMid}`, background: r.modoCompara ? C.sidebarBg : 'transparent', color: r.modoCompara ? '#fff' : C.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {r.modoCompara ? '✕ Fechar Comparação' : '⇄ Comparar Períodos'}
          </button>
        </div>

        {/* Período B — só quando comparação ativa */}
        {r.modoCompara && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', padding: '12px 16px', background: '#F0F9FF', borderRadius: RAIO_MD, border: `1px dashed #93C5FD` }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', marginBottom: 6 }}>Período para Comparar</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <InputData value={r.dataInicioB} onChange={r.setDataInicioB} style={{ ...inputStyle, background: '#fff' }} />
                <span style={{ color: '#1D4ED8', fontSize: 12 }}>à</span>
                <InputData value={r.dataFimB} onChange={r.setDataFimB} style={{ ...inputStyle, background: '#fff' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'Mês anterior', fn: () => { const d = new Date(); r.setDataInicioB(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]); r.setDataFimB(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]); } },
                { label: 'Mês retrasado', fn: () => { const d = new Date(); r.setDataInicioB(new Date(d.getFullYear(), d.getMonth() - 2, 1).toISOString().split('T')[0]); r.setDataFimB(new Date(d.getFullYear(), d.getMonth() - 1, 0).toISOString().split('T')[0]); } },
                { label: 'Ano anterior', fn: () => { const d = new Date(); r.setDataInicioB(`${d.getFullYear() - 1}-01-01`); r.setDataFimB(`${d.getFullYear() - 1}-12-31`); } },
              ].map(p => <button key={p.label} onClick={p.fn} style={{ background: '#fff', border: `1px solid #93C5FD`, color: '#1D4ED8', borderRadius: 20, padding: '7px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{p.label}</button>)}
            </div>
          </div>
        )}
      </div>

      {/* CARDS KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Atendimentos', valorA: String(r.resumoA.total), valorB: r.resumoB ? String(r.resumoB.total) : null, delta: r.deltaVisitas },
          { label: 'Receita Total', valorA: brl(r.resumoA.receita), valorB: r.resumoB ? brl(r.resumoB.receita) : null, delta: r.deltaReceita },
          { label: 'Ticket Médio',  valorA: brl(r.resumoA.ticket),  valorB: r.resumoB ? brl(r.resumoB.ticket)  : null, delta: r.deltaTicket },
        ].map(c => (
          <div key={c.label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.sidebarBg}`, borderRadius: RAIO_XL, padding: '20px 24px' }}>
            <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>{c.label}</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: C.textMain }}>{c.valorA}</h3>
              {c.delta !== null && <DeltaBadge pct={c.delta} />}
            </div>
            {c.valorB && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: C.textMuted }}>
                Comparado: <strong>{c.valorB}</strong>
              </p>
            )}
          </div>
        ))}
      </div>

      {/* TABELAS */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.borderMid}`, background: C.bg }}>
          <button style={tabStyle(aba === 'clientes')}      onClick={() => setAba('clientes')}><FiUsers size={14} /> Clientes ({r.rankingClientes.length})</button>
          <button style={tabStyle(aba === 'profissionais')} onClick={() => setAba('profissionais')}><FiUser size={14} /> Profissionais ({r.rankingProfissionais.length})</button>
          <button style={tabStyle(aba === 'servicos')}      onClick={() => setAba('servicos')}><FiScissors size={14} /> Serviços ({r.rankingServicos.length})</button>
          <button style={tabStyle(aba === 'produtos')}      onClick={() => setAba('produtos')}><FiPackage size={14} /> Produtos ({r.rankingProdutos.length})</button>
        </div>

        {/* LEGENDA A/B compacta */}
        {r.modoCompara && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 20px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, fontSize: 11 }}>
            <span style={{ color: C.textMuted }}>Nas células:</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: C.sidebarBg, borderRadius: 3, padding: '1px 5px' }}>A</span>
              <span style={{ color: C.textMain, fontWeight: 600 }}>{labelA}</span>
            </span>
            <span style={{ color: C.textLight }}>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#64748B', background: '#E2E8F0', borderRadius: 3, padding: '1px 5px' }}>B</span>
              <span style={{ color: C.textMuted, fontWeight: 600 }}>{labelB}</span>
            </span>
          </div>
        )}

        {aba === 'clientes'      && <TabelaClientes      r={r} labelA={labelA} labelB={labelB} />}
        {aba === 'profissionais' && <TabelaProfissionais r={r} labelA={labelA} labelB={labelB} />}
        {aba === 'servicos'      && <TabelaServicos      r={r} labelA={labelA} labelB={labelB} />}
        {aba === 'produtos'      && <TabelaProdutos      r={r} labelA={labelA} labelB={labelB} />}
      </div>
    </div>
  );
}
