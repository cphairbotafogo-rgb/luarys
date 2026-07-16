'use client'
import { C } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { FiUsers, FiDownload, FiPrinter, FiLoader, FiHelpCircle } from 'react-icons/fi';
import { fmtNum, estiloCard, estiloBtnCSV, estiloBtnPDF } from '../tipos';

interface Props {
  dadosComissoes: any;
  mesAnoLabel: string;
  onCSVAgrupado: () => void;
  onCSVDetalhado: () => void;
  onPDF: () => void;
  gerandoPDF: string | null;
}

export function RelatorioComissoes({ dadosComissoes, mesAnoLabel, onCSVAgrupado, onCSVDetalhado, onPDF, gerandoPDF }: Props) {
  const carregando = gerandoPDF === 'comissoes';
  return (
    <div style={{ ...estiloCard, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, background: '#FEF2F2', borderRadius: RAIO_MD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiUsers size={18} color="#EF4444" />
          </div>
          <div>
            <h3 className="font-title" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>2. Comissões — Lei Salão Parceiro</h3>
            <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>Base dedutível do ISS por profissional — {mesAnoLabel}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={estiloBtnCSV as any} onClick={onCSVAgrupado}><FiDownload size={13} /> CSV Agrupado</button>
          <button style={estiloBtnCSV as any} onClick={onCSVDetalhado}><FiDownload size={13} /> CSV Detalhado</button>
          <button style={estiloBtnPDF(carregando) as any} onClick={onPDF} disabled={!!gerandoPDF}>
            {carregando ? <FiLoader className="animate-spin" size={13} /> : <FiPrinter size={13} />} PDF
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.borderMid}` }}>
              {['Profissional','Atendimentos','Receita Bruta','% Comissão','Comissão (R$)','Cota Salão (R$)'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>
                  {h === '% Comissão' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {h}
                      <FiHelpCircle
                        size={11}
                        style={{ cursor: 'help' }}
                        title="Esta % é uma média ponderada (comissão total ÷ receita bruta) de todos os atendimentos do profissional no período — não a taxa fixa cadastrada. Ela pode aparecer baixa quando parte dos serviços não tem comissão configurada (ex.: serviços do próprio proprietário) ou quando há descontos de taxa de cartão/PIX aplicados."
                      />
                    </span>
                  ) : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dadosComissoes.linhasAgrupadas.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: C.textLight }}>Nenhuma comissão registrada neste período.</td></tr>
            ) : dadosComissoes.linhasAgrupadas.map((l: any[], i: number) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '12px', fontWeight: 700, color: C.sidebarBg }}>{l[0]}</td>
                <td style={{ padding: '12px', color: C.textMuted }}>{l[1]}</td>
                <td style={{ padding: '12px', fontWeight: 600 }}>R$ {l[2]}</td>
                <td style={{ padding: '12px', color: C.textMuted }}>{l[3]}</td>
                <td style={{ padding: '12px', fontWeight: 700, color: '#EF4444' }}>R$ {l[4]}</td>
                <td style={{ padding: '12px', fontWeight: 700, color: '#10B981' }}>R$ {l[5]}</td>
              </tr>
            ))}
          </tbody>
          {dadosComissoes.linhasAgrupadas.length > 0 && (
            <tfoot>
              <tr style={{ background: C.sidebarBg, color: '#fff' }}>
                <td style={{ padding: '12px', fontWeight: 800 }}>TOTAL</td>
                <td style={{ padding: '12px' }}>{dadosComissoes.validas.length}</td>
                <td style={{ padding: '12px', fontWeight: 800 }}>R$ {fmtNum(dadosComissoes.totalReceita)}</td>
                <td style={{ padding: '12px' }}>—</td>
                <td style={{ padding: '12px', fontWeight: 800 }}>R$ {fmtNum(dadosComissoes.totalComissao)}</td>
                <td style={{ padding: '12px', fontWeight: 800 }}>R$ {fmtNum(dadosComissoes.totalSalao)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
