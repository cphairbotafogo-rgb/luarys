// src/modules/relatorios/gavetas/rankings/TabelaProdutos.tsx
'use client'
import { useState } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_SM } from '@/lib/estiloGlobal';
import { delta } from '@/lib/visitasUtils';
import { PainelComparacao } from '../PainelComparacao';
import { medal, CelComp, CelDelta, thProps, Seta, tdBase, tdNum, tdDest, thFixo } from './componentes';

export function TabelaProdutos({ r, labelA, labelB }: { r: any; labelA: string; labelB: string }) {
  const [selPr, setSelPr] = useState<string | null>(null);

  return (
    <>
      {selPr && <PainelComparacao aba="produtos" nome={selPr} dadosA={r.rankingProdutos.find((x: any) => x.nome === selPr)} dadosB={r.modoCompara ? r.rankingProdutosB.find((x: any) => x.nome === selPr) : null} labelA={labelA} labelB={labelB} onFechar={() => setSelPr(null)} />}
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
              {r.rankingProdutos.map((p: any, i: number) => {
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
  );
}
