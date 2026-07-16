'use client'
import { C, brl } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { FiDollarSign, FiDownload, FiPrinter, FiLoader } from 'react-icons/fi';
import { estiloCard, estiloBtnCSV, estiloBtnPDF } from '../tipos';

interface Props {
  dadosFaturamento: any;
  mesAnoLabel: string;
  onCSV: () => void;
  onPDF: () => void;
  gerandoPDF: string | null;
}

export function RelatorioFaturamento({ dadosFaturamento, mesAnoLabel, onCSV, onPDF, gerandoPDF }: Props) {
  const carregando = gerandoPDF === 'faturamento';
  return (
    <div style={{ ...estiloCard, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: '#F0FDF4', borderRadius: RAIO_MD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiDollarSign size={18} color="#10B981" />
          </div>
          <div>
            <h3 className="font-title" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>1. Faturamento Mensal</h3>
            <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>Serviços (ISS) vs Produtos (ICMS) — {mesAnoLabel}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={estiloBtnCSV as any} onClick={onCSV}><FiDownload size={13} /> CSV</button>
          <button style={estiloBtnPDF(carregando) as any} onClick={onPDF} disabled={!!gerandoPDF}>
            {carregando ? <FiLoader className="animate-spin" size={13} /> : <FiPrinter size={13} />} PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Serviços — ISS Municipal', valor: dadosFaturamento.totalServicos, cor: '#10B981', icon: '⚒️' },
          { label: 'Produtos — ICMS Estadual', valor: dadosFaturamento.totalProdutos, cor: '#3B82F6', icon: '📦' },
          { label: 'Outros Lançamentos', valor: dadosFaturamento.totalOutros, cor: C.textLight, icon: '📋' },
        ].map(({ label, valor, cor, icon }) => (
          <div key={label} style={{ background: C.bg, borderRadius: RAIO_MD, padding: '12px 16px' }}>
            <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>{icon} {label}</p>
            <p className="font-title" style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: cor }}>{brl(valor)}</p>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.borderMid}` }}>
              {['Data','Descrição','Categoria','Pagamento','Imposto','Valor'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dadosFaturamento.linhasDetalhadas.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: C.textLight }}>Nenhum lançamento neste período.</td></tr>
            ) : dadosFaturamento.linhasDetalhadas.slice(0, 8).map((l: any[], i: number) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                {l.map((c, j) => (
                  <td key={j} style={{ padding: '10px 12px', color: j === 5 ? '#10B981' : C.textMain, fontWeight: j === 5 ? 700 : 500 }}>{c}</td>
                ))}
              </tr>
            ))}
            {dadosFaturamento.linhasDetalhadas.length > 8 && (
              <tr><td colSpan={6} style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: C.textLight }}>
                + {dadosFaturamento.linhasDetalhadas.length - 8} registros — exporte para ver todos
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
