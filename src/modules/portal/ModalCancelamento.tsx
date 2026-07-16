'use client'
import { C } from "@/lib/constants";
import { FONTE_CORPO, FONTE_TITULO } from "./estiloPortal";
import { RAIO_MD, RAIO_LG, RAIO_2XL } from "@/lib/estiloGlobal";
import { FiX, FiAlertTriangle } from "react-icons/fi";

export function ModalCancelamento({ modalAberto, fecharModal, permiteCancelamentoGratuito, cienteCancelamento, setCienteCancelamento, confirmarCancelamentoAgendamento, cancelandoAgendamento }: any) {
  if (!modalAberto) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24, fontFamily: FONTE_CORPO }}>
      <div style={{ background: C.bgCard, width: "100%", maxWidth: 420, borderRadius: RAIO_2XL, padding: 32, display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", borderTop: `4px solid ${C.danger}` }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 14, fontWeight: 700, color: C.danger, display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <FiAlertTriangle size={18} /> Cancelar Reserva?
          </h3>
          <button onClick={fecharModal} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, opacity: 0.8, display: "flex" }}><FiX size={24} /></button>
        </div>

        {/* Políticas Baseadas em Regras de Negócio */}
        {permiteCancelamentoGratuito ? (
          <div style={{ background: "#F4F8F5", padding: 16, borderRadius: RAIO_LG, border: "1px solid #E8F0EA", marginBottom: 24 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#3B4A3F", lineHeight: 1.5, fontWeight: 500 }}>
              <strong style={{ color: "#10B981" }}>Cancelamento no Prazo:</strong> O valor do seu sinal de reserva será integralmente revertido em créditos ou estornado, pois cumpre as diretrizes de antecedência.
            </p>
          </div>
        ) : (
          <div style={{ background: "#FEF2F2", padding: 16, borderRadius: RAIO_LG, border: "1px solid #FECACA", marginBottom: 24 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#991B1B", lineHeight: 1.5, fontWeight: 500 }}>
              <strong style={{ color: C.danger }}>Fora do Prazo:</strong> Faltam menos de 24 horas para o atendimento marcado. Conforme regulamento, o valor do sinal retém-se como garantia administrativa (Art. 418 CC).
            </p>
          </div>
        )}

        {/* Checkbox de Aceite */}
        <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", marginBottom: 28 }}>
          <input
            type="checkbox"
            checked={cienteCancelamento}
            onChange={e => setCienteCancelamento(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 1, accentColor: C.danger }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.textMain, lineHeight: 1.4 }}>Estou ciente das regras e quero prosseguir.</span>
        </label>

        {/* Botão de Disparo */}
        <button
          onClick={confirmarCancelamentoAgendamento}
          disabled={!cienteCancelamento || cancelandoAgendamento}
          className="uppercase tracking-wider transition-all"
          style={{
            fontFamily: FONTE_TITULO,
            width: "100%", padding: 14,
            background: cienteCancelamento ? C.danger : C.borderMid,
            color: "#fff", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, border: "none",
            cursor: (!cienteCancelamento || cancelandoAgendamento) ? "not-allowed" : "pointer"
          }}
        >
          {cancelandoAgendamento ? "A processar..." : "Confirmar Cancelamento"}
        </button>

      </div>
    </div>
  );
}
