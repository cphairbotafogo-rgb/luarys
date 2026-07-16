// src/modules/relatorios/gavetas/comissoes/ModalExportacao.tsx
// Modal de seleção de formato de exportação + área de impressão (invisível na tela).
'use client'
import { C, brl } from "@/lib/constants";
import { RAIO_XL, RAIO_2XL, SOMBRA_MODAL, overlayModal } from "@/lib/estiloGlobal";
import { FiGrid, FiList, FiClock, FiUser, FiX } from "react-icons/fi";
import { TipoImpressao, ComissaoAgrupada } from "./tipos";

const thStylePrint = { padding:"10px", borderBottom:"2px solid #333", fontSize:12, fontWeight:800, textAlign:"left" as const, textTransform:"uppercase" as const };
const tdStylePrint = { padding:"8px 10px", borderBottom:"1px solid #ddd", fontSize:12 };

interface Props {
  // modal de seleção
  modalImpressao: boolean;
  onFechar: () => void;
  onDisparar: (tipo: TipoImpressao) => void;
  capacidadeDisponivel: boolean;
  profissionalDisponivel: boolean;
  profissionalNome?: string;
  // área de impressão
  tipoImpressao: TipoImpressao | null;
  perfil: any;
  dataInicio: string;
  dataFim: string;
  comissoesValidas: any[];
  comissoesAgrupadas: ComissaoAgrupada[];
  extrasVisiveis: any[];
  comissaoTotal: number;
  totalRecebiveis: number;
  totalAbatimentos: number;
  comissaoAjustada: number;
  capacidadeSelecionada: any;
  profissionalSelecionadoObj: any;
}

