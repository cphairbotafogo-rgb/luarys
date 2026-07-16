// src/modules/financeiro/AbaLancamentos.tsx
// Aba Livro Caixa (Auditoria) — tabela de lançamentos + painel de estornos.
'use client'
import { C, brl } from '@/lib/constants';
import { RAIO_XS, RAIO_XL, RAIO_2XL } from '@/lib/estiloGlobal';
import { FiInbox, FiCheckCircle, FiAlertCircle, FiCreditCard, FiLink, FiEdit2, FiAlertTriangle } from 'react-icons/fi';

function diasVencimento(t: any): { tipo: 'atrasado' | 'proximo' | null; dias: number } {
  if (t.status === 'Pago' || !t.data_vencimento) return { tipo: null, dias: 0 };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(t.data_vencimento + 'T12:00:00');
  const dias = Math.ceil((venc.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0)  return { tipo: 'atrasado', dias: Math.abs(dias) };
  if (dias <= 5) return { tipo: 'proximo',  dias };
  return { tipo: null, dias };
}

interface Props {
  transacoes: any[];
  onSelecionarTransacao: (t: any) => void;
}

export function AbaLancamentos({ transacoes, onSelecionarTransacao }: Props) {
  const ativas   = transacoes.filter(t => t.status !== 'Estornado');
  const estornos = transacoes.filter(t => t.status === 'Estornado');

  const badgePagamento = (forma: string) => {
    const f = forma || '';
    if (f.includes('Pix') || f.includes('PIX')) return { bg: '#ECFDF5', color: '#059669' };
    if (f.includes('Crédito')) return { bg: '#EFF6FF', color: '#1D4ED8' };
    if (f.includes('Débito'))  return { bg: '#F5F3FF', color: '#7C3AED' };
    if (f.includes('Dinheiro')) return { bg: '#FEF3C7', color: '#92400E' };
    return { bg: '#F1F5F9', color: C.textMain };
  };

  return (
    <>
      {/* Tabela principal */}
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <div className="font-title uppercase tracking-widest" style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 1.5fr 1fr', background: C.bg, padding: '16px 24px', borderBottom: `1px solid ${C.borderMid}`, fontSize: 10, fontWeight: 700, color: C.textLight }}>
          <div>Data e Status</div>
          <div>Descrição / Profissional / Pgto</div>
          <div>Categoria</div>
          <div style={{ textAlign: 'right' }}>Valor Líquido</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {ativas.length === 0 && (
            <div style={{ padding: 80, textAlign: 'center', color: C.textMuted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <FiInbox size={40} color={C.borderMid} />
              <p className="font-title" style={{ margin: 0, fontWeight: 700, fontSize: 14, color: C.textMain }}>Nenhuma transação registrada neste período.</p>
            </div>
          )}
          {ativas.map((t, i, arr) => {
            const badge  = badgePagamento(t.forma_pagamento || '');
            const alerta = diasVencimento(t);
            return (
              <div key={t.id} onClick={() => onSelecionarTransacao(t)} className="transition-all hover:bg-slate-50"
                style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 1.5fr 1fr', padding: '16px 24px', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${C.border}`, alignItems: 'center', cursor: 'pointer', borderLeft: alerta.tipo === 'atrasado' ? '3px solid #EF4444' : alerta.tipo === 'proximo' ? '3px solid #F59E0B' : 'none' }}
                title="Clique para ver detalhes, editar ou estornar">
                <div>
                  <strong style={{ fontSize: 12, color: C.textMain, display: 'block', fontWeight: 600 }}>
                    {new Date(t.data_movimentacao).toLocaleDateString('pt-BR')}
                  </strong>
                  <span className="font-title uppercase tracking-widest" style={{ fontSize: 9, fontWeight: 700, color: t.status === 'Pago' ? '#10B981' : '#D97706', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    {t.status === 'Pago' ? <FiCheckCircle size={10} /> : <FiAlertCircle size={10} />} {t.status?.toUpperCase() || 'PAGO'}
                  </span>
                  {alerta.tipo === 'atrasado' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#FEE2E2', color: '#991B1B', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, marginTop: 4 }}>
                      <FiAlertCircle size={9} /> {alerta.dias}d em atraso
                    </span>
                  )}
                  {alerta.tipo === 'proximo' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#FEF3C7', color: '#92400E', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, marginTop: 4 }}>
                      <FiAlertTriangle size={9} /> vence em {alerta.dias}d
                    </span>
                  )}
                </div>
                <div>
                  <strong className="font-title" style={{ fontSize: 13, color: C.sidebarBg, display: 'block', marginBottom: 6, fontWeight: 700 }}>{t.descricao}</strong>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: RAIO_XS, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, background: badge.bg, color: badge.color }}>
                      <FiCreditCard size={10} /> {t.forma_pagamento || 'Não informada'}
                      {t.bandeira_cartao && <span style={{ fontWeight: 800, opacity: 0.8 }}>· {t.bandeira_cartao}</span>}
                    </span>
                    {t.descricao?.includes('/') && <span style={{ fontSize: 10, background: '#FFFBEB', color: '#92400E', padding: '3px 8px', borderRadius: RAIO_XS, fontWeight: 600 }}>Parcelado</span>}
                    {t.relacao_id && <span style={{ fontSize: 10, background: C.bg, border: `1px solid ${C.borderMid}`, color: C.sidebarBg, padding: '2px 8px', borderRadius: RAIO_XS, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><FiLink size={10} /> Vinculado</span>}
                  </div>
                </div>
                <div>
                  <span style={{ background: C.bg, color: C.textMuted, padding: '4px 10px', borderRadius: RAIO_XL, fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}` }}>{t.categoria}</span>
                </div>
                <div className="font-title" style={{ fontSize: 14, fontWeight: 700, textAlign: 'right', color: t.tipo === 'entrada' ? '#10B981' : '#EF4444' }}>
                  {t.tipo === 'entrada' ? '+' : '-'} {brl(t.valor)}
                  <FiEdit2 size={12} style={{ marginLeft: 8, color: C.borderMid }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Painel de estornos */}
      {estornos.length > 0 && (
        <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, border: '1px solid #FECACA', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', marginTop: 16 }}>
          <div style={{ background: '#FEF2F2', padding: '14px 24px', borderBottom: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiAlertCircle size={14} color="#991B1B" />
            <span className="font-title uppercase tracking-widest" style={{ fontSize: 10, fontWeight: 700, color: '#991B1B' }}>
              Estornos do Período — não contabilizados nos totais
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#991B1B', fontWeight: 600 }}>
              {estornos.length} registro{estornos.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="font-title uppercase tracking-widest" style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 1.5fr 1fr', background: '#FEF2F2', padding: '10px 24px', borderBottom: '1px solid #FECACA', fontSize: 9, fontWeight: 700, color: '#991B1B' }}>
            <div>Data</div><div>Descrição / Motivo</div><div>Categoria</div><div style={{ textAlign: 'right' }}>Valor</div>
          </div>
          {estornos.map((t, i, arr) => (
            <div key={t.id} onClick={() => onSelecionarTransacao(t)} className="transition-all hover:bg-red-50"
              style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 1.5fr 1fr', padding: '14px 24px', borderBottom: i === arr.length - 1 ? 'none' : '1px solid #FEE2E2', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <strong style={{ fontSize: 12, color: C.textMain, display: 'block', fontWeight: 600 }}>{new Date(t.data_movimentacao).toLocaleDateString('pt-BR')}</strong>
                <span className="font-title uppercase tracking-widest" style={{ fontSize: 9, fontWeight: 700, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <FiAlertCircle size={9} /> ESTORNADO
                </span>
              </div>
              <div>
                <strong className="font-title" style={{ fontSize: 13, color: '#991B1B', display: 'block', marginBottom: 4, fontWeight: 700, textDecoration: 'line-through' }}>{t.descricao}</strong>
                {(t.comentario || t.observacao) && <span style={{ fontSize: 11, color: C.textLight }}>{t.comentario || t.observacao}</span>}
              </div>
              <div>
                <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 10px', borderRadius: RAIO_XL, fontSize: 11, fontWeight: 600, border: '1px solid #FECACA' }}>{t.categoria}</span>
              </div>
              <div className="font-title" style={{ fontSize: 14, fontWeight: 700, textAlign: 'right', color: '#991B1B', textDecoration: 'line-through' }}>
                {t.tipo === 'entrada' ? '+' : '-'} {brl(t.valor)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
