// src/modules/financeiro/AbaPainel.tsx
// Aba Dashboard do módulo financeiro — cards de receitas, despesas e saldo.
'use client'
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_2XL } from '@/lib/estiloGlobal';
import { FiArrowUpRight, FiArrowDownRight, FiDollarSign, FiChevronDown, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { Card } from '@/components/ui';

interface Props {
  entradas: any[];
  saidas: any[];
  totalEntradas: number;
  totalSaidas: number;
  totalSaidasPagas: number;
  totalSaidasPendentes: number;
  saldo: number;
  totaisPix: number;
  totaisCartao: number;
  totaisDinheiro: number;
  despesasPorCategoria: Record<string, number>;
  expandirReceitas: boolean;
  setExpandirReceitas: (v: boolean | ((prev: boolean) => boolean)) => void;
  expandirDespesas: boolean;
  setExpandirDespesas: (v: boolean | ((prev: boolean) => boolean)) => void;
  onSelecionarTransacao: (t: any) => void;
}

export function AbaPainel({
  entradas, saidas, totalEntradas, totalSaidas,
  totalSaidasPagas, totalSaidasPendentes, saldo,
  totaisPix, totaisCartao, totaisDinheiro,
  despesasPorCategoria,
  expandirReceitas, setExpandirReceitas,
  expandirDespesas, setExpandirDespesas,
  onSelecionarTransacao,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>

        {/* Card Receitas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Card
            style={{ background: C.bgCard, padding: 24, borderRadius: expandirReceitas ? `${RAIO_2XL} ${RAIO_2XL} 0 0` : RAIO_2XL, border: `1px solid ${C.border}`, borderBottom: expandirReceitas ? 'none' : undefined, boxShadow: '0 4px 6px rgba(0,0,0,0.02)', cursor: 'pointer' }}
            onClick={() => setExpandirReceitas(v => !v)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="font-title uppercase tracking-widest" style={{ fontSize: 11, fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiArrowUpRight size={14} /> Receitas (Entradas)
              </span>
              <FiChevronDown size={14} color={C.textLight} style={{ transform: expandirReceitas ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </div>
            <p className="font-title" style={{ margin: '12px 0 0', fontSize: 26, fontWeight: 700, color: C.textMain }}>{brl(totalEntradas)}</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <div style={{ flex: 1 }}><div className="font-title uppercase tracking-widest" style={{ fontSize: 9, color: C.textMuted, fontWeight: 700 }}>PIX</div><div style={{ fontSize: 13, fontWeight: 700, color: C.textMain, marginTop: 4 }}>{brl(totaisPix)}</div></div>
              <div style={{ flex: 1 }}><div className="font-title uppercase tracking-widest" style={{ fontSize: 9, color: C.textMuted, fontWeight: 700 }}>Cartões</div><div style={{ fontSize: 13, fontWeight: 700, color: C.textMain, marginTop: 4 }}>{brl(totaisCartao)}</div></div>
              <div style={{ flex: 1 }}><div className="font-title uppercase tracking-widest" style={{ fontSize: 9, color: C.textMuted, fontWeight: 700 }}>Dinheiro</div><div style={{ fontSize: 13, fontWeight: 700, color: C.textMain, marginTop: 4 }}>{brl(totaisDinheiro)}</div></div>
            </div>
          </Card>
          {expandirReceitas && (
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: `0 0 ${RAIO_2XL} ${RAIO_2XL}`, maxHeight: 320, overflowY: 'auto' }}>
              <div style={{ padding: '10px 16px', background: '#F0FDF4', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {entradas.length} lançamento{entradas.length !== 1 ? 's' : ''}
                </span>
              </div>
              {entradas.length === 0
                ? <div style={{ padding: '16px', fontSize: 12, color: C.textLight, textAlign: 'center' }}>Nenhuma entrada no período.</div>
                : entradas.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${C.border}`, gap: 8, cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); onSelecionarTransacao(t); }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.cliente_nome || t.descricao || '—'}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>
                        {t.forma_pagamento || t.metodo_pagamento || '—'} · {t.data_movimentacao ? new Date(t.data_movimentacao).toLocaleDateString('pt-BR') : '—'}
                        {t.profissional_nome ? ` · ${t.profissional_nome}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#10B981', whiteSpace: 'nowrap' }}>{brl(Number(t.valor))}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Card Despesas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Card
            style={{ background: C.bgCard, padding: 24, borderRadius: expandirDespesas ? `${RAIO_2XL} ${RAIO_2XL} 0 0` : RAIO_2XL, border: `1px solid ${C.border}`, borderBottom: expandirDespesas ? 'none' : undefined, boxShadow: '0 4px 6px rgba(0,0,0,0.02)', cursor: 'pointer' }}
            onClick={() => setExpandirDespesas(v => !v)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="font-title uppercase tracking-widest" style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiArrowDownRight size={14} /> Despesas (Saídas)
              </span>
              <FiChevronDown size={14} color={C.textLight} style={{ transform: expandirDespesas ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </div>
            <p className="font-title" style={{ margin: '12px 0 0', fontSize: 26, fontWeight: 700, color: C.textMain }}>{brl(totalSaidas)}</p>
            {totalSaidasPendentes > 0 && (
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>Pagas: {brl(totalSaidasPagas)}</span>
                <span style={{ fontSize: 11, color: '#B45309', fontWeight: 600 }}>A Pagar: {brl(totalSaidasPendentes)}</span>
              </div>
            )}
            <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              {Object.keys(despesasPorCategoria).length === 0
                ? <div style={{ fontSize: 12, color: C.textLight, fontWeight: 500 }}>Sem despesas no período.</div>
                : Object.entries(despesasPorCategoria).slice(0, 3).map(([cat, val]: any) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, fontWeight: 500 }}>
                    <span style={{ color: C.textMuted }}>{cat}</span>
                    <strong style={{ color: C.textMain }}>{brl(val)}</strong>
                  </div>
                ))}
            </div>
          </Card>
          {expandirDespesas && (
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: `0 0 ${RAIO_2XL} ${RAIO_2XL}`, maxHeight: 320, overflowY: 'auto' }}>
              <div style={{ padding: '10px 16px', background: '#FEF2F2', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {saidas.length} lançamento{saidas.length !== 1 ? 's' : ''}
                </span>
              </div>
              {saidas.length === 0
                ? <div style={{ padding: '16px', fontSize: 12, color: C.textLight, textAlign: 'center' }}>Nenhuma despesa no período.</div>
                : saidas.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${C.border}`, gap: 8, cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); onSelecionarTransacao(t); }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao || t.categoria || '—'}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>
                        {t.categoria || '—'} · {t.data_vencimento ? new Date(t.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                        {t.status ? ` · ${t.status}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#EF4444', whiteSpace: 'nowrap' }}>{brl(Number(t.valor))}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Card Saldo */}
        <Card style={{ background: C.sidebarBg, padding: 24, borderRadius: RAIO_2XL, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 100, color: C.douradoLuarys, opacity: 0.1 }}><FiDollarSign /></div>
          <div style={{ position: 'relative', zIndex: 10 }}>
            <span className="font-title uppercase tracking-widest" style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>Resultado Líquido</span>
            <p className="font-title" style={{ margin: '12px 0 0', fontSize: 32, fontWeight: 700, color: '#fff' }}>{brl(saldo)}</p>
          </div>
          <div style={{ position: 'relative', zIndex: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: RAIO_MD, fontSize: 12, color: '#F8F9FA', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            {saldo >= 0
              ? <><FiTrendingUp size={16} color={C.douradoLuarys} /> O caixa está positivo no período.</>
              : <><FiTrendingDown size={16} color="#FCA5A5" /> Atenção: Saldo negativo no período!</>}
          </div>
        </Card>

      </div>
    </div>
  );
}
