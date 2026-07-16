'use client'
import { FiMessageCircle, FiX, FiZap } from "react-icons/fi";
import { C } from "@/lib/constants";
import { RAIO_LG, RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { ROTULOS_GATILHO } from "./constants";

interface Props {
  item: any;
  automacao: any | undefined;
  onEnviar: (item: any) => void;
  onIgnorar: (item: any) => void;
}

export function FilaItemCard({ item, automacao, onEnviar, onIgnorar }: Props) {
  const meta = ROTULOS_GATILHO[automacao?.gatilho] || { label: '', icone: FiZap, cor: C.sidebarBg };
  const Icone = meta.icone;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ width: 36, height: 36, borderRadius: RAIO_LG, background: `${meta.cor}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icone size={16} color={meta.cor} />
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.textMain }}>{item.cliente_nome}</p>
        <p style={{ margin: "2px 0 8px", fontSize: 11, color: C.textLight }}>{item.telefone} · {meta.label}</p>
        <p style={{ margin: 0, fontSize: 12, color: C.textMuted, background: C.bg, padding: "8px 12px", borderRadius: RAIO_MD, lineHeight: 1.5 }}>
          {item.mensagem}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={() => onEnviar(item)}
          style={{ background: "#25D366", color: "#fff", border: "none", padding: "8px 16px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <FiMessageCircle size={12} /> Abrir WhatsApp
        </button>
        <button onClick={() => onIgnorar(item)}
          style={{ background: "transparent", color: C.textLight, border: `1px solid ${C.borderMid}`, padding: "8px 16px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <FiX size={12} /> Ignorar
        </button>
      </div>
    </div>
  );
}
