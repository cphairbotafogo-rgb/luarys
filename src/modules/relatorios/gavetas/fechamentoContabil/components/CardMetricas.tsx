'use client'
import { C, brl } from '@/lib/constants';
import { estiloMetrica } from '../tipos';

interface Props {
  dadosFaturamento: { total: number; totalServicos: number; totalProdutos: number };
  dadosComissoes: { totalComissao: number; validas: any[] };
  dadosLivroCaixa: { totalDespesas: number; todasSaidas: any[]; resultado: number };
}

export function CardMetricas({ dadosFaturamento, dadosComissoes, dadosLivroCaixa }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
      <div style={estiloMetrica('#10B981')}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Faturamento Total</p>
        <p className="font-title" style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 800, color: '#10B981' }}>{brl(dadosFaturamento.total)}</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>Serv: {brl(dadosFaturamento.totalServicos)} | Prod: {brl(dadosFaturamento.totalProdutos)}</p>
      </div>
      <div style={estiloMetrica('#EF4444')}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Comissões a Deduzir</p>
        <p className="font-title" style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 800, color: '#EF4444' }}>{brl(dadosComissoes.totalComissao)}</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>{dadosComissoes.validas.length} lançamentos</p>
      </div>
      <div style={estiloMetrica('#F59E0B')}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Total Despesas</p>
        <p className="font-title" style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 800, color: '#F59E0B' }}>{brl(dadosLivroCaixa.totalDespesas)}</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>{dadosLivroCaixa.todasSaidas.length} lançamentos</p>
      </div>
      <div style={estiloMetrica(dadosLivroCaixa.resultado >= 0 ? C.sidebarBg : '#EF4444')}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Resultado Líquido</p>
        <p className="font-title" style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 800, color: dadosLivroCaixa.resultado >= 0 ? C.sidebarBg : '#EF4444' }}>
          {brl(dadosLivroCaixa.resultado)}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>
          {dadosLivroCaixa.resultado >= 0 ? '✅ Superávit' : '⚠️ Déficit'}
        </p>
      </div>
    </div>
  );
}
