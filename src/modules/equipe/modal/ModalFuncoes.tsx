'use client'
/**
 * src/modules/equipe/modal/ModalFuncoes.tsx
 * Modal rápido de gestão do catálogo de funções/cargos corporativos.
 */
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_2XL, SOMBRA_MODAL, overlayModal } from "@/lib/estiloGlobal";
import { FiX } from "react-icons/fi";
import { inputStyle } from "./estilosCompartilhados";

export function ModalFuncoes({ listaFuncoes, novaFuncaoTexto, setNovaFuncaoTexto, adicionarNovaFuncaoDB, deletarFuncaoDB, onClose }: any) {
  return (
    <div style={{ ...overlayModal, zIndex: 9999 }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, boxShadow: SOMBRA_MODAL, padding: 32, width: "100%", maxWidth: 420, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg, textTransform: "uppercase" }}>Gerenciar Funções</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex" }}><FiX size={24} /></button>
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: C.textMuted, fontWeight: 500, lineHeight: 1.5 }}>Essas nomenclaturas estarão disponíveis nas fichas de contratação da equipe.</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Escreva a nova função..." value={novaFuncaoTexto} onChange={e => setNovaFuncaoTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') adicionarNovaFuncaoDB() }} />
          <button onClick={adicionarNovaFuncaoDB} style={{ padding: "0 16px", background: C.sidebarBg, color: C.bgCard, border: "none", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "uppercase" }}>Adicionar</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto", paddingRight: 4 }}>
          {listaFuncoes.length === 0 && <span style={{ fontSize: 12, color: C.textLight, fontStyle: "italic", fontWeight: 500 }}>Nenhuma função registrada.</span>}
          {listaFuncoes.map((f: any) => (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: C.bg, borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>{f.nome}</span>
              <button onClick={() => deletarFuncaoDB(f.id)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontWeight: "bold", fontSize: 14, display: "flex", padding: 4 }} className="hover:scale-105 transition-transform"><FiX size={14}/></button>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width: "100%", marginTop: 24, padding: "12px 0", background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Fechar</button>
      </div>
    </div>
  );
}
