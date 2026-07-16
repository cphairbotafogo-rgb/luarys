'use client'
/**
 * src/modules/relatorios/gavetas/GavetaAtendimentos.tsx
 *
 * Relatório de atendimentos com período livre (dia/semana/mês/ano ou range
 * customizado), filtro por profissional/serviço/status, resumo agregado e
 * lista hierárquica expansível (Dia > Profissional > Atendimentos), no
 * estilo "drill-down" de relatórios financeiros tradicionais.
 *
 * Lógica de filtros/cálculo/PDF em useRelatorioAtendimentos.ts — este
 * arquivo é só a camada visual.
 */

import { useState } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_XL, RAIO_MD } from '@/lib/estiloGlobal';
import { FiChevronDown, FiChevronRight, FiDownload, FiCalendar, FiUsers, FiSearch } from 'react-icons/fi';
import { InputData } from '@/components/InputData';
import {
  useRelatorioAtendimentos, formatarDataLabel, DIAS_SEMANA,
  type AtalhoPeriodo,
} from '@/modules/relatorios/hooks/useRelatorioAtendimentos';

const corStatus = (status: string) =>
  status === 'Finalizado' ? { bg: '#D1FAE5', texto: '#047857' }
  : status === 'Cancelado' ? { bg: '#FEE2E2', texto: '#B91C1C' }
  : status === 'Faltou' ? { bg: '#FEE2E2', texto: '#B91C1C' }
  : { bg: '#F1F5F9', texto: C.textMuted };

