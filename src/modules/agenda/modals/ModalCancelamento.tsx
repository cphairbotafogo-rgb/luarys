import { C } from "@/lib/constants";
import { inputAdmin, labelPadrao, containerModalPerigo, overlayModal, RAIO_MD, RAIO_SM, FONTE_CORPO } from "@/lib/estiloGlobal";
import { FiAlertTriangle } from "react-icons/fi";

export function ModalCancelamento({ editandoAg, dadosCancelamento, setDadosCancelamento, confirmarCancelamento, onClose }: any) {
  const inputStyle = { ...inputAdmin, outlineColor: C.danger };
  const labelStyle = { ...labelPadrao };
  const tipoAcao = dadosCancelamento.tipoAcao || 'cancelado';

  return (
    <div className="font-body" style={{ ...overlayModal, zIndex: 1000 }}>
      <div style={{ ...containerModalPerigo, padding: 32, width: "100%", maxWidth: 450 }}>

        <h3 className="font-title uppercase tracking-widest" style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: C.danger, display: "flex", alignItems: "center", gap: 10 }}>
          <FiAlertTriangle size={20} /> O que aconteceu?
        </h3>

        <p style={{ margin: "0 0 20px", fontSize: 13, color: C.textMuted, fontWeight: 500, lineHeight: 1.5 }}>
          <strong style={{ color: C.textMain }}>{editandoAg?.cliente}</strong> — {editandoAg?.servico}
        </p>

        {/* Tipo: Cancelado ou Faltou */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { valor: 'cancelado', label: 'Cancelamento', desc: 'Cliente avisou com antecedência' },
            { valor: 'faltou',    label: 'Cliente Faltou', desc: 'Não apareceu sem aviso (no-show)' },
          ].map(op => (
            <button key={op.valor}
              onClick={() => setDadosCancelamento({ ...dadosCancelamento, tipoAcao: op.valor })}
              className="transition-all"
              style={{
                padding: "12px 10px", borderRadius: RAIO_MD, cursor: "pointer", textAlign: 'left' as const,
                background: tipoAcao === op.valor ? C.dangerBg : C.bg,
                border: `1px solid ${tipoAcao === op.valor ? "#FCA5A5" : C.borderMid}`,
                fontFamily: FONTE_CORPO,
              }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: tipoAcao === op.valor ? C.dangerText : C.textMain }}>
                {op.label}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{op.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {tipoAcao === 'cancelado' && (
            <div>
              <label className="font-title" style={{ ...labelStyle, color: C.textMain }}>Quem solicitou? *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                {['Cliente', 'Profissional', 'Estabelecimento'].map(opcao => (
                  <button key={opcao} onClick={() => setDadosCancelamento({ ...dadosCancelamento, quem: opcao })}
                    className="transition-all"
                    style={{
                      padding: "10px 4px", fontSize: 11, fontWeight: 600, borderRadius: RAIO_MD, cursor: "pointer",
                      background: dadosCancelamento.quem === opcao ? C.dangerBg : C.bg,
                      color: dadosCancelamento.quem === opcao ? C.dangerText : C.textMuted,
                      border: `1px solid ${dadosCancelamento.quem === opcao ? "#FCA5A5" : C.borderMid}`,
                      fontFamily: FONTE_CORPO,
                    }}>
                    {opcao}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="font-title" style={{ ...labelStyle, color: C.textMain }}>
              {tipoAcao === 'faltou' ? 'Observação (opcional)' : 'Motivo *'}
            </label>
            <textarea
              placeholder={tipoAcao === 'faltou' ? 'Ex: Tentei contato, sem retorno...' : 'Ex: Imprevisto médico, remarcação de viagem...'}
              value={dadosCancelamento.motivo}
              onChange={e => setDadosCancelamento({ ...dadosCancelamento, motivo: e.target.value })}
              style={{ ...inputStyle, height: 80, resize: "none" as const }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button onClick={confirmarCancelamento} className="transition-all hover:opacity-90"
            style={{ flex: 2, padding: "12px 0", fontSize: 13, fontWeight: 600, background: C.danger, color: "#fff", border: "none", borderRadius: RAIO_MD, cursor: "pointer" }}>
            {tipoAcao === 'faltou' ? 'Registrar Falta' : 'Confirmar Cancelamento'}
          </button>
          <button onClick={onClose} className="transition-all hover:bg-slate-50"
            style={{ flex: 1, padding: "12px 0", fontSize: 13, fontWeight: 600, background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: "pointer" }}>
            Voltar
          </button>
        </div>

      </div>
    </div>
  );
}
