// src/modules/relatorios/gavetas/comissoes/ModalAjuste.tsx
// Modal para lançar recebíveis e abatimentos manuais de comissão.
'use client'
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_2XL, SOMBRA_MODAL, overlayModal } from "@/lib/estiloGlobal";
import { FiPlus, FiX } from "react-icons/fi";
import { FormExtra } from "./tipos";

const inputStyle = { padding:"10px 14px", borderRadius:RAIO_MD, border:`1px solid ${C.borderMid}`, width:"100%", outlineColor: C.sidebarBg, fontSize: 13, color: C.textMain, backgroundColor: C.bgCard, fontWeight: 600, boxSizing: "border-box" as const };
const labelStyle = { margin:"0 0 6px", fontSize:10, fontWeight:700, color:C.textMuted, display:"flex", alignItems:"center", gap:6, textTransform:"uppercase" as const, letterSpacing:"0.5px" };

interface Props {
  profissionais: any[];
  formExtra: FormExtra;
  setFormExtra: (f: FormExtra) => void;
  salvando: boolean;
  onSalvar: () => void;
  onFechar: () => void;
}

export function ModalAjuste({ profissionais, formExtra, setFormExtra, salvando, onSalvar, onFechar }: Props) {
  return (
    <div className="nao-imprimir" style={{ ...overlayModal, zIndex: 999 }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, width: 480, padding: 32, boxShadow: SOMBRA_MODAL }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8 }}>
            <FiPlus size={18} /> Lançar Ajuste de Comissão
          </h3>
          <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight }}><FiX size={24} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Profissional</label>
            <select style={{ ...inputStyle, cursor: "pointer" }} value={formExtra.profissional_id} onChange={e => setFormExtra({ ...formExtra, profissional_id: e.target.value })}>
              <option value="">Selecione o profissional...</option>
              {profissionais.filter(p => p.ativo !== false).map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Tipo de Ajuste</label>
            <div style={{ display: "flex", gap: 12 }}>
              {([['recebivel', 'Recebível', '#065F46', '#D1FAE5'], ['abatimento', 'Abatimento', C.danger, '#FEE2E2']] as const).map(([v, label, cor, bg]) => (
                <label key={v} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "12px 16px", borderRadius: RAIO_MD, border: `2px solid ${formExtra.tipo === v ? cor : C.borderMid}`, background: formExtra.tipo === v ? bg : "#fff" }}>
                  <input type="radio" name="tipo-extra" checked={formExtra.tipo === v} onChange={() => setFormExtra({ ...formExtra, tipo: v as 'recebivel' | 'abatimento' })} style={{ accentColor: cor }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: formExtra.tipo === v ? cor : C.textMain }}>{label}</span>
                </label>
              ))}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              {formExtra.tipo === 'recebivel' ? 'Recebível aumenta a comissão do profissional (ex: gorjeta, bônus).' : 'Abatimento reduz a comissão do profissional (ex: vale, desconto de uniforme).'}
            </p>
          </div>

          <div>
            <label style={labelStyle}>Descrição</label>
            <input type="text" style={inputStyle} placeholder="Ex: Gorjeta especial, Desconto uniforme..." value={formExtra.descricao} onChange={e => setFormExtra({ ...formExtra, descricao: e.target.value })} />
          </div>

          <div>
            <label style={labelStyle}>Valor (R$)</label>
            <input type="number" min="0.01" step="0.01" style={inputStyle} placeholder="0,00" value={formExtra.valor} onChange={e => setFormExtra({ ...formExtra, valor: e.target.value })} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <button onClick={onFechar} style={{ flex: 1, padding: "14px", background: "transparent", border: `1px solid ${C.borderMid}`, color: C.textMain, borderRadius: RAIO_MD, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={onSalvar} disabled={salvando}
            style={{ flex: 1, padding: "14px", background: salvando ? C.borderMid : C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 700, fontSize: 13, cursor: salvando ? "not-allowed" : "pointer" }}>
            {salvando ? "Salvando..." : "Confirmar Lançamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