export function GavetaAtendimentos({ dados, perfil }: any) {
  const r = useRelatorioAtendimentos(dados, perfil);
  const [diasExpandidos, setDiasExpandidos] = useState<Set<string>>(new Set());
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set());

  function alternarDia(data: string) {
    setDiasExpandidos(prev => {
      const novo = new Set(prev);
      novo.has(data) ? novo.delete(data) : novo.add(data);
      return novo;
    });
  }

  function alternarGrupo(chave: string) {
    setGruposExpandidos(prev => {
      const novo = new Set(prev);
      novo.has(chave) ? novo.delete(chave) : novo.add(chave);
      return novo;
    });
  }

  const botaoAtalho = (chave: AtalhoPeriodo, label: string) => (
    <button
      onClick={() => r.aplicarAtalho(chave)}
      style={{
        padding: '7px 14px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        border: `1px solid ${r.atalho === chave ? C.sidebarBg : C.borderMid}`,
        background: r.atalho === chave ? C.sidebarBg : C.bgCard,
        color: r.atalho === chave ? '#fff' : C.textMuted,
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="font-body">
      {/* ── BARRA DE FILTROS ── */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {botaoAtalho('hoje', 'Hoje')}
          {botaoAtalho('semana', 'Esta Semana')}
          {botaoAtalho('mes', 'Este Mês')}
          {botaoAtalho('ano', 'Este Ano')}
          {botaoAtalho('livre', 'Período Livre')}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', marginBottom: 6 }}>Período</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.bg, borderRadius: RAIO_MD, padding: '6px 10px', border: `1px solid ${C.borderMid}` }}>
              <FiCalendar size={14} color={C.textMuted} />
              <InputData
                value={r.dataInicio}
                disabled={r.atalho !== 'livre'}
                onChange={v => r.editarDataInicio(v)}
                style={{ border: 'none', outline: 'none', fontSize: 12, fontWeight: 600, color: C.textMain, background: 'transparent' }}
              />
              <span style={{ fontSize: 12, color: C.textLight }}>à</span>
              <InputData
                value={r.dataFim}
                disabled={r.atalho !== 'livre'}
                onChange={v => r.editarDataFim(v)}
                style={{ border: 'none', outline: 'none', fontSize: 12, fontWeight: 600, color: C.textMain, background: 'transparent' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', marginBottom: 6 }}>Status</label>
            <select
              value={r.filtroStatus}
              onChange={e => r.setFiltroStatus(e.target.value as any)}
              style={{ padding: '9px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontWeight: 600, color: C.textMain, cursor: 'pointer' }}
            >
              <option value="finalizados">Só Finalizados</option>
              <option value="todos">Incluir Cancelados e Faltas</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', marginBottom: 6 }}>Profissional</label>
            <select
              value={r.filtroProfissionalId}
              onChange={e => r.setFiltroProfissionalId(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontWeight: 600, color: C.textMain, cursor: 'pointer', maxWidth: 180 }}
            >
              <option value="todos">Todos</option>
              {(dados?.profs || []).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', marginBottom: 6 }}>Serviço</label>
            <select
              value={r.filtroServicoId}
              onChange={e => r.setFiltroServicoId(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontWeight: 600, color: C.textMain, cursor: 'pointer', maxWidth: 180 }}
            >
              <option value="todos">Todos</option>
              {(dados?.servicos || []).map((s: any) => <option key={s.id} value={s.id}>{s.nome_servico}</option>)}
            </select>
          </div>

          <div style={{ position: "relative" }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', marginBottom: 6 }}>Cliente</label>
            <div style={{ position: "relative" }}>
              <FiSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
              <input
                placeholder="Buscar por nome..."
                value={r.filtroCliente}
                onChange={e => r.setFiltroCliente(e.target.value)}
                style={{ paddingLeft: 30, paddingRight: 10, paddingTop: 9, paddingBottom: 9, borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontWeight: 600, color: C.textMain, outline: "none", width: 170 }}
              />
            </div>
          </div>

          <button
            onClick={r.exportarPDF}
            disabled={r.visitasFiltradas.length === 0}
            style={{
              marginLeft: 'auto', padding: '10px 18px', borderRadius: RAIO_MD, border: 'none',
              background: r.visitasFiltradas.length === 0 ? '#CBD5E1' : C.sidebarBg, color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: r.visitasFiltradas.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <FiDownload size={14} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* ── RESUMO ── */}
      <div style={{ display: 'grid', gridTemplateColumns: r.resumo.mostrarTaxa ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 18 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>Total de Atendimentos</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.textMain }}>{r.resumo.total}</p>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 18 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>Valor dos Serviços</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#047857' }}>{brl(r.resumo.faturamento)}</p>
          <p style={{ margin: '4px 0 0', fontSize: 10, color: C.textLight }}>Valor real das contas fechadas (fonte: Financeiro). A Visão Geral inclui também lançamentos avulsos.</p>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 18 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>Ticket Médio</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.textMain }}>{brl(r.resumo.ticketMedio)}</p>
        </div>
        {r.resumo.mostrarTaxa && (
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 18 }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>Taxa de Falta/Cancelamento</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: r.resumo.taxaFalhaPct > 15 ? '#B91C1C' : C.textMain }}>{r.resumo.taxaFalhaPct.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* ── HIERARQUIA: DIA > PROFISSIONAL > ATENDIMENTOS ── */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
        {r.hierarquia.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 50, color: C.textMuted, fontSize: 13 }}>
            Nenhum atendimento encontrado para os filtros selecionados.
          </div>
        ) : (
          r.hierarquia.map(dia => {
            const diaAberto = diasExpandidos.has(dia.data);
            const dataObj = new Date(dia.data + 'T00:00:00');
            const labelDiaSemana = DIAS_SEMANA[dataObj.getDay()];

            return (
              <div key={dia.data} style={{ borderBottom: `1px solid ${C.border}` }}>
                <button
                  onClick={() => alternarDia(dia.data)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', background: C.bg, border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {diaAberto ? <FiChevronDown size={16} color={C.sidebarBg} /> : <FiChevronRight size={16} color={C.sidebarBg} />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>{formatarDataLabel(dia.data)}</span>
                    <span style={{ fontSize: 12, color: C.textLight }}>{labelDiaSemana}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
                    <span style={{ color: C.textMuted }}>{dia.totalAtendimentosDia} atendimento{dia.totalAtendimentosDia !== 1 ? 's' : ''}</span>
                    <span style={{ fontWeight: 700, color: '#047857', minWidth: 90, textAlign: 'right' }}>{brl(dia.faturamentoDia)}</span>
                  </div>
                </button>

                {diaAberto && dia.profissionaisDoDia.map(grupo => {
                  const chaveGrupo = `${dia.data}-${grupo.profissionalId}`;
                  const grupoAberto = gruposExpandidos.has(chaveGrupo);

                  return (
                    <div key={chaveGrupo}>
                      <button
                        onClick={() => alternarGrupo(chaveGrupo)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '11px 18px 11px 38px', background: C.bgCard, border: 'none', borderTop: `1px solid ${C.border}`,
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {grupoAberto ? <FiChevronDown size={14} color={C.textMuted} /> : <FiChevronRight size={14} color={C.textMuted} />}
                          <FiUsers size={13} color={C.textLight} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.textMain }}>{grupo.nomeProf}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
                          <span style={{ color: C.textLight }}>{grupo.totalAtendimentos} atendimento{grupo.totalAtendimentos !== 1 ? 's' : ''}</span>
                          <span style={{ fontWeight: 600, color: C.textMuted, minWidth: 90, textAlign: 'right' }}>{brl(grupo.faturamento)}</span>
                        </div>
                      </button>

                      {grupoAberto && (
                        <div style={{ padding: '0 18px 8px 58px' }}>
                          {grupo.itens.map((visita: any) => {
                            const cor = corStatus(visita.status);
                            const nomesServicos = visita.servicoIds.length > 0
                              ? visita.servicoIds.map((id: string) => r.mapaServicos.get(id) || 'Serviço não identificado').join(' + ')
                              : 'Serviço não identificado';
                            return (
                              <div
                                key={visita.chave}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0',
                                  borderBottom: `1px solid #F1F5F9`, fontSize: 12,
                                }}
                              >
                                <span style={{ color: C.textLight, minWidth: 48 }}>{visita.inicio || '-'}</span>
                                <span style={{ color: C.textMain, flex: 1, fontWeight: 500 }}>{visita.cliente_nome || 'Cliente não identificado'}</span>
                                <span style={{ color: C.textMuted, flex: 1.5 }}>{nomesServicos}</span>
                                <span style={{ background: cor.bg, color: cor.texto, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: RAIO_XL, minWidth: 80, textAlign: 'center' }}>
                                  {visita.status}
                                </span>
                                <span style={{ fontWeight: 700, color: C.textMain, minWidth: 80, textAlign: 'right' }}>{brl(visita.valorTotal)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}

        {r.hierarquia.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: C.sidebarBg }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Total do Período ({r.resumo.total} atendimentos)</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.douradoLuarys }}>{brl(r.resumo.faturamento)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
