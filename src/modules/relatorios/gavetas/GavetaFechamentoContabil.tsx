'use client'
import { C } from '@/lib/constants';
import { RAIO_LG, RAIO_MD } from '@/lib/estiloGlobal';
import { FiLoader, FiFolder } from 'react-icons/fi';
import { MESES } from './fechamentoContabil/tipos';
import { useDadosFechamento } from './fechamentoContabil/useDadosFechamento';
import { useExportacoes } from './fechamentoContabil/useExportacoes';
import { CardMetricas } from './fechamentoContabil/components/CardMetricas';
import { RelatorioFaturamento } from './fechamentoContabil/components/RelatorioFaturamento';
import { RelatorioComissoes } from './fechamentoContabil/components/RelatorioComissoes';
import { RelatorioLivroCaixa } from './fechamentoContabil/components/RelatorioLivroCaixa';
import { RelatorioConciliacao } from './fechamentoContabil/components/RelatorioConciliacao';
import { RelatorioFiscalParceiros } from './fechamentoContabil/components/RelatorioFiscalParceiros';

export function GavetaFechamentoContabil({ perfil }: any) {
  const {
    carregando, nomeSalao, mes, setMes, ano, setAno, mesAnoLabel,
    dadosFaturamento, dadosComissoes, dadosLivroCaixa, dadosConciliacao,
  } = useDadosFechamento(perfil);

  const { gerandoPDF, exportarCSV, exportarPDFRelatorio, exportarKitCompleto } = useExportacoes({
    nomeSalao, mes, ano, mesAnoLabel,
    dadosFaturamento, dadosComissoes, dadosLivroCaixa, dadosConciliacao,
  });

  if (carregando) return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 12, color: C.sidebarBg, fontWeight: 700 }}>
      <FiLoader className="animate-spin" size={18} /> Compilando dados contábeis...
    </div>
  );

  return (
    <div className="font-body" style={{ height: '100%', overflowY: 'auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h2 className="font-title uppercase tracking-widest"
            style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg }}>
            Kit Fechamento Contábil
          </h2>
          <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: 13 }}>
            5 relatórios prontos para o contador — exportáveis em CSV e PDF.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={`${ano}-${mes}`}
            onChange={e => { const [a, m] = e.target.value.split('-'); setAno(Number(a)); setMes(Number(m)); }}
            style={{ padding: '10px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, fontWeight: 600, color: C.textMain, background: C.bgCard }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={`${ano}-${i}`}>{MESES[i]} {ano}</option>
            ))}
          </select>

          <button
            onClick={exportarKitCompleto}
            disabled={gerandoPDF === 'kit'}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: RAIO_MD, border: 'none',
              background: gerandoPDF === 'kit' ? C.borderMid : C.douradoEleva,
              color: C.sidebarBg, fontSize: 13, fontWeight: 800,
              cursor: gerandoPDF === 'kit' ? 'not-allowed' : 'pointer',
            }}
          >
            {gerandoPDF === 'kit'
              ? <><FiLoader className="animate-spin" size={16} /> Gerando...</>
              : <><FiFolder size={16} /> Exportar Kit Completo (PDF)</>
            }
          </button>
        </div>
      </div>

      <CardMetricas
        dadosFaturamento={dadosFaturamento}
        dadosComissoes={dadosComissoes}
        dadosLivroCaixa={dadosLivroCaixa}
      />

      <RelatorioFaturamento
        dadosFaturamento={dadosFaturamento}
        mesAnoLabel={mesAnoLabel}
        onCSV={() => exportarCSV('faturamento')}
        onPDF={() => exportarPDFRelatorio('faturamento')}
        gerandoPDF={gerandoPDF}
      />

      <RelatorioComissoes
        dadosComissoes={dadosComissoes}
        mesAnoLabel={mesAnoLabel}
        onCSVAgrupado={() => exportarCSV('comissoes_agrupado')}
        onCSVDetalhado={() => exportarCSV('comissoes_detalhado')}
        onPDF={() => exportarPDFRelatorio('comissoes')}
        gerandoPDF={gerandoPDF}
      />

      <RelatorioLivroCaixa
        dadosLivroCaixa={dadosLivroCaixa}
        mesAnoLabel={mesAnoLabel}
        onCSV={() => exportarCSV('livrocaixa')}
        onPDF={() => exportarPDFRelatorio('livrocaixa')}
        gerandoPDF={gerandoPDF}
      />

      <RelatorioConciliacao
        dadosConciliacao={dadosConciliacao}
        mesAnoLabel={mesAnoLabel}
        onCSV={() => exportarCSV('conciliacao')}
        onPDF={() => exportarPDFRelatorio('conciliacao')}
        gerandoPDF={gerandoPDF}
      />

      <RelatorioFiscalParceiros
        perfil={perfil}
        mes={mes}
        ano={ano}
        mesAnoLabel={mesAnoLabel}
      />

      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: RAIO_LG, padding: 16, fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
        <strong>⚖️ Nota para o Contador:</strong> Os relatórios acima são baseados nos lançamentos registrados no sistema.
        A separação ISS/ICMS depende da categorização correta dos lançamentos em "Serviços Prestados" e "Venda de Produtos".
        Comissões dedutíveis seguem a Lei nº 13.352/2016 (Lei Salão Parceiro).
        XMLs de NFS-e e NFC-e serão disponibilizados após integração com provedor fiscal homologado.
      </div>

    </div>
  );
}
