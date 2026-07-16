'use client'

import { useState, useMemo } from 'react';
import { InputData } from '@/components/InputData';
import { C, brl } from '@/lib/constants';
import { mapAgParaFin, valorServicoEmVisita } from '@/lib/visitasUtils';
import { RAIO_MD, RAIO_XL, RAIO_SM, RAIO_XS } from '@/lib/estiloGlobal';
import {
  FiDollarSign, FiTrendingDown, FiActivity, FiCalendar,
  FiCheckCircle, FiTarget,
} from 'react-icons/fi';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function isoParaData(str: string): Date {
  // evita bug de timezone: '2026-06-01' → interpreta como local
  if (!str) return new Date(NaN);
  const [y, m, d] = String(str).substring(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dentroDoFiltro(dataStr: string, filtro: string, inicio: string, fim: string): boolean {
  if (!dataStr) return false;
  const d = isoParaData(dataStr);
  if (isNaN(d.getTime())) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (filtro === '7d') {
    const limite = new Date(hoje); limite.setDate(hoje.getDate() - 6);
    return d >= limite && d <= hoje;
  }
  if (filtro === 'mes') {
    return d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth();
  }
  if (filtro === '3m') {
    const limite = new Date(hoje); limite.setMonth(hoje.getMonth() - 2); limite.setDate(1);
    return d >= limite && d <= hoje;
  }
  if (filtro === 'ano') {
    return d.getFullYear() === hoje.getFullYear();
  }
  if (filtro === 'livre' && inicio && fim) {
    const di = isoParaData(inicio), df = isoParaData(fim);
    return d >= di && d <= df;
  }
  return true;
}

function ultimos6Meses(): string[] {
  const resultado: string[] = [];
  const hoje = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    resultado.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return resultado;
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

export function GavetaDashboard({ dados }: any) {
  const [filtro, setFiltro] = useState<'7d' | 'mes' | '3m' | 'ano' | 'livre'>('mes');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const financeiro: any[] = dados?.financeiro || [];
  const agendamentos: any[] = dados?.agendamentos || [];
  const despesas: any[] = dados?.despesas || [];
  const servicos: any[] = dados?.servicos || [];

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const finFiltrado = financeiro.filter(
      (f) => f.status !== 'Estornado' && dentroDoFiltro(f.data_movimentacao, filtro, dataInicio, dataFim)
    );
    const despFiltradas = despesas
      .filter((d) => dentroDoFiltro(d.data_pagamento || d.data_vencimento, filtro, dataInicio, dataFim))
      .map((d) => ({ tipo: 'saida', valor: d.valor }));

    const receita = finFiltrado
      .filter((f) => f.tipo === 'entrada')
      .reduce((s: number, f: any) => s + Number(f.valor || 0), 0);

    const despesaFin = finFiltrado
      .filter((f) => f.tipo === 'saida')
      .reduce((s: number, f: any) => s + Number(f.valor || 0), 0);

    const despesaAvulsa = despFiltradas
      .reduce((s: number, f: any) => s + Number(f.valor || 0), 0);

    const despesa = despesaFin + despesaAvulsa;
    const resultado = receita - despesa;

    // Conta atendimentos como registros financeiros de entrada fechados no período
    // (um financeiro = uma visita real, independente de quantos serviços teve)
    const atendimentos = finFiltrado.filter((f) => f.tipo === 'entrada').length;
    const ticketMedio = atendimentos > 0 ? receita / atendimentos : 0;
    const total = agendamentos.filter(
      (a: any) => dentroDoFiltro(a.data, filtro, dataInicio, dataFim)
    ).length;

    return { receita, despesa, resultado, atendimentos, ticketMedio, total };
  }, [filtro, dataInicio, dataFim, financeiro, despesas, agendamentos]);

  // ─── GRÁFICO 1: Receita vs Despesa últimos 6 meses ───────────────────────
  const meses6 = ultimos6Meses();
  const grafMeses = useMemo(() => {
    return meses6.map((anoMes) => {
      const finMes = financeiro.filter(
        (f) => f.status !== 'Estornado' && String(f.data_movimentacao || '').substring(0, 7) === anoMes
      );
      const despMes = despesas.filter(
        (d) => String(d.data_pagamento || d.data_vencimento || '').substring(0, 7) === anoMes
      );
      const rec = finMes.filter((f) => f.tipo === 'entrada').reduce((s: number, f: any) => s + Number(f.valor || 0), 0);
      const des = finMes.filter((f) => f.tipo === 'saida').reduce((s: number, f: any) => s + Number(f.valor || 0), 0)
        + despMes.reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
      const [, mm] = anoMes.split('-');
      return { label: MESES_ABREV[Number(mm) - 1], receita: rec, despesa: des };
    });
  }, [financeiro, despesas]);

  const maxGraf1 = Math.max(...grafMeses.map((m) => Math.max(m.receita, m.despesa)), 1);

  // ─── GRÁFICO 2: Top 5 categorias de serviço ──────────────────────────────
  const grafCategorias = useMemo(() => {
    const mAgFin = mapAgParaFin(financeiro);
    const mapa: Record<string, number> = {};
    agendamentos
      .filter((a) => a.status === 'Finalizado')
      .forEach((a) => {
        const srv = servicos.find((s: any) => s.id === a.servico_id);
        const cat = srv?.categoria || srv?.nome || 'Sem categoria';
        const fin = mAgFin.get(a.id) || null;
        mapa[cat] = (mapa[cat] || 0) + valorServicoEmVisita(a, fin);
      });
    return Object.entries(mapa)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 5);
  }, [agendamentos, servicos, financeiro]);

  const maxGraf2 = Math.max(...grafCategorias.map((c) => c[1]), 1);

  // ─── GRÁFICO 3: Atendimentos por dia da semana ───────────────────────────
  const grafDias = useMemo(() => {
    const contagem = Array(7).fill(0);
    agendamentos
      .filter((a) => a.status === 'Finalizado')
      .forEach((a) => {
        const d = isoParaData(a.data);
        if (!isNaN(d.getTime())) contagem[d.getDay()]++;
      });
    return DIAS_SEMANA.map((label, i) => ({ label, qtd: contagem[i] }));
  }, [agendamentos]);

  const maxGraf3 = Math.max(...grafDias.map((d) => d.qtd), 1);

  // ─── ESTILOS LOCAIS ───────────────────────────────────────────────────────
  const sCard: React.CSSProperties = {
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: RAIO_XL,
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const sSecao: React.CSSProperties = {
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: RAIO_XL,
    padding: 24,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '4px 0' }}>

      {/* ── FILTRO DE PERÍODO ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as any)}
          style={{
            padding: '8px 12px', borderRadius: RAIO_MD,
            border: `1px solid ${C.borderMid}`, fontSize: 13,
            color: C.textMain, background: C.bgCard, cursor: 'pointer',
          }}
        >
          <option value="7d">Últimos 7 dias</option>
          <option value="mes">Este Mês</option>
          <option value="3m">Últimos 3 Meses</option>
          <option value="ano">Este Ano</option>
          <option value="livre">Período Livre</option>
        </select>
        {filtro === 'livre' && (
          <>
            <InputData value={dataInicio} onChange={(v) => setDataInicio(v)}
              style={{ padding: '8px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain }} />
            <span style={{ color: C.textMuted, fontSize: 13 }}>até</span>
            <InputData value={dataFim} onChange={(v) => setDataFim(v)}
              style={{ padding: '8px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain }} />
          </>
        )}
      </div>

      {/* ── KPI GRID ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

        {/* Receita */}
        <div style={sCard}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Receita Total</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: C.success }}>{brl(kpis.receita)}</p>
          </div>
          <FiDollarSign size={28} color={C.success} style={{ opacity: 0.7 }} />
        </div>

        {/* Despesa */}
        <div style={sCard}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Despesa Total</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: C.danger }}>{brl(kpis.despesa)}</p>
          </div>
          <FiTrendingDown size={28} color={C.danger} style={{ opacity: 0.7 }} />
        </div>

        {/* Resultado */}
        <div style={sCard}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Resultado</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: kpis.resultado >= 0 ? C.success : C.danger }}>{brl(kpis.resultado)}</p>
          </div>
          <FiActivity size={28} color={kpis.resultado >= 0 ? C.success : C.danger} style={{ opacity: 0.7 }} />
        </div>

        {/* Agendamentos */}
        <div style={sCard}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Agendamentos</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: C.textMain }}>{kpis.total}</p>
          </div>
          <FiCalendar size={28} color={C.sidebarBg} style={{ opacity: 0.5 }} />
        </div>

        {/* Atendimentos */}
        <div style={sCard}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Atendimentos</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: C.textMain }}>{kpis.atendimentos}</p>
          </div>
          <FiCheckCircle size={28} color={C.sidebarBg} style={{ opacity: 0.5 }} />
        </div>

        {/* Ticket Médio */}
        <div style={sCard}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Ticket Médio</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: C.douradoEleva }}>{brl(kpis.ticketMedio)}</p>
          </div>
          <FiTarget size={28} color={C.douradoEleva} style={{ opacity: 0.7 }} />
        </div>
      </div>

      {/* ── GRÁFICO 1: Receita vs Despesa por Mês ────────────────────────── */}
      <div style={sSecao}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.textMain, marginBottom: 20 }}>Receita vs Despesa — Últimos 6 Meses</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 120 }}>
          {grafMeses.map((m) => (
            <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
                <div
                  title={`Receita: ${brl(m.receita)}`}
                  style={{
                    flex: 1, background: C.success, opacity: 0.85,
                    height: `${Math.round((m.receita / maxGraf1) * 100)}%`,
                    borderRadius: `${RAIO_XS}px ${RAIO_XS}px 0 0`, minHeight: 2,
                  }}
                />
                <div
                  title={`Despesa: ${brl(m.despesa)}`}
                  style={{
                    flex: 1, background: C.danger, opacity: 0.7,
                    height: `${Math.round((m.despesa / maxGraf1) * 100)}%`,
                    borderRadius: `${RAIO_XS}px ${RAIO_XS}px 0 0`, minHeight: 2,
                  }}
                />
              </div>
              <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{m.label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <span style={{ fontSize: 11, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: RAIO_XS, background: C.success, display: 'inline-block' }} /> Receita
          </span>
          <span style={{ fontSize: 11, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: RAIO_XS, background: C.danger, display: 'inline-block', opacity: 0.7 }} /> Despesa
          </span>
        </div>
      </div>

      {/* ── GRÁFICO 2: Top 5 Categorias ──────────────────────────────────── */}
      <div style={sSecao}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.textMain, marginBottom: 20 }}>Top 5 Categorias por Faturamento</p>
        {grafCategorias.length === 0 && (
          <p style={{ fontSize: 13, color: C.textMuted }}>Nenhum atendimento finalizado no período.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grafCategorias.map(([cat, val]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: C.textMain, fontWeight: 600, width: 130, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {cat}
              </span>
              <div style={{ flex: 1, background: C.bg, borderRadius: RAIO_SM, height: 10, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.round((val / maxGraf2) * 100)}%`,
                  height: '100%', background: C.sidebarBg, borderRadius: RAIO_SM,
                }} />
              </div>
              <span style={{ fontSize: 12, color: C.textMuted, width: 90, textAlign: 'right', flexShrink: 0 }}>{brl(val)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── GRÁFICO 3: Atendimentos por Dia da Semana ────────────────────── */}
      <div style={sSecao}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.textMain, marginBottom: 20 }}>Atendimentos por Dia da Semana</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120 }}>
          {grafDias.map((d) => (
            <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textMain }}>{d.qtd > 0 ? d.qtd : ''}</span>
              <div style={{
                width: '100%', height: 80, display: 'flex', alignItems: 'flex-end',
              }}>
                <div style={{
                  width: '100%',
                  height: `${Math.round((d.qtd / maxGraf3) * 100)}%`,
                  background: C.douradoEleva, opacity: 0.85,
                  borderRadius: `${RAIO_XS}px ${RAIO_XS}px 0 0`, minHeight: d.qtd > 0 ? 4 : 0,
                }} title={`${d.qtd} atendimentos`} />
              </div>
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
