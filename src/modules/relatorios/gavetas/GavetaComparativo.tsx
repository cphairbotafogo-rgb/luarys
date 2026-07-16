'use client'
/**
 * src/modules/relatorios/gavetas/GavetaComparativo.tsx
 *
 * Comparativo de períodos financeiros — movido do Dashboard para Inteligência → Financeiro.
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_SM, RAIO_XL, RAIO_XS } from '@/lib/estiloGlobal';
import { FiCalendar, FiBarChart2 } from 'react-icons/fi';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function iso(d: Date) { return d.toISOString().split('T')[0]; }

function labelPeriodo(inicio: string, fim: string) {
  if (inicio === fim) return new Date(inicio + 'T12:00:00').toLocaleDateString('pt-BR');
  return `${new Date(inicio + 'T12:00:00').toLocaleDateString('pt-BR')} – ${new Date(fim + 'T12:00:00').toLocaleDateString('pt-BR')}`;
}

function presets() {
  const hoje = new Date();
  const seg = new Date(hoje); seg.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
  const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
  const ini_mes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim_mes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const ini_ant = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fim_ant = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  return [
    { label: 'Hoje',         inicio: iso(hoje),    fim: iso(hoje) },
    { label: 'Esta semana',  inicio: iso(seg),     fim: iso(dom) },
    { label: 'Este mês',     inicio: iso(ini_mes), fim: iso(fim_mes) },
    { label: 'Mês anterior', inicio: iso(ini_ant), fim: iso(fim_ant) },
  ];
}

interface MetricasPeriodo {
  faturamento: number;
  despesas: number;
  lucro: number;
  atendimentos: number;
  ticketMedio: number;
  sa: number;
}

// ─── SELETOR DE PERÍODO ───────────────────────────────────────────────────────

function SeletorPeriodo({ label, inicio, fim, onMudar }: {
  label: string; inicio: string; fim: string;
  onMudar: (inicio: string, fim: string) => void;
}) {
  const refIni = useRef<HTMLInputElement>(null);
  const refFim = useRef<HTMLInputElement>(null);
  const lista  = presets();

  const inputHidden: React.CSSProperties = { position: 'absolute', width: 0, height: 0, opacity: 0, border: 'none', padding: 0 };
  const btnDate = (): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: RAIO_MD,
    border: `1px solid ${C.borderMid}`, background: C.bgCard, cursor: 'pointer',
    fontSize: 13, fontWeight: 700, color: C.textMain, position: 'relative',
  });

  return (
    <div style={{ flex: 1, minWidth: 220, background: C.bg, borderRadius: RAIO_XL, padding: 16, border: `1px solid ${C.border}` }}>
      <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {lista.map(p => {
          const ativo = inicio === p.inicio && fim === p.fim;
          return (
            <button key={p.label} onClick={() => onMudar(p.inicio, p.fim)}
              style={{ padding: '4px 10px', borderRadius: RAIO_SM, border: `1px solid ${ativo ? C.sidebarBg : C.borderMid}`, background: ativo ? C.sidebarBg : C.bgCard, color: ativo ? '#fff' : C.textMuted, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ position: 'relative' }}>
          <input ref={refIni} type="date" value={inicio} onChange={e => onMudar(e.target.value, fim)} style={inputHidden} />
          <button onClick={() => refIni.current?.showPicker()} style={btnDate()}>
            <FiCalendar size={13} color={C.textLight} />
            {new Date(inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
          </button>
        </div>
        <span style={{ fontSize: 11, color: C.textLight, fontWeight: 600 }}>até</span>
        <div style={{ position: 'relative' }}>
          <input ref={refFim} type="date" value={fim} onChange={e => onMudar(inicio, e.target.value)} style={inputHidden} />
          <button onClick={() => refFim.current?.showPicker()} style={btnDate()}>
            <FiCalendar size={13} color={C.textLight} />
            {new Date(fim + 'T12:00:00').toLocaleDateString('pt-BR')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DELTA (variação A→B) ─────────────────────────────────────────────────────

function Delta({ a, b, formato = 'brl' }: { a: number; b: number; formato?: 'brl' | 'num' | 'pct' }) {
  const diff = b - a;
  const pct  = a !== 0 ? ((diff / Math.abs(a)) * 100).toFixed(1) : null;
  if (diff === 0) return <span style={{ fontSize: 10, color: C.textLight }}>—</span>;
  const cor   = diff > 0 ? '#10B981' : C.danger;
  const sinal = diff > 0 ? '+' : '';
  const label = formato === 'brl' ? `${sinal}${brl(diff)}` : formato === 'pct' ? `${sinal}${diff.toFixed(2)}` : `${sinal}${diff.toFixed(0)}`;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: cor, background: `${cor}15`, padding: '2px 6px', borderRadius: RAIO_XS }}>
      {label} {pct ? `(${sinal}${pct}%)` : ''}
    </span>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export function GavetaComparativo({ perfil }: { perfil: any }) {
  const hoje = new Date();

  const [iniA, setIniA] = useState(() => iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)));
  const [fimA, setFimA] = useState(() => iso(new Date(hoje.getFullYear(), hoje.getMonth(), 0)));
  const [iniB, setIniB] = useState(() => iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [fimB, setFimB] = useState(() => iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));

  const [dadosA,       setDadosA]       = useState<MetricasPeriodo | null>(null);
  const [dadosB,       setDadosB]       = useState<MetricasPeriodo | null>(null);
  const [carregando,   setCarregando]   = useState(false);
  const [rodouUmaVez,  setRodouUmaVez]  = useState(false);

  const carregarPeriodo = useCallback(async (inicio: string, fim: string): Promise<MetricasPeriodo> => {
    if (!perfil?.salao_id) return { faturamento: 0, despesas: 0, lucro: 0, atendimentos: 0, ticketMedio: 0, sa: 0 };

    const [resFin, resAg, resDespV, resDespP] = await Promise.all([
      supabase.from('financeiro').select('tipo, valor, status')
        .eq('salao_id', perfil.salao_id)
        .neq('status', 'Estornado')
        .gte('data_movimentacao', `${inicio}T00:00:00Z`)
        .lte('data_movimentacao', `${fim}T23:59:59Z`),
      supabase.from('agendamentos').select('status, cliente_id')
        .eq('salao_id', perfil.salao_id)
        .gte('data', inicio).lte('data', fim).eq('status', 'Finalizado'),
      supabase.from('despesas').select('id, valor').eq('salao_id', perfil.salao_id)
        .neq('status', 'Estornado').gte('data_vencimento', inicio).lte('data_vencimento', fim),
      supabase.from('despesas').select('id, valor').eq('salao_id', perfil.salao_id)
        .neq('status', 'Estornado').gte('data_pagamento', inicio).lte('data_pagamento', fim),
    ]);

    const fin = resFin.data || [];
    const ags = resAg.data || [];
    const faturamento = fin.filter(f => f.tipo === 'entrada').reduce((s, f) => s + Number(f.valor), 0);
    const saidasFin   = fin.filter(f => f.tipo === 'saida').reduce((s, f) => s + Number(f.valor), 0);
    const despMap = new Map<string, number>();
    [...(resDespV.data || []), ...(resDespP.data || [])].forEach((d: any) => despMap.set(d.id, Number(d.valor)));
    const despesas       = saidasFin + Array.from(despMap.values()).reduce((a, v) => a + v, 0);
    const atendimentos   = ags.length;
    const clientesUnicos = new Set(ags.map(a => a.cliente_id).filter(Boolean)).size;
    const sa             = clientesUnicos > 0 ? atendimentos / clientesUnicos : 0;
    return { faturamento, despesas, lucro: faturamento - despesas, atendimentos, ticketMedio: atendimentos > 0 ? faturamento / atendimentos : 0, sa };
  }, [perfil?.salao_id]);

  async function comparar(ni_a = iniA, nf_a = fimA, ni_b = iniB, nf_b = fimB) {
    setCarregando(true);
    const [a, b] = await Promise.all([carregarPeriodo(ni_a, nf_a), carregarPeriodo(ni_b, nf_b)]);
    setDadosA(a); setDadosB(b);
    setCarregando(false);
    setRodouUmaVez(true);
  }

  async function mudarA(ni: string, nf: string) {
    setIniA(ni); setFimA(nf);
    if (rodouUmaVez) await comparar(ni, nf, iniB, fimB);
  }
  async function mudarB(ni: string, nf: string) {
    setIniB(ni); setFimB(nf);
    if (rodouUmaVez) await comparar(iniA, fimA, ni, nf);
  }

  const linhas: { label: string; key: keyof MetricasPeriodo; fmt: 'brl' | 'num' | 'pct' }[] = [
    { label: 'Faturamento',       key: 'faturamento',  fmt: 'brl' },
    { label: 'Despesas',          key: 'despesas',     fmt: 'brl' },
    { label: 'Lucro',             key: 'lucro',        fmt: 'brl' },
    { label: 'Atendimentos',      key: 'atendimentos', fmt: 'num' },
    { label: 'Ticket Médio',      key: 'ticketMedio',  fmt: 'brl' },
    { label: 'SA (Serv./Cliente)',key: 'sa',           fmt: 'pct' },
  ];

  const formatarVal = (v: number, fmt: 'brl' | 'num' | 'pct') =>
    fmt === 'brl' ? brl(v) : fmt === 'pct' ? v.toFixed(2) : v.toFixed(0);

  return (
    <div style={{ maxWidth: 900 }}>

      {/* Seletores */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <SeletorPeriodo label="Período A" inicio={iniA} fim={fimA} onMudar={mudarA} />
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', color: C.textLight, fontSize: 18, fontWeight: 300 }}>vs</div>
        <SeletorPeriodo label="Período B" inicio={iniB} fim={fimB} onMudar={mudarB} />
      </div>

      {/* Botão comparar */}
      {!rodouUmaVez && (
        <button
          onClick={() => comparar()}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: RAIO_MD, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 24 }}
        >
          <FiBarChart2 size={16} /> Comparar períodos
        </button>
      )}

      {/* Carregando */}
      {carregando && (
        <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Calculando comparativo...</div>
      )}

      {/* Tabela */}
      {!carregando && dadosA && dadosB && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                <th style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', textAlign: 'left', width: '28%' }}>Indicador</th>
                <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, color: C.sidebarBg, textAlign: 'right' }}>
                  A · {labelPeriodo(iniA, fimA)}
                </th>
                <th style={{ padding: '10px 14px', fontSize: 11, fontWeight: 800, color: C.sidebarBg, textAlign: 'right' }}>
                  B · {labelPeriodo(iniB, fimB)}
                </th>
                <th style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', textAlign: 'right' }}>Variação A→B</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ label, key, fmt }) => {
                const vA = dadosA[key];
                const vB = dadosB[key];
                return (
                  <tr key={key} style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: 700, color: C.textMain }}>{label}</td>
                    <td style={{ padding: '13px 14px', fontSize: 13, color: C.textMuted, textAlign: 'right' }}>{formatarVal(vA, fmt)}</td>
                    <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: 700, color: C.sidebarBg, textAlign: 'right' }}>{formatarVal(vB, fmt)}</td>
                    <td style={{ padding: '13px 14px', textAlign: 'right' }}>
                      <Delta a={vA} b={vB} formato={fmt} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
