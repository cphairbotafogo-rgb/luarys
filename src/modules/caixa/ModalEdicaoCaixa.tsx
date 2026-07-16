// src/modules/caixa/ModalEdicaoCaixa.tsx
// Modal de correção e estorno de lançamentos do PDV.
// Quatro modos internos: opcoes | forma | data | estorno.
'use client'
import { C, brl } from "@/lib/constants";
import { RAIO_MD, overlayModal, containerModal, containerModalPerigo, inputAdmin, labelPadrao } from "@/lib/estiloGlobal";
import { FiX, FiArrowLeft, FiLock, FiCreditCard, FiCalendar, FiAlertTriangle } from "react-icons/fi";
import { ModoCaixa, Transacao } from "./tipos";

interface Props {
  // modal de autorização (PIN)
  modalAutorizacao: Transacao | null;
  senhaGerente: string;
  setSenhaGerente: (v: string) => void;
  onAutorizar: (e: any) => void;
  onCancelarAutorizacao: () => void;
  // modal de edição
  modalEdicao: Transacao | null;
  modoCaixa: ModoCaixa;
  setModoCaixa: (m: ModoCaixa) => void;
  novaFormaPagamento: string;
  setNovaFormaPagamento: (v: string) => void;
  novaDataCaixa: string;
  setNovaDataCaixa: (v: string) => void;
  pinCaixaAcao: string;
  setPinCaixaAcao: (v: string) => void;
  motivoEstornoCaixa: string;
  setMotivoEstornoCaixa: (v: string) => void;
  onFechar: () => void;
  onSalvarForma: (e: any) => void;
  onSalvarData: () => void;
  onEstornar: () => void;
}

