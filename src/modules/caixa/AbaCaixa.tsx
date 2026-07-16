// src/modules/caixa/AbaCaixa.tsx
// Shell principal da Frente de Caixa (PDV).
// Estado e handlers: useAbaCaixa | Modais: ModalLancamentoCaixa, ModalEdicaoCaixa.
'use client'
import React from "react";
import { C, brl } from "@/lib/constants";
import { RAIO_XS, RAIO_SM, RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { FiDollarSign, FiEdit2, FiCheckCircle, FiPrinter, FiPlus, FiClock,
         FiChevronDown, FiChevronUp, FiCalendar, FiUser, FiLock, FiSearch, FiArrowDownRight } from "react-icons/fi";
import { Card } from "@/components/ui";
import { useAbaCaixa } from "./useAbaCaixa";
import type { Transacao } from "./tipos";
import { ModalLancamentoCaixa } from "./ModalLancamentoCaixa";
import { ModalEdicaoCaixa } from "./ModalEdicaoCaixa";
import { ModalNovaDespesa } from "@/modules/financeiro/modals/ModalNovaDespesa";

const COR_STATUS: Record<string, { bg: string; cor: string }> = {
  'Agendado':       { bg: '#EFF6FF', cor: '#1D4ED8' },
  'Confirmado':     { bg: '#F0FDF4', cor: '#166534' },
  'Aguardando':     { bg: '#FEF3C7', cor: '#92400E' },
  'Em Atendimento': { bg: '#FDF4FF', cor: '#7E22CE' },
  'Finalizado':     { bg: '#1E293B', cor: '#fff' },
};
const PRIO_STATUS: Record<string, number> = {
  'Em Atendimento': 5, 'Aguardando': 4, 'Confirmado': 3, 'Agendado': 2, 'Finalizado': 1,
};

export function AbaCaixa({ perfil, setAba }: any) {
  const cx = useAbaCaixa(perfil);
  const [modalDespesaAberto, setModalDespesaAberto] = React.useState(false);
  const [mostrarTransacoes, setMostrarTransacoes] = React.useState(true);

  if (cx.carregando) return (
    <div style={{ padding: 40, color: C.textLight, fontWeight: 700, textAlign: "center" }}>
      A processar movimentos do caixa...
    </div>
  );

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: C.bg }}>

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: RAIO_XL, background: C.sidebarBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FiDollarSign size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>Frente de Caixa (PDV)</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Movimento do dia, fechamento e controle de Ordens de Serviço.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setModalDespesaAberto(true)}
            style={{ background: C.danger, color: "#fff", border: "none", padding: "12px 20px", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.5px", transition: "0.2s" }}>
            <FiArrowDownRight size={18} /> Lançar Despesa
          </button>
          <button onClick={() => cx.setModalLancamento(true)}
            style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "12px 24px", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.5px", transition: "0.2s" }}>
            <FiPlus size={18} /> Novo Recebimento
          </button>
        </div>
      </div>

      {/* ── Barra de filtros ────────────────────────────────────────────────── */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

        {/* Período */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <FiCalendar size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />Período:
          </span>
          {([['hoje','Hoje'],['semana','Semana'],['mes','Mês'],['livre','Livre']] as const).map(([tipo, label]) => (
            <button key={tipo} onClick={() => cx.calcularPeriodo(tipo)}
              style={{ padding: "5px 12px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "0.15s",
                border: `1px solid ${cx.filtroPeriodo === tipo ? C.sidebarBg : C.borderMid}`,
                background: cx.filtroPeriodo === tipo ? C.sidebarBg : C.bgCard,
                color: cx.filtroPeriodo === tipo ? "#fff" : C.textMuted }}>
              {label}
            </button>
          ))}
          {cx.filtroPeriodo === 'livre' && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Não-controlado durante a digitação (defaultValue + key): digitar não
                  re-renderiza nem busca, então o cursor NÃO pula. Confirma só ao sair
                  do campo (blur) ou apertar Enter. O `key` reflete mudança por atalho. */}
              <input key={`ini-${cx.dataIni}`} type="date" defaultValue={cx.dataIni}
                onBlur={e => { const v = e.currentTarget.value; if (v) cx.setDataIni(v); }}
                onKeyDown={e => { if (e.key === 'Enter') { const v = e.currentTarget.value; if (v) cx.setDataIni(v); } }}
                style={{ padding: "4px 8px", borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.textMain }} />
              <span style={{ fontSize: 11, color: C.textMuted }}>até</span>
              <input key={`fim-${cx.dataFim}`} type="date" defaultValue={cx.dataFim} min={cx.dataIni}
                onBlur={e => { const v = e.currentTarget.value; if (v) cx.setDataFim(v); }}
                onKeyDown={e => { if (e.key === 'Enter') { const v = e.currentTarget.value; if (v) cx.setDataFim(v); } }}
                style={{ padding: "4px 8px", borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.textMain }} />
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 24, background: C.border, margin: "0 4px" }} />

        {/* Profissional */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <FiUser size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />Profissional:
          </span>
          <select value={cx.filtroProfissional} onChange={e => cx.setFiltroProfissional(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.textMain, background: C.bgCard, cursor: "pointer" }}>
            <option value="todos">Todos</option>
            {cx.profissionaisLista.map((p: any) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>

        <div style={{ width: 1, height: 24, background: C.border, margin: "0 4px" }} />

        {/* Busca por OS ou cliente */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
          <FiSearch size={13} color={C.textLight} style={{ position: "absolute", left: 10, pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Nº OS ou cliente..."
            value={cx.filtroOS}
            onChange={e => cx.setFiltroOS(e.target.value)}
            style={{ paddingLeft: 30, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: RAIO_MD, border: `1px solid ${cx.filtroOS ? C.sidebarBg : C.borderMid}`, fontSize: 12, color: C.textMain, background: C.bgCard, width: 180, outline: "none" }}
          />
        </div>

        {(cx.filtroPeriodo !== 'hoje' || cx.filtroProfissional !== 'todos' || cx.filtroOS) && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>
              {cx.transacoesFiltradas.length} lançamento{cx.transacoesFiltradas.length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>{brl(cx.totalGeral)}</span>
          </div>
        )}
      </div>

      {/* ── Recebimentos (colapsível) ─────────────────────────────────────────── */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: "hidden" }}>
        <button
          onClick={() => setMostrarTransacoes(v => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: C.bg, border: "none", cursor: "pointer", borderBottom: mostrarTransacoes ? `1px solid ${C.borderMid}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FiDollarSign size={14} color={C.success} />
            <span style={{ fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.5px" }}>Recebimentos do Período</span>
            {cx.transacoesFiltradas.length > 0 && (
              <span style={{ background: "#F0FDF4", color: "#166534", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: RAIO_LG }}>
                {cx.transacoesFiltradas.length} lançamento{cx.transacoesFiltradas.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>{brl(cx.totalGeral)}</span>
            {mostrarTransacoes ? <FiChevronUp size={14} color={C.textLight} /> : <FiChevronDown size={14} color={C.textLight} />}
          </div>
        </button>

        {mostrarTransacoes && <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr" }}>

        {/* Tabela */}
        <div style={{ borderRight: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderMid}`, background: C.bg }}>
                <th style={{ padding: "16px 20px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Nº OS</th>
                <th style={{ padding: "16px 20px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Cliente</th>
                <th style={{ padding: "16px 20px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Pagamento</th>
                <th style={{ padding: "16px 20px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Valor</th>
                <th style={{ padding: "16px 20px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Correção</th>
              </tr>
            </thead>
            <tbody>
              {cx.transacoesFiltradas.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: C.textLight, fontStyle: "italic" }}>
                  {cx.filtroOS ? `Nenhum resultado para "${cx.filtroOS}".` : 'Nenhum recebimento no período.'}
                </td></tr>
              )}
              {(() => {
                const renderLinha = (t: Transacao) => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}` }} className="hover:bg-slate-50">
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{ fontWeight: 800, color: C.sidebarBg, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.5px' }}>
                        {t.os_numero || '—'}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px", fontWeight: 700, color: C.textMain, fontSize: 13 }}>{t.cliente_nome}</td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ display: "inline-block", background: C.bg, color: C.textMuted, padding: "4px 10px", borderRadius: RAIO_SM, fontSize: 11, fontWeight: 800 }}>
                          {t.forma_pagamento}
                        </span>
                        {t.bandeira_cartao && (
                          <span style={{ fontSize: 10, color: C.textLight, fontWeight: 700, paddingLeft: 4 }}>
                            {t.bandeira_cartao}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", fontWeight: 800, color: C.success, fontSize: 14 }}>{brl(t.valor_total)}</td>
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      <button onClick={() => cx.tentarEditar(t)}
                        style={{ background: "transparent", border: "none", color: cx.isGerenteOuDono ? C.textLight : C.danger, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 }}
                        className="hover:opacity-70">
                        {!cx.isGerenteOuDono && <FiLock size={12} />} <FiEdit2 size={14} /> Corrigir
                      </button>
                    </td>
                  </tr>
                );

                // Período de um único dia: renderiza sem agrupamento
                if (cx.dataIni === cx.dataFim) {
                  return cx.transacoesFiltradas.map(renderLinha);
                }

                // Múltiplos dias: agrupa por data e insere separador
                const grupos = new Map<string, Transacao[]>();
                cx.transacoesFiltradas.forEach(t => {
                  const dia = (t.data_hora || '').substring(0, 10);
                  if (!grupos.has(dia)) grupos.set(dia, []);
                  grupos.get(dia)!.push(t);
                });

                return Array.from(grupos.entries()).map(([dia, txs]) => {
                  const dataLabel = dia
                    ? new Date(dia + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                    : 'Data não registrada';
                  const totalDia = txs.reduce((a, t) => a + Number(t.valor_total), 0);
                  return (
                    <React.Fragment key={dia}>
                      <tr>
                        <td colSpan={5} style={{ padding: '8px 20px', background: `${C.sidebarBg}12`, borderBottom: `1px solid ${C.borderMid}`, borderTop: `1px solid ${C.borderMid}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <FiCalendar size={12} color={C.sidebarBg} />
                              <span style={{ fontSize: 11, fontWeight: 800, color: C.sidebarBg, textTransform: 'capitalize' }}>
                                {dataLabel}
                              </span>
                              <span style={{ fontSize: 10, color: C.textLight }}>
                                · {txs.length} lançamento{txs.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 800, color: C.success }}>{brl(totalDia)}</span>
                          </div>
                        </td>
                      </tr>
                      {txs.map(renderLinha)}
                    </React.Fragment>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        {/* Resumo do turno */}
        <Card style={{ padding: 24, background: C.bgCard, border: `1px solid ${C.sidebarBg}`, alignSelf: "start" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
            <FiPrinter size={18} /> {cx.tituloResumo}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.textMuted }}><span>Pix</span> <span>{brl(cx.totalPix)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.textMuted }}><span>Cartão de Crédito</span> <span>{brl(cx.totalCartaoCred)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.textMuted }}><span>Cartão de Débito</span> <span>{brl(cx.totalCartaoDeb)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.textMuted }}><span>Dinheiro</span> <span>{brl(cx.totalDinheiro)}</span></div>
          </div>
          <div style={{ borderTop: `1px dashed ${C.borderMid}`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Total Caixa</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.sidebarBg }}>{brl(cx.totalGeral)}</span>
          </div>
          <button
            onClick={() => {
              sessionStorage.setItem('relatorios_aba_inicial', 'fechamento');
              setAba?.('relatorios');
            }}
            style={{ width: "100%", marginTop: 24, background: C.sidebarBg, color: "#fff", border: "none", padding: "14px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: "pointer", textTransform: "uppercase", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
            <FiCheckCircle size={16} /> Kit Fechamento Contábil →
          </button>
          <p style={{ margin: "8px 0 0", fontSize: 10, color: C.textLight, textAlign: "center" }}>
            Exporta relatórios de faturamento, comissões e livro-caixa
          </p>
        </Card>
        </div>}
      </div>

      {/* ── Agendamentos do período ─────────────────────────────────────────── */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: "hidden", marginTop: 24 }}>
        <button
          onClick={() => cx.setMostrarAbertos(v => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: C.bg, border: "none", cursor: "pointer", borderBottom: cx.mostrarAbertos ? `1px solid ${C.borderMid}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FiClock size={14} color={cx.agEmAbertoFiltrados.length > 0 ? "#D97706" : C.textMuted} />
            <span style={{ fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {cx.dataIni === cx.dataFim
                ? `Agendamentos — ${cx.dataIni === new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0] ? 'Hoje' : cx.dataIni.split('-').reverse().join('/')}`
                : `Agendamentos do Período`}
            </span>
            {(() => {
              const pendentes   = cx.agEmAbertoFiltrados.filter((ag: any) => ag.status !== 'Finalizado').length;
              const finalizados = cx.agEmAbertoFiltrados.filter((ag: any) => ag.status === 'Finalizado').length;
              return (
                <>
                  {pendentes > 0 && (
                    <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: RAIO_LG }}>
                      {pendentes} pendente{pendentes > 1 ? 's' : ''}
                    </span>
                  )}
                  {finalizados > 0 && (
                    <span style={{ background: "#F0FDF4", color: "#166534", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: RAIO_LG }}>
                      {finalizados} finalizado{finalizados > 1 ? 's' : ''}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
          {cx.mostrarAbertos ? <FiChevronUp size={14} color={C.textLight} /> : <FiChevronDown size={14} color={C.textLight} />}
        </button>

        {cx.mostrarAbertos && (
          cx.agEmAbertoFiltrados.length === 0 ? (
            <div style={{ padding: "20px 20px", display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 13 }}>
              <FiCheckCircle size={14} color="#10B981" />
              {cx.agEmAberto.length === 0
                ? 'Nenhum agendamento para o período.'
                : 'Nenhum agendamento para o profissional selecionado.'}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FFFBEB" }}>
                  {["Horário", "Cliente", "Serviço", "Profissional", "Situação"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, color: "#92400E", textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const renderGrupoCliente = (cliente: string, ags: any[], chave: string) => {
                    if (ags.length === 1) {
                      const ag = ags[0];
                      const badge = COR_STATUS[ag.status] || { bg: '#F1F5F9', cor: C.textMuted };
                      return (
                        <tr key={chave} style={{ borderTop: `1px solid ${C.border}` }} className="hover:bg-amber-50/30">
                          <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 800, color: C.sidebarBg, fontFamily: "monospace" }}>{ag.inicio ? ag.inicio.slice(0, 5) : '—'}</td>
                          <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: C.textMain }}>{ag.cliente_nome || '—'}</td>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: C.textMuted }}>{ag._nome_servico}</td>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: C.textMuted }}>{ag._nome_profissional}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: RAIO_XS, background: badge.bg, color: badge.cor }}>{ag.status}</span>
                          </td>
                        </tr>
                      );
                    }
                    const expandido = cx.gruposExpandidos[chave] ?? false;
                    const melhorStatus = ags.reduce((m: string, ag: any) =>
                      (PRIO_STATUS[ag.status] || 0) > (PRIO_STATUS[m] || 0) ? ag.status : m, ags[0]?.status || 'Agendado');
                    const badge = COR_STATUS[melhorStatus] || { bg: '#F1F5F9', cor: C.textMuted };
                    const profsUnicos = [...new Set(ags.map((ag: any) => ag._nome_profissional).filter(Boolean))].join(', ');
                    const h0 = ags[0]?.inicio?.slice(0, 5) || '—';
                    const hN = ags[ags.length - 1]?.inicio?.slice(0, 5) || '—';
                    return (
                      <React.Fragment key={chave}>
                        <tr onClick={() => cx.toggleGrupo(chave)}
                          style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer', background: expandido ? '#FFFDF5' : '#fff' }}
                          className="hover:bg-amber-50/50">
                          <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 800, color: C.sidebarBg, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                            {h0}{hN !== h0 && <span style={{ color: C.textLight, fontWeight: 400 }}> – {hN}</span>}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{cliente}</span>
                              <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{ags.length} serviços</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>clique para expandir</td>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: C.textMuted }}>{profsUnicos}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: RAIO_XS, background: badge.bg, color: badge.cor }}>{melhorStatus}</span>
                              {expandido ? <FiChevronUp size={12} color={C.textLight} /> : <FiChevronDown size={12} color={C.textLight} />}
                            </div>
                          </td>
                        </tr>
                        {expandido && ags.map((ag: any) => {
                          const subBadge = COR_STATUS[ag.status] || { bg: '#F1F5F9', cor: C.textMuted };
                          return (
                            <tr key={ag.id} style={{ borderTop: `1px dashed ${C.borderMid}`, background: '#FFFDF5' }}>
                              <td style={{ padding: "9px 16px 9px 28px", fontSize: 12, fontWeight: 700, color: C.textLight, fontFamily: "monospace" }}>{ag.inicio ? ag.inicio.slice(0, 5) : '—'}</td>
                              <td style={{ padding: "9px 16px", fontSize: 12, color: C.textMuted }}><span style={{ color: '#D4A017', marginRight: 6 }}>└</span></td>
                              <td style={{ padding: "9px 16px", fontSize: 12, color: C.textMain, fontWeight: 500 }}>{ag._nome_servico}</td>
                              <td style={{ padding: "9px 16px", fontSize: 12, color: C.textMuted }}>{ag._nome_profissional}</td>
                              <td style={{ padding: "9px 16px" }}>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: RAIO_XS, background: subBadge.bg, color: subBadge.cor }}>{ag.status}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  };

                  const agruparPorCliente = (lista: any[]) => {
                    const g: Record<string, any[]> = {};
                    lista.forEach((ag: any) => { const k = ag.cliente_nome || 'Sem nome'; if (!g[k]) g[k] = []; g[k].push(ag); });
                    return g;
                  };

                  // Período único: agrupa só por cliente
                  if (cx.dataIni === cx.dataFim) {
                    const grupos = agruparPorCliente(cx.agEmAbertoFiltrados);
                    return Object.keys(grupos)
                      .sort((a, b) => (grupos[a][0]?.inicio || '').localeCompare(grupos[b][0]?.inicio || ''))
                      .map(cliente => renderGrupoCliente(cliente, grupos[cliente], cliente));
                  }

                  // Múltiplos dias: separador por data + agrupamento por cliente dentro de cada dia
                  const porDia = new Map<string, any[]>();
                  cx.agEmAbertoFiltrados.forEach((ag: any) => {
                    const dia = (ag.data || '').substring(0, 10);
                    if (!porDia.has(dia)) porDia.set(dia, []);
                    porDia.get(dia)!.push(ag);
                  });
                  return Array.from(porDia.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .flatMap(([dia, agsNoDia]) => {
                      const grupos = agruparPorCliente(agsNoDia);
                      const clientes = Object.keys(grupos).sort((a, b) =>
                        (grupos[a][0]?.inicio || '').localeCompare(grupos[b][0]?.inicio || '')
                      );
                      const dataLabel = dia
                        ? new Date(dia + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                        : 'Data não registrada';
                      const pendentes = agsNoDia.filter((ag: any) => ag.status !== 'Finalizado').length;
                      const finalizados = agsNoDia.filter((ag: any) => ag.status === 'Finalizado').length;
                      return [
                        <tr key={`dia-ag-${dia}`}>
                          <td colSpan={5} style={{ padding: '8px 16px', background: '#FFFBEB', borderBottom: `1px solid #FDE68A`, borderTop: `1px solid #FDE68A` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FiCalendar size={12} color="#92400E" />
                                <span style={{ fontSize: 11, fontWeight: 800, color: "#92400E", textTransform: 'capitalize' }}>{dataLabel}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                {pendentes > 0 && <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: RAIO_LG }}>{pendentes} pendente{pendentes !== 1 ? 's' : ''}</span>}
                                {finalizados > 0 && <span style={{ background: "#F0FDF4", color: "#166534", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: RAIO_LG }}>{finalizados} finalizado{finalizados !== 1 ? 's' : ''}</span>}
                              </div>
                            </div>
                          </td>
                        </tr>,
                        ...clientes.map(cliente => renderGrupoCliente(cliente, grupos[cliente], `${dia}-${cliente}`)),
                      ];
                    });
                })()}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* ── Modais ─────────────────────────────────────────────────────────── */}
      {modalDespesaAberto && (
        <ModalNovaDespesa
          perfil={perfil}
          onClose={() => setModalDespesaAberto(false)}
          aoSalvar={() => { setModalDespesaAberto(false); cx.recarregar?.(); }}
        />
      )}

      {cx.modalLancamento && (
        <ModalLancamentoCaixa
          formLancar={cx.formLancar}
          setFormLancar={cx.setFormLancar}
          onSubmit={cx.lancarAtendimento}
          onClose={() => cx.setModalLancamento(false)}
        />
      )}

      <ModalEdicaoCaixa
        modalAutorizacao={cx.modalAutorizacao}
        senhaGerente={cx.senhaGerente}
        setSenhaGerente={cx.setSenhaGerente}
        onAutorizar={cx.autorizarEdicao}
        onCancelarAutorizacao={() => { cx.setModalAutorizacao(null); cx.setSenhaGerente(''); }}
        modalEdicao={cx.modalEdicao}
        modoCaixa={cx.modoCaixa}
        setModoCaixa={cx.setModoCaixa}
        novaFormaPagamento={cx.novaFormaPagamento}
        setNovaFormaPagamento={cx.setNovaFormaPagamento}
        novaDataCaixa={cx.novaDataCaixa}
        setNovaDataCaixa={cx.setNovaDataCaixa}
        pinCaixaAcao={cx.pinCaixaAcao}
        setPinCaixaAcao={cx.setPinCaixaAcao}
        motivoEstornoCaixa={cx.motivoEstornoCaixa}
        setMotivoEstornoCaixa={cx.setMotivoEstornoCaixa}
        onFechar={cx.fecharModalEdicao}
        onSalvarForma={cx.salvarCorrecaoPagamento}
        onSalvarData={cx.salvarCorrecaoData}
        onEstornar={cx.executarEstornoCaixa}
      />

    </div>
  );
}
