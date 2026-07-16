'use client'
/**
 * src/modules/relatorios/gavetas/produtividade/GavetaProdutividade.tsx
 *
 * Radar de Produtividade — valor/hora por profissional.
 * Mostra quanto cada profissional gera por hora trabalhada,
 * evolução diária no período e comparação com a meta configurável.
 */

import { useState, useEffect } from 'react';
import { InputData } from '@/components/InputData';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_SM } from '@/lib/estiloGlobal';
import { FiClock, FiTrendingUp, FiUser, FiCalendar, FiEdit2, FiCheck, FiLoader, FiTarget, FiZap } from 'react-icons/fi';
import { useProdutividade } from './useProdutividade';
import { type PeriodoFiltro, corValorHora, labelValorHora, brl as brlLocal, fmtHoras, calcularPeriodo } from './tipos';
import { CardProfissional } from './components/CardProfissional';
import { GraficoBarrasDiarias } from './components/GraficoBarrasDiarias';

const card = { background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '20px 24px' } as const;
const inputStyle = { padding: '7px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: C.bgCard } as const;

export function GavetaProdutividade({ perfil }: any) {
  const {
    carregando, profissionais, dadosDia,
    metaValorHora, setMetaValorHora,
    metaBrutaMes,
    buscar,
  } = useProdutividade(perfil);

  // Período selecionado
  const [tipoPeriodo, setTipoPeriodo] = useState<PeriodoFiltro['tipo']>('mes_atual');
  const periodoInicial = calcularPeriodo('mes_atual');
  const [dataInicio, setDataInicio] = useState(periodoInicial.inicio);
  const [dataFim,    setDataFim]    = useState(periodoInicial.fim);

  // Edição da meta
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaTemp,     setMetaTemp]     = useState(String(metaValorHora));

  function aplicarPeriodo(tipo: PeriodoFiltro['tipo']) {
    setTipoPeriodo(tipo);
    if (tipo !== 'personalizado') {
      const p = calcularPeriodo(tipo);
      setDataInicio(p.inicio);
      setDataFim(p.fim);
    }
  }

  // Buscar sempre que o período mudar
  useEffect(() => {
    buscar({ tipo: tipoPeriodo, dataInicio, dataFim });
  }, [dataInicio, dataFim]);

  function confirmarMeta() {
    const v = parseFloat(metaTemp.replace(',', '.'));
    if (!isNaN(v) && v > 0) setMetaValorHora(v);
    setEditandoMeta(false);
  }

  // Resumo consolidado
  const totalFaturamento = profissionais.reduce((a, p) => a + p.faturamento, 0);
  const totalHoras       = profissionais.reduce((a, p) => a + p.horasTrabalhadas, 0);
  const mediaValorHora   = totalHoras > 0 ? totalFaturamento / totalHoras : 0;
  const acimaMeta        = profissionais.filter(p => p.valorHora >= metaValorHora).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── CABEÇALHO ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 42, height: 42, borderRadius: RAIO_MD,
              background: C.sidebarBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FiZap size={20} color={C.douradoEleva} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.textMain }}>
                RADAR DE PRODUTIVIDADE
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                Valor gerado por hora de cadeira ocupada — por profissional
              </div>
            </div>
          </div>
        </div>

        {/* Meta configurável */}
        <div style={{
          ...card, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderLeft: `3px solid ${C.douradoEleva}`,
        }}>
          <FiTarget size={15} color={C.douradoEleva} />
          <div>
            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Meta valor/hora
            </div>
            {editandoMeta ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>R$</span>
                <input
                  type="number" value={metaTemp}
                  onChange={e => setMetaTemp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmarMeta()}
                  style={{ ...inputStyle, width: 80, padding: '3px 8px', fontSize: 14 }}
                  autoFocus
                />
                <button onClick={confirmarMeta}
                  style={{ background: C.sidebarBg, border: 'none', borderRadius: RAIO_SM, padding: '4px 8px', cursor: 'pointer' }}>
                  <FiCheck size={13} color="#fff" />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: C.douradoEleva }}>
                  {brlLocal(metaValorHora)}/h
                </span>
                <button onClick={() => { setMetaTemp(String(metaValorHora)); setEditandoMeta(true); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <FiEdit2 size={13} color={C.textMuted} />
                </button>
              </div>
            )}
            {metaBrutaMes > 0 && (
              <div style={{ fontSize: 10, color: C.textLight, marginTop: 4 }}>
                Meta do mês (Dashboard): {brlLocal(metaBrutaMes)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTROS DE PERÍODO ──────────────────────────────────────────── */}
      <div style={{
        ...card, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <FiCalendar size={14} color={C.textMuted} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Período:
        </span>
        {([
          ['mes_atual',    'Este Mês'],
          ['semana',       'Esta Semana'],
          ['personalizado','Personalizado'],
        ] as const).map(([tipo, label]) => (
          <button key={tipo} onClick={() => aplicarPeriodo(tipo)}
            style={{
              padding: '6px 14px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${tipoPeriodo === tipo ? C.sidebarBg : C.borderMid}`,
              background: tipoPeriodo === tipo ? C.sidebarBg : C.bgCard,
              color: tipoPeriodo === tipo ? '#fff' : C.textMuted,
            }}>
            {label}
          </button>
        ))}
        {tipoPeriodo === 'personalizado' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <InputData value={dataInicio}
              onChange={v => setDataInicio(v)}
              style={{ ...inputStyle, padding: '5px 10px' }} />
            <span style={{ fontSize: 11, color: C.textMuted }}>até</span>
            <InputData value={dataFim} min={dataInicio}
              onChange={v => setDataFim(v)}
              style={{ ...inputStyle, padding: '5px 10px' }} />
          </div>
        )}
      </div>

      {/* ── CARREGANDO ─────────────────────────────────────────────────── */}
      {carregando && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10, color: C.textMuted }}>
          <FiLoader size={18} className="animate-spin" />
          <span style={{ fontSize: 13 }}>Calculando produtividade...</span>
        </div>
      )}

      {!carregando && profissionais.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '40px 0', color: C.textMuted, fontSize: 13 }}>
          Nenhum atendimento finalizado com duração preenchida no período.
        </div>
      )}

      {!carregando && profissionais.length > 0 && (<>

        {/* ── RESUMO GERAL ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            {
              icon: <FiTrendingUp size={16} color={C.douradoEleva} />,
              label: 'Valor/hora médio do salão',
              valor: `${brlLocal(mediaValorHora)}/h`,
              cor: corValorHora(mediaValorHora),
            },
            {
              icon: <FiClock size={16} color={C.sidebarBg} />,
              label: 'Total horas em cadeira',
              valor: fmtHoras(Math.round(totalHoras * 60)),
              cor: C.textMain,
            },
            {
              icon: <FiUser size={16} color={C.sidebarBg} />,
              label: 'Acima da meta',
              valor: `${acimaMeta} de ${profissionais.length} prof.`,
              cor: acimaMeta === profissionais.length ? '#10B981' : C.textMain,
            },
            {
              icon: <FiZap size={16} color={C.sidebarBg} />,
              label: 'Faturamento total',
              valor: brlLocal(totalFaturamento),
              cor: C.textMain,
            },
          ].map(m => (
            <div key={m.label} style={{ ...card, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {m.icon}
                <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {m.label}
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: m.cor }}>{m.valor}</div>
            </div>
          ))}
        </div>

        {/* ── CARDS POR PROFISSIONAL ───────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {profissionais.map((p, i) => (
            <CardProfissional key={p.id} prof={p} meta={metaValorHora} rank={i + 1} />
          ))}
        </div>

        {/* ── GRÁFICO DIÁRIO ───────────────────────────────────────────── */}
        <div style={card}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          }}>
            <FiTrendingUp size={15} color={C.sidebarBg} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>
              Evolução diária do valor/hora
            </span>
            <span style={{ fontSize: 11, color: C.textMuted }}>
              — linha dourada = meta configurada
            </span>
          </div>
          <GraficoBarrasDiarias
            dadosDia={dadosDia}
            profissionais={profissionais}
            meta={metaValorHora}
          />
        </div>

        {/* ── TABELA DETALHADA ─────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMain, marginBottom: 14 }}>
            Detalhamento por profissional
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  {['#', 'Profissional', 'Atendimentos', 'Horas em cadeira', 'Faturamento', 'Ticket médio', 'Valor/hora', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profissionais.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 12px', color: C.textMuted, fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: C.textMain }}>{p.nome}</td>
                    <td style={{ padding: '10px 12px', color: C.textMuted }}>{p.atendimentos}</td>
                    <td style={{ padding: '10px 12px', color: C.textMuted }}>{fmtHoras(p.minutosTrabalhados)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: C.textMain }}>{brlLocal(p.faturamento)}</td>
                    <td style={{ padding: '10px 12px', color: C.textMuted }}>{brlLocal(p.ticketMedio)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontWeight: 800, fontSize: 14,
                        color: corValorHora(p.valorHora),
                      }}>
                        {brlLocal(p.valorHora)}/h
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                        background: corValorHora(p.valorHora) + '20',
                        color: corValorHora(p.valorHora),
                      }}>
                        {labelValorHora(p.valorHora)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </>)}
    </div>
  );
}
