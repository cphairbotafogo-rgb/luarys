'use client'
/**
 * src/modules/equipe/modal/ModalAdiantamento.tsx
 * Modal de lançamento de vale/adiantamento salarial para um colaborador.
 */
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_2XL, SOMBRA_MODAL, overlayModal } from "@/lib/estiloGlobal";
import { FiX } from "react-icons/fi";
import { labelStyle, inputStyle } from "./estilosCompartilhados";

export function ModalAdiantamento({ formAdiantamento, setFormAdiantamento, processandoAdiantamento, lancarAdiantamento, onClose }: any) {
  return (
    <div style={{ ...overlayModal, zIndex: 1000 }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, boxShadow: SOMBRA_MODAL, padding: 32, width: "100%", maxWidth: 440, border: `1px solid ${C.border}` }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg, textTransform: "uppercase" }}>Adiantamento de Salário</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex" }}><FiX size={24} /></button>
        </div>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: C.textMuted, fontWeight: 500, lineHeight: 1.5 }}>Lançamento de Vale para <strong style={{ color: C.textMain }}>{formAdiantamento.profissional_nome}</strong>. O montante sairá do fluxo de caixa operacional.</p>

        <form onSubmit={lancarAdiantamento} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Valor do Vale (R$)</label>
            <input type="number" step="0.01" style={{ ...inputStyle, fontSize: 16, fontWeight: 700, color: C.success }} value={formAdiantamento.valor} onChange={e => setFormAdiantamento({ ...formAdiantamento, valor: e.target.value })} required autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Data da Emissão</label><input type="date" style={inputStyle} value={formAdiantamento.data} onChange={e => setFormAdiantamento({ ...formAdiantamento, data: e.target.value })} required /></div>
            <div><label style={labelStyle}>Competência</label><input type="month" style={{ ...inputStyle, background: C.bg, color: C.textLight }} value={formAdiantamento.data.substring(0, 7)} disabled /></div>
          </div>
          <div>
            <label style={labelStyle}>Observações de Auditoria</label>
            <input type="text" style={inputStyle} placeholder="Ex: Adiantamento referente à quinzena" value={formAdiantamento.observacao} onChange={e => setFormAdiantamento({ ...formAdiantamento, observacao: e.target.value })} />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button type="submit" style={{ flex: 2, padding: "14px", background: C.success, color: C.bgCard, border: "none", borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: "pointer" }} disabled={processandoAdiantamento}>
              {processandoAdiantamento ? "A processar..." : "Confirmar Lançamento"}
            </button>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "14px", background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