export function ModalEdicaoCaixa({
  modalAutorizacao, senhaGerente, setSenhaGerente, onAutorizar, onCancelarAutorizacao,
  modalEdicao, modoCaixa, setModoCaixa,
  novaFormaPagamento, setNovaFormaPagamento,
  novaDataCaixa, setNovaDataCaixa,
  pinCaixaAcao, setPinCaixaAcao,
  motivoEstornoCaixa, setMotivoEstornoCaixa,
  onFechar, onSalvarForma, onSalvarData, onEstornar,
}: Props) {
  const inputStyle = inputAdmin;
  const labelStyle = labelPadrao;

  return (
    <>
      {/* ── Modal de autorização por PIN ───────────────────────────────────── */}
      {modalAutorizacao && (
        <div style={{ ...overlayModal }}>
          <div style={{ ...containerModalPerigo, padding: 32, width: "100%", maxWidth: 400 }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: 28, background: "#FECACA", color: C.danger, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <FiLock size={28} />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 900, color: C.danger, textTransform: "uppercase" }}>Acesso Restrito</h3>
              <p style={{ margin: 0, fontSize: 13, color: C.textMuted, fontWeight: 500 }}>
                Apenas gestores podem alterar uma <strong>Ordem de Serviço</strong>. Peça ao gerente para digitar a senha.
              </p>
            </div>
            <form onSubmit={onAutorizar} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ ...labelStyle, color: C.danger }}>Senha do Gerente</label>
                <input type="password" required
                  style={{ ...inputStyle, borderColor: C.danger, textAlign: "center", letterSpacing: "4px", fontSize: 18 }}
                  value={senhaGerente} onChange={e => setSenhaGerente(e.target.value)}
                  placeholder="••••" autoFocus />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={onCancelarAutorizacao}
                  style={{ flex: 1, padding: "14px", background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: "pointer", textTransform: "uppercase" }}>
                  Cancelar
                </button>
                <button type="submit"
                  style={{ flex: 1, padding: "14px", background: C.danger, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: "pointer", textTransform: "uppercase" }}>
                  Desbloquear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de edição (4 modos) ──────────────────────────────────────── */}
      {modalEdicao && (
        <div style={{ ...overlayModal }}>
          <div style={{ ...containerModal, width: "100%", maxWidth: 420, overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {/* Cabeçalho */}
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#F8FAFC" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>PDV · Corrigir Lançamento</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.sidebarBg, marginTop: 4 }}>{modalEdicao.cliente_nome}</div>
                <div style={{ fontSize: 12, color: C.textLight }}>
                  {brl(modalEdicao.valor_total)}{modalEdicao.os_numero ? ` · OS ${modalEdicao.os_numero}` : ''}
                </div>
              </div>
              <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 4 }}>
                <FiX size={20} />
              </button>
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Opções iniciais */}
              {modoCaixa === 'opcoes' && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => setModoCaixa('forma')}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: RAIO_MD, cursor: "pointer", textAlign: "left" }}>
                    <FiCreditCard size={18} color="#0369A1" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0369A1" }}>Corrigir Forma de Pagamento</div>
                      <div style={{ fontSize: 11, color: "#0284C7", marginTop: 2 }}>Alterar PIX, cartão, dinheiro…</div>
                    </div>
                  </button>

                  <button onClick={() => { setPinCaixaAcao(''); setModoCaixa('data'); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: RAIO_MD, cursor: "pointer", textAlign: "left" }}>
                    <FiCalendar size={18} color="#D97706" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#D97706" }}>Corrigir Data do Pagamento</div>
                      <div style={{ fontSize: 11, color: "#B45309", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><FiLock size={10} /> Requer PIN do gerente</div>
                    </div>
                  </button>

                  <button onClick={() => { setPinCaixaAcao(''); setMotivoEstornoCaixa(''); setModoCaixa('estorno'); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: RAIO_MD, cursor: "pointer", textAlign: "left" }}>
                    <FiAlertTriangle size={18} color="#DC2626" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>Estornar Lançamento</div>
                      <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><FiLock size={10} /> Requer PIN do gerente</div>
                    </div>
                  </button>

                  <button onClick={onFechar}
                    style={{ padding: "11px", background: "transparent", color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, cursor: "pointer", fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                    Cancelar
                  </button>
                </div>
              )}

              {/* Corrigir forma de pagamento */}
              {modoCaixa === 'forma' && (
                <form onSubmit={onSalvarForma} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Nova Forma de Pagamento</label>
                    <select style={inputStyle} value={novaFormaPagamento} onChange={e => setNovaFormaPagamento(e.target.value)}>
                      <option value="Pix">Pix</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Cartão de Débito">Cartão de Débito</option>
                      <option value="Dinheiro">Dinheiro</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={() => setModoCaixa('opcoes')}
                      style={{ flex: 1, padding: "12px", background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <FiArrowLeft size={13} /> Voltar
                    </button>
                    <button type="submit"
                      style={{ flex: 1, padding: "12px", background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Salvar
                    </button>
                  </div>
                </form>
              )}

              {/* Corrigir data */}
              {modoCaixa === 'data' && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: RAIO_MD, padding: "10px 14px", fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                    Atenção: a data de movimentação será alterada no sistema financeiro.
                  </div>
                  <div>
                    <label style={labelStyle}>Nova Data de Pagamento</label>
                    <input type="date" style={inputStyle} value={novaDataCaixa}
                      max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                      onChange={e => setNovaDataCaixa(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}><FiLock size={11} /> PIN do Gerente</label>
                    <input type="password" placeholder="Digite o PIN" style={inputStyle}
                      value={pinCaixaAcao} onChange={e => setPinCaixaAcao(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && onSalvarData()} />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={() => setModoCaixa('opcoes')}
                      style={{ flex: 1, padding: "12px", background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <FiArrowLeft size={13} /> Voltar
                    </button>
                    <button onClick={onSalvarData} disabled={!novaDataCaixa || !pinCaixaAcao}
                      style={{ flex: 1, padding: "12px", background: !novaDataCaixa || !pinCaixaAcao ? C.borderMid : "#D97706", color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Salvar Data
                    </button>
                  </div>
                </div>
              )}

              {/* Estornar */}
              {modoCaixa === 'estorno' && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ background: "#FEF2F2", border: "1px dashed #FCA5A5", borderRadius: RAIO_MD, padding: "10px 14px", fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>
                    Esta ação é irreversível. O lançamento será marcado como Estornado.
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: "#991B1B" }}>Motivo do Estorno *</label>
                    <textarea placeholder="Ex: Cobrança duplicada, erro de valor…"
                      value={motivoEstornoCaixa} onChange={e => setMotivoEstornoCaixa(e.target.value)}
                      style={{ ...inputStyle, height: 68, resize: "none", borderColor: "#FCA5A5" } as any} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: "#991B1B", display: "flex", alignItems: "center", gap: 6 }}><FiLock size={11} /> PIN do Gerente *</label>
                    <input type="password" placeholder="Digite o PIN para autorizar"
                      style={{ ...inputStyle, borderColor: "#FCA5A5" }}
                      value={pinCaixaAcao} onChange={e => setPinCaixaAcao(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && onEstornar()} />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={() => setModoCaixa('opcoes')}
                      style={{ flex: 1, padding: "12px", background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <FiArrowLeft size={13} /> Voltar
                    </button>
                    <button onClick={onEstornar} disabled={!motivoEstornoCaixa.trim() || !pinCaixaAcao}
                      style={{ flex: 1, padding: "12px", background: !motivoEstornoCaixa.trim() || !pinCaixaAcao ? C.borderMid : "#DC2626", color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <FiAlertTriangle size={13} /> Estornar
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
