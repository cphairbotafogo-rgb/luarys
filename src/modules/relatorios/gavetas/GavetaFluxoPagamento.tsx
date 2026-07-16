'use client'

import { useState, useMemo } from 'react';
import { useTaxasConfig } from '@/lib/useTaxasConfig';
import { C, brl } from '@/lib/constants';
import { InputData } from '@/components/InputData';
import { RAIO_MD, RAIO_XL, RAIO_XS } from '@/lib/estiloGlobal';
import { FiDownload, FiCreditCard, FiChevronDown, FiChevronUp } from 'react-icons/fi';

type Visao = 'atendimento' | 'pagamento' | 'previsto';
type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'livre';

// Mapa bandeira → emoji de bandeira
const EMOJI_BANDEIRA: Record<string, string> = {
  Visa:       '🔵',
  Mastercard: '🔴',
  Elo:        '🟡',
  Amex:       '🟢',
  Hipercard:  '🟠',
};

// Débito tem sub-marcas (Visa Electron, Maestro/Redeshop) que são variantes da mesma bandeira.
// Normaliza para o nome canônico para evitar linhas duplicadas com taxas divergentes.
// Converte timestamp UTC do banco para YYYY-MM-DD no fuso local do navegador.
function localDateStr(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return String(iso).substring(0, 10);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);
}

function normalizarBandeira(bandeira: string | null, forma: string): string | null {
  if (!bandeira || forma !== 'Cartão de Débito') return bandeira;
  const b = String(bandeira).toUpperCase();
  if (b.includes('VISA')) return 'Visa';
  if (b.includes('MAESTRO') || b.includes('REDESHOP')) return 'Mastercard';
  if (b.includes('MASTER')) return 'Mastercard';
  if (b.includes('ELO')) return 'Elo';
  if (b.includes('AMEX') || b.includes('AMERICAN')) return 'Amex';
  return bandeira;
}

function normalizarForma(forma: string): string {
  if (!forma) return 'Outros';
  const f = String(forma).toUpperCase();
  if (f.includes('CREDIT') || f.includes('CRÉDIT')) return 'Cartão de Crédito';
  if (f.includes('DEBIT')  || f.includes('DÉBIT'))  return 'Cartão de Débito';
  if (f.includes('PIX'))    return 'Pix';
  if (f.includes('DINHEIRO') || f.includes('CASH')) return 'Dinheiro';
  return 'Outros';
}

function obterIntervalo(periodo: Periodo, delivre: string, atelivre: string): { de: string; ate: string } {
  const hoje = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (periodo === 'hoje')   return { de: iso(hoje), ate: iso(hoje) };
  if (periodo === 'semana') {
    const ds = hoje.getDay();
    const ini = new Date(hoje); ini.setDate(hoje.getDate() - ds);
    const fim = new Date(hoje); fim.setDate(hoje.getDate() + (6 - ds));
    return { de: iso(ini), ate: iso(fim) };
  }
  if (periodo === 'mes') {
    return {
      de:  iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
      ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    };
  }
  if (periodo === 'ano') return { de: `${hoje.getFullYear()}-01-01`, ate: `${hoje.getFullYear()}-12-31` };
  return { de: delivre, ate: atelivre };
}


interface LinhaForma {
  forma: string;
  qtd: number;
  valorBruto: number;
  taxa: number;          // % médio ponderado
  custo: number;
  valorLiquido: number;
  subLinhas?: Array<{    // por bandeira, só em cartões
    bandeira: string;
    qtd: number;
    valorBruto: number;
    taxa: number;
    custo: number;
    valorLiquido: number;
  }>;
}

