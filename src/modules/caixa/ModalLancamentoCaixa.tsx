// src/modules/caixa/ModalLancamentoCaixa.tsx
// Modal "Novo Recebimento" — lança OS manualmente no PDV.
'use client'
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_SM, overlayModal, containerModal, inputAdmin, labelPadrao } from "@/lib/estiloGlobal";
import { FiX } from "react-icons/fi";
import { BANDEIRAS, FormLancar } from "./tipos";

interface Props {
  formLancar: FormLancar;
  setFormLancar: (f: FormLancar) => void;
  onSubmit: (e: any) => void;
  onClose: () => void;
}

export function ModalLancamentoCaixa({ formLancar, setFormLancar, onSubmit, onClose }: Props) {
  const inputStyle = inputAdmin;
  const labelStyle = labelPadrao;

  return (
    <div style={{ ...overlayModal }}>
      <div style={{ ...containerModal, padding: 32, width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Novo Recebimento</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight }}><FiX size={24} /></button>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Nome do Cliente</label>
            <input required style={inputStyle} value={formLancar.cliente}
              onChange={e => setFormLancar({ ...formLancar, cliente: e.target.value })}
              placeholder="Ex: Maria Silva" />
          </div>

          <div>
            <label style={labelStyle}>Valor Total Cobrado (R$)</label>
            <input type="number" step="0.01" required style={inputStyle} value={formLancar.valor}
              onChange={e => setFormLancar({ ...formLancar, valor: e.target.value })}
              placeholder="0.00" />
          </div>

          <div>
            <label style={labelStyle}>Forma de Pagamento</label>
            <select style={inputStyle} value={formLancar.forma}
              onChange={e => setFormLancar({ ...formLancar, forma: e.target.value, bandeira: '' })}>
              <option value="Pix">Pix</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>

          {formLancar.forma.includes('Cartão') && (
            <div>
              <label style={labelStyle}>Bandeira do Cartão *</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {BANDEIRAS.map(b => (
                  <button type="button" key={b}
                    onClick={() => setFormLancar({ ...formLancar, bandeira: b })}
                    style={{
                      padding: "6px 12px", borderRadius: RAIO_SM,
                      border: `1px solid ${C.borderMid}`,
                      background: formLancar.bandeira === b ? C.sidebarBg : C.bgCard,
                      color: formLancar.bandeira === b ? '#fff' : C.textMuted,
                      fontSize: 11, fontWeight: 700, cursor: "pointer"
                    }}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit"
            style={{ marginTop: 16, padding: "14px", background: C.success, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 800, cursor: "pointer", textTransform: "uppercase" }}>
            Registrar e Gerar OS
          </button>
        </form>
      </div>
    </div>
  );
}
