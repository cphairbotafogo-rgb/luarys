'use client'
import { useMemo, useState } from "react";
import { C, brl } from "@/lib/constants";
import { RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";

type Agrup = 'dia' | 'mes' | 'ano';

const CORES_PAG: Record<string, string> = {
  'PIX':             '#22C55E',
  'Cartão Crédito':  '#3B82F6',
  'Cartão Débito':   '#8B5CF6',
  'DINHEIRO':        '#F59E0B',
  'Outros':          '#94A3B8',
};

function chave(dateStr: string, agrup: Agrup) {
  const d = (dateStr || '').substring(0, 10);
  if (!d) return '';
  return agrup === 'dia' ? d : agrup === 'mes' ? d.substring(0, 7) : d.substring(0, 4);
}

function label(ch: string, agrup: Agrup) {
  if (agrup === 'dia') { const [, m, d] = ch.split('-'); return `${d}/${m}`; }
  if (agrup === 'mes') {
    const [y, m] = ch.split('-');
    return `${'JanFevMarAbrMaiJunJulAgoSetOutNovDez'.match(/.{3}/g)![+m - 1]}/${y.slice(2)}`;
  }
  return ch;
}

// ─── Gráfico de barras verticais SVG ─────────────────────────────────────────
function BarVertical({ dados, cor, corDes }: { dados: { ch: string; rec: number; des: number; lb: string }[]; cor: string; corDes: string }) {
  const maxV = Math.max(...dados.map(d => Math.max(d.rec, d.des)), 1);
  const bW = 14, gap = 4, grpGap = 8;
  const alturaSvg = 160;
  const totalW = dados.length * (bW * 2 + gap + grpGap) + 10;

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
      <svg width={Math.max(totalW, 300)} height={alturaSvg + 28} style={{ display: 'block' }}>
        {dados.map((d, i) => {
          const x0 = i * (bW * 2 + gap + grpGap) + 4;
          const hRec = Math.max(2, (d.rec / maxV) * alturaSvg);
          const hDes = Math.max(2, (d.des / maxV) * alturaSvg);
          return (
            <g key={i}>
              <rect x={x0} y={alturaSvg - hRec} width={bW} height={hRec} fill={cor} rx={2} opacity={0.85} />
              <rect x={x0 + bW + gap} y={alturaSvg - hDes} width={bW} height={hDes} fill={corDes} rx={2} opacity={0.75} />
              <text x={x0 + bW} y={alturaSvg + 14} textAnchor="middle" fontSize={9} fill="#94A3B8">{d.lb}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Gráfico de barras só receita ────────────────────────────────────────────
function BarSimples({ dados, cor }: { dados: { lb: string; v: number }[]; cor: string }) {
  const maxV = Math.max(...dados.map(d => d.v), 1);
  const bW = 22, grpGap = 6, alturaSvg = 160;
  const totalW = dados.length * (bW + grpGap) + 10;
  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
      <svg width={Math.max(totalW, 300)} height={alturaSvg + 28} style={{ display: 'block' }}>
        {dados.map((d, i) => {
          const h = Math.max(2, (d.v / maxV) * alturaSvg);
          const x = i * (bW + grpGap) + 4;
          return (
            <g key={i}>
              <rect x={x} y={alturaSvg - h} width={bW} height={h} fill={cor} rx={3} />
              <text x={x + bW / 2} y={alturaSvg + 14} textAnchor="middle" fontSize={9} fill="#94A3B8">{d.lb}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Barra horizontal ─────────────────────────────────────────────────────────
function BarHoriz({ dados, getCor }: { dados: { lb: string; v: number; extra: string }[]; getCor: (lb: string) => string }) {
  const maxV = Math.max(...dados.map(d => d.v), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dados.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 130, fontSize: 11, color: C.textMain, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }} title={d.lb}>{d.lb}</div>
          <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 4, height: 20, overflow: 'hidden' }}>
            <div style={{ width: `${(d.v / maxV) * 100}%`, minWidth: 4, height: '100%', background: getCor(d.lb), borderRadius: 4, transition: '0.4s ease' }} />
          </div>
          <div style={{ width: 88, fontSize: 11, fontWeight: 700, color: C.textMain, flexShrink: 0 }}>{d.extra}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Card KPI ─────────────────────────────────────────────────────────────────
function Kpi({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, padding: '14px 20px', flex: 1 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 900, color: cor }}>{valor}</p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function GavetaGraficos({ dados }: { dados: any }) {
  const [agrup, setAgrup] = useState<Agrup>('mes');

  const calc = useMemo(() => {
    const recMap: Record<string, number> = {};
    const desMap: Record<string, number> = {};
    const pagMap: Record<string, number> = {};
    const srvMap: Record<string, number> = {};
    let totalRec = 0, totalDes = 0, totalDesc = 0;

    for (const f of (dados.financeiro as any[])) {
      if (f.status === 'Estornado') continue;
      const ch = chave(f.data_movimentacao, agrup);
      if (!ch) continue;
      if (f.tipo === 'entrada') {
        recMap[ch] = (recMap[ch] || 0) + (Number(f.valor) || 0);
        totalRec += Number(f.valor) || 0;
        const fp = f.forma_pagamento || 'Outros';
        pagMap[fp] = (pagMap[fp] || 0) + (Number(f.valor) || 0);
        totalDesc += Number(f.desconto) || 0;
      }
    }
    for (const d of (dados.despesas as any[])) {
      const dt = d.data_pagamento || d.data_vencimento;
      const ch = chave(dt, agrup);
      if (!ch) continue;
      desMap[ch] = (desMap[ch] || 0) + (Number(d.valor) || 0);
      totalDes += Number(d.valor) || 0;
    }
    for (const ag of (dados.agendamentos as any[])) {
      if (ag.status !== 'Finalizado') continue;
      const nome = ag.servicos?.nome_servico || 'Outros';
      srvMap[nome] = (srvMap[nome] || 0) + 1;
    }

    const limite = agrup === 'dia' ? 45 : agrup === 'mes' ? 24 : 10;
    const chaves = Array.from(new Set([...Object.keys(recMap), ...Object.keys(desMap)])).sort().slice(-limite);

    const barras = chaves.map(ch => ({ ch, lb: label(ch, agrup), rec: recMap[ch] || 0, des: desMap[ch] || 0 }));
    const recSimples = chaves.map(ch => ({ lb: label(ch, agrup), v: recMap[ch] || 0 }));

    const topSrv = Object.entries(srvMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([lb, v]) => ({ lb, v, extra: `${v}×` }));

    const topPag = Object.entries(pagMap).sort((a, b) => b[1] - a[1])
      .map(([lb, v]) => ({ lb, v, extra: brl(v) }));

    return { barras, recSimples, topSrv, topPag, totalRec, totalDes, totalDesc };
  }, [dados, agrup]);

  const btnAgrup = (a: Agrup) => ({
    padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${agrup === a ? C.sidebarBg : C.borderMid}`,
    background: agrup === a ? C.sidebarBg : 'transparent',
    color: agrup === a ? '#fff' : C.textMain,
  } as React.CSSProperties);

  const temDados = calc.barras.length > 0 || calc.topSrv.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Seletor de agrupamento */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>Agrupar por:</span>
        {(['dia', 'mes', 'ano'] as Agrup[]).map(a => (
          <button key={a} style={btnAgrup(a)} onClick={() => setAgrup(a)}>
            {a === 'dia' ? 'Dia' : a === 'mes' ? 'Mês' : 'Ano'}
          </button>
        ))}
        <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>
          Período definido no cabeçalho acima
        </span>
      </div>

      {!temDados && (
        <p style={{ color: C.textMuted, textAlign: 'center', marginTop: 40, fontSize: 13 }}>
          Nenhum dado no período selecionado. Ajuste o período no cabeçalho e clique em Aplicar.
        </p>
      )}

      {temDados && (<>

        {/* KPIs resumo */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Kpi label="Receita Total" valor={brl(calc.totalRec)} cor={C.success} />
          <Kpi label="Despesas" valor={brl(calc.totalDes)} cor="#EF4444" />
          <Kpi label="Resultado" valor={brl(calc.totalRec - calc.totalDes)} cor={calc.totalRec >= calc.totalDes ? C.success : '#EF4444'} />
          <Kpi label="Descontos Dados" valor={brl(calc.totalDesc)} cor="#F59E0B" />
        </div>

        {/* Receita por período */}
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: '20px 24px', border: `1px solid ${C.border}` }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: C.textMain }}>
            Receita por {agrup === 'dia' ? 'Dia' : agrup === 'mes' ? 'Mês' : 'Ano'}
          </h3>
          {calc.recSimples.length ? <BarSimples dados={calc.recSimples} cor={C.sidebarBg} /> : <p style={{ color: C.textMuted, fontSize: 12 }}>Sem receitas no período.</p>}
        </div>

        {/* Receita × Despesa */}
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: '20px 24px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.textMain }}>Receita × Despesa</h3>
            <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
              {[{ cor: C.sidebarBg, lb: 'Receita' }, { cor: '#EF4444', lb: 'Despesa' }].map(({ cor, lb }) => (
                <span key={lb} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: cor, display: 'inline-block' }} /> {lb}
                </span>
              ))}
            </div>
          </div>
          {calc.barras.length
            ? <BarVertical dados={calc.barras} cor={C.sidebarBg} corDes="#EF4444" />
            : <p style={{ color: C.textMuted, fontSize: 12 }}>Sem dados no período.</p>}
        </div>

        {/* Serviços + Pagamentos lado a lado */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: '20px 24px', border: `1px solid ${C.border}` }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: C.textMain }}>Serviços Mais Realizados</h3>
            {calc.topSrv.length
              ? <BarHoriz dados={calc.topSrv} getCor={() => '#4F9D6E'} />
              : <p style={{ color: C.textMuted, fontSize: 12 }}>Sem atendimentos finalizados.</p>}
          </div>
          <div style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: '20px 24px', border: `1px solid ${C.border}` }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: C.textMain }}>Por Forma de Pagamento</h3>
            {calc.topPag.length
              ? <BarHoriz dados={calc.topPag} getCor={lb => CORES_PAG[lb] || '#94A3B8'} />
              : <p style={{ color: C.textMuted, fontSize: 12 }}>Sem entradas registradas.</p>}
          </div>
        </div>

      </>)}
    </div>
  );
}
