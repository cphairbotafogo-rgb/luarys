// src/modules/relatorios/gavetas/rankings/TabelaProfissionais.tsx
'use client'
import { useState } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_SM } from '@/lib/estiloGlobal';
import { delta } from '@/lib/visitasUtils';
import { PainelComparacao } from '../PainelComparacao';
import { medal, CelComp, CelDelta, thProps, Seta, tdBase, tdNum, tdDest, thFixo } from './componentes';

export function TabelaProfissionais({ r, labelA, labelB }: { r: any; labelA: string; labelB: string }) {
  const [selP, setSelP] = useState<string | null>(null);

  return (
    <>
      {selP && <PainelComparacao aba="profissionais" nome={selP} dadosA={r.rankingProfissionais.find((x: any) => x.nome === selP)} dadosB={r.modoCompara ? r.rankingProfissionaisB.find((x: any) => x.nome === selP) : null} labelA={labelA} labelB={labelB} onFechar={() => setSelP(null)} />}
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
              {r.rankingProfissionais.map((p: any, i: number) => {
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
  );
}
