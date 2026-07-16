'use client'
import { C, brl } from '@/lib/constants';
import { RAIO_LG, RAIO_MD } from '@/lib/estiloGlobal';
import { FiCreditCard, FiDownload, FiPrinter, FiLoader } from 'react-icons/fi';
import { fmtNum, estiloCard, estiloBtnCSV, estiloBtnPDF } from '../tipos';

interface Props {
  dadosConciliacao: any;
  mesAnoLabel: string;
  onCSV: () => void;
  onPDF: () => void;
  gerandoPDF: string | null;
}

export function RelatorioConciliacao({ dadosConciliacao, mesAnoLabel, onCSV, onPDF, gerandoPDF }: Props) {
  const carregando = gerandoPDF === 'conciliacao';
  return (
    <div style={{ ...estiloCard, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: '#EFF6FF', borderRadius: RAIO_MD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiCreditCard size={18} color="#3B82F6" />
          </div>
          <div>
            <h3 className="font-title" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>4. Conciliação de Pagamentos</h3>
            <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>Distribuição por modalidade para cruzamento com extrato — {mesAnoLabel}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={estiloBtnCSV as any} onClick={onCSV}><FiDownload size={13} /> CSV</button>
          <button style={estiloBtnPDF(carregando) as any} onClick={onPDF} disabled={!!gerandoPDF}>
            {carregando ? <FiLoader className="animate-spin" size={13} /> : <FiPrinter size={13} />} PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {dadosConciliacao.lista.map((g: any) => (
          <div key={g.tipo} style={{ background: C.bg, borderRadius: RAIO_LG, padding: '16px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{g.tipo}</p>
            <p className="font-title" style={{ margin: '6px 0 2px', fontSize: 20, fontWeight: 800, color: C.sidebarBg }}>{brl(g.bruto)}</p>
            <p style={{ margin: 0, fontSize: 11, color: C.textLight }}>{g.transacoes} transação{g.transacoes !== 1 ? 'ões' : ''}</p>
            <p style={{ margin: '4px 0 0', fontSize: 10, color: C.textLight }}>
              {fmtNum((g.bruto / (dadosConciliacao.totalBruto || 1)) * 100)}% do total
            </p>
          </div>
        ))}
        {dadosConciliacao.lista.length === 0 && (
          <p style={{ color: C.textLight, fontSize: 13 }}>Nenhum recebimento neste período.</p>
        )}
      </div>

      <div style={{ background: C.sidebarBg, borderRadius: RAIO_MD, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Total Recebido no Período</span>
        <span className="font-title" style={{ color: C.douradoEleva, fontSize: 20, fontWeight: 800 }}>{brl(dadosConciliacao.totalBruto)}</span>
      </div>
    </div>
  );
}
