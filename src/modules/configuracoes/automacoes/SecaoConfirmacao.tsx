'use client'
import React from "react";
import { FiCalendar, FiCheck, FiLoader, FiRotateCcw } from "react-icons/fi";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { DICA_PLACEHOLDERS } from "./constants";

interface Props {
  msgConfirmacao: string;
  setMsgConfirmacao: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onInserir: (variavel: string) => void;
  salvando: boolean;
  onSalvar: () => void;
  onRestaurar: () => void;
}

export function SecaoConfirmacao({ msgConfirmacao, setMsgConfirmacao, textareaRef, onInserir, salvando, onSalvar, onRestaurar }: Props) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 24, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: RAIO_LG, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FiCalendar size={18} color="#3B82F6" />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.textMain }}>Confirmação de Agendamento</h4>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textLight }}>Mensagem enviada diretamente do agendamento (agenda)</p>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
          Modelo da mensagem
        </label>
        <textarea
          ref={textareaRef}
          value={msgConfirmacao}
          onChange={e => setMsgConfirmacao(e.target.value)}
          rows={9}
          style={{ width: "100%", padding: "12px 16px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, fontFamily: "var(--font-body)", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
        />
      </div>

      <div style={{ background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: "10px 14px", marginBottom: 14 }}>
        <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Variáveis disponíveis</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {DICA_PLACEHOLDERS.map(p => (
            <button key={p.var} type="button" title={`Clique para inserir: ${p.desc}`} onClick={() => onInserir(p.var)}
              style={{ background: "#EFF6FF", color: "#3B82F6", border: "1px solid #BFDBFE", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-body)" }}>
              {p.var}
            </button>
          ))}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: C.textMuted }}>
          A linha com <strong>{'{profissional}'}</strong> é removida automaticamente se o agendamento não tiver profissional.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onSalvar} disabled={salvando}
          style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "10px 20px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          {salvando ? <FiLoader className="animate-spin" size={14} /> : <FiCheck size={14} />} Salvar
        </button>
        <button onClick={onRestaurar} title="Restaurar mensagem padrão"
          style={{ background: "transparent", color: C.textLight, border: `1px solid ${C.borderMid}`, padding: "10px 16px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <FiRotateCcw size={13} /> Restaurar Padrão
        </button>
      </div>
    </div>
  );
}