export function ModalExportacao({
  modalImpressao, onFechar, onDisparar,
  capacidadeDisponivel, profissionalDisponivel, profissionalNome,
  tipoImpressao, perfil, dataInicio, dataFim,
  comissoesValidas, comissoesAgrupadas, extrasVisiveis,
  comissaoTotal, totalRecebiveis, totalAbatimentos, comissaoAjustada,
  capacidadeSelecionada, profissionalSelecionadoObj,
}: Props) {
  const formatarData = (iso: string) => iso.split('-').reverse().join('/');

  return (
    <>
      {/* Modal de seleção de formato */}
      {modalImpressao && (
        <div className="nao-imprimir" style={{ ...overlayModal, zIndex: 999 }}>
          <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, width: 450, padding: 32, boxShadow: SOMBRA_MODAL }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg }}>Formato do Relatório</h3>
              <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight }}><FiX size={24} /></button>
            </div>
            <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, lineHeight: 1.5 }}>
              Escolha como os serviços serão exibidos no documento final.
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <button onClick={() => onDisparar('agrupado')} className="transition-all hover:bg-slate-50"
                style={{ flex: 1, padding: "24px 16px", borderRadius: RAIO_XL, border: `2px solid ${C.borderMid}`, background: C.bgCard, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ background: C.bg, padding: 12, borderRadius: "50%", color: C.sidebarBg }}><FiGrid size={24} /></div>
                <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Agrupados</span>
              </button>
              <button onClick={() => onDisparar('detalhado')} className="transition-all hover:bg-slate-50"
                style={{ flex: 1, padding: "24px 16px", borderRadius: RAIO_XL, border: `2px solid ${C.borderMid}`, background: C.bgCard, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ background: C.bg, padding: 12, borderRadius: "50%", color: C.sidebarBg }}><FiList size={24} /></div>
                <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Detalhados</span>
              </button>
              {capacidadeDisponivel && (
                <button onClick={() => onDisparar('capacidade')} className="transition-all hover:bg-slate-50"
                  style={{ flex: 1, padding: "24px 16px", borderRadius: RAIO_XL, border: `2px solid ${C.borderMid}`, background: C.bgCard, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ background: C.bg, padding: 12, borderRadius: "50%", color: C.sidebarBg }}><FiClock size={24} /></div>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Capacidade</span>
                </button>
              )}
              {profissionalDisponivel && (
                <button onClick={() => onDisparar('profissional')} className="transition-all hover:bg-slate-50"
                  style={{ flex: 1, padding: "24px 16px", borderRadius: RAIO_XL, border: `2px solid ${C.sidebarBg}`, background: `${C.sidebarBg}06`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ background: C.sidebarBg, padding: 12, borderRadius: "50%", color: "#fff" }}><FiUser size={24} /></div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Resumo do Profissional</span>
                    {profissionalNome && <span style={{ display: "block", fontSize: 11, color: C.textMuted, marginTop: 4 }}>{profissionalNome}</span>}
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Área de impressão — invisível na tela, visível na impressão via CSS */}
      {tipoImpressao && (
        <div className="area-impressao" style={{ display: "none", fontFamily: "Arial, sans-serif", color: "#333" }}>
          {/* Cabeçalho */}
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <h2 style={{ margin: "0 0 5px", fontSize: 18, textTransform: "uppercase" }}>{perfil?.nome_fantasia || 'Nome do Salão'}</h2>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: "normal" }}>
              {tipoImpressao === 'capacidade'
                ? `EXTRATO DE CAPACIDADE — ${capacidadeSelecionada?.nome || ''}`
                : tipoImpressao === 'profissional'
                ? `EXTRATO DE COMISSÃO — ${profissionalSelecionadoObj?.nome || ''}`
                : 'RESUMO FINANCEIRO'}
            </h3>
            <p style={{ margin: "5px 0 0", fontSize: 12, color: "#666" }}>
              Período: {formatarData(dataInicio)} a {formatarData(dataFim)}
            </p>
          </div>

          {tipoImpressao !== 'capacidade' && tipoImpressao !== 'profissional' && (
            <h4 style={{ fontSize: 12, textTransform: "uppercase", borderBottom: "1px solid #000", paddingBottom: 5, marginBottom: 15 }}>
              DESCRITIVO DAS RECEITAS NO PERÍODO
            </h4>
          )}

          {/* Agrupado */}
          {tipoImpressao === 'agrupado' && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 40 }}>
              <thead>
                <tr>
                  <th style={thStylePrint}>Serviço</th>
                  <th style={{ ...thStylePrint, textAlign: "center" }}>Quantidade</th>
                  <th style={{ ...thStylePrint, textAlign: "right" }}>Valor em Serviços (R$)</th>
                  <th style={{ ...thStylePrint, textAlign: "right" }}>Comissão Profissional (R$)</th>
                </tr>
              </thead>
              <tbody>
                {comissoesAgrupadas.map((item, idx) => (
                  <tr key={idx}>
                    <td style={tdStylePrint}><strong>{item.servico}</strong></td>
                    <td style={{ ...tdStylePrint, textAlign: "center" }}>{item.quantidade}</td>
                    <td style={{ ...tdStylePrint, textAlign: "right" }}>{brl(item.valorTotal)}</td>
                    <td style={{ ...tdStylePrint, textAlign: "right", fontWeight: "bold" }}>{brl(item.comissaoTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Detalhado */}
          {tipoImpressao === 'detalhado' && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 40 }}>
              <thead>
                <tr>
                  <th style={thStylePrint}>Data</th>
                  <th style={thStylePrint}>Cliente</th>
                  <th style={thStylePrint}>Serviço</th>
                  <th style={{ ...thStylePrint, textAlign: "right" }}>Valor (R$)</th>
                  <th style={{ ...thStylePrint, textAlign: "right" }}>Comissão (R$)</th>
                </tr>
              </thead>
              <tbody>
                {comissoesValidas.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td style={tdStylePrint}>{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                    <td style={tdStylePrint}>{item.agendamentos?.cliente_nome || '-'}</td>
                    <td style={tdStylePrint}>{item.tipo === 'produto' ? 'Venda de Produtos' : (item.agendamentos?.servicos?.nome_servico || 'Serviço Avulso')}</td>
                    <td style={{ ...tdStylePrint, textAlign: "right" }}>{brl(Number(item.valor_servico))}</td>
                    <td style={{ ...tdStylePrint, textAlign: "right", fontWeight: "bold" }}>{brl(Number(item.valor_comissao))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Capacidade */}
          {tipoImpressao === 'capacidade' && capacidadeSelecionada && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Capacidade contratada", valor: `${(capacidadeSelecionada.capacidadeContratadaMin / 60).toFixed(1)}h` },
                  { label: "Capacidade efetiva",    valor: `${(capacidadeSelecionada.capacidadeEfetivaMin / 60).toFixed(1)}h` },
                  { label: "Horas ocupadas",         valor: `${(capacidadeSelecionada.horasOcupadasMin / 60).toFixed(1)}h` },
                  { label: "Taxa de ocupação",       valor: `${(capacidadeSelecionada.taxaOcupacao * 100).toFixed(0)}%` },
                ].map(card => (
                  <div key={card.label} style={{ border: "1px solid #000", padding: 10 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 10, textTransform: "uppercase" }}>{card.label}</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: "bold" }}>{card.valor}</p>
                  </div>
                ))}
              </div>
              <h4 style={{ fontSize: 12, textTransform: "uppercase", borderBottom: "1px solid #000", paddingBottom: 5, marginBottom: 15 }}>Ocorrências no período</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
                <thead>
                  <tr>
                    <th style={thStylePrint}>Data</th>
                    <th style={thStylePrint}>Tipo</th>
                    <th style={thStylePrint}>Motivo</th>
                    <th style={{ ...thStylePrint, textAlign: "right" }}>Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {capacidadeSelecionada.ocorrencias.length === 0 && (
                    <tr><td style={tdStylePrint} colSpan={4}>Nenhuma ocorrência registrada no período.</td></tr>
                  )}
                  {capacidadeSelecionada.ocorrencias.map((oc: any, idx: number) => (
                    <tr key={idx}>
                      <td style={tdStylePrint}>{oc.data.split('-').reverse().join('/')}</td>
                      <td style={tdStylePrint}>{oc.tipo}</td>
                      <td style={tdStylePrint}>{oc.motivo || '-'}</td>
                      <td style={{ ...tdStylePrint, textAlign: "right" }}>{(oc.duracaoMin / 60).toFixed(1)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {capacidadeSelecionada.impactoFinanceiroEstimado > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginBottom: 24 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "8px", fontSize: 12, fontWeight: "bold" }}>Impacto financeiro estimado das ausências</td>
                      <td style={{ padding: "8px", fontSize: 12, fontWeight: "bold", textAlign: "right" }}>{brl(capacidadeSelecionada.impactoFinanceiroEstimado)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              <p style={{ fontSize: 10, color: "#666", marginBottom: 24 }}>
                Estimativa calculada com base no ticket médio por hora do profissional no período. Liberações concedidas pelo salão não entram neste cálculo.
              </p>
            </>
          )}

          {/* Extrato do profissional */}
          {tipoImpressao === 'profissional' && profissionalSelecionadoObj && (
            <>
              <h4 style={{ fontSize: 12, textTransform: "uppercase", borderBottom: "2px solid #000", paddingBottom: 5, marginBottom: 15 }}>Serviços Realizados no Período</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
                <thead>
                  <tr>
                    <th style={thStylePrint}>Data</th>
                    <th style={thStylePrint}>Cliente</th>
                    <th style={thStylePrint}>Serviço / Produto</th>
                    <th style={{ ...thStylePrint, textAlign: "right" }}>Valor (R$)</th>
                    <th style={{ ...thStylePrint, textAlign: "right" }}>Comissão (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {comissoesValidas.length === 0 && <tr><td style={tdStylePrint} colSpan={5}>Nenhum registro no período.</td></tr>}
                  {comissoesValidas.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={tdStylePrint}>{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                      <td style={tdStylePrint}>{item.agendamentos?.cliente_nome || '-'}</td>
                      <td style={tdStylePrint}>{item.tipo === 'produto' ? 'Venda de Produtos' : (item.agendamentos?.servicos?.nome_servico || 'Serviço Avulso')}</td>
                      <td style={{ ...tdStylePrint, textAlign: "right" }}>{brl(Number(item.valor_servico))}</td>
                      <td style={{ ...tdStylePrint, textAlign: "right", fontWeight: "bold" }}>{brl(Number(item.valor_comissao))}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} style={{ padding: "8px", fontSize: 12, fontWeight: "bold", borderTop: "2px solid #000", textAlign: "right" }}>Subtotal de Comissão</td>
                    <td style={{ padding: "8px", fontSize: 12, fontWeight: "bold", borderTop: "2px solid #000", textAlign: "right" }}>{brl(comissaoTotal)}</td>
                  </tr>
                </tbody>
              </table>

              {extrasVisiveis.length > 0 && (
                <>
                  <h4 style={{ fontSize: 12, textTransform: "uppercase", borderBottom: "2px solid #000", paddingBottom: 5, marginBottom: 15 }}>Ajustes do Período</h4>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
                    <thead><tr><th style={thStylePrint}>Tipo</th><th style={thStylePrint}>Descrição</th><th style={{ ...thStylePrint, textAlign: "right" }}>Valor (R$)</th></tr></thead>
                    <tbody>
                      {extrasVisiveis.map((e: any, idx: number) => (
                        <tr key={idx}>
                          <td style={tdStylePrint}>{e.tipo === 'recebivel' ? 'Recebível' : 'Abatimento'}</td>
                          <td style={tdStylePrint}>{e.descricao}</td>
                          <td style={{ ...tdStylePrint, textAlign: "right", fontWeight: "bold", color: e.tipo === 'recebivel' ? '#065F46' : '#DC2626' }}>
                            {e.tipo === 'recebivel' ? '+' : '-'} {brl(Number(e.valor))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              <h4 style={{ fontSize: 12, textTransform: "uppercase", borderBottom: "2px solid #000", paddingBottom: 5, marginBottom: 15 }}>Demonstrativo Financeiro</h4>
              <table style={{ width: "60%", marginLeft: "auto", borderCollapse: "collapse", marginBottom: 40 }}>
                <tbody>
                  <tr><td style={{ padding: "6px 8px", fontSize: 12 }}>Comissão base sobre serviços</td><td style={{ padding: "6px 8px", fontSize: 12, textAlign: "right" }}>{brl(comissaoTotal)}</td></tr>
                  {totalRecebiveis > 0 && <tr><td style={{ padding: "6px 8px", fontSize: 12 }}>+ Recebíveis adicionais</td><td style={{ padding: "6px 8px", fontSize: 12, textAlign: "right", color: "#065F46" }}>+ {brl(totalRecebiveis)}</td></tr>}
                  {totalAbatimentos > 0 && <tr><td style={{ padding: "6px 8px", fontSize: 12 }}>− Abatimentos</td><td style={{ padding: "6px 8px", fontSize: 12, textAlign: "right", color: "#DC2626" }}>- {brl(totalAbatimentos)}</td></tr>}
                  <tr style={{ borderTop: "2px solid #000" }}>
                    <td style={{ padding: "10px 8px", fontSize: 14, fontWeight: "bold" }}>TOTAL A RECEBER</td>
                    <td style={{ padding: "10px 8px", fontSize: 14, fontWeight: "bold", textAlign: "right" }}>{brl(comissaoAjustada)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginTop: 60 }}>
                <div style={{ borderTop: "1px solid #000", paddingTop: 8 }}>
                  <p style={{ margin: 0, fontSize: 11, textAlign: "center" }}>Assinatura do Profissional</p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, textAlign: "center", color: "#666" }}>{profissionalSelecionadoObj.nome}</p>
                </div>
                <div style={{ borderTop: "1px solid #000", paddingTop: 8 }}>
                  <p style={{ margin: 0, fontSize: 11, textAlign: "center" }}>Assinatura do Responsável</p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, textAlign: "center", color: "#666" }}>{perfil?.nome_fantasia || ''}</p>
                </div>
              </div>
              <p style={{ marginTop: 24, fontSize: 10, color: "#999", textAlign: "center" }}>
                Documento gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          )}

          {/* Resumo financeiro (agrupado/detalhado) */}
          {tipoImpressao !== 'capacidade' && tipoImpressao !== 'profissional' && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000" }}>
                <thead><tr><th colSpan={2} style={{ padding: "8px", background: "#f0f0f0", fontSize: 12, borderBottom: "1px solid #000" }}>RECEBIMENTOS</th></tr></thead>
                <tbody>
                  <tr><td style={{ padding: "8px", fontSize: 12 }}>Sobre Serviços</td><td style={{ padding: "8px", fontSize: 12, textAlign: "right" }}>{brl(comissaoTotal)}</td></tr>
                  <tr>
                    <td style={{ padding: "8px", fontSize: 12, fontWeight: "bold", borderTop: "1px solid #000" }}>TOTAL A PAGAR</td>
                    <td style={{ padding: "8px", fontSize: 12, fontWeight: "bold", textAlign: "right", borderTop: "1px solid #000" }}>{brl(comissaoTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
