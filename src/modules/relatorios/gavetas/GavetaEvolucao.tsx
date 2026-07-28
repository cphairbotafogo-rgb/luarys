'use client'
import { useMemo, useState } from "react";
import { C } from "@/lib/constants";
import { RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { FiScissors, FiUsers, FiPackage } from "react-icons/fi";

type Agrup = 'dia' | 'mes' | 'ano';
type Categoria = 'servicos' | 'profissionais' | 'produtos';

const CORES_SERIE = ['#1E293B', '#4F9D6E', '#D4AF37', '#3B82F6', '#EF4444'];

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

// ─── Gráfico de barras agrupadas (N séries por período) ──────────────────────
// `periodos` já vem formatado (label pronta pra exibir, não a chave bruta).
function BarMultiSerie({ periodos, series }: { periodos: string[]; series: { nome: string; cor: string; valores: number[] }[] }) {
  const maxV = Math.max(...series.flatMap(s => s.valores), 1);
  const nSeries = series.length || 1;
  const bW = 10, gap = 2, grpGap = 10;
  const alturaSvg = 160;
  const grpW = nSeries * (bW + gap) + grpGap;
  const totalW = periodos.length * grpW + 10;

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
      <svg width={Math.max(totalW, 300)} height={alturaSvg + 28} style={{ display: 'block' }}>
        {periodos.map((_, iPeriodo) => {
          const x0Grupo = iPeriodo * grpW + 4;
          return (
            <g key={iPeriodo}>
              {series.map((s, iSerie) => {
                const v = s.valores[iPeriodo] || 0;
                const h = v > 0 ? Math.max(2, (v / maxV) * alturaSvg) : 0;
                const x = x0Grupo + iSerie * (bW + gap);
                return <rect key={iSerie} x={x} y={alturaSvg - h} width={bW} height={h} fill={s.cor} rx={2} opacity={0.9} />;
              })}
              <text x={x0Grupo + (grpW - grpGap) / 2} y={alturaSvg + 14} textAnchor="middle" fontSize={9} fill="#94A3B8">
                {periodos[iPeriodo]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const CATEGORIAS: { id: Categoria; label: string; icon: any }[] = [
  { id: 'servicos',      label: 'Serviços',      icon: FiScissors },
  { id: 'profissionais', label: 'Profissionais', icon: FiUsers    },
  { id: 'produtos',      label: 'Produtos',      icon: FiPackage  },
];

export function GavetaEvolucao({ dados }: { dados: any }) {
  const [categoria, setCategoria] = useState<Categoria>('servicos');
  const [agrup, setAgrup] = useState<Agrup>('mes');

  const calc = useMemo(() => {
    // mapaEntidade[nome][periodo] = quantidade
    const mapaEntidade: Record<string, Record<string, number>> = {};
    const totalPorEntidade: Record<string, number> = {};
    const periodosSet = new Set<string>();
    let totalGeral = 0;

    if (categoria === 'servicos' || categoria === 'profissionais') {
      (dados.agendamentos as any[] || []).forEach((ag: any) => {
        if (ag.status !== 'Finalizado') return;
        const ch = chave(ag.data, agrup);
        if (!ch) return;
        const nome = categoria === 'servicos'
          ? (ag.servicos?.nome_servico || '(serviço removido)')
          : ((dados.profs as any[] || []).find((p: any) => p.id === ag.profissional_id)?.nome || 'Sem profissional');
        if (!mapaEntidade[nome]) mapaEntidade[nome] = {};
        mapaEntidade[nome][ch] = (mapaEntidade[nome][ch] || 0) + 1;
        totalPorEntidade[nome] = (totalPorEntidade[nome] || 0) + 1;
        periodosSet.add(ch);
        totalGeral++;
      });
    } else {
      (dados.histEstoque as any[] || []).forEach((h: any) => {
        if (h.tipo !== 'Saída' || !(h.motivo || '').toLowerCase().includes('venda')) return;
        const ch = chave(h.created_at, agrup);
        if (!ch) return;
        const prod = (dados.produtos as any[] || []).find((p: any) => p.id === h.produto_id);
        const nome = prod?.nome_produto || '(produto removido)';
        const qtd = Number(h.quantidade) || 0;
        if (!mapaEntidade[nome]) mapaEntidade[nome] = {};
        mapaEntidade[nome][ch] = (mapaEntidade[nome][ch] || 0) + qtd;
        totalPorEntidade[nome] = (totalPorEntidade[nome] || 0) + qtd;
        periodosSet.add(ch);
        totalGeral += qtd;
      });
    }

    const limite = agrup === 'dia' ? 45 : agrup === 'mes' ? 12 : 10;
    const periodos = Array.from(periodosSet).sort().slice(-limite);

    const top5 = Object.entries(totalPorEntidade)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([nome], i) => ({
        nome, cor: CORES_SERIE[i],
        total: totalPorEntidade[nome],
        valores: periodos.map(p => mapaEntidade[nome]?.[p] || 0),
      }));

    const totalPorPeriodo = periodos.map(p =>
      Object.values(mapaEntidade).reduce((s, m) => s + (m[p] || 0), 0)
    );

    return { periodos, top5, totalGeral, totalPorPeriodo };
  }, [dados, categoria, agrup]);

  const btnAgrup = (a: Agrup) => ({
    padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${agrup === a ? C.sidebarBg : C.borderMid}`,
    background: agrup === a ? C.sidebarBg : 'transparent',
    color: agrup === a ? '#fff' : C.textMain,
  } as React.CSSProperties);

  const btnCat = (cat: Categoria) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${categoria === cat ? C.sidebarBg : C.borderMid}`,
    background: categoria === cat ? C.sidebarBg : 'transparent',
    color: categoria === cat ? '#fff' : C.textMain,
  } as React.CSSProperties);

  const unidade = categoria === 'produtos' ? 'unidades' : 'atendimentos';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Seletores */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {CATEGORIAS.map(({ id, label: lb, icon: Icon }) => (
            <button key={id} style={btnCat(id)} onClick={() => setCategoria(id)}>
              <Icon size={13} /> {lb}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>Agrupar por:</span>
          {(['dia', 'mes', 'ano'] as Agrup[]).map(a => (
            <button key={a} style={btnAgrup(a)} onClick={() => setAgrup(a)}>
              {a === 'dia' ? 'Dia' : a === 'mes' ? 'Mês' : 'Ano'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: C.textMuted }}>Período definido no cabeçalho acima</span>
      </div>

      {calc.periodos.length === 0 && (
        <p style={{ color: C.textMuted, textAlign: 'center', marginTop: 40, fontSize: 13 }}>
          Nenhum dado no período selecionado. Ajuste o período no cabeçalho e clique em Aplicar.
        </p>
      )}

      {calc.periodos.length > 0 && (<>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, padding: '14px 20px', flex: 1 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total no período ({unidade})</p>
            <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 900, color: C.sidebarBg }}>{calc.totalGeral}</p>
          </div>
        </div>

        {/* Gráfico comparativo — top 5 entidades ao longo do tempo */}
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: '20px 24px', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.textMain }}>
              Evolução — Top 5 {CATEGORIAS.find(c => c.id === categoria)?.label}
            </h3>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, flexWrap: 'wrap' }}>
              {calc.top5.map(s => (
                <span key={s.nome} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: s.cor, display: 'inline-block' }} /> {s.nome} ({s.total})
                </span>
              ))}
            </div>
          </div>
          {calc.top5.length > 0
            ? <BarMultiSerie periodos={calc.periodos.map(p => label(p, agrup)) as any} series={calc.top5.map(s => ({ ...s, valores: s.valores }))} />
            : <p style={{ color: C.textMuted, fontSize: 12 }}>Sem dados no período.</p>}
        </div>

        {/* Tabela detalhada por período */}
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 700, color: C.textMain, fontSize: 14 }}>Detalhe por período</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{CATEGORIAS.find(c => c.id === categoria)?.label}</th>
                  {calc.periodos.map(p => (
                    <th key={p} style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: C.textLight, borderBottom: `1px solid ${C.border}` }}>{label(p, agrup)}</th>
                  ))}
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: C.textMain, borderBottom: `1px solid ${C.border}` }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {calc.top5.map((s, i) => (
                  <tr key={s.nome} style={{ borderBottom: i < calc.top5.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: C.textMain, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: s.cor, display: 'inline-block' }} /> {s.nome}
                    </td>
                    {s.valores.map((v, j) => (
                      <td key={j} style={{ padding: '10px 12px', textAlign: 'right', color: v > 0 ? C.textMain : C.textLight }}>{v || '—'}</td>
                    ))}
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.sidebarBg }}>{s.total}</td>
                  </tr>
                ))}
                <tr style={{ background: C.bg }}>
                  <td style={{ padding: '10px 16px', fontWeight: 800, color: C.textMain, textTransform: 'uppercase', fontSize: 11 }}>Total geral</td>
                  {calc.totalPorPeriodo.map((v, j) => (
                    <td key={j} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.textMain }}>{v}</td>
                  ))}
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: C.sidebarBg }}>{calc.totalGeral}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </>)}
    </div>
  );
}
