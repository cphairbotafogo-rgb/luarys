'use client'
import { useState } from "react";
import { C } from "@/lib/constants";
import { FONTE_CORPO, FONTE_TITULO } from "./estiloPortal";
import { RAIO_MD, RAIO_2XL } from "@/lib/estiloGlobal";
import { FiX, FiActivity, FiSave, FiShield } from "react-icons/fi";

export function ModalAnamnese({ modalAberto, fecharModal, salvando, dadosAnamnese, setDadosAnamnese, salvarFichaTecnica }: any) {
  const [consentiu, setConsentiu] = useState(false);
  if (!modalAberto) return null;

  const inputStyle = {
    width: "100%", padding: 14, borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
    boxSizing: "border-box" as const, fontSize: 13, color: C.textMain,
    outlineColor: C.sidebarBg, fontFamily: FONTE_CORPO, fontWeight: 500
  };
  const labelStyle = {
    fontFamily: FONTE_TITULO,
    fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block",
    margin: "0 0 6px", textTransform: "uppercase" as const, letterSpacing: "0.5px"
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24, fontFamily: FONTE_CORPO }}>
      <div style={{ background: C.bgCard, width: "100%", maxWidth: 550, maxHeight: "85vh", borderRadius: RAIO_2XL, padding: "32px 32px 0", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden", border: `1px solid ${C.border}`, borderTop: `4px solid ${C.douradoEleva}` }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 15, fontWeight: 700, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <FiActivity size={18} /> Ficha Técnica / Anamnese
          </h3>
          <button onClick={fecharModal} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, opacity: 0.8, display: "flex" }}><FiX size={24} /></button>
        </div>

        {/* Formulário */}
        <form onSubmit={salvarFichaTecnica} style={{ flex: 1, overflowY: "auto", paddingBottom: 32, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Consentimento LGPD — obrigatório antes de preencher */}
          <div style={{ background: "#F0F4FF", border: "1px solid #C7D7F5", borderRadius: RAIO_MD, padding: "14px 16px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
              <FiShield size={13} style={{ verticalAlign: "middle", marginRight: 4, color: "#4B6CB7" }} />
              Os dados de saúde coletados neste formulário são considerados <strong>dados sensíveis</strong> pela LGPD (Lei 13.709/2018) e serão usados exclusivamente pelo salão para personalizar os serviços prestados a você. Você pode revogar este consentimento a qualquer momento solicitando a exclusão da sua ficha.
            </p>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consentiu}
                onChange={e => setConsentiu(e.target.checked)}
                style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0, cursor: "pointer", accentColor: C.sidebarBg }}
              />
              <span style={{ fontSize: 12, color: "#111827", lineHeight: 1.5, fontWeight: 600 }}>
                Consinto com o tratamento dos meus dados de saúde para a finalidade descrita acima.
              </span>
            </label>
          </div>

          <div>
            <label style={labelStyle}>Qual o seu tipo de pele / cabelo?</label>
            <input type="text" value={dadosAnamnese.tipo_cabelo} onChange={e => setDadosAnamnese({...dadosAnamnese, tipo_cabelo: e.target.value})} style={inputStyle} placeholder="Ex: Pele sensível, cabelos com química..." />
          </div>
          <div>
            <label style={labelStyle}>Possui alergia a algum produto ou componente?</label>
            <textarea rows={3} value={dadosAnamnese.alergias} onChange={e => setDadosAnamnese({...dadosAnamnese, alergias: e.target.value})} style={{ ...inputStyle, resize: "none" }} placeholder="Ex: Alergia a amônia, parabenos ou esmaltes específicos..." />
          </div>

          <button
            type="submit"
            disabled={salvando || !consentiu}
            className="uppercase tracking-wider transition-all hover:opacity-95"
            style={{ fontFamily: FONTE_TITULO, width: "100%", padding: 14, background: consentiu ? C.sidebarBg : C.border, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: salvando || !consentiu ? "not-allowed" : "pointer", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <FiSave size={16} /> {salvando ? "A salvar dados..." : "Salvar Ficha Técnica"}
          </button>
        </form>

      </div>
    </div>
  );
}
