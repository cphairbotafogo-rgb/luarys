'use client'
import { C, brl } from '@/lib/constants';
import { delta } from '@/lib/visitasUtils';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';

type TipoAba = 'clientes' | 'profissionais' | 'servicos' | 'produtos';

interface Props {
  aba:      TipoAba;
  nome:     string;
  dadosA:   any;
  dadosB:   any | null;
  labelA:   string;
  labelB:   string;
  onFechar: () => void;
}

const METRICAS: Record<TipoAba, Array<{ campo: string; label: string; fmt: (v: number) => string }>> = {
  clientes: [
    { campo: 'visitas', label: 'Visitas',      fmt: v => String(v) },
    { campo: 'total',   label: 'Receita',      fmt: brl },
    { campo: 'ticket',  label: 'Ticket Médio', fmt: brl },
  ],
  profissionais: [
    { campo: 'atendimentos',      label: 'Atendimentos',    fmt: v => String(v) },
    { campo: 'clientesDistintos', label: 'Clientes Únicos', fmt: v => String(v) },
    { campo: 'novosClientes',     label: 'Novos Clientes',  fmt: v => String(v) },
    { campo: 'pctRecorrentes',    label: '% Recorrentes',   fmt: v => `${Number(v).toFixed(1)}%` },
    { campo: 'total',             label: 'Receita',         fmt: brl },
    { campo: 'ticket',            label: 'Ticket Médio',    fmt: brl },
  ],
  servicos: [
    { campo: 'execucoes',         label: 'Realizados', fmt: v => String(v) },
    { campo: 'clientesDistintos', label: 'Clientes',   fmt: v => String(v) },
    { campo: 'total',             label: 'Receita',    fmt: brl },
    { campo: 'ticket',            label: 'Ticket',     fmt: brl },
    { campo: 'pctTotal',          label: '% do Total', fmt: v => `${Number(v).toFixed(1)}%` },
  ],
  produtos: [
    { campo: 'unidadesVendidas', label: 'Unidades',    fmt: v => String(v) },
    { campo: 'total',            label: 'Receita',     fmt: brl },
    { campo: 'ticket',           label: 'Por Unidade', fmt: brl },
  ],
};

function SubLista({ titulo, itensA, itensB }: {
  titulo: string;
  itensA: Array<{ nome: string; count: number }>;
  itensB: Array<{ nome: string; count: number }> | null;
}) {
  if (!itensA?.length) return null;
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #BAE6FD' }}>
      <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{titulo}</p>
      {itensA.map(a => {
        const b = itensB?.find(x => x.nome === a.nome) ?? null;
        return (
          <div key={a.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7, fontSize: 12 }}>
            <span style={{ flex: 1, color: C.textMain, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{a.nome}</span>
            <span style={{ fontWeight: 800, color: C.sidebarBg, minWidth: 36, textAlign: 'right' as const }}>{a.count}×</span>
            {itensB !== null && <>
              <span style={{ color: C.textMuted, minWidth: 36, textAlign: 'right' as const }}>{b ? `${b.count}×` : '—'}</span>
              <span style={{ minWidth: 64, textAlign: 'center' as const }}>
                {b ? <DeltaCell vA={a.count} vB={b.count} /> : <span style={{ color: C.textLight, fontSize: 11 }}>novo</span>}
              </span>
            </>}
          </div>
        );
      })}
    </div>
  );
}

function DeltaCell({ vA, vB }: { vA: number; vB: number }) {
  const pct = delta(vA, vB);
  if (pct === null) return <span style={{ color: C.textLight, fontSize: 11 }}>—</span>;
  const positivo = pct >= 0;
  const abs = Math.abs(pct);
  const Icon = abs < 0.1 ? FiMinus : positivo ? FiTrendingUp : FiTrendingDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: positivo ? '#047857' : '#B91C1C', background: positivo ? '#D1FAE5' : '#FEE2E2', borderRadius: 20, padding: '2px 7px' }}>
      <Icon size={10} /> {abs.toFixed(1)}%
    </span>
  );
}

export function PainelComparacao({ aba, nome, dadosA, dadosB, labelA, labelB, onFechar }: Props) {
  const ms = METRICAS[aba];
  const thBase: React.CSSProperties = { padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', borderBottom: '1px solid #BAE6FD', background: 'transparent' };

  return (
    <div style={{ background: '#F0F9FF', borderBottom: '1px solid #BAE6FD', padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>⇄ Evolução — </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.textMain }}>{nome}</span>
          {dadosB === null && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 10 }}>(ative "Comparar Períodos" para ver período B)</span>}
        </div>
        <button onClick={onFechar} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>✕ Fechar</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thBase}>Métrica</th>
            <th style={{ ...thBase, textAlign: 'right' as const, color: '#1D4ED8' }}>{labelA}</th>
            {dadosB !== null && <>
              <th style={{ ...thBase, textAlign: 'right' as const }}>{labelB}</th>
              <th style={{ ...thBase, textAlign: 'center' as const }}>Variação</th>
            </>}
          </tr>
        </thead>
        <tbody>
          {ms.map(m => {
            const vA = Number(dadosA?.[m.campo]) || 0;
            const vB = dadosB !== null ? Number(dadosB?.[m.campo]) || 0 : null;
            return (
              <tr key={m.campo}>
                <td style={{ padding: '9px 14px', fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{m.label}</td>
                <td style={{ padding: '9px 14px', fontSize: 13, color: C.sidebarBg, fontWeight: 800, textAlign: 'right' as const }}>{m.fmt(vA)}</td>
                {vB !== null && <>
                  <td style={{ padding: '9px 14px', fontSize: 12, color: C.textMuted, fontWeight: 600, textAlign: 'right' as const }}>{m.fmt(vB)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'center' as const }}><DeltaCell vA={vA} vB={vB} /></td>
                </>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {aba === 'clientes' && (
        <SubLista
          titulo={`Serviços realizados no período (${dadosA?.topServicos?.length || 0})`}
          itensA={dadosA?.topServicos || []}
          itensB={dadosB !== null ? dadosB?.topServicos || [] : null}
        />
      )}
      {aba === 'profissionais' && (
        <SubLista
          titulo={`Todos os serviços realizados no período (${dadosA?.topServicos?.length || 0})`}
          itensA={dadosA?.topServicos || []}
          itensB={dadosB !== null ? dadosB?.topServicos || [] : null}
        />
      )}
      {aba === 'servicos' && (
        <SubLista
          titulo="Por profissional"
          itensA={dadosA?.topProfs || []}
          itensB={dadosB !== null ? dadosB?.topProfs || [] : null}
        />
      )}
    </div>
  );
}
