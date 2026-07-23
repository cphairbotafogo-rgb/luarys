// src/modules/relatorios/gavetas/rankings/TabelaClientes.tsx
'use client'
import { useState } from 'react';
import { C, brl } from '@/lib/constants';
import { delta } from '@/lib/visitasUtils';
import { PainelComparacao } from '../PainelComparacao';
import { medal, CelComp, CelDelta, fmt, thProps, Seta, tdBase, tdNum, tdDest, thFixo } from './componentes';

export function TabelaClientes({ r, labelA, labelB }: { r: any; labelA: string; labelB: string }) {
  const [selC, setSelC] = useState<string | null>(null);

  return (
    <>
      {selC && <PainelComparacao aba="clientes" nome={selC} dadosA={r.rankingClientes.find((x: any) => x.nome === selC)} dadosB={r.modoCompara ? r.rankingClientesB.find((x: any) => x.nome === selC) : null} labelA={labelA} labelB={labelB} onFechar={() => setSelC(null)} />}
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
              {r.rankingClientes.map((c: any, i: number) => {
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
  );
}
