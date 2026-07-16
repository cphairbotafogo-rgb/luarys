// src/modules/relatorios/gavetas/comissoes/ModalRecalculo.tsx
// Modal de recálculo de comissões pendentes por profissional e data.
'use client'
import { C } from "@/lib/constants";
import { InputData } from "@/components/InputData";
import { RAIO_MD, RAIO_2XL, SOMBRA_MODAL, overlayModal } from "@/lib/estiloGlobal";
import { FiRefreshCw, FiInfo, FiX } from "react-icons/fi";

const inputStyle = { padding:"10px 14px", borderRadius:RAIO_MD, border:`1px solid ${C.borderMid}`, width:"100%", outlineColor: C.sidebarBg, fontSize: 13, color: C.textMain, backgroundColor: C.bgCard, fontWeight: 600, boxSizing: "border-box" as const };
const labelStyle = { margin:"0 0 6px", fontSize:10, fontWeight:700, color:C.textMuted, display:"flex", alignItems:"center", gap:6, textTransform:"uppercase" as const, letterSpacing:"0.5px" };

interface Props {
  profissionais: any[];
  dataRecalculo: string;
  setDataRecalculo: (v: string) => void;
  profissionaisRecalculo: string[];
  toggleProfissionalRecalculo: (id: string) => void;
  selecionarTodos: () => void;
  processando: boolean;
  onExecutar: () => void;
  onFechar: () => void;
}

export function ModalRecalculo({
  profissionais, dataRecalculo, setDataRecalculo,
  profissionaisRecalculo, toggleProfissionalRecalculo, selecionarTodos,
  processando, onExecutar, onFechar,
}: Props) {
  return (
    <div className="nao-imprimir" style={{ ...overlayModal, zIndex: 999 }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, width: 500, padding: 32, boxShadow: SOMBRA_MODAL }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8 }}>
            <FiRefreshCw size={18} /> Recalcular Comissões
          </h3>
          <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight }}><FiX size={24} /></button>
        </div>

        <div style={{ background: "#FEF2F2", border: `1px solid ${C.danger}`, padding: 12, borderRadius: RAIO_MD, marginBottom: 24, display: "flex", gap: 12 }}>
          <FiInfo color={C.danger} size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 12, color: C.danger, lineHeight: 1.5 }}>
            Esta funcionalidade recalcula todas as comissões <strong>pendentes</strong> dos profissionais selecionados a partir da data informada, com base nas <strong>regras atuais de cadastro</strong>.
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>A partir da data:</label>
          <InputData style={inputStyle} value={dataRecalculo} onChange={setDataRecalculo} />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ ...labelStyle, margin: 0 }}>Profissionais:</label>
            <button onClick={selecionarTodos} style={{ background: "none", border: "none", fontSize: 11, color: C.sidebarBg, fontWeight: 700, cursor: "pointer" }}>
              Selecionar Todos
            </button>
          </div>
          <div style={{ border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, maxHeight: 180, overflowY: "auto" }}>
            {profissionais.map(p => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} className="hover:bg-slate-50">
                <input type="checkbox" checked={profissionaisRecalculo.includes(p.id)} onChange={() => toggleProfissionalRecalculo(p.id)} style={{ accentColor: C.sidebarBg, width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>{p.nome}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
          <button onClick={onFechar} style={{ flex: 1, padding: "14px", background: "transparent", border: `1px solid ${C.borderMid}`, color: C.textMain, borderRadius: RAIO_MD, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={onExecutar} disabled={processando || profissionaisRecalculo.length === 0}
            style={{ flex: 1, padding: "14px", background: (processando || profissionaisRecalculo.length === 0) ? C.borderMid : C.danger, color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 700, fontSize: 13, cursor: (processando || profissionaisRecalculo.length === 0) ? "not-allowed" : "pointer" }}>
            {processando ? "Recalculando..." : "Aplicar Recálculo"}
          </button>
        </div>
      </div>
    </div>
  );
}
