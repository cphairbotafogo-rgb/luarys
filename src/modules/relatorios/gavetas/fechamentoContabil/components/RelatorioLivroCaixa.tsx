'use client'
import { C, brl } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { FiFileText, FiDownload, FiPrinter, FiLoader } from 'react-icons/fi';
import { estiloCard, estiloBtnCSV, estiloBtnPDF } from '../tipos';

interface Props {
  dadosLivroCaixa: any;
  mesAnoLabel: string;
  onCSV: () => void;
  onPDF: () => void;
  gerandoPDF: string | null;
}

export function RelatorioLivroCaixa({ dadosLivroCaixa, mesAnoLabel, onCSV, onPDF, gerandoPDF }: Props) {
  const carregando = gerandoPDF === 'livrocaixa';
  return (
    <div style={{ ...estiloCard, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: '#FFFBEB', borderRadius: RAIO_MD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiFileText size={18} color="#F59E0B" />
          </div>
          <div>
            <h3 className="font-title" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>3. Livro Caixa — Despesas</h3>
            <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>Custos operacionais por categoria — {mesAnoLabel}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={estiloBtnCSV as any} onClick={onCSV}><FiDownload size={13} /> CSV</button>
          <button style={estiloBtnPDF(carregando) as any} onClick={onPDF} disabled={!!gerandoPDF}>
            {carregando ? <FiLoader className="animate-spin" size={13} /> : <FiPrinter size={13} />} PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {Object.entries(dadosLivroCaixa.porCategoria).map(([cat, val]) => (
          <div key={cat} style={{ background: C.bg, borderRadius: RAIO_MD, padding: '8px 14px', fontSize: 12 }}>
            <span style={{ color: C.textMuted }}>{cat}: </span>
            <span style={{ fontWeight: 700, color: '#EF4444' }}>{brl(val as number)}</span>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.borderMid}` }}>
              {['Data','Descrição','Categoria','Pagamento','Status','Valor'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dadosLivroCaixa.linhasDetalhadas.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: C.textLight }}>Nenhuma despesa neste período.</td></tr>
            ) : dadosLivroCaixa.linhasDetalhadas.slice(0, 8).map((l: any[], i: number) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                {l.map((c, j) => (
                  <td key={j} style={{ padding: '10px 12px', color: j === 5 ? '#EF4444' : C.textMain, fontWeight: j === 5 ? 700 : 500 }}>{c}</td>
                ))}
              </tr>
            ))}
            {dadosLivroCaixa.linhasDetalhadas.length > 8 && (
              <tr><td colSpan={6} style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: C.textLight }}>
                + {dadosLivroCaixa.linhasDetalhadas.length - 8} registros — exporte para ver todos
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
