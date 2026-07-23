// src/modules/relatorios/gavetas/rankings/TabelaServicos.tsx
// Aba de Serviços — agrupados por categoria (a mais complexa das 4 tabelas).
'use client'
import React, { useState } from 'react';
import { C, brl } from '@/lib/constants';
import { delta } from '@/lib/visitasUtils';
import { FiSearch, FiScissors, FiX, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { PainelComparacao } from '../PainelComparacao';
import { CelComp, CelDelta, AbBadges, tdNum, tdDest, inputStyle } from './componentes';

export function TabelaServicos({ r, labelA, labelB }: { r: any; labelA: string; labelB: string }) {
  const [selS, setSelS] = useState<string | null>(null);
  const [selCat, setSelCat] = useState<string | null>(null);
  const [catCollapsed, setCatCollapsed] = useState<Set<string>>(new Set());

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
}
