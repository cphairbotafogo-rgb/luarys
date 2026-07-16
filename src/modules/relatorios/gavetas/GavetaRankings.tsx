'use client'
import React, { useState } from 'react';
import { C, brl } from '@/lib/constants';
import { InputData } from '@/components/InputData';
import { RAIO_MD, RAIO_XL, RAIO_SM } from '@/lib/estiloGlobal';
import { FiAward, FiUsers, FiScissors, FiUser, FiCalendar, FiChevronUp, FiChevronDown, FiSearch, FiX, FiTrendingUp, FiTrendingDown, FiMinus, FiPackage } from 'react-icons/fi';
import { delta } from '@/lib/visitasUtils';
import { useRankingPerformance, type OrdemCampo } from '@/modules/relatorios/hooks/useRankingPerformance';
import { PainelComparacao } from './PainelComparacao';

function fmtPer(s: string, e: string) {
  const [,ms,ds] = s.split('-'); const [,me,de] = e.split('-');
  return `${ds}/${ms} – ${de}/${me}`;
}

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  const p = d.split('T')[0].split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const positivo = pct >= 0;
  const Icon = Math.abs(pct) < 0.1 ? FiMinus : positivo ? FiTrendingUp : FiTrendingDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: positivo ? '#047857' : '#B91C1C', background: positivo ? '#D1FAE5' : '#FEE2E2', borderRadius: 20, padding: '2px 8px' }}>
      <Icon size={11} /> {Math.abs(pct).toFixed(1)}%
    </span>
  );
}
function CelComp({ a, b }: { a: string; b?: string | null }) {
  if (!b) return <>{a}</>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontWeight: 700 }}>{a}</span>
      <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>{b}</span>
    </div>
  );
}
// Indicador A/B para a primeira coluna de cada linha
function AbBadges() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: '#1E3A5F', borderRadius: 3, padding: '1px 5px', lineHeight: 1.5 }}>A</span>
      <span style={{ fontSize: 9, fontWeight: 800, color: '#64748B', background: '#E2E8F0', borderRadius: 3, padding: '1px 5px', lineHeight: 1.5 }}>B</span>
    </div>
  );
}
function CelDelta({ pct, diff }: { pct: number | null; diff: number }) {
  if (pct === null) return null;
  const pos = diff >= 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <DeltaBadge pct={pct} />
      <span style={{ fontSize: 11, fontWeight: 700, color: pos ? '#047857' : '#B91C1C' }}>{pos ? '+' : ''}{brl(diff)}</span>
    </div>
  );
}

