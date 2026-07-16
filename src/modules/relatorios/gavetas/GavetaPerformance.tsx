'use client'
/**
 * FIX [C-3] — src/modules/relatorios/gavetas/GavetaPerformance.tsx
 *
 * Antes: listava profissionais e serviços em ordem de cadastro, sem
 *        nenhum cruzamento com agendamentos ou financeiro.
 *
 * Agora:
 *  - Ranking de Profissionais: ordenado por receita gerada no período
 *    (agendamentos Finalizados × valor do serviço)
 *  - Ranking de Serviços: ordenado por número de execuções
 *  - Filtro de período: mês atual (padrão) ou mês personalizado
 *  - Barra de progresso relativa ao 1º colocado
 */

import { useState, useMemo } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_XS, RAIO_XL } from '@/lib/estiloGlobal';
import { FiAward, FiZap, FiTrendingUp } from 'react-icons/fi';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function GavetaPerformance({ dados }: any) {
  const agora    = new Date();
  const [mes, setMes] = useState(agora.getMonth());
  const [ano, setAno] = useState(agora.getFullYear());

  const agendamentos = dados?.agendamentos || [];
  const profissionais = dados?.profs       || [];
  const servicos      = dados?.servicos    || [];

  // ─── FILTRO DO PERÍODO ────────────────────────────────────────────────────
  const agsMes = useMemo(() =>
    agendamentos.filter((ag: any) => {
      if (ag.status !== 'Finalizado') return false;
      if (!ag.data) return false;
      const d = new Date(ag.data + 'T12:00:00');
      return d.getMonth() === mes && d.getFullYear() === ano;
    }),
  [agendamentos, mes, ano]);

  // ─── RANKING PROFISSIONAIS por receita ───────────────────────────────────
  const rankingProfs = useMemo(() => {
    const mapa: Record<string, { nome: string; receita: number; atendimentos: number }> = {};

    agsMes.forEach((ag: any) => {
      const prof = profissionais.find((p: any) => p.id === ag.profissional_id);
      if (!prof) return;

      const serv  = servicos.find((s: any) => s.id === ag.servico_id);
      const valor = Number(ag.valor_cobrado || ag.valor_total || serv?.preco_padrao || 0);

      if (!mapa[prof.id]) mapa[prof.id] = { nome: prof.nome, receita: 0, atendimentos: 0 };
      mapa[prof.id].receita       += valor;
      mapa[prof.id].atendimentos  += 1;
    });

    return Object.values(mapa).sort((a, b) => b.receita - a.receita);
  }, [agsMes, profissionais, servicos]);

  // ─── RANKING SERVIÇOS por execuções ──────────────────────────────────────
  const rankingServicos = useMemo(() => {
    const mapa: Record<string, { nome: string; execucoes: number; receita: number }> = {};

    agsMes.forEach((ag: any) => {
      const serv = servicos.find((s: any) => s.id === ag.servico_id);
      if (!serv) return;

      const valor = Number(ag.valor_cobrado || ag.valor_total || serv.preco_padrao || 0);
      if (!mapa[serv.id]) mapa[serv.id] = { nome: serv.nome_servico, execucoes: 0, receita: 0 };
      mapa[serv.id].execucoes += 1;
      mapa[serv.id].receita   += valor;
    });

    return Object.values(mapa).sort((a, b) => b.execucoes - a.execucoes);
  }, [agsMes, servicos]);

  // ─── ESTILOS ──────────────────────────────────────────────────────────────
  const card = {
    background: C.bgCard, padding: 24, borderRadius: RAIO_XL,
    border: `1px solid ${C.border}`,
  };

  const badgeStyle = (i: number) => ({
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    background: i === 0 ? '#FFFBEB' : i === 1 ? '#F1F5F9' : '#F8FAFC',
    border: i === 0 ? '1px solid #FDE68A' : `1px solid ${C.borderMid}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 11,
    color: i === 0 ? '#B45309' : C.textMuted,
  });

  const semDados = (msg: string) => (
    <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', margin: 0 }}>{msg}</p>
  );

  const maxReceitaProf   = rankingProfs[0]?.receita   || 1;
  const maxExecServ      = rankingServicos[0]?.execucoes || 1;

  return (
    <div className="font-body" style={{ maxWidth: 900 }}>

      {/* CABEÇALHO + FILTRO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h2 className="font-title uppercase tracking-widest"
            style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg }}>
            Rankings de Performance
          </h2>
          <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: 13, fontWeight: 500 }}>
            Baseado em {agsMes.length} atendimento{agsMes.length !== 1 ? 's' : ''} finalizados no período.
          </p>
        </div>

        {/* Seletor de mês */}
        <select
          value={`${ano}-${mes}`}
          onChange={e => {
            const [a, m] = e.target.value.split('-');
            setAno(Number(a)); setMes(Number(m));
          }}
          style={{
            padding: '8px 12px', borderRadius: RAIO_XL,
            border: `1px solid ${C.borderMid}`, fontSize: 12,
            fontWeight: 600, color: C.textMain, background: C.bgCard,
          }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={`${ano}-${i}`}>{MESES[i]} {ano}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* ─── RANKING PROFISSIONAIS ─── */}
        <div style={card}>
          <h3 className="font-title uppercase tracking-widest"
            style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 700, color: C.sidebarBg,
              borderBottom: `1px solid ${C.border}`, paddingBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiAward size={15} color={C.textLight} /> Top Profissionais
          </h3>

          {rankingProfs.length === 0
            ? semDados('Nenhum atendimento finalizado no período.')
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {rankingProfs.slice(0, 5).map((p, i) => (
                  <div key={p.nome}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <div style={badgeStyle(i)}>{i + 1}º</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{p.nome}</span>
                          <span className="font-title" style={{ fontSize: 12, fontWeight: 700, color: C.sidebarBg }}>
                            {brl(p.receita)}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: C.textMuted }}>
                          {p.atendimentos} atendimento{p.atendimentos !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: RAIO_XS, background: C.bg, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: RAIO_XS,
                        width: `${(p.receita / maxReceitaProf) * 100}%`,
                        background: i === 0 ? C.douradoEleva : C.activeMenuBg,
                        transition: 'width 0.8s ease-out',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* ─── RANKING SERVIÇOS ─── */}
        <div style={card}>
          <h3 className="font-title uppercase tracking-widest"
            style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 700, color: C.sidebarBg,
              borderBottom: `1px solid ${C.border}`, paddingBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiZap size={15} color={C.textLight} /> Top Procedimentos
          </h3>

          {rankingServicos.length === 0
            ? semDados('Nenhum serviço executado no período.')
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {rankingServicos.slice(0, 5).map((s, i) => (
                  <div key={s.nome}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <div style={badgeStyle(i)}>{i + 1}º</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{s.nome}</span>
                          <span className="font-title" style={{ fontSize: 12, fontWeight: 700, color: C.sidebarBg }}>
                            {s.execucoes}×
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: C.textMuted }}>
                          {brl(s.receita)} gerados
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: RAIO_XS, background: C.bg, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: RAIO_XS,
                        width: `${(s.execucoes / maxExecServ) * 100}%`,
                        background: i === 0 ? C.douradoEleva : C.btnPrimary,
                        transition: 'width 0.8s ease-out',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* ─── RESUMO GERAL ────────────────────────────────────────────────────── */}
      {agsMes.length > 0 && (
        <div style={{
          marginTop: 24, padding: '20px 24px',
          background: C.sidebarBg, borderRadius: RAIO_XL,
          display: 'flex', gap: 40, alignItems: 'center',
        }}>
          <FiTrendingUp size={24} color={C.douradoEleva} style={{ flexShrink: 0 }} />
          {[
            { label: 'Atendimentos', valor: agsMes.length.toString() },
            { label: 'Receita Total', valor: brl(rankingProfs.reduce((a, p) => a + p.receita, 0)) },
            { label: 'Ticket Médio', valor: brl(rankingProfs.reduce((a, p) => a + p.receita, 0) / (agsMes.length || 1)) },
            { label: 'Serviços Únicos', valor: rankingServicos.length.toString() },
          ].map(({ label, valor }) => (
            <div key={label}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>
                {label}
              </p>
              <p className="font-title" style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                {valor}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}