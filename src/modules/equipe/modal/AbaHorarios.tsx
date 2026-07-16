'use client'
/**
 * src/modules/equipe/modal/AbaHorarios.tsx
 * Aba de escala semanal de horários e intervalos.
 */
import { C } from "@/lib/constants";
import { RAIO_XL } from "@/lib/estiloGlobal";
import { inputStyle } from "./estilosCompartilhados";

export function AbaHorarios({ form, atualizarHorario }: any) {
  return (
    <div>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Defina a escala de horários operacionais e os intervalos do colaborador.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Object.keys(form.horarios).map(dia => (
          <div key={dia} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", border: `1px solid ${C.border}`, borderRadius: RAIO_XL, background: form.horarios[dia].ativo ? C.bgCard : C.bg }}>
            <label style={{ display: "flex", alignItems: "center", gap: 12, width: 110, cursor: "pointer" }}>
              <input type="checkbox" checked={form.horarios[dia].ativo} onChange={(e) => atualizarHorario(dia, 'ativo', e.target.checked)} style={{ accentColor: C.sidebarBg, width: 16, height: 16 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: form.horarios[dia].ativo ? C.sidebarBg : C.textLight }}>{dia}</span>
            </label>
            {form.horarios[dia].ativo ? (
              <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Turno:</span>
                  <input type="time" style={{ ...inputStyle, width: 90, padding: "8px" }} value={form.horarios[dia].entrada} onChange={(e) => atualizarHorario(dia, 'entrada', e.target.value)} />
                  <span style={{ color: C.textLight, fontSize: 12, fontWeight: 500 }}>às</span>
                  <input type="time" style={{ ...inputStyle, width: 90, padding: "8px" }} value={form.horarios[dia].saida} onChange={(e) => atualizarHorario(dia, 'saida', e.target.value)} />
                </div>
                <div style={{ width: 1, height: 20, background: C.borderMid }}></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Intervalo:</span>
                  <input type="time" style={{ ...inputStyle, width: 90, padding: "8px" }} value={form.horarios[dia].almocoEntrada} onChange={(e) => atualizarHorario(dia, 'almocoEntrada', e.target.value)} />
                  <span style={{ color: C.textLight, fontSize: 12, fontWeight: 500 }}>às</span>
                  <input type="time" style={{ ...inputStyle, width: 90, padding: "8px" }} value={form.horarios[dia].almocoSaida} onChange={(e) => atualizarHorario(dia, 'almocoSaida', e.target.value)} />
                </div>
              </div>
            ) : <span style={{ fontSize: 12, color: C.textLight, fontStyle: "italic", fontWeight: 500 }}>Escala de Folga</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
