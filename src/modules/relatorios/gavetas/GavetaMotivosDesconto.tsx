'use client'

import { useState, useMemo } from 'react';
import { InputData } from '@/components/InputData';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_SM, RAIO_XS } from '@/lib/estiloGlobal';
import { FiDownload, FiTag, FiPercent, FiList } from 'react-icons/fi';

type AtalhoPeriodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'livre';
type Origem = 'todos' | 'agendamentos' | 'financeiro';

const MOTIVOS_NORMALIZADOS: Record<string, string> = {
  'aniversario': 'Aniversário',
  'aniversário': 'Aniversário',
  'fidelidade': 'Fidelidade',
  'cortesia': 'Cortesia',
  'convenio': 'Convênio',
  'convênio': 'Convênio',
  'sem desconto': 'Sem desconto',
  '': 'Não informado',
};

function normalizarMotivo(valor: string | null | undefined): string {
  if (!valor) return 'Não informado';
  const chave = valor.trim().toLowerCase();
  return MOTIVOS_NORMALIZADOS[chave] ?? valor.trim();
}

function calcularIntervalo(atalho: AtalhoPeriodo, de: string, ate: string): [Date, Date] {
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  if (atalho === 'hoje') return [inicio, hoje];
  if (atalho === 'semana') {
    const dom = new Date(inicio);
    dom.setDate(inicio.getDate() - inicio.getDay());
    return [dom, hoje];
  }
  if (atalho === 'mes') {
    const primeiro = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    return [primeiro, hoje];
  }
  if (atalho === 'ano') {
    const primeiro = new Date(inicio.getFullYear(), 0, 1);
    return [primeiro, hoje];
  }
  const dataInicio = de ? new Date(de + 'T00:00:00') : inicio;
  const dataFim = ate ? new Date(ate + 'T23:59:59') : hoje;
  return [dataInicio, dataFim];
}