export function GavetaFluxoPagamento({ dados, perfil }: any) {
  const [visao, setVisao]     = useState<Visao>('atendimento');
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const hojeStr = localDateStr(new Date().toISOString());
  const [delivre, setDelivre] = useState(hojeStr.substring(0, 8) + '01');
  const [atelivre, setAtelivre] = useState(hojeStr);

  const { obterTaxa, configCarregada } = useTaxasConfig(perfil);

  const financeiro: any[] = dados?.financeiro || [];
  const { de, ate } = obterIntervalo(periodo, delivre, atelivre);

  const dadosFiltrados = useMemo(() => {
    return financeiro.filter((f: any) => {
      if (f.status === 'Estornado') return false;
      const data = localDateStr(f.data_movimentacao);
      return data >= de && data <= ate;
    });
  }, [financeiro, de, ate]);

  // Agrupa por forma e, dentro de cartões, por bandeira
  const linhas = useMemo<LinhaForma[]>(() => {
    const mapa: Record<string, {
      qtd: number; bruto: number; custo: number;
      porBandeira: Record<string, { qtd: number; bruto: number; custo: number }>;
    }> = {};

    dadosFiltrados.forEach((f: any) => {
      const forma    = normalizarForma(f.forma_pagamento || f.metodo_pagamento || '');
      const bandeira = normalizarBandeira(f.bandeira_cartao || null, forma);
      const valor    = Number(f.valor || 0);
      const taxa     = obterTaxa(forma, bandeira);
      const custo    = valor * taxa / 100;

      if (!mapa[forma]) mapa[forma] = { qtd: 0, bruto: 0, custo: 0, porBandeira: {} };
      mapa[forma].qtd++;
      mapa[forma].bruto += valor;
      mapa[forma].custo += custo;

      if ((forma === 'Cartão de Crédito' || forma === 'Cartão de Débito') && bandeira) {
        if (!mapa[forma].porBandeira[bandeira]) mapa[forma].porBandeira[bandeira] = { qtd: 0, bruto: 0, custo: 0 };
        mapa[forma].porBandeira[bandeira].qtd++;
        mapa[forma].porBandeira[bandeira].bruto += valor;
        mapa[forma].porBandeira[bandeira].custo += custo;
      }
    });

    return Object.entries(mapa)
      .sort(([, a], [, b]) => b.bruto - a.bruto)
      .map(([forma, v]) => {
        const taxaMedia = v.bruto > 0 ? (v.custo / v.bruto) * 100 : 0;
        const subLinhas = Object.entries(v.porBandeira)
          .sort(([, a], [, b]) => b.bruto - a.bruto)
          .map(([band, sb]) => {
            const t = sb.bruto > 0 ? (sb.custo / sb.bruto) * 100 : 0;
            return {
              bandeira: band, qtd: sb.qtd,
              valorBruto: sb.bruto, taxa: t,
              custo: sb.custo, valorLiquido: sb.bruto - sb.custo,
            };
          });

        return {
          forma, qtd: v.qtd,
          valorBruto: v.bruto, taxa: taxaMedia,
          custo: v.custo, valorLiquido: v.bruto - v.custo,
          subLinhas: subLinhas.length > 0 ? subLinhas : undefined,
        };
      });
  }, [dadosFiltrados, obterTaxa]);

  const totalQtd     = linhas.reduce((a, l) => a + l.qtd, 0);
  const totalBruto   = linhas.reduce((a, l) => a + l.valorBruto, 0);
  const totalCusto   = linhas.reduce((a, l) => a + l.custo, 0);
  const totalLiquido = totalBruto - totalCusto;
  const taxaGeral    = totalBruto > 0 ? (totalCusto / totalBruto) * 100 : 0;

  function toggleExpandido(forma: string) {
    setExpandido(prev => ({ ...prev, [forma]: !prev[forma] }));
  }

  function exportarCSV() {
    if (linhas.length === 0) return;
    let csv = 'Forma de Pagamento,Bandeira,Qtd,Valor Bruto,Taxa %,Custo Operadora,Valor Líquido\n';
    linhas.forEach(l => {
      if (l.subLinhas && l.subLinhas.length > 0) {
        l.subLinhas.forEach(s => {
          csv += `${l.forma},${s.bandeira},${s.qtd},"${s.valorBruto.toFixed(2).replace('.', ',')}","${s.taxa.toFixed(2).replace('.', ',')}%","${s.custo.toFixed(2).replace('.', ',')}","${s.valorLiquido.toFixed(2).replace('.', ',')}"\n`;
        });
      } else {
        csv += `${l.forma},—,${l.qtd},"${l.valorBruto.toFixed(2).replace('.', ',')}","${l.taxa.toFixed(2).replace('.', ',')}%","${l.custo.toFixed(2).replace('.', ',')}","${l.valorLiquido.toFixed(2).replace('.', ',')}"\n`;
      }
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fluxo_pagamento_${de}_a_${ate}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  const btnPeriodo = (p: Periodo) => ({
    padding: '6px 12px', borderRadius: RAIO_XS,
    border: `1px solid ${periodo === p ? C.douradoEleva : C.border}`,
    background: periodo === p ? C.douradoEleva : C.bgCard,
    color: periodo === p ? '#fff' : C.textMuted,
    fontSize: 11, fontWeight: 600, cursor: 'pointer',
  });

  const btnVisao = (v: Visao) => ({
    padding: '8px 14px', borderRadius: RAIO_MD,
    border: `1px solid ${visao === v ? C.sidebarBg : C.borderMid}`,
    background: visao === v ? C.sidebarBg : C.bgCard,
    color: visao === v ? '#fff' : C.textMuted,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  });

  const inputStyle = {
    padding: '7px 10px', borderRadius: RAIO_MD,
    border: `1px solid ${C.borderMid}`,
    fontSize: 12, color: C.textMain, background: C.bgCard,
  };

  const ICONE_FORMA: Record<string, string> = {
    'Cartão de Crédito': '💳',
    'Cartão de Débito':  '💳',
    'Pix':               '⚡',
    'Dinheiro':          '💵',
    'Outros':            '📋',
  };

  const VISOES: { key: Visao; label: string }[] = [
    { key: 'atendimento', label: 'Por Data de Atendimento/Venda' },
    { key: 'pagamento',   label: 'Por Data de Pagamento/Estorno' },
    { key: 'previsto',    label: 'Por Data Prevista de Recebimento' },
  ];

  const PERIODOS: { key: Periodo; label: string }[] = [
    { key: 'hoje',   label: 'Hoje' },
    { key: 'semana', label: 'Esta Semana' },
    { key: 'mes',    label: 'Este Mês' },
    { key: 'ano',    label: 'Este Ano' },
    { key: 'livre',  label: 'Período Livre' },
  ];

  const GRID = '2fr 1fr 1fr 1fr 1fr 1fr';

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
          onClick={exportarCSV}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          <FiDownload size={14} /> Exportar CSV
        </button>
      </div>

      {/* ── Filtros de período ────────────────────────────────────────────── */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20, marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PERIODOS.map(({ key, label }) => (
            <button key={key} style={btnPeriodo(key)} onClick={() => setPeriodo(key)}>{label}</button>
          ))}
        </div>
        {periodo === 'livre' && (
          <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>De</span>
              <InputData value={delivre} onChange={setDelivre} style={inputStyle} />
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Até</span>
              <InputData value={atelivre} onChange={setAtelivre} style={inputStyle} />
            </div>
          </div>
        )}
      </div>

      {/* ── Visão ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', flexShrink: 0 }}>
        {VISOES.map(({ key, label }) => (
          <button key={key} style={btnVisao(key)} onClick={() => setVisao(key)}>{label}</button>
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
        {linhas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 14 }}>
            Nenhum lançamento encontrado no período selecionado.
          </div>
        ) : linhas.map((l, idx) => {
          const temSub      = !!l.subLinhas && l.subLinhas.length > 0;
          const aberto      = !!expandido[l.forma];
          const ehCartao    = temSub || l.forma === 'Cartão de Crédito' || l.forma === 'Cartão de Débito';
          const podeTerTaxa = l.forma !== 'Dinheiro' && l.forma !== 'Outros';
          const qtdSemBand  = temSub ? l.qtd - (l.subLinhas || []).reduce((a, s) => a + s.qtd, 0) : 0;

          // Formata taxa para exibição: só mostra "—" quando config não foi carregada
          const fmtTaxa = (t: number) =>
            !configCarregada ? '—' : `${t.toFixed(2).replace('.', ',')}%`;

          return (
            <div key={l.forma} style={{ borderBottom: idx < linhas.length - 1 ? `1px solid ${C.border}` : 'none' }}>

              {/* Linha principal */}
              <div
                onClick={() => (temSub || (ehCartao && l.qtd > 0)) && toggleExpandido(l.forma)}
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
                  {l.custo > 0 ? `− ${brl(l.custo)}` : (configCarregada && podeTerTaxa ? `${brl(0)}` : '—')}
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
                    {configCarregada ? '≈ estimado' : '—'}
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
        {linhas.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '16px 20px', background: C.sidebarBg, flexShrink: 0 }}>
            <span className="font-title" style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Geral</span>
            <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{totalQtd}</span>
            <span style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: C.success }}>{brl(totalBruto)}</span>
            <span style={{ textAlign: 'right', fontSize: 12, color: '#94A3B8' }}>
              {!configCarregada ? '—' : `≈ ${taxaGeral.toFixed(2).replace('.', ',')}%`}
            </span>
            <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#FCA5A5' }}>
              {totalCusto > 0 ? `− ${brl(totalCusto)}` : (configCarregada ? brl(0) : '—')}
            </span>
            <span style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#fff' }}>{brl(totalLiquido)}</span>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <FiCreditCard size={13} color={C.textLight} />
        <span style={{ fontSize: 11, color: C.textLight }}>
          Visão ativa: <strong style={{ color: C.textMuted }}>{VISOES.find(v => v.key === visao)?.label}</strong> · {de === ate ? de : `${de} a ${ate}`}
          {!configCarregada && (
            <span style={{ color: '#B45309', marginLeft: 12 }}>⚠️ Taxas não configuradas — acesse Configurações → Taxas de Cartão.</span>
          )}
        </span>
      </div>
    </div>
  );
}
