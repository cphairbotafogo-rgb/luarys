'use client'
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_2XL } from '@/lib/estiloGlobal';
import { FiAlertTriangle, FiAlertCircle } from 'react-icons/fi';

function alertaVencimento(t: any): { tipo: 'atrasado' | 'proximo' | null; dias: number } {
  if (t.status === 'Pago' || !t.data_vencimento) return { tipo: null, dias: 0 };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(t.data_vencimento + 'T12:00:00');
  const dias = Math.ceil((venc.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0)  return { tipo: 'atrasado', dias: Math.abs(dias) };
  if (dias <= 5) return { tipo: 'proximo',  dias };
  return { tipo: null, dias };
}

interface Props {
  saidas: any[];
  onSelecionarTransacao: (t: any) => void;
}

interface ColunaProps {
  titulo: string;
  cor: string;
  corFundo: string;
  itens: any[];
  total: number;
  onSelecionar: (t: any) => void;
}

function Coluna({ titulo, cor, corFundo, itens, total, onSelecionar }: ColunaProps) {
  return (
    <div style={{ flex: 1, background: C.bgCard, borderRadius: RAIO_2XL, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <div style={{ padding: '18px 24px', background: corFundo, borderBottom: `1px solid ${C.borderMid}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="font-title uppercase tracking-widest" style={{ fontSize: 12, fontWeight: 800, color: cor }}>{titulo}</span>
        <span className="font-title" style={{ fontSize: 18, fontWeight: 800, color: cor }}>{brl(total)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {itens.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
            <p style={{ margin: 0, fontSize: 12 }}>Nenhuma despesa {titulo.toLowerCase()} neste período.</p>
          </div>
        )}
        {itens.map((t, i) => {
          const alerta = alertaVencimento(t);
          return (
            <div key={t.id} onClick={() => onSelecionar(t)} className="transition-all hover:bg-slate-50"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: i === itens.length - 1 ? 'none' : `1px solid ${C.border}`, cursor: 'pointer', borderLeft: alerta.tipo === 'atrasado' ? '3px solid #EF4444' : alerta.tipo === 'proximo' ? '3px solid #F59E0B' : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <strong style={{ fontSize: 13, color: C.textMain, fontWeight: 600 }}>{t.descricao}</strong>
                  {alerta.tipo === 'atrasado' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#FEE2E2', color: '#991B1B', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase' as const }}>
                      <FiAlertCircle size={9} /> {alerta.dias}d em atraso
                    </span>
                  )}
                  {alerta.tipo === 'proximo' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#FEF3C7', color: '#92400E', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase' as const }}>
                      <FiAlertTriangle size={9} /> vence em {alerta.dias}d
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: C.textLight }}>
                  {t.categoria}
                  {t.data_vencimento && t.status !== 'Pago' && ` · venc. ${new Date(t.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                  {!t.data_vencimento && t.data_movimentacao && ` · ${new Date(t.data_movimentacao).toLocaleDateString('pt-BR')}`}
                </span>
              </div>
              <strong className="font-title" style={{ fontSize: 13, color: cor, fontWeight: 700 }}>{brl(t.valor)}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AbaDespesas({ saidas, onSelecionarTransacao }: Props) {
  const despesasDoPeriodo  = saidas.filter(t => t.status !== 'Estornado');
  const fixas              = despesasDoPeriodo.filter(t => t.tipo_custo === 'Fixo');
  const variaveis          = despesasDoPeriodo.filter(t => t.tipo_custo === 'Variável');
  const semClassificacao   = despesasDoPeriodo.filter(t => t.tipo_custo !== 'Fixo' && t.tipo_custo !== 'Variável');
  const totalFixas         = fixas.reduce((acc, t) => acc + (t.valor || 0), 0);
  const totalVariaveis     = variaveis.reduce((acc, t) => acc + (t.valor || 0), 0);
  const totalSemClass      = semClassificacao.reduce((acc, t) => acc + (t.valor || 0), 0);
  const totalGeral         = totalFixas + totalVariaveis + totalSemClass;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Resumo geral */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '16px 20px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' }}>Total de Despesas no Período</span>
          <div className="font-title" style={{ fontSize: 22, fontWeight: 800, color: C.textMain, marginTop: 4 }}>{brl(totalGeral)}</div>
        </div>
        <div style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '16px 20px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase' }}>% Fixas x Variáveis</span>
          <div className="font-title" style={{ fontSize: 14, fontWeight: 700, color: C.textMain, marginTop: 4 }}>
            {totalGeral > 0 ? `${((totalFixas / totalGeral) * 100).toFixed(0)}% fixas` : '—'} · {totalGeral > 0 ? `${((totalVariaveis / totalGeral) * 100).toFixed(0)}% variáveis` : '—'}
          </div>
        </div>
      </div>

      {/* Colunas */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <Coluna titulo="Despesas Fixas"     cor="#1D4ED8" corFundo="#EFF6FF" itens={fixas}    total={totalFixas}    onSelecionar={onSelecionarTransacao} />
        <Coluna titulo="Despesas Variáveis" cor="#92400E" corFundo="#FFFBEB" itens={variaveis} total={totalVariaveis} onSelecionar={onSelecionarTransacao} />
        {semClassificacao.length > 0 && (
          <Coluna titulo="Sem Classificação" cor="#6B7280" corFundo="#F9FAFB" itens={semClassificacao} total={totalSemClass} onSelecionar={onSelecionarTransacao} />
        )}
      </div>

      {semClassificacao.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
          <strong>{semClassificacao.length} despesa{semClassificacao.length > 1 ? 's' : ''} sem Tipo de Custo definido.</strong>{' '}
          Clique em cada uma e defina como Fixo ou Variável para que entrem nos relatórios corretamente.
        </div>
      )}
    </div>
  );
}
