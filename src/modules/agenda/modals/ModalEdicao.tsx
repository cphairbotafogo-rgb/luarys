'use client'
import { C } from "@/lib/constants";
import { calcularStatusAniversario, montarMsgAniversario } from "@/lib/aniversarios";
import {
  FONTE_CORPO, RAIO_SM, RAIO_MD, RAIO_XL, RAIO_2XL,
  overlayModal, containerModal,
} from "@/lib/estiloGlobal";
import {
  FiX, FiCheck, FiMessageCircle, FiMail, FiUser, FiClock,
  FiAlertCircle, FiEdit2, FiDollarSign, FiZap, FiAlertTriangle, FiLock,
} from "react-icons/fi";
import { encontrarConflitosDeHorario, temConflitoPagamentoPortal } from "@/lib/agendaUtils";
import { useModalEdicao } from "./useModalEdicao";
import { SecaoDadosServico } from "./components/SecaoDadosServico";

export function ModalEdicao({
  editandoAg, setEditandoAg,
  clientesDb, profissionaisDb, servicosDb, etiquetasDb,
  indexTelefoneZap, setIndexTelefoneZap,
  mostrandoNovaEtiqueta, setMostrandoNovaEtiqueta,
  novaTag, setNovaTag,
  onClose, iniciarCancelamento, salvarEdicao, fecharContaComEdicao,
  abrirCadastroCliente, abrirHistoricoCliente,
  abrirWhatsApp, abrirEmail,
  removerEtiquetaDoAgendamento, adicionarEtiquetaAoAgendamento, salvarNovaEtiqueta,
  verificarAniversario,
  agendamentosExistentes,
  perfil,
  carregarDadosParaAgenda,
}: any) {

  const md = useModalEdicao(editandoAg, servicosDb, perfil, carregarDadosParaAgenda);

  const conflitosHorario = encontrarConflitosDeHorario({
    profissionalId: editandoAg.id_prof, data: editandoAg.data,
    hora: editandoAg.inicio, duracaoMin: Number(editandoAg.duracaoMin) || 60,
    agendamentos: agendamentosExistentes || [], ignorarId: editandoAg.id,
  });
  const conflitoPagamentoPortal = temConflitoPagamentoPortal(conflitosHorario);

  const inputStyle = {
    padding: "9px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
    width: "100%", boxSizing: "border-box" as const, outlineColor: C.sidebarBg,
    fontSize: 13, color: C.textMain, backgroundColor: C.bgCard, fontWeight: 500, fontFamily: FONTE_CORPO,
  };
  const labelStyle = {
    margin: "0 0 5px", fontSize: 10, fontWeight: 700, color: C.textMuted,
    display: "block", textTransform: "uppercase" as const, letterSpacing: "0.5px",
  };

  const cli = clientesDb.find((c: any) => c.nome_completo === editandoAg.cliente);

  return (
    <div className="font-body" style={{ ...overlayModal }}>
      <div style={{
        ...containerModal,
        width: "100%",
        maxWidth: 860,
        maxHeight: "95vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: 0,
      }}>

        {/* ── CABEÇALHO ──────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 24px", borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <h3 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8 }}>
            <FiEdit2 size={16} /> Detalhes do Agendamento
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex", opacity: 0.8 }}>
            <FiX size={22} />
          </button>
        </div>

        {/* ── CORPO: 2 colunas ───────────────────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "5fr 7fr",
          flex: 1,
          overflow: "hidden",
          minHeight: 0,
        }}>

          {/* ── COLUNA ESQUERDA: Cliente ────────────────────────────────── */}
          <div style={{
            padding: "16px 16px 16px 24px",
            borderRight: `1px solid ${C.border}`,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>

            {/* Nome + botões */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <label style={labelStyle}>Cliente</label>
                <p className="font-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.sidebarBg, lineHeight: 1.2 }}>{editandoAg.cliente}</p>
                {cli?.cpf && (
                  <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>
                    CPF: <strong style={{ color: C.textMain }}>{cli.cpf}</strong>
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={e => { e.preventDefault(); abrirCadastroCliente(); }} title="Editar Cadastro"
                  style={{ background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", color: C.textMuted }}>
                  <FiUser size={14} />
                </button>
                <button onClick={e => { e.preventDefault(); abrirHistoricoCliente(); }} title="Ver Histórico"
                  style={{ background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", color: C.textMuted }}>
                  <FiClock size={14} />
                </button>
              </div>
            </div>

            {/* Badge aniversário */}
            {cli?.nascimento && (() => {
              const info = calcularStatusAniversario(cli.nascimento, [], cli.id);
              if (!info) return null;
              const bg = info.status === 'hoje' ? '#FEF3C7' : info.status === 'alerta' ? '#FEF2F2' : '#EFF6FF';
              return (
                <div style={{ background: bg, border: `1px solid ${info.cor}40`, borderRadius: RAIO_MD, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{info.emoji}</span>
                    <div>
                      <p className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 10, fontWeight: 700, color: info.cor }}>{info.label}</p>
                      {info.status === 'hoje' && <p style={{ margin: "2px 0 0", fontSize: 10, color: info.cor, opacity: 0.8 }}>Comemore com ela! 🎉</p>}
                    </div>
                  </div>
                  {info.status === 'hoje' && cli?.telefone_whatsapp && (
                    <button
                      onClick={() => { const num = cli.telefone_whatsapp.replace(/\D/g, ""); window.open("https://wa.me/" + num + "?text=" + encodeURIComponent(montarMsgAniversario(cli.nome_completo, "nosso salão")), "_blank"); }}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "none", background: C.success, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <FiMessageCircle size={12} /> Parabéns
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Observações fixas */}
            {cli?.obs_fixa && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: RAIO_MD, padding: '10px 12px' }}>
                <FiAlertCircle size={13} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Obs. Fixas</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#92400E', fontWeight: 500, lineHeight: 1.4 }}>{cli.obs_fixa}</p>
                </div>
              </div>
            )}

            {/* Enviar mensagem */}
            <div>
              <label style={labelStyle}>Enviar Mensagem para</label>
              <select style={{ ...inputStyle }} value={indexTelefoneZap} onChange={e => setIndexTelefoneZap(Number(e.target.value))}>
                <option value={0}>{cli?.telefone_whatsapp ? `WhatsApp: ${cli.telefone_whatsapp}` : 'Número não cadastrado'}</option>
                {(cli?.telefones || []).map((t: any, i: number) => (
                  <option key={i + 1} value={i + 1}>{t.tipo}: +{t.ddi} ({t.ddd}) {t.numero}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={e => { e.preventDefault(); abrirWhatsApp(); }}
                style={{ flex: 1, background: C.success, color: "#fff", border: "none", padding: "10px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <FiMessageCircle size={14} /> WhatsApp
              </button>
              <button onClick={e => { e.preventDefault(); abrirEmail(); }}
                style={{ flex: 1, background: C.bgCard, color: C.textMain, border: `1px solid ${C.borderMid}`, padding: "10px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <FiMail size={14} /> E-mail
              </button>
            </div>

            {/* Etiquetas */}
            <div>
              <label style={labelStyle}>Etiquetas</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {editandoAg.etiquetas?.map((tag: any) => (
                  <span key={tag.id} style={{ background: tag.cor, color: "#fff", padding: "4px 10px", borderRadius: RAIO_2XL, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                    {tag.nome}
                    <button onClick={e => { e.preventDefault(); removerEtiquetaDoAgendamento(tag.id); }} style={{ background: "rgba(0,0,0,0.15)", border: "none", color: "#fff", borderRadius: "50%", width: 14, height: 14, fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                      <FiX size={10} />
                    </button>
                  </span>
                ))}
                <select style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: 11, background: "transparent", borderColor: C.sidebarBg, color: C.sidebarBg, fontWeight: 600, borderRadius: RAIO_2XL }}
                  value="" onChange={e => { if (e.target.value === "NOVA") setMostrandoNovaEtiqueta(true); else adicionarEtiquetaAoAgendamento(e.target.value); }}>
                  <option value="" disabled>+ Adicionar</option>
                  {etiquetasDb.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  <option value="NOVA">✨ Nova Etiqueta...</option>
                </select>
              </div>
              {mostrandoNovaEtiqueta && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, padding: 10, background: C.bgCard, borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}>
                  <input style={{ ...inputStyle, flex: 1, padding: "7px 10px" }} placeholder="Nome da Tag" value={novaTag.nome} onChange={e => setNovaTag({ ...novaTag, nome: e.target.value })} autoFocus />
                  <input type="color" style={{ width: 36, height: 36, padding: 0, border: "none", borderRadius: RAIO_SM, cursor: "pointer" }} value={novaTag.cor} onChange={e => setNovaTag({ ...novaTag, cor: e.target.value })} />
                  <button onClick={e => { e.preventDefault(); salvarNovaEtiqueta(); }} style={{ background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, padding: "0 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Salvar</button>
                  <button onClick={e => { e.preventDefault(); setMostrandoNovaEtiqueta(false); }} style={{ background: "transparent", color: C.textMuted, border: "none", cursor: "pointer", fontSize: 11 }}>✕</button>
                </div>
              )}
            </div>

            {/* Criado por */}
            {(editandoAg.criado_por || editandoAg.created_at) && (
              <div style={{ marginTop: "auto", padding: "8px 12px", background: C.bg, borderRadius: RAIO_MD, fontSize: 11, color: C.textLight, borderTop: `1px solid ${C.border}` }}>
                {editandoAg.criado_por && <>Por <strong style={{ color: C.textMuted }}>{editandoAg.criado_por}</strong></>}
                {editandoAg.created_at && <> · {new Date(editandoAg.created_at).toLocaleDateString("pt-BR")} às {new Date(editandoAg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>}
              </div>
            )}
          </div>

          {/* ── COLUNA DIREITA: Agendamento ─────────────────────────────── */}
          <div style={{
            padding: "16px 24px 16px 16px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>

            {/* Status */}
            <div>
              <label style={labelStyle}>Status do Agendamento</label>
              <select
                value={editandoAg.status || "Agendado"}
                onChange={e => setEditandoAg({ ...editandoAg, status: e.target.value })}
                style={{
                  ...inputStyle, fontWeight: 700,
                  color: editandoAg.status === "Aguardando" ? "#B45309" : editandoAg.status === "Em Atendimento" ? "#1D4ED8" : editandoAg.status === "Faltou" ? "#B91C1C" : editandoAg.status === "Finalizado" ? "#047857" : "#059669",
                  backgroundColor: editandoAg.status === "Aguardando" ? "#FEF3C7" : editandoAg.status === "Em Atendimento" ? "#DBEAFE" : editandoAg.status === "Faltou" ? "#FEE2E2" : editandoAg.status === "Finalizado" ? "#D1FAE5" : "#ECFDF5",
                  borderColor: editandoAg.status === "Aguardando" ? "#FDE68A" : editandoAg.status === "Em Atendimento" ? "#BFDBFE" : editandoAg.status === "Faltou" ? "#FECACA" : "#A7F3D0",
                }}>
                <option value="Aguardando">Aguardando Confirmação</option>
                <option value="Confirmado">Confirmado</option>
                <option value="Em Atendimento">Em Atendimento</option>
                <option value="Faltou">Cliente Faltou</option>
                <option value="Finalizado">Finalizado</option>
              </select>
            </div>

            {/* Encaixe */}
            <button type="button" onClick={() => setEditandoAg({ ...editandoAg, eh_encaixe: !editandoAg.eh_encaixe })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: RAIO_MD, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: editandoAg.eh_encaixe ? `${C.douradoEleva}1A` : C.bgCard, border: `1px solid ${editandoAg.eh_encaixe ? C.douradoEleva : C.borderMid}` }}>
              <span style={{ background: editandoAg.eh_encaixe ? C.douradoEleva : C.border, color: editandoAg.eh_encaixe ? "#2C3643" : C.textLight, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FiZap size={11} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: editandoAg.eh_encaixe ? C.douradoEleva : C.textMuted }}>
                {editandoAg.eh_encaixe ? "Marcado como Encaixe" : "Marcar como Encaixe"}
              </span>
            </button>

            {/* Alertas de conflito */}
            {conflitoPagamentoPortal && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px", borderRadius: RAIO_MD, background: "#FEF2F2", border: "1px solid #FCA5A5" }}>
                <FiLock size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#DC2626", lineHeight: 1.4 }}>
                  Horário bloqueado — pagamento de portal em andamento. Aguarde expirar ou cancele a reserva.
                </span>
              </div>
            )}
            {!conflitoPagamentoPortal && conflitosHorario.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: RAIO_MD, background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <FiAlertTriangle size={13} color="#B45309" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#92400E" }}>
                  {conflitosHorario.length === 1
                    ? `Profissional já tem ${conflitosHorario[0].cliente} às ${conflitosHorario[0].inicio}.`
                    : `Profissional já tem ${conflitosHorario.length} agendamentos neste horário.`}
                </span>
              </div>
            )}

            {/* Dados do serviço */}
            <SecaoDadosServico
              editandoAg={editandoAg}
              setEditandoAg={setEditandoAg}
              servicosDb={servicosDb}
              profissionaisDb={profissionaisDb}
              md={md}
            />
          </div>
        </div>

        {/* ── RODAPÉ ─────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 24px", borderTop: `1px solid ${C.border}`, flexShrink: 0,
          background: C.bgCard,
        }}>
          <button onClick={e => { e.preventDefault(); iniciarCancelamento(); }}
            style={{ background: "none", border: "none", color: C.danger, fontWeight: 600, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <FiAlertCircle size={15} /> Cancelar Agendamento
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={e => { e.preventDefault(); onClose(); }}
              style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: "pointer" }}>
              Fechar
            </button>
            <button
              onClick={e => {
                e.preventDefault();
                if (conflitoPagamentoPortal) return;
                if (conflitosHorario.length > 0) {
                  const prof = conflitosHorario[0];
                  const msg = conflitosHorario.length === 1
                    ? `Este profissional já tem "${prof.cliente}" às ${prof.inicio}. Salvar mesmo assim?`
                    : `Este profissional já tem ${conflitosHorario.length} agendamentos neste horário. Salvar mesmo assim?`;
                  if (!window.confirm(msg)) return;
                }
                salvarEdicao();
              }}
              style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, background: conflitoPagamentoPortal ? '#94A3B8' : conflitosHorario.length > 0 ? '#F59E0B' : C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, cursor: conflitoPagamentoPortal ? 'not-allowed' : 'pointer', display: "flex", alignItems: "center", gap: 6, opacity: conflitoPagamentoPortal ? 0.6 : 1 }}>
              {conflitoPagamentoPortal ? <FiLock size={14} /> : <FiCheck size={14} />}
              {conflitoPagamentoPortal ? 'Bloqueado' : conflitosHorario.length > 0 ? 'Salvar com Conflito' : 'Salvar'}
            </button>
            <button disabled={md.salvandoEFechando}
              onClick={async e => { e.preventDefault(); md.setSalvandoEFechando(true); try { await fecharContaComEdicao(); } finally { md.setSalvandoEFechando(false); } }}
              style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700, background: md.salvandoEFechando ? "#6EE7B7" : "#10B981", color: "#fff", border: "none", borderRadius: RAIO_MD, cursor: md.salvandoEFechando ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <FiDollarSign size={16} /> {md.salvandoEFechando ? "Salvando..." : "Fechar Conta"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
