'use client'

import { C, brl } from '@/lib/constants';
import { InputData } from '@/components/InputData';
import { RAIO_MD, RAIO_XL, RAIO_XS } from '@/lib/estiloGlobal';
import { FiDownload, FiCreditCard, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useFluxoPagamento, EMOJI_BANDEIRA, ICONE_FORMA, VISOES, PERIODOS, GRID } from './useFluxoPagamento';

export function GavetaFluxoPagamento({ dados, perfil }: any) {
  const f = useFluxoPagamento(dados, perfil);

  const btnPeriodo = (p: string) => ({
    padding: '6px 12px', borderRadius: RAIO_XS,
    border: `1px solid ${f.periodo === p ? C.douradoLuarys : C.border}`,
    background: f.periodo === p ? C.douradoLuarys : C.bgCard,
    color: f.periodo === p ? '#fff' : C.textMuted,
    fontSize: 11, fontWeight: 600, cursor: 'pointer',
  });

  const btnVisao = (v: string) => ({
    padding: '8px 14px', borderRadius: RAIO_MD,
    border: `1px solid ${f.visao === v ? C.sidebarBg : C.borderMid}`,
    background: f.visao === v ? C.sidebarBg : C.bgCard,
    color: f.visao === v ? '#fff' : C.textMuted,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  });

  const inputStyle = {
    padding: '7px 10px', borderRadius: RAIO_MD,
    border: `1px solid ${C.borderMid}`,
    fontSize: 12, color: C.textMain, background: C.bgCard,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexShrink: 0 }}>
        <div>
          <h2 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg }}>
            Fluxo por Forma de Pagamento
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>
            Análise de recebimentos agrupados por método
          </p>
        </div>
        <button
          onClick={f.exportarCSV}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          <FiDownload size={14} /> Exportar CSV
        </button>
      </div>

      {/* ── Filtros de período ────────────────────────────────────────────── */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20, marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PERIODOS.map(({ key, label }) => (
            <button key={key} style={btnPeriodo(key)} onClick={() => f.setPeriodo(key)}>{label}</button>
          ))}
        </div>
        {f.periodo === 'livre' && (
          <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>De</span>
              <InputData value={f.delivre} onChange={f.setDelivre} style={inputStyle} />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Até</span>
              <InputData value={f.atelivre} onChange={f.setAtelivre} style={inputStyle} />
            </div>
          </div>
        )}
      </div>

      {/* ── Visão ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', flexShrink: 0 }}>
        {VISOES.map(({ key, label }) => (
          <button key={key} style={btnVisao(key)} onClick={() => f.setVisao(key)}>{label}</button>
        ))}
      </div>

      {/* ── Tabela ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>

        {/* Cabeçalho da tabela */}
        <div className="font-title" style={{ display: 'grid', gridTemplateColumns: GRID, padding: '12px 20px', background: C.bg, borderBottom: `1px solid ${C.borderMid}`, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
          <span>Forma de Pagamento</span>
          <span style={{ textAlign: 'center' }}>Qtd</span>
          <span style={{ textAlign: 'right' }}>Valor Bruto</span>
          <span style={{ textAlign: 'right' }}>Taxa Operadora</span>
          <span style={{ textAlign: 'right' }}>Custo</span>
          <span style={{ textAlign: 'right' }}>Valor Líquido</span>
        </div>

        {/* Linhas */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
        {f.linhas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 }}>
            Nenhum lançamento encontrado no período selecionado.
          </div>
        ) : f.linhas.map((l, idx) => {
          const temSub      = !!l.subLinhas && l.subLinhas.length > 0;
          const aberto      = !!f.expandido[l.forma];
          const ehCartao    = temSub || l.forma === 'Cartão de Crédito' || l.forma === 'Cartão de Débito';
          const podeTerTaxa = l.forma !== 'Dinheiro' && l.forma !== 'Outros';
          const qtdSemBand  = temSub ? l.qtd - (l.subLinhas || []).reduce((a, s) => a + s.qtd, 0) : 0;

          // Formata taxa para exibição: só mostra "—" quando config não foi carregada
          const fmtTaxa = (t: number) =>
            !f.configCarregada ? '—' : `${t.toFixed(2).replace('.', ',')}%`;

          return (
            <div key={l.forma} style={{ borderBottom: idx < f.linhas.length - 1 ? `1px solid ${C.border}` : 'none' }}>

              {/* Linha principal */}
              <div
                onClick={() => (temSub || (ehCartao && l.qtd > 0)) && f.toggleExpandido(l.forma)}
                style={{
                  display: 'grid', gridTemplateColumns: GRID,
                  padding: '14px 20px', fontSize: 13, alignItems: 'center',
                  cursor: ehCartao ? 'pointer' : 'default',
                  background: aberto ? '#F8FAFC' : 'transparent',
                  transition: 'background 0.15s',
                }}
                className={ehCartao ? 'hover:bg-slate-50' : ''}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, color: C.textMain }}>
                  <span style={{ fontSize: 16 }}>{ICONE_FORMA[l.forma] || '📋'}</span>
                  {l.forma}
                  {temSub && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, background: C.bg, padding: '2px 7px', borderRadius: RAIO_XS, border: `1px solid ${C.borderMid}` }}>
                      {l.subLinhas!.length} {l.subLinhas!.length === 1 ? 'bandeira' : 'bandeiras'}
                    </span>
                  )}
                  {ehCartao && (
                    aberto ? <FiChevronUp size={14} color={C.textLight} /> : <FiChevronDown size={14} color={C.textLight} />
                  )}
                </span>
                <span style={{ textAlign: 'center', color: C.textMuted, fontWeight: 500 }}>{l.qtd}</span>
                <span style={{ textAlign: 'right', color: C.success, fontWeight: 600 }}>{brl(l.valorBruto)}</span>
                <span style={{ textAlign: 'right', color: l.taxa > 0 ? '#B45309' : C.textLight, fontSize: 12, fontWeight: l.taxa > 0 ? 600 : 400 }}>
                  {podeTerTaxa ? fmtTaxa(l.taxa) : '—'}
                </span>
                <span style={{ textAlign: 'right', color: l.custo > 0 ? '#EF4444' : C.textLight, fontSize: 12, fontWeight: l.custo > 0 ? 600 : 400 }}>
                  {l.custo > 0 ? `− ${brl(l.custo)}` : (f.configCarregada && podeTerTaxa ? `${brl(0)}` : '—')}
                </span>
                <span style={{ textAlign: 'right', color: C.textMain, fontWeight: 700 }}>{brl(l.valorLiquido)}</span>
              </div>

              {/* Sub-linhas (bandeiras) */}
              {ehCartao && aberto && temSub && l.subLinhas!.map(s => (
                <div key={s.bandeira} style={{
                  display: 'grid', gridTemplateColumns: GRID,
                  padding: '10px 20px 10px 48px',
                  fontSize: 12, alignItems: 'center',
                  background: '#F0F7FF',
                  borderTop: `1px dashed ${C.borderMid}`,
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: C.textMain }}>
                    <span>{EMOJI_BANDEIRA[s.bandeira] || '💳'}</span>
                    {s.bandeira}
                  </span>
                  <span style={{ textAlign: 'center', color: C.textMuted }}>{s.qtd}</span>
                  <span style={{ textAlign: 'right', color: C.success }}>{brl(s.valorBruto)}</span>
                  <span style={{ textAlign: 'right', color: s.taxa > 0 ? '#B45309' : C.textLight }}>
                    {fmtTaxa(s.taxa)}
                  </span>
                  <span style={{ textAlign: 'right', color: s.custo > 0 ? '#EF4444' : C.textLight }}>
                    {s.custo > 0 ? `− ${brl(s.custo)}` : brl(0)}
                  </span>
                  <span style={{ textAlign: 'right', color: C.textMain, fontWeight: 600 }}>{brl(s.valorLiquido)}</span>
                </div>
              ))}

              {/* Lançamentos sem bandeira — taxa estimada pela média configurada */}
              {ehCartao && aberto && qtdSemBand > 0 && (
                <div style={{
                  display: 'grid', gridTemplateColumns: GRID,
                  padding: '8px 20px 8px 48px',
                  background: '#FFFBEB', borderTop: `1px dashed ${C.borderMid}`,
                  fontSize: 11, alignItems: 'center', color: '#92400E',
                }}>
                  <span style={{ fontWeight: 600 }}>
                    ⚠️ Sem bandeira registrada ({qtdSemBand} lanç.)
                  </span>
                  <span style={{ textAlign: 'center' }}>{qtdSemBand}</span>
                  <span />
                  <span style={{ textAlign: 'right', fontSize: 10 }}>
                    {f.configCarregada ? '≈ estimado' : '—'}
                  </span>
                  <span />
                  <span />
                </div>
              )}
            </div>
          );
        })}
        </div>

        {/* Rodapé / Totais */}
        {f.linhas.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '16px 20px', background: C.sidebarBg, flexShrink: 0 }}>
            <span className="font-title" style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Geral</span>
            <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{f.totalQtd}</span>
            <span style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: C.success }}>{brl(f.totalBruto)}</span>
            <span style={{ textAlign: 'right', fontSize: 12, color: '#94A3B8' }}>
              {!f.configCarregada ? '—' : `≈ ${f.taxaGeral.toFixed(2).replace('.', ',')}%`}
            </span>
            <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#FCA5A5' }}>
              {f.totalCusto > 0 ? `− ${brl(f.totalCusto)}` : (f.configCarregada ? brl(0) : '—')}
            </span>
            <span style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#fff' }}>{brl(f.totalLiquido)}</span>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <FiCreditCard size={13} color={C.textLight} />
        <span style={{ fontSize: 11, color: C.textLight }}>
          Visão ativa: <strong style={{ color: C.textMuted }}>{VISOES.find(v => v.key === f.visao)?.label}</strong> · {f.de === f.ate ? f.de : `${f.de} a ${f.ate}`}
          {!f.configCarregada && (
            <span style={{ color: '#B45309', marginLeft: 12 }}>⚠️ Taxas não configuradas — acesse Configurações → Taxas de Cartão.</span>
          )}
        </span>
      </div>
    </div>
  );
}
