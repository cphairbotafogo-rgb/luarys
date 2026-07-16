'use client'
import { useState, useMemo } from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_SM } from '@/lib/estiloGlobal';
import { corValorHora, brl as brlLocal, fmtHoras, fmtData } from '../tipos';

export function GraficoBarrasDiarias({ dadosDia, profissionais, meta }: {
  dadosDia: any[];
  profissionais: any[];
  meta: number;
}) {
  const [profFiltro, setProfFiltro] = useState<string>('todos');

  const dadosFiltrados = useMemo(() => {
    const base = profFiltro === 'todos'
      ? dadosDia
      : dadosDia.filter(d => d.profissionalId === profFiltro);

    const porData: Record<string, { faturamento: number; minutos: number; atendimentos: number }> = {};
    base.forEach(d => {
      if (!porData[d.data]) porData[d.data] = { faturamento: 0, minutos: 0, atendimentos: 0 };
      porData[d.data].faturamento  += d.faturamento;
      porData[d.data].minutos      += d.minutos;
      porData[d.data].atendimentos += d.atendimentos;
    });

    return Object.entries(porData)
      .map(([data, v]) => ({
        data,
        faturamento: v.faturamento,
        minutos: v.minutos,
        atendimentos: v.atendimentos,
        valorHora: v.minutos > 0 ? v.faturamento / (v.minutos / 60) : 0,
      }))
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [dadosDia, profFiltro]);

  const maxValorHora = Math.max(...dadosFiltrados.map(d => d.valorHora), meta, 1);

  if (dadosFiltrados.length === 0) return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: C.textMuted, fontSize: 13 }}>
      Nenhum atendimento no período selecionado.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filtro por profissional */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setProfFiltro('todos')}
          style={{
            padding: '5px 14px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${profFiltro === 'todos' ? C.sidebarBg : C.borderMid}`,
            background: profFiltro === 'todos' ? C.sidebarBg : C.bgCard,
            color: profFiltro === 'todos' ? '#fff' : C.textMuted,
          }}>
          Todos
        </button>
        {profissionais.map((p: any) => (
          <button key={p.id} onClick={() => setProfFiltro(p.id)}
            style={{
              padding: '5px 14px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${profFiltro === p.id ? C.sidebarBg : C.borderMid}`,
              background: profFiltro === p.id ? C.sidebarBg : C.bgCard,
              color: profFiltro === p.id ? '#fff' : C.textMuted,
            }}>
            {p.nome.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Gráfico de barras */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, paddingBottom: 28, position: 'relative' }}>
        <div style={{
          position: 'absolute',
          bottom: 28 + (meta / maxValorHora) * 132,
          left: 0, right: 0,
          borderTop: `2px dashed ${C.douradoEleva}`,
          pointerEvents: 'none',
        }}>
          <span style={{
            position: 'absolute', right: 0, top: -18,
            fontSize: 10, color: C.douradoEleva, fontWeight: 700,
            background: C.bgCard, padding: '1px 6px', borderRadius: 4,
          }}>
            Meta {brlLocal(meta)}/h
          </span>
        </div>

        {dadosFiltrados.map(d => {
          const altPct = maxValorHora > 0 ? (d.valorHora / maxValorHora) * 132 : 0;
          const cor = corValorHora(d.valorHora);
          const acimaMeta = d.valorHora >= meta;
          return (
            <div key={d.data} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}>
              <div
                title={`${fmtData(d.data)}\n${brlLocal(d.valorHora)}/h\n${d.atendimentos} atend. · ${fmtHoras(d.minutos)}`}
                style={{
                  width: '100%', height: altPct, background: cor,
                  borderRadius: `${RAIO_SM} ${RAIO_SM} 0 0`, cursor: 'default',
                  opacity: 0.85,
                  border: acimaMeta ? `2px solid ${cor}` : 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{
                position: 'absolute', bottom: -24, fontSize: 9, color: C.textMuted,
                whiteSpace: 'nowrap', transform: 'rotate(-45deg)', transformOrigin: 'top left',
              }}>
                {fmtData(d.data).slice(0, 5)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', paddingTop: 4 }}>
        {[
          { cor: '#10B981', label: 'Excelente (≥R$200/h)' },
          { cor: '#F59E0B', label: 'Bom (≥R$120/h)' },
          { cor: '#F97316', label: 'Fraco (≥R$60/h)' },
          { cor: '#EF4444', label: 'Crítico (<R$60/h)' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.cor }} />
            <span style={{ fontSize: 11, color: C.textMuted }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