function exportarCSV(linhas: { motivo: string; qtd: number; total: number; pct: number }[]) {
  const cabecalho = 'Motivo,Qtd de Ocorrências,Valor Total Descontado,% do Total\n';
  const conteudo = linhas.map(l =>
    `"${l.motivo}",${l.qtd},"${brl(l.total)}","${l.pct.toFixed(1)}%"`
  ).join('\n');
  const blob = new Blob(['﻿' + cabecalho + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `descontos_por_motivo_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function GavetaMotivosDesconto({ dados }: any) {
  const [atalho, setAtalho] = useState<AtalhoPeriodo>('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [origem, setOrigem] = useState<Origem>('todos');

  const [inicio, fim] = calcularIntervalo(atalho, de, ate);

  const registros = useMemo(() => {
    const lista: { motivo: string; valor: number }[] = [];

    if (origem !== 'financeiro') {
      (dados?.agendamentos ?? []).forEach((a: any) => {
        if (a.status !== 'Finalizado') return;
        const dt = new Date(a.data);
        if (dt < inicio || dt > fim) return;
        const val = Number(a.desconto) || 0;
        if (val <= 0) return;
        lista.push({ motivo: normalizarMotivo(a.tipo_desconto), valor: val });
      });
    }

    if (origem !== 'agendamentos') {
      (dados?.financeiro ?? []).forEach((f: any) => {
        if (f.status === 'Estornado') return;
        const dt = new Date(f.data_movimentacao);
        if (dt < inicio || dt > fim) return;
        const val = Number(f.desconto) || 0;
        if (val <= 0) return;
        lista.push({ motivo: normalizarMotivo(f.tipo_desconto), valor: val });
      });
    }

    return lista;
  }, [dados, inicio, fim, origem]);

  const agrupado = useMemo(() => {
    const mapa = new Map<string, { qtd: number; total: number }>();
    registros.forEach(({ motivo, valor }) => {
      const atual = mapa.get(motivo) ?? { qtd: 0, total: 0 };
      mapa.set(motivo, { qtd: atual.qtd + 1, total: atual.total + valor });
    });
    const totalGeral = registros.reduce((s, r) => s + r.valor, 0);
    return Array.from(mapa.entries())
      .map(([motivo, { qtd, total }]) => ({
        motivo, qtd, total,
        pct: totalGeral > 0 ? (total / totalGeral) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [registros]);

  const receitaPeriodo = useMemo(() => {
    return (dados?.agendamentos ?? []).reduce((s: number, a: any) => {
      if (a.status !== 'Finalizado') return s;
      const dt = new Date(a.data);
      if (dt < inicio || dt > fim) return s;
      return s + (Number(a.valor_final) || 0);
    }, 0);
  }, [dados, inicio, fim]);

  const totalDescontos = registros.reduce((s, r) => s + r.valor, 0);
  const qtdRegistros   = registros.length;
  const ticketMedio    = qtdRegistros > 0 ? totalDescontos / qtdRegistros : 0;
  const pctReceita     = receitaPeriodo > 0 ? (totalDescontos / receitaPeriodo) * 100 : 0;

  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const labelPeriodo = atalho === 'hoje' ? 'Hoje'
    : atalho === 'semana' ? 'Esta Semana'
    : atalho === 'mes'    ? 'Este Mês'
    : atalho === 'ano'    ? 'Este Ano'
    : `${fmt(inicio)} – ${fmt(fim)}`;

  const botaoAtalho = (chave: AtalhoPeriodo, label: string) => (
    <button
      key={chave}
      onClick={() => setAtalho(chave)}
      style={{
        padding: '7px 14px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700,
        cursor: 'pointer',
        border: `1px solid ${atalho === chave ? C.sidebarBg : C.borderMid}`,
        background: atalho === chave ? C.sidebarBg : C.bgCard,
        color: atalho === chave ? '#fff' : C.textMuted,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* FILTROS */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {botaoAtalho('hoje', 'Hoje')}
          {botaoAtalho('semana', 'Esta Semana')}
          {botaoAtalho('mes', 'Este Mês')}
          {botaoAtalho('ano', 'Este Ano')}
          {botaoAtalho('livre', 'Período Livre')}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {atalho === 'livre' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', marginBottom: 4 }}>De</label>
                <InputData value={de} onChange={v => setDe(v)}
                  style={{ border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '6px 10px', fontSize: 13, color: C.textMain, background: C.bg }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', marginBottom: 4 }}>Até</label>
                <InputData value={ate} onChange={v => setAte(v)}
                  style={{ border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '6px 10px', fontSize: 13, color: C.textMain, background: C.bg }} />
              </div>
            </>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', marginBottom: 4 }}>Origem</label>
            <select value={origem} onChange={e => setOrigem(e.target.value as Origem)}
              style={{ border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '6px 10px', fontSize: 13, color: C.textMain, background: C.bg }}>
              <option value="todos">Todos</option>
              <option value="agendamentos">Agendamentos</option>
              <option value="financeiro">Financeiro</option>
            </select>
          </div>
        </div>
      </div>

      {/* BANNER DE RESUMO DO PERÍODO */}
      <div style={{ background: C.sidebarBg, borderRadius: RAIO_XL, padding: '18px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>Descontos concedidos — {labelPeriodo}</p>
          <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 900, color: '#fff' }}>{brl(totalDescontos)}</p>
        </div>
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Registros</p>
            <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#fff' }}>{qtdRegistros}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>% da Receita</p>
            <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: pctReceita > 10 ? '#FCA5A5' : '#D4AF37' }}>{pctReceita.toFixed(1)}%</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Ticket Médio</p>
            <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#fff' }}>{brl(ticketMedio)}</p>
          </div>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Receita do Período', valor: brl(receitaPeriodo), icon: <FiList size={18} color={C.success} />, sub: 'atendimentos finalizados' },
          { label: 'Impacto dos Descontos', valor: `${pctReceita.toFixed(1)}% da receita`, icon: <FiPercent size={18} color={C.douradoEleva} />, sub: pctReceita > 10 ? 'acima do ideal — revisar política' : 'dentro do aceitável' },
        ].map(card => (
          <div key={card.label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>{card.label}</span>
              {card.icon}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.textMain }}>{card.valor}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* TABELA */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontWeight: 700, color: C.textMain, fontSize: 14 }}>Descontos por Motivo</span>
          <button
            onClick={() => exportarCSV(agrupado)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            <FiDownload size={13} /> Exportar CSV
          </button>
        </div>

        {agrupado.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.textMuted }}>
            <FiTag size={32} color={C.border} style={{ marginBottom: 12 }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Nenhum desconto encontrado</p>
            <p style={{ fontSize: 13 }}>Ajuste os filtros de período ou origem.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['Motivo', 'Qtd de Ocorrências', 'Valor Total Descontado', '% do Total de Descontos'].map(col => (
                  <th key={col} style={{ padding: '10px 16px', textAlign: col === 'Motivo' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agrupado.map((linha, i) => (
                <tr key={linha.motivo} style={{ borderBottom: i < agrupado.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? C.bgCard : C.bg }}>
                  <td style={{ padding: '12px 16px', color: C.textMain, fontWeight: 600 }}>
                    <span style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: RAIO_XS, padding: '2px 8px', fontSize: 12 }}>{linha.motivo}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: C.textMuted }}>{linha.qtd}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: C.danger, fontWeight: 700 }}>{brl(linha.total)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <span style={{ background: `${C.warning}22`, color: C.warningText ?? C.warning, borderRadius: RAIO_XS, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                      {linha.pct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