export function GavetaRankings({ dados, perfil }: any) {
  const r = useRankingPerformance(dados, perfil);
  const [aba, setAba] = useState<'clientes' | 'profissionais' | 'servicos' | 'produtos'>('clientes');
  const [selC, setSelC]     = useState<string | null>(null);
  const [selP, setSelP]     = useState<string | null>(null);
  const [selS, setSelS]     = useState<string | null>(null);
  const [selPr, setSelPr]   = useState<string | null>(null);
  const [selCat, setSelCat] = useState<string | null>(null);
  const [catCollapsed, setCatCollapsed] = useState<Set<string>>(new Set());
  const labelA = fmtPer(r.dataInicio, r.dataFim);
  const labelB = fmtPer(r.dataInicioB, r.dataFimB);

  const inputStyle = { padding: '9px 13px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: C.bgCard, fontWeight: 500 };
  const tabStyle = (ativa: boolean): React.CSSProperties => ({
    flex: 1, justifyContent: 'center',
    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 12px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none',
    borderBottom: ativa ? `2px solid ${C.sidebarBg}` : '2px solid transparent',
    color: ativa ? C.sidebarBg : C.textLight,
    textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 0.2s',
  });
  const tdBase: React.CSSProperties = { padding: '13px 16px', fontSize: 13, borderBottom: `1px solid ${C.border}` };
  const tdNum:  React.CSSProperties = { ...tdBase, textAlign: 'right', fontWeight: 600 };
  const tdDest: React.CSSProperties = { ...tdNum, color: C.sidebarBg, fontWeight: 800 };
  const thFixo: React.CSSProperties = { padding: '12px 16px', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', background: C.bg, borderBottom: `1px solid ${C.borderMid}`, width: 48 };
  const medal = (i: number) => i < 3 ? ['🥇','🥈','🥉'][i] : String(i + 1);

  function thProps(campo: string, ordem: OrdemCampo, setOrdem: (o: OrdemCampo) => void) {
    const ativa = ordem.campo === campo;
    return {
      style: { padding: '12px 16px', fontSize: 10, fontWeight: 700, color: ativa ? C.sidebarBg : C.textLight, textTransform: 'uppercase' as const, cursor: 'pointer', whiteSpace: 'nowrap' as const, userSelect: 'none' as const, textAlign: 'left' as const, background: C.bg, borderBottom: `1px solid ${C.borderMid}` },
      onClick: () => setOrdem(ativa ? { campo, dir: ordem.dir === 'desc' ? 'asc' : 'desc' } : { campo, dir: 'desc' }),
    };
  }
  function Seta({ campo, ordem }: { campo: string; ordem: OrdemCampo }) {
    if (ordem.campo !== campo) return <span style={{ color: C.textLight, marginLeft: 4, fontSize: 9 }}>↕</span>;
    return ordem.dir === 'desc' ? <FiChevronDown size={12} style={{ display: 'inline', marginLeft: 3 }} /> : <FiChevronUp size={12} style={{ display: 'inline', marginLeft: 3 }} />;
  }

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

        {/* CLIENTES */}
        {aba === 'clientes' && (
          <>
            {selC && <PainelComparacao aba="clientes" nome={selC} dadosA={r.rankingClientes.find(x => x.nome === selC)} dadosB={r.modoCompara ? r.rankingClientesB.find(x => x.nome === selC) : null} labelA={labelA} labelB={labelB} onFechar={() => setSelC(null)} />}
            <div style={{ overflowX: 'auto' }}>
            {r.rankingClientes.length === 0
              ? <p style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Nenhum atendimento finalizado no período selecionado.</p>
              : <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                  <thead><tr>
                    <th style={thFixo}>#</th>
                    {(['nome','dataNasc','dataCadastro','ultimoAtendimento','visitas','total','ticket'] as const).map((campo, i) =>
                      <th key={campo} {...thProps(campo, r.ordemClientes, r.setOrdemClientes)}>
                        {['Cliente','Aniversário','Cadastro','Último Atend.','Visitas','Total','Ticket'][i]}
                        <Seta campo={campo} ordem={r.ordemClientes} />
                      </th>
                    )}
                    {r.modoCompara && <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', background: C.bg, borderBottom: `1px solid ${C.borderMid}`, whiteSpace: 'nowrap' }}>∆ Receita</th>}
                  </tr></thead>
                  <tbody>
                    {r.rankingClientes.map((c, i) => {
                      const itemB = r.modoCompara ? r.rankingClientesB.find((x: any) => x.nome === c.nome) : null;
                      const pct = itemB ? delta(c.total, itemB.total) : null;
                      return (
                      <tr key={c.nome + i} onClick={() => setSelC(prev => prev === c.nome ? null : c.nome)} style={{ cursor: 'pointer', background: selC === c.nome ? `${C.sidebarBg}0C` : 'transparent' }}>
                        <td style={{ ...tdBase, color: selC === c.nome ? C.sidebarBg : C.textLight, fontWeight: 700, fontSize: 12, textAlign: 'center' }}>{selC === c.nome ? '✓' : medal(i)}</td>
                        <td style={{ ...tdBase, fontWeight: 700, color: C.textMain }}>{c.nome}</td>
                        <td style={{ ...tdBase, color: C.textMuted, fontSize: 12 }}>{c.dataNasc ? (() => { const p = c.dataNasc.split('-'); return `${p[2]}/${p[1]}`; })() : '—'}</td>
                        <td style={{ ...tdBase, color: C.textMuted, fontSize: 12 }}>{fmt(c.dataCadastro)}</td>
                        <td style={{ ...tdBase, color: C.textMuted, fontSize: 12 }}>{fmt(c.ultimoAtendimento)}</td>
                        <td style={tdNum}>{c.visitas}</td>
                        <td style={tdDest}><CelComp a={brl(c.total)} b={r.modoCompara ? brl(itemB?.total ?? 0) : undefined} /></td>
                        <td style={{ ...tdNum, color: C.textMain }}><CelComp a={brl(c.ticket)} b={r.modoCompara ? brl(itemB?.ticket ?? 0) : undefined} /></td>
                        {r.modoCompara && <td style={tdNum}><CelDelta pct={pct} diff={c.total - (itemB?.total ?? 0)} /></td>}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
            }
            </div>
          </>
        )}

        {/* PROFISSIONAIS */}
        {aba === 'profissionais' && (
          <>
            {selP && <PainelComparacao aba="profissionais" nome={selP} dadosA={r.rankingProfissionais.find(x => x.nome === selP)} dadosB={r.modoCompara ? r.rankingProfissionaisB.find(x => x.nome === selP) : null} labelA={labelA} labelB={labelB} onFechar={() => setSelP(null)} />}
            <div style={{ overflowX: 'auto' }}>
            {r.rankingProfissionais.length === 0
              ? <p style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Nenhum atendimento finalizado no período selecionado.</p>
              : <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
                  <thead><tr>
                    <th style={thFixo}>#</th>
                    {[
                      { campo: 'nome', label: 'Profissional' }, { campo: 'atendimentos', label: 'Atendimentos' },
                      { campo: 'clientesDistintos', label: 'Clientes' }, { campo: 'novosClientes', label: 'Novos' },
                      { campo: 'pctRecorrentes', label: '% Recorrentes' }, { campo: 'total', label: 'Valor Total' },
                      { campo: 'ticket', label: 'Ticket Médio' }, { campo: 'pctTotal', label: '% do Total' },
                    ].map(col => <th key={col.campo} {...thProps(col.campo, r.ordemProfs, r.setOrdemProfs)}>{col.label}<Seta campo={col.campo} ordem={r.ordemProfs} /></th>)}
                    {r.modoCompara && <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', background: C.bg, borderBottom: `1px solid ${C.borderMid}`, whiteSpace: 'nowrap' }}>∆ Total</th>}
                  </tr></thead>
                  <tbody>
                    {r.rankingProfissionais.map((p, i) => {
                      const itemB = r.modoCompara ? r.rankingProfissionaisB.find((x: any) => x.nome === p.nome) : null;
                      const pct = itemB ? delta(p.total, itemB.total) : null;
                      return (
                      <tr key={p.nome + i} onClick={() => setSelP(prev => prev === p.nome ? null : p.nome)} style={{ cursor: 'pointer', background: selP === p.nome ? `${C.sidebarBg}0C` : 'transparent' }}>
                        <td style={{ ...tdBase, color: selP === p.nome ? C.sidebarBg : C.textLight, fontWeight: 700, fontSize: 12, textAlign: 'center' }}>{selP === p.nome ? '✓' : medal(i)}</td>
                        <td style={{ ...tdBase, fontWeight: 700, color: C.textMain }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${C.sidebarBg}18`, color: C.sidebarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                              {p.nome?.charAt(0).toUpperCase()}
                            </div>
                            {p.nome}
                          </div>
                        </td>
                        <td style={tdNum}>{p.atendimentos}</td>
                        <td style={tdNum}>{p.clientesDistintos}</td>
                        <td style={{ ...tdNum, color: '#10B981' }}>{p.novosClientes}</td>
                        <td style={tdNum}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 2, minWidth: 40 }}>
                              <div style={{ width: `${p.pctRecorrentes}%`, height: '100%', background: C.sidebarBg, borderRadius: 2 }} />
                            </div>
                            <span style={{ minWidth: 36 }}>{p.pctRecorrentes}%</span>
                          </div>
                        </td>
                        <td style={tdDest}><CelComp a={brl(p.total)} b={r.modoCompara ? brl(itemB?.total ?? 0) : undefined} /></td>
                        <td style={{ ...tdNum, color: C.textMain }}><CelComp a={brl(p.ticket)} b={r.modoCompara ? brl(itemB?.ticket ?? 0) : undefined} /></td>
                        <td style={tdNum}>
                          <span style={{ background: `${C.sidebarBg}14`, color: C.sidebarBg, padding: '3px 8px', borderRadius: RAIO_SM, fontSize: 11, fontWeight: 800 }}>{p.pctTotal.toFixed(1)}%</span>
                        </td>
                        {r.modoCompara && <td style={tdNum}><CelDelta pct={pct} diff={p.total - (itemB?.total ?? 0)} /></td>}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
            }
            </div>
          </>
        )}

        {/* SERVIÇOS — agrupados por categoria */}
        {aba === 'servicos' && (() => {
          const filtrados = r.rankingServicos.filter((s: any) =>
            (!r.buscaServico || s.nome.toLowerCase().includes(r.buscaServico.toLowerCase())) &&
            (!r.filtroCategoria || s.categoria === r.filtroCategoria)
          );

          const catMap = new Map<string, typeof filtrados>();
          filtrados.forEach((s: any) => {
            if (!catMap.has(s.categoria)) catMap.set(s.categoria, []);
            catMap.get(s.categoria)!.push(s);
          });
          const categorias = [...catMap.keys()].sort((a, b) => {
            const sumA = catMap.get(a)!.reduce((acc: number, s: any) => acc + s.total, 0);
            const sumB = catMap.get(b)!.reduce((acc: number, s: any) => acc + s.total, 0);
            return sumB - sumA;
          });

          const totalGeralA = filtrados.reduce((acc: number, s: any) => acc + s.total, 0);

          const thS: React.CSSProperties = { padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' as const, background: C.bg, borderBottom: `1px solid ${C.borderMid}`, whiteSpace: 'nowrap' as const, textAlign: 'right' as const };

          // Painel lateral da categoria selecionada
          const catPainelData = selCat ? (() => {
            const servsCat = r.rankingServicos.filter((s: any) => s.categoria === selCat);
            const totalA = servsCat.reduce((a: number, s: any) => a + s.total, 0);
            const execsA = servsCat.reduce((a: number, s: any) => a + s.execucoes, 0);
            const pctA   = totalGeralA > 0 ? (totalA / totalGeralA) * 100 : 0;
            const dadosA = { execucoes: execsA, clientesDistintos: servsCat.reduce((a: number, s: any) => a + (s.clientesDistintos || 0), 0), total: totalA, ticket: execsA > 0 ? totalA / execsA : 0, pctTotal: pctA };

            const servsCatB = r.modoCompara ? r.rankingServicosB.filter((s: any) => s.categoria === selCat) : [];
            const totalB = servsCatB.reduce((a: number, s: any) => a + s.total, 0);
            const execsB = servsCatB.reduce((a: number, s: any) => a + s.execucoes, 0);
            const dadosB = r.modoCompara ? { execucoes: execsB, clientesDistintos: servsCatB.reduce((a: number, s: any) => a + (s.clientesDistintos || 0), 0), total: totalB, ticket: execsB > 0 ? totalB / execsB : 0, pctTotal: 0 } : null;
            return { dadosA, dadosB };
          })() : null;

          function toggleCat(cat: string) {
            setCatCollapsed(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
          }

          return (
            <>
              {/* Painel lateral de categoria */}
              {selCat && catPainelData && (
                <PainelComparacao aba="servicos" nome={selCat} dadosA={catPainelData.dadosA} dadosB={catPainelData.dadosB} labelA={labelA} labelB={labelB} onFechar={() => setSelCat(null)} />
              )}
              {/* Painel lateral de serviço individual */}
              {selS && !selCat && (
                <PainelComparacao aba="servicos" nome={selS} dadosA={r.rankingServicos.find((x: any) => x.nome === selS)} dadosB={r.modoCompara ? r.rankingServicosB.find((x: any) => x.nome === selS) : null} labelA={labelA} labelB={labelB} onFechar={() => setSelS(null)} />
              )}

              {/* Barra de filtros */}
              <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${C.borderMid}`, background: C.bg, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
                  <FiSearch size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.textLight, pointerEvents: 'none' }} />
                  <input type="text" placeholder="Buscar serviço..." value={r.buscaServico} onChange={e => r.setBuscaServico(e.target.value)} style={{ ...inputStyle, paddingLeft: 32, width: '100%' }} />
                  {r.buscaServico && <button onClick={() => r.setBuscaServico('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex' }}><FiX size={13} /></button>}
                </div>
                <select value={r.filtroCategoria} onChange={e => r.setFiltroCategoria(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
                  <option value="">Todas as Categorias</option>
                  {r.categoriasUnicas.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              {filtrados.length === 0
                ? <p style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Nenhum serviço encontrado no período.</p>
                : <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780, tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: 48 }} />
                        <col />
                        <col style={{ width: 110 }} />
                        <col style={{ width: 130 }} />
                        <col style={{ width: 140 }} />
                        <col style={{ width: 120 }} />
                        {r.modoCompara && <col style={{ width: 130 }} />}
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={{ ...thS, textAlign: 'center' }} />
                          <th style={{ ...thS, textAlign: 'left' }}>Serviço</th>
                          <th style={thS}>Realizados</th>
                          <th style={thS}>Ticket Médio</th>
                          <th style={thS}>Valor Total</th>
                          <th style={thS}>% do Total</th>
                          {r.modoCompara && <th style={thS}>∆ Total</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {categorias.map(cat => {
                          const servs     = catMap.get(cat)!;
                          const collapsed = catCollapsed.has(cat);
                          const catTotalA = servs.reduce((a: number, s: any) => a + s.total, 0);
                          const catExecsA = servs.reduce((a: number, s: any) => a + s.execucoes, 0);
                          const catPctA   = totalGeralA > 0 ? (catTotalA / totalGeralA) * 100 : 0;
                          const servsB    = r.modoCompara ? r.rankingServicosB.filter((x: any) => x.categoria === cat) : [];
                          const catTotalB = servsB.reduce((a: number, s: any) => a + s.total, 0);
                          const catExecsB = servsB.reduce((a: number, s: any) => a + s.execucoes, 0);
                          const catPct    = r.modoCompara ? delta(catTotalA, catTotalB) : null;
                          const catSel    = selCat === cat;
                          const catTicketA = catExecsA > 0 ? catTotalA / catExecsA : 0;
                          const catTicketB = catExecsB > 0 ? catTotalB / catExecsB : 0;
                          const bTop: React.CSSProperties = { borderTop: `2px solid ${C.borderMid}` };
                          const bg: React.CSSProperties   = { background: catSel ? `${C.sidebarBg}18` : `${C.sidebarBg}0A` };

                          return (
                            <React.Fragment key={cat}>
                              {/* ── LINHA DE CATEGORIA ── */}
                              <tr style={bg}>
                                {/* Col 1: chevron + A/B quando comparação ativa */}
                                <td style={{ ...bTop, borderLeft: `4px solid ${catSel ? C.sidebarBg : `${C.sidebarBg}55`}`, padding: '8px 4px', textAlign: 'center' as const }}>
                                  <button onClick={e => { e.stopPropagation(); toggleCat(cat); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: C.sidebarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                    {collapsed ? <FiChevronDown size={14} /> : <FiChevronUp size={14} />}
                                  </button>
                                  {r.modoCompara && <AbBadges />}
                                </td>
                                {/* Col 2: nome */}
                                <td style={{ ...bTop, padding: '8px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FiScissors size={12} color={C.sidebarBg} style={{ flexShrink: 0 }} />
                                    <button onClick={() => { setSelCat(prev => prev === cat ? null : cat); setSelS(null); }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                                      <span style={{ fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase' as const, letterSpacing: '0.6px' }}>{cat}</span>
                                    </button>
                                    <span style={{ fontSize: 10, color: C.textMuted }}>{servs.length} serv.</span>
                                    <span style={{ fontSize: 11, color: catSel ? C.sidebarBg : C.textLight, fontWeight: 700 }}>{catSel ? '⇄' : '›'}</span>
                                  </div>
                                </td>
                                {/* Col 3-7 */}
                                <td style={{ ...tdNum, ...bTop, fontWeight: 700, color: C.sidebarBg }}>
                                  <CelComp a={String(catExecsA)} b={r.modoCompara ? String(catExecsB) : undefined} />
                                </td>
                                <td style={{ ...tdNum, ...bTop, fontWeight: 700, color: C.sidebarBg }}>
                                  <CelComp a={brl(catTicketA)} b={r.modoCompara ? brl(catTicketB) : undefined} />
                                </td>
                                <td style={{ ...tdDest, ...bTop }}>
                                  <CelComp a={brl(catTotalA)} b={r.modoCompara ? brl(catTotalB) : undefined} />
                                </td>
                                <td style={{ ...tdNum, ...bTop }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, flexShrink: 0 }}>
                                      <div style={{ width: `${Math.min(catPctA, 100)}%`, height: '100%', background: C.sidebarBg, borderRadius: 2 }} />
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: 12 }}>{catPctA.toFixed(1)}%</span>
                                  </div>
                                </td>
                                {r.modoCompara && (
                                  <td style={{ ...tdNum, ...bTop }}>
                                    <CelDelta pct={catPct} diff={catTotalA - catTotalB} />
                                  </td>
                                )}
                              </tr>

                              {/* ── SERVIÇOS (collapsible) ── */}
                              {!collapsed && servs.map((s: any, idx: number) => {
                                const itemB = r.modoCompara ? r.rankingServicosB.find((x: any) => x.nome === s.nome) : null;
                                const pct   = itemB ? delta(s.total, itemB.total) : null;
                                const sel   = selS === s.nome && !selCat;
                                return (
                                  <tr key={s.nome + idx}
                                    onClick={() => { setSelS(prev => prev === s.nome ? null : s.nome); setSelCat(null); }}
                                    style={{ cursor: 'pointer', background: sel ? `${C.sidebarBg}0C` : 'transparent', transition: 'background 0.1s' }}
                                  >
                                    {/* Col 1: A/B badges ou ✓/↳ */}
                                    <td style={{ padding: '8px 4px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' as const }}>
                                      {r.modoCompara
                                        ? <AbBadges />
                                        : <span style={{ color: sel ? C.sidebarBg : C.textLight, fontSize: 12 }}>{sel ? '✓' : '↳'}</span>
                                      }
                                    </td>
                                    <td style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, color: C.textMain, fontSize: 13 }}>
                                      {s.nome}
                                    </td>
                                    <td style={{ ...tdNum, borderBottom: `1px solid ${C.border}` }}>
                                      <CelComp a={String(s.execucoes)} b={r.modoCompara ? String(itemB?.execucoes ?? 0) : undefined} />
                                    </td>
                                    <td style={{ ...tdNum, color: C.textMain, borderBottom: `1px solid ${C.border}` }}>
                                      <CelComp a={brl(s.ticket)} b={r.modoCompara ? brl(itemB?.ticket ?? 0) : undefined} />
                                    </td>
                                    <td style={{ ...tdDest, borderBottom: `1px solid ${C.border}` }}>
                                      <CelComp a={brl(s.total)} b={r.modoCompara ? brl(itemB?.total ?? 0) : undefined} />
                                    </td>
                                    <td style={{ ...tdNum, borderBottom: `1px solid ${C.border}` }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 36, height: 3, background: C.border, borderRadius: 2, flexShrink: 0 }}>
                                          <div style={{ width: `${Math.min(s.pctTotal, 100)}%`, height: '100%', background: `${C.sidebarBg}80`, borderRadius: 2 }} />
                                        </div>
                                        <span style={{ fontSize: 12 }}>{s.pctTotal.toFixed(1)}%</span>
                                      </div>
                                    </td>
                                    {r.modoCompara && (
                                      <td style={{ ...tdNum, borderBottom: `1px solid ${C.border}` }}>
                                        <CelDelta pct={pct} diff={s.total - (itemB?.total ?? 0)} />
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
              }
            </>
          );
        })()}

        {/* PRODUTOS */}
        {aba === 'produtos' && (
          <>
            {selPr && <PainelComparacao aba="produtos" nome={selPr} dadosA={r.rankingProdutos.find(x => x.nome === selPr)} dadosB={r.modoCompara ? r.rankingProdutosB.find(x => x.nome === selPr) : null} labelA={labelA} labelB={labelB} onFechar={() => setSelPr(null)} />}
            <div style={{ overflowX: 'auto' }}>
            {r.rankingProdutos.length === 0
              ? <p style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Nenhuma venda de produto registrada no período selecionado.</p>
              : <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                  <thead><tr>
                    <th style={thFixo}>#</th>
                    {[
                      { campo: 'nome',             label: 'Produto' },
                      { campo: 'categoria',        label: 'Categoria' },
                      { campo: 'unidadesVendidas', label: 'Unidades Vendidas' },
                      { campo: 'total',            label: 'Valor Total' },
                      { campo: 'ticket',           label: 'Ticket Médio' },
                      { campo: 'pctTotal',         label: '% do Total' },
                    ].map(col => (
                      <th key={col.campo} {...thProps(col.campo, r.ordemProdutos, r.setOrdemProdutos)}>
                        {col.label}<Seta campo={col.campo} ordem={r.ordemProdutos} />
                      </th>
                    ))}
                    {r.modoCompara && <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', background: C.bg, borderBottom: `1px solid ${C.borderMid}`, whiteSpace: 'nowrap' }}>∆ Total</th>}
                  </tr></thead>
                  <tbody>
                    {r.rankingProdutos.map((p, i) => {
                      const itemB = r.modoCompara ? r.rankingProdutosB.find((x: any) => x.nome === p.nome) : null;
                      const pct = itemB ? delta(p.total, itemB.total) : null;
                      return (
                      <tr key={p.nome + i} onClick={() => setSelPr(prev => prev === p.nome ? null : p.nome)} style={{ cursor: 'pointer', background: selPr === p.nome ? `${C.sidebarBg}0C` : 'transparent' }}>
                        <td style={{ ...tdBase, color: selPr === p.nome ? C.sidebarBg : C.textLight, fontWeight: 700, fontSize: 12, textAlign: 'center' }}>{selPr === p.nome ? '✓' : medal(i)}</td>
                        <td style={{ ...tdBase, fontWeight: 700, color: C.textMain }}>{p.nome}</td>
                        <td style={{ ...tdBase, fontSize: 12 }}>
                          <span style={{ background: `${C.sidebarBg}12`, color: C.sidebarBg, padding: '2px 8px', borderRadius: RAIO_SM, fontSize: 11, fontWeight: 700 }}>{p.categoria}</span>
                        </td>
                        <td style={tdNum}><CelComp a={String(p.unidadesVendidas)} b={r.modoCompara ? String(itemB?.unidadesVendidas ?? 0) : undefined} /></td>
                        <td style={tdDest}><CelComp a={brl(p.total)} b={r.modoCompara ? brl(itemB?.total ?? 0) : undefined} /></td>
                        <td style={{ ...tdNum, color: C.textMain }}><CelComp a={brl(p.ticket)} b={r.modoCompara ? brl(itemB?.ticket ?? 0) : undefined} /></td>
                        <td style={tdNum}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 48, height: 4, background: C.border, borderRadius: 2, flexShrink: 0 }}>
                              <div style={{ width: `${Math.min(p.pctTotal, 100)}%`, height: '100%', background: C.sidebarBg, borderRadius: 2 }} />
                            </div>
                            <span>{p.pctTotal.toFixed(1)}%</span>
                          </div>
                        </td>
                        {r.modoCompara && <td style={tdNum}><CelDelta pct={pct} diff={p.total - (itemB?.total ?? 0)} /></td>}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
            }
            </div>
          </>
        )}
      </div>
    </div>
  );
}
