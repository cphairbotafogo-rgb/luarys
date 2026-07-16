'use client'
/**
 * src/modules/equipe/modal/ModalLimitePlano.tsx
 * Modal de aviso quando o limite de profissionais do plano é atingido.
 */
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_2XL } from "@/lib/estiloGlobal";
import { FiAlertTriangle } from "react-icons/fi";

export function ModalLimitePlano({ mensagemLimite, onClose, onUpgrade }: any) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 24 }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, padding: 32, width: "100%", maxWidth: 420, border: `1px solid ${C.border}`, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: "#FFFBEB", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <FiAlertTriangle size={28} />
        </div>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: C.textMain, textTransform: "uppercase" }}>Limite de Profissionais Atingido</h3>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
          Você atingiu o limite de profissionais do seu plano. Para cadastrar ou ativar novas agendas, faça um upgrade.
        </p>
        {mensagemLimite && <p style={{ margin: "0 0 24px", fontSize: 11, color: C.textLight, fontStyle: "italic" }}>{mensagemLimite}</p>}
        <div style={{ display: "flex", gap: 12, marginTop: mensagemLimite ? 0 : 24 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "14px 0", fontSize: 12, background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>Voltar</button>
          <button type="button" onClick={onUpgrade} style={{ flex: 1, padding: "14px 0", fontSize: 12, background: C.sidebarBg, color: C.bgCard, border: "none", borderRadius: RAIO_MD, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>Fazer Upgrade</button>
        </div>
      </div>
    </div>
  );
}
