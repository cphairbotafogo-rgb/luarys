// src/modules/relatorios/gavetas/comissoes/GavetaComissoes.tsx
// Shell principal da gaveta de comissões.
// Lógica: useGavetaComissoes | Modais: ModalRecalculo, ModalAjuste, ModalExportacao.
'use client'
import React from "react";
import { C, brl } from "@/lib/constants";
import { InputData } from "@/components/InputData";
import { RAIO_XS, RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import {
  FiPieChart, FiUsers, FiUser, FiFilter, FiCalendar, FiRefreshCw, FiPrinter,
  FiTrash2, FiArrowUp, FiArrowDown, FiBarChart2, FiAlignLeft,
  FiCheckCircle, FiDollarSign, FiPlus, FiChevronDown, FiChevronRight,
} from "react-icons/fi";
import { useCapacidadeProfissional } from "@/modules/relatorios/hooks/useCapacidadeProfissional";
import { useGavetaComissoes } from "./useGavetaComissoes";
import { ModalRecalculo } from "./ModalRecalculo";
import { ModalAjuste } from "./ModalAjuste";
import { ModalExportacao } from "./ModalExportacao";
import { agruparComissoes, calcularAcertoEquipe } from "./tipos";
import { TabelaComissoesDetalhada } from "./TabelaComissoesDetalhada";

const inputStyle = { padding:"10px 14px", borderRadius:RAIO_MD, border:`1px solid ${C.borderMid}`, width:"100%", outlineColor: C.sidebarBg, fontSize: 13, color: C.textMain, backgroundColor: C.bgCard, fontWeight: 600, boxSizing: "border-box" as const };
const labelStyle = { margin:"0 0 6px", fontSize:10, fontWeight:700, color:C.textMuted, display:"flex", alignItems:"center", gap:6, textTransform:"uppercase" as const, letterSpacing:"0.5px" };

export function GavetaComissoes({ perfil }: any) {
  const cx = useGavetaComissoes(perfil);
  // ── Cálculos derivados ─────────────────────────────────────────────────────
  const comissoesValidas = cx.comissoes.filter(c => c.status !== 'Cancelado' && c.status !== 'Estornado');
  const receitaBrutaTotal = comissoesValidas.reduce((acc, c) => acc + (Number(c.valor_servico) || 0), 0);
  const comissaoTotal     = comissoesValidas.reduce((acc, c) => acc + (Number(c.valor_comissao) || 0), 0);
  const lucroSalao        = receitaBrutaTotal - comissaoTotal;

  const extrasVisiveis    = cx.extras.filter(e => cx.profissionalFiltro === 'TODOS' || e.profissional_id === cx.profissionalFiltro);
  const totalRecebiveis   = extrasVisiveis.filter(e => e.tipo === 'recebivel').reduce((a, e) => a + Number(e.valor), 0);
  const totalAbatimentos  = extrasVisiveis.filter(e => e.tipo === 'abatimento').reduce((a, e) => a + Number(e.valor), 0);
  const comissaoAjustada  = comissaoTotal + totalRecebiveis - totalAbatimentos;

  const acertoEquipe      = calcularAcertoEquipe(cx.profissionais, comissoesValidas, cx.extras);
  const comissoesAgrupadas = agruparComissoes(comissoesValidas);

  // ── Capacidade (só com profissional específico) ────────────────────────────
  const horasFinalizadasPorProf: Record<string, number> = {};
  cx.bloqueiosCapacidade.forEach((ag: any) => {
    if (ag.status === 'Finalizado') {
      horasFinalizadasPorProf[ag.profissional_id] = (horasFinalizadasPorProf[ag.profissional_id] || 0) + (Number(ag.duracao_min) || 0);
    }
  });
  const receitaPorProf: Record<string, number> = {};
  comissoesValidas.forEach((c: any) => {
    receitaPorProf[c.profissional_id] = (receitaPorProf[c.profissional_id] || 0) + (Number(c.valor_servico) || 0);
  });
  const ticketMedioPorProfissional: Record<string, number> = {};
  Object.keys(receitaPorProf).forEach(profId => {
    const minutos = horasFinalizadasPorProf[profId] || 0;
    ticketMedioPorProfissional[profId] = minutos > 0 ? receitaPorProf[profId] / (minutos / 60) : 0;
  });
  const capacidadePorProfissional = useCapacidadeProfissional({
    profissionais: cx.profissionais,
    agendamentos: cx.bloqueiosCapacidade,
    dataInicio: cx.dataInicio,
    dataFim: cx.dataFim,
    ticketMedioPorProfissional,
  });
  const capacidadeSelecionada = cx.profissionalFiltro !== 'TODOS'
    ? capacidadePorProfissional.find(c => c.profissionalId === cx.profissionalFiltro) ?? null
    : null;
  const profissionalSelecionadoObj = cx.profissionalFiltro !== 'TODOS'
    ? cx.profissionais.find(p => p.id === cx.profissionalFiltro) ?? null
    : null;

  return (
    <div style={{ animation: "fadeIn 0.2s ease-out" }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .area-impressao, .area-impressao * { visibility: visible; }
          .area-impressao { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .nao-imprimir { display: none !important; }
        }
      `}} />

      <div className="nao-imprimir">
        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ background: C.sidebarBg, padding: 12, borderRadius: RAIO_XL, color: "#fff" }}><FiUsers size={24} /></div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>Comissões da Equipe</h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Análise de performance, filtros avançados e recálculo financeiro.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Toggle visão */}
            <div style={{ display: "flex", gap: 2, background: C.bg, padding: 4, borderRadius: RAIO_LG, border: `1px solid ${C.border}` }}>
              <button onClick={() => cx.setVisao('detalhada')} style={{ padding: "7px 14px", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: cx.visao === 'detalhada' ? C.sidebarBg : "transparent", color: cx.visao === 'detalhada' ? "#fff" : C.textMuted, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", transition: "all 0.15s" }}>
                <FiAlignLeft size={13} /> Detalhado
              </button>
              <button onClick={() => cx.setVisao('consolidada')} style={{ padding: "7px 14px", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: cx.visao === 'consolidada' ? C.sidebarBg : "transparent", color: cx.visao === 'consolidada' ? "#fff" : C.textMuted, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", transition: "all 0.15s" }}>
                <FiBarChart2 size={13} /> Acerto de Equipe
              </button>
            </div>
            <button onClick={() => cx.setModalRecalculo(true)} className="transition-all hover:bg-slate-50 shadow-sm" style={{ background: C.bgCard, color: C.danger, border: `1px solid ${C.danger}`, padding: "12px 20px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <FiRefreshCw size={16} /> Recalcular Comissões
            </button>
            <button onClick={() => cx.setModalImpressao(true)} className="transition-all hover:opacity-90 shadow-sm" style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "12px 24px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <FiPrinter size={16} /> Exportar
            </button>
          </div>
        </div>

        {/* ── Filtros ─────────────────────────────────────────────────────── */}
        <div style={{ background: C.bgCard, padding: 24, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}><FiCalendar size={12} /> Data Inicial</label>
              <InputData style={inputStyle} value={cx.dataInicio} onChange={cx.setDataInicio} />
            </div>
            <div>
              <label style={labelStyle}><FiCalendar size={12} /> Data Final</label>
              <InputData style={inputStyle} value={cx.dataFim} onChange={cx.setDataFim} />
            </div>
            <div>
              <label style={labelStyle}><FiFilter size={12} /> Profissional</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={cx.profissionalFiltro} onChange={e => cx.setProfissionalFiltro(e.target.value)}>
                <option value="TODOS">Todos os Profissionais</option>
                {cx.profissionais.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}{p.ativo === false ? ' (Inativo)' : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={cx.gerarRelatorioComissoes} style={{ background: C.sidebarBg, color: "#fff", border: "none", width: "100%", padding: "10px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textTransform: "uppercase", height: "42px" }}>
                {cx.carregando ? "Filtrando..." : "Filtrar"}
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr", gap: 16, paddingTop: 16, borderTop: `1px dashed ${C.borderMid}` }}>
            <div>
              <label style={labelStyle}>Listar Vendas De:</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={cx.tipoVendaFiltro} onChange={e => cx.setTipoVendaFiltro(e.target.value)}>
                <option value="TODOS">Todas as Origens</option>
                <option value="SERVICOS">Somente Serviços</option>
                <option value="PRODUTOS">Somente Produtos</option>
                <option value="PACOTES">Somente Pacotes</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status de Pagamento (Profissional):</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={cx.statusPagamentoFiltro} onChange={e => cx.setStatusPagamentoFiltro(e.target.value)}>
                <option value="TODOS">Todos</option>
                <option value="LANCADOS">Pagamentos Lançados (Já Pagos)</option>
                <option value="NAO_LANCADOS">Pagamentos Não Lançados (A Pagar)</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: C.textMain, fontWeight: 600, marginTop: 14 }}>
                <input type="checkbox" checked={cx.exibirEstornos} onChange={e => cx.setExibirEstornos(e.target.checked)} style={{ accentColor: C.sidebarBg, width: 16, height: 16 }} />
                Exibir Estornos / Cancelados
              </label>
            </div>
          </div>
        </div>

        {/* ── Cards de resumo ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 32 }}>
          <div style={{ background: C.bgCard, padding: 24, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.sidebarBg}` }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px" }}>Receita Bruta (Válida)</p>
            <h3 style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900, color: C.textMain }}>{brl(receitaBrutaTotal)}</h3>
          </div>
          <div style={{ background: C.bgCard, padding: 24, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.danger}` }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px" }}>Comissão a Pagar / Paga</p>
            <h3 style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900, color: C.danger }}>{brl(comissaoTotal)}</h3>
          </div>
          <div style={{ background: C.sidebarBg, padding: 24, borderRadius: RAIO_XL, color: "#fff" }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Lucro Bruto do Salão</p>
            <h3 style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900, color: "#fff" }}>{brl(lucroSalao)}</h3>
          </div>
        </div>

        {/* ── Painel de ajustes ───────────────────────────────────────────── */}
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, marginBottom: 24 }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.borderMid}`, background: C.bg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Ajustes de Comissão</h3>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>Recebíveis e abatimentos manuais do período</span>
            </div>
            <button
              onClick={() => { cx.setFormExtra({ profissional_id: cx.profissionalFiltro !== 'TODOS' ? cx.profissionalFiltro : '', tipo: 'recebivel', descricao: '', valor: '' }); cx.setModalExtra(true); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <FiPlus size={14} /> Lançar Ajuste
            </button>
          </div>
          {extrasVisiveis.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
              Nenhum ajuste lançado neste período. Use o botão acima para adicionar bônus ou abatimentos.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    <th style={{ padding: "10px 24px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Profissional</th>
                    <th style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Tipo</th>
                    <th style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Descrição</th>
                    <th style={{ padding: "10px 24px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Valor</th>
                    <th style={{ padding: "10px 16px", width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {extrasVisiveis.map((e: any) => (
                    <tr key={e.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: "12px 24px", fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>{e.profissionais?.nome || '-'}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: RAIO_XS, background: e.tipo === 'recebivel' ? "#D1FAE5" : "#FEE2E2", color: e.tipo === 'recebivel' ? "#065F46" : C.danger }}>
                          {e.tipo === 'recebivel' ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />}
                          {e.tipo === 'recebivel' ? 'Recebível' : 'Abatimento'}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: C.textMain }}>{e.descricao}</td>
                      <td style={{ padding: "12px 24px", fontSize: 14, fontWeight: 800, textAlign: "right", color: e.tipo === 'recebivel' ? "#065F46" : C.danger }}>
                        {e.tipo === 'recebivel' ? '+' : '-'} {brl(Number(e.valor))}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button onClick={() => cx.deletarExtra(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex", alignItems: "center" }} title="Remover">
                          <FiTrash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(totalRecebiveis > 0 || totalAbatimentos > 0) && (
                <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.borderMid}`, display: "flex", justifyContent: "flex-end", background: C.bg }}>
                  <div style={{ textAlign: "right", fontSize: 13 }}>
                    <p style={{ margin: "0 0 4px", color: C.textMuted }}>Comissão base: <strong style={{ color: C.textMain }}>{brl(comissaoTotal)}</strong></p>
                    {totalRecebiveis   > 0 && <p style={{ margin: "0 0 4px", color: "#065F46" }}>+ Recebíveis: <strong>{brl(totalRecebiveis)}</strong></p>}
                    {totalAbatimentos > 0 && <p style={{ margin: "0 0 4px", color: C.danger }}>− Abatimentos: <strong>{brl(totalAbatimentos)}</strong></p>}
                    <p style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 900, color: C.sidebarBg, borderTop: `1px solid ${C.borderMid}`, paddingTop: 8 }}>= Comissão ajustada: {brl(comissaoAjustada)}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Visão consolidada: acerto de equipe ─────────────────────────── */}
        {cx.visao === 'consolidada' && (
          <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.borderMid}`, background: C.bg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Acerto de Equipe</h3>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>{acertoEquipe.length} profissional(is) com movimento no período</span>
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                {[
                  { label: "Total Gerado", valor: acertoEquipe.reduce((a, p) => a + p.comissaoPendente + p.comissaoPaga, 0), cor: C.sidebarBg },
                  { label: "A Quitar",    valor: acertoEquipe.reduce((a, p) => a + p.aReceber, 0),       cor: C.danger },
                  { label: "Já Pago",     valor: acertoEquipe.reduce((a, p) => a + p.comissaoPaga, 0),   cor: "#10B981" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>{s.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.cor }}>{brl(s.valor)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead style={{ background: C.bg }}>
                  <tr>
                    <th style={{ padding: "12px 24px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Profissional</th>
                    <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Receita no Período</th>
                    <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Comissão Bruta</th>
                    <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Ajustes</th>
                    <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.danger, textTransform: "uppercase", textAlign: "right" }}>A Quitar</th>
                    <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: "#065F46", textTransform: "uppercase", textAlign: "right" }}>Já Pago</th>
                    <th style={{ padding: "12px 24px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "center" }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {acertoEquipe.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: "48px 24px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>Nenhum profissional com comissões no período selecionado.</td></tr>
                  ) : acertoEquipe.map(p => {
                    const temPendencia  = p.idsPendentes.length > 0;
                    const ajusteLiquido = p.recebiveisProf - p.abatimentosProf;
                    return (
                      <tr key={p.profissional.id} style={{ borderBottom: `1px solid ${C.border}` }} className="hover:bg-slate-50">
                        <td style={{ padding: "16px 24px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${C.sidebarBg}18`, color: C.sidebarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                              {p.profissional.nome?.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: C.textMain }}>{p.profissional.nome}</span>
                          </div>
                        </td>
                        <td style={{ padding: "16px", textAlign: "right", fontSize: 13, color: C.textMuted }}>{brl(p.totalServicos)}</td>
                        <td style={{ padding: "16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: C.textMain }}>{brl(p.comissaoPendente + p.comissaoPaga)}</td>
                        <td style={{ padding: "16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: ajusteLiquido >= 0 ? "#10B981" : C.danger }}>
                          {ajusteLiquido !== 0 ? (ajusteLiquido > 0 ? "+" : "") + brl(ajusteLiquido) : "—"}
                        </td>
                        <td style={{ padding: "16px", textAlign: "right", fontSize: 14, fontWeight: 800, color: temPendencia ? C.danger : C.textMuted }}>{brl(p.aReceber)}</td>
                        <td style={{ padding: "16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#065F46" }}>{brl(p.comissaoPaga)}</td>
                        <td style={{ padding: "16px 24px", textAlign: "center" }}>
                          {temPendencia ? (
                            <button onClick={() => cx.pagarTodoProfissional(p.profissional.nome, p.idsPendentes)} disabled={cx.processandoPagamento}
                              style={{ background: C.success, color: "#fff", border: "none", padding: "8px 16px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 800, cursor: cx.processandoPagamento ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, textTransform: "uppercase" }}>
                              <FiDollarSign size={13} /> Quitar {p.idsPendentes.length}
                            </button>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#10B981" }}>
                              <FiCheckCircle size={14} /> Quitado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Visão detalhada — agrupada por Profissional → Data ─────────── */}
        {cx.visao === 'detalhada' && (
          <TabelaComissoesDetalhada
            comissoes={cx.comissoes}
            comissoesSelecionadas={cx.comissoesSelecionadas}
            processandoPagamento={cx.processandoPagamento}
            onToggle={cx.toggleComissao}
            onSelecionarTodas={cx.selecionarTodasPendentes}
            onPagar={cx.marcarComoPago}
          />
        )}
      </div>

      {/* ── Modais ─────────────────────────────────────────────────────────── */}
      {cx.modalRecalculo && (
        <ModalRecalculo
          profissionais={cx.profissionais}
          dataRecalculo={cx.dataRecalculo}
          setDataRecalculo={cx.setDataRecalculo}
          profissionaisRecalculo={cx.profissionaisRecalculo}
          toggleProfissionalRecalculo={cx.toggleProfissionalRecalculo}
          selecionarTodos={cx.selecionarTodosProfissionaisRecalculo}
          processando={cx.processandoRecalculo}
          onExecutar={cx.executarRecalculo}
          onFechar={() => cx.setModalRecalculo(false)}
        />
      )}

      {cx.modalExtra && (
        <ModalAjuste
          profissionais={cx.profissionais}
          formExtra={cx.formExtra}
          setFormExtra={cx.setFormExtra}
          salvando={cx.salvandoExtra}
          onSalvar={cx.salvarExtra}
          onFechar={() => cx.setModalExtra(false)}
        />
      )}

      <ModalExportacao
        modalImpressao={cx.modalImpressao}
        onFechar={() => cx.setModalImpressao(false)}
        onDisparar={cx.dispararImpressao}
        capacidadeDisponivel={!!capacidadeSelecionada}
        profissionalDisponivel={!!profissionalSelecionadoObj}
        profissionalNome={profissionalSelecionadoObj?.nome}
        tipoImpressao={cx.tipoImpressao}
        perfil={perfil}
        dataInicio={cx.dataInicio}
        dataFim={cx.dataFim}
        comissoesValidas={comissoesValidas}
        comissoesAgrupadas={comissoesAgrupadas}
        extrasVisiveis={extrasVisiveis}
        comissaoTotal={comissaoTotal}
        totalRecebiveis={totalRecebiveis}
        totalAbatimentos={totalAbatimentos}
        comissaoAjustada={comissaoAjustada}
        capacidadeSelecionada={capacidadeSelecionada}
        profissionalSelecionadoObj={profissionalSelecionadoObj}
      />
    </div>
  );
}
