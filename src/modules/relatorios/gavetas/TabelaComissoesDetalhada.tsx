'use client'
import React, { useState } from "react";
import { C, brl } from "@/lib/constants";
import { RAIO_XS, RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { FiChevronDown, FiChevronRight, FiCheckCircle, FiDollarSign } from "react-icons/fi";

interface Props {
  comissoes: any[];
  comissoesSelecionadas: string[];
  processandoPagamento: boolean;
  onToggle: (id: string) => void;
  onSelecionarTodas: () => void;
  onPagar: () => void;
}

export function TabelaComissoesDetalhada({ comissoes, comissoesSelecionadas, processandoPagamento, onToggle, onSelecionarTodas, onPagar }: Props) {
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const toggle = (chave: string) => setColapsados(prev => {
    const s = new Set(prev); s.has(chave) ? s.delete(chave) : s.add(chave); return s;
  });

  const th = (label: string, align: 'left' | 'right' | 'center' = 'left') => (
    <th style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" as const, textAlign: align, whiteSpace: "nowrap" as const }}>{label}</th>
  );

  // Agrupa: profissional → data → itens
  const porProf: Record<string, any[]> = {};
  comissoes.forEach(c => {
    const k = c.profissionais?.nome || 'Não Alocado';
    if (!porProf[k]) porProf[k] = [];
    porProf[k].push(c);
  });

  const pendentesTotal = comissoes.filter(c => c.status === 'Pendente');

  return (
    <div style={{ background: '#fff', borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.borderMid}`, background: C.bg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Detalhamento por Profissional</h3>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>{comissoes.length} registros · clique no profissional ou data para expandir</span>
        </div>
        <button onClick={onPagar} disabled={comissoesSelecionadas.length === 0 || processandoPagamento}
          style={{ background: comissoesSelecionadas.length > 0 ? "#10B981" : C.borderMid, color: "#fff", border: "none", padding: "10px 16px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: (comissoesSelecionadas.length === 0 || processandoPagamento) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", transition: "0.2s" }}>
          {processandoPagamento ? "Processando..." : <><FiDollarSign size={15} /> Pagar {comissoesSelecionadas.length > 0 ? comissoesSelecionadas.length : ''}</>}
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 2, background: "#F8FAFC", boxShadow: "0 1px 0 #E2E8F0" }}>
            <tr>
              <th style={{ width: 36, padding: "10px 12px" }}>
                <input type="checkbox" onChange={onSelecionarTodas}
                  checked={comissoesSelecionadas.length > 0 && comissoesSelecionadas.length === pendentesTotal.length}
                  style={{ accentColor: C.sidebarBg, width: 15, height: 15, cursor: "pointer" }} />
              </th>
              {th('Data Atend.')}
              {th('Data Pgto')}
              {th('Cliente')}
              {th('Serviço / Produto')}
              {th('Valor Serv.', 'right')}
              {th('% Com.', 'center')}
              {th('Base Cálculo', 'right')}
              {th('− Taxa Op.', 'right')}
              {th('Comissão', 'right')}
              {th('Status', 'center')}
            </tr>
          </thead>
          <tbody>
            {Object.entries(porProf).map(([nomeProf, itens]) => {
              const totalProf = itens.reduce((a, c) => a + (c.status !== 'Cancelado' && c.status !== 'Estornado' ? Number(c.valor_comissao) : 0), 0);
              const totalServ = itens.reduce((a, c) => a + (c.status !== 'Cancelado' && c.status !== 'Estornado' ? Number(c.valor_servico) : 0), 0);
              const aberto    = !colapsados.has(nomeProf);
              const pendentes = itens.filter(c => c.status === 'Pendente');

              const porData: Record<string, any[]> = {};
              itens.forEach(c => {
                const d = new Date(c.created_at).toLocaleDateString('pt-BR');
                if (!porData[d]) porData[d] = [];
                porData[d].push(c);
              });

              return (
                <React.Fragment key={nomeProf}>
                  {/* ── Linha do profissional ── */}
                  <tr onClick={() => toggle(nomeProf)} style={{ background: `${C.sidebarBg}0A`, cursor: "pointer", borderTop: `2px solid ${C.borderMid}` }}>
                    <td style={{ padding: "12px 12px" }}>
                      {aberto ? <FiChevronDown size={14} color={C.sidebarBg} /> : <FiChevronRight size={14} color={C.sidebarBg} />}
                    </td>
                    <td colSpan={4} style={{ padding: "12px 12px", fontWeight: 800, fontSize: 13, color: C.sidebarBg }}>
                      {nomeProf}
                      {pendentes.length > 0 && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: RAIO_XS, background: "#FEF3C7", color: "#92400E" }}>{pendentes.length} pendente(s)</span>}
                    </td>
                    <td style={{ padding: "12px 12px", textAlign: "right", fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{brl(totalServ)}</td>
                    <td /><td /><td />
                    <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 800, fontSize: 13, color: C.sidebarBg }}>{brl(totalProf)}</td>
                    <td />
                  </tr>

                  {aberto && Object.entries(porData).map(([data, linhas]) => {
                    const totalData  = linhas.reduce((a, c) => a + (c.status !== 'Cancelado' && c.status !== 'Estornado' ? Number(c.valor_comissao) : 0), 0);
                    const chaveData  = `${nomeProf}|${data}`;
                    const dataAberta = !colapsados.has(chaveData);

                    return (
                      <React.Fragment key={chaveData}>
                        {/* ── Sublinha de data ── */}
                        <tr onClick={() => toggle(chaveData)} style={{ background: "#F8FAFC", cursor: "pointer", borderTop: `1px solid ${C.border}` }}>
                          <td style={{ padding: "8px 12px 8px 28px" }}>
                            {dataAberta ? <FiChevronDown size={12} color={C.textMuted} /> : <FiChevronRight size={12} color={C.textMuted} />}
                          </td>
                          <td colSpan={8} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.textMuted }}>{data} · {linhas.length} atendimento(s)</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.textMuted }}>{brl(totalData)}</td>
                          <td />
                        </tr>

                        {dataAberta && linhas.map((item: any, idx: number) => {
                          const isEstorno   = item.status === 'Cancelado' || item.status === 'Estornado';
                          const isPago      = item.status === 'Pago';
                          const isPend      = item.status === 'Pendente';
                          const podeSelec   = isPend && !isEstorno;
                          const perc        = Number(item.porcentagem_comissao) || 0;
                          const valorServ   = Number(item.valor_servico) || 0;
                          const comissaoBruta = (valorServ * perc) / 100;
                          const comissaoLiq   = Number(item.valor_comissao) || 0;
                          const descTaxa    = !isEstorno && comissaoBruta > comissaoLiq
                            ? comissaoBruta - comissaoLiq : 0;

                          return (
                            <tr key={idx} onClick={() => podeSelec && onToggle(item.id)}
                              style={{ borderTop: `1px solid ${C.border}`, opacity: isEstorno ? 0.55 : 1, background: comissoesSelecionadas.includes(item.id) ? "#F0FDF4" : "white", cursor: podeSelec ? "pointer" : "default" }}
                              className={podeSelec ? "hover:bg-slate-50" : ""}>
                              <td style={{ padding: "10px 12px 10px 44px" }}>
                                {podeSelec
                                  ? <input type="checkbox" checked={comissoesSelecionadas.includes(item.id)} readOnly style={{ accentColor: "#10B981", width: 14, height: 14, cursor: "pointer" }} />
                                  : isPago ? <FiCheckCircle color="#10B981" size={13} /> : null}
                              </td>
                              <td style={{ padding: "10px 12px", color: C.textMuted }}>{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                              <td style={{ padding: "10px 12px", color: C.textMuted }}>{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                              <td style={{ padding: "10px 12px", fontWeight: 600, color: C.textMain }}>{item.agendamentos?.cliente_nome || '—'}</td>
                              <td style={{ padding: "10px 12px", color: C.textMain }}>{item.servico_nome || item.agendamentos?.servicos?.nome_servico || 'Serviço Avulso'}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: isEstorno ? C.textLight : C.textMain }}>{brl(valorServ)}</td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                {perc > 0
                                  ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: RAIO_XS, background: `${C.sidebarBg}14`, color: C.sidebarBg }}>{perc.toFixed(0)}%</span>
                                  : <span style={{ color: C.textLight }}>0%</span>}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: C.textMuted }}>{perc > 0 ? brl(comissaoBruta) : '—'}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: descTaxa > 0 ? '#EF4444' : C.textLight }}>
                                {descTaxa > 0 ? `− ${brl(descTaxa)}` : '—'}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: isEstorno ? C.textLight : (isPago ? "#065F46" : C.danger) }}>
                                {isEstorno ? '—' : brl(comissaoLiq)}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 7px", borderRadius: RAIO_XS, background: isEstorno ? "#FEE2E2" : (isPago ? "#D1FAE5" : "#FEF3C7"), color: isEstorno ? C.danger : (isPago ? "#065F46" : "#92400E") }}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
