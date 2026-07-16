'use client'
import { C } from "@/lib/constants";
import { FONTE_CORPO, FONTE_TITULO } from "./estiloPortal";
import { RAIO_SM, RAIO_MD, RAIO_XL, RAIO_2XL } from "@/lib/estiloGlobal";
import { FiX, FiClock, FiStar } from "react-icons/fi";

export function ModalHistorico({ modalAberto, fecharModal, carregando, historico, onAvaliar }: any) {
  if (!modalAberto) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24, fontFamily: FONTE_CORPO }}>
      <div style={{ background: C.bgCard, width: "100%", maxWidth: 580, maxHeight: "85vh", borderRadius: RAIO_2XL, padding: "32px 32px 0", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", border: `1px solid ${C.border}`, borderTop: `4px solid ${C.douradoEleva}`, overflow: "hidden" }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 15, fontWeight: 700, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <FiClock size={18} /> Histórico de Procedimentos
          </h3>
          <button onClick={fecharModal} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, opacity: 0.8, display: "flex" }}><FiX size={24} /></button>
        </div>

        {/* Lista de Registros */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 32, display: "flex", flexDirection: "column", gap: 12, paddingRight: 4 }}>
          {carregando ? (
            <div style={{ fontFamily: FONTE_TITULO, textAlign: "center", color: C.textLight, padding: 40, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              A carregar histórico de visitas... ⏳
            </div>
          ) : historico.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13, fontStyle: "italic" }}>
              Nenhum registro encontrado em sua conta.
            </div>
          ) : historico.map((ag: any) => {
            const isConcluido = ag?.status === 'Concluído' || ag?.status === 'Finalizado';
            return (
              <div key={ag?.id} style={{ padding: "16px 20px", border: `1px solid ${C.border}`, borderRadius: RAIO_XL, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: C.bg }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 14, fontWeight: 700, color: C.textMain }}>
                    {ag?.servicos?.nome_servico || "Procedimento Clínico"}
                  </h4>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
                    {ag?.data?.split('-').reverse().join('/')} às {ag?.inicio?.substring(0, 5)}
                    {ag?.nome_salao && <span style={{ color: C.textLight }}> · {ag.nome_salao}</span>}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {isConcluido && onAvaliar && (
                    <button onClick={() => { onAvaliar(ag); fecharModal(); }} className="transition-all hover:opacity-80" style={{ background: `${C.douradoEleva}1A`, border: `1px solid ${C.douradoEleva}`, color: C.douradoEleva, padding: "5px 10px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <FiStar size={11} /> Avaliar
                    </button>
                  )}
                  <span style={{ fontFamily: FONTE_TITULO, background: isConcluido ? '#F4F8F5' : '#FEF2F2', color: isConcluido ? '#047857' : C.danger, border: `1px solid ${isConcluido ? '#E8F0EA' : '#FECACA'}`, padding: "4px 10px", borderRadius: RAIO_SM, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {ag?.status || "Confirmado"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
