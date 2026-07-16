'use client'
import React from "react";
import { FiCheck, FiLoader, FiZap } from "react-icons/fi";
import { C } from "@/lib/constants";
import { RAIO_LG, RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { ROTULOS_GATILHO, PLACEHOLDERS_POR_GATILHO } from "./constants";

interface Props {
  automacao: any;
  salvandoId: string | null;
  textareaRefs: React.MutableRefObject<Record<string, HTMLTextAreaElement | null>>;
  onToggle: (a: any) => void;
  onCampoChange: (id: string, campo: string, valor: any) => void;
  onSalvar: (a: any) => void;
  onInserirVariavel: (autoId: string, variavel: string, template: string) => void;
}

export function AutomacaoCard({ automacao: a, salvandoId, textareaRefs, onToggle, onCampoChange, onSalvar, onInserirVariavel }: Props) {
  const meta = ROTULOS_GATILHO[a.gatilho] || { label: a.gatilho, icone: FiZap, cor: C.sidebarBg };
  const Icone = meta.icone;
  const placeholders = PLACEHOLDERS_POR_GATILHO[a.gatilho] || [];

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: RAIO_LG, background: `${meta.cor}1A`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone size={18} color={meta.cor} />
          </div>
          <div>
            <input value={a.nome} onChange={e => onCampoChange(a.id, 'nome', e.target.value)}
              style={{ fontSize: 14, fontWeight: 800, color: C.textMain, border: "none", outline: "none", fontFamily: "var(--font-body)", background: "transparent", padding: 0 }} />
            <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textLight, textTransform: "uppercase", fontWeight: 700 }}>{meta.label}</p>
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11, fontWeight: 700, color: a.ativo ? C.success : C.textLight, textTransform: "uppercase" }}>
          <input type="checkbox" checked={!!a.ativo} onChange={() => onToggle(a)} style={{ accentColor: C.success, width: 16, height: 16, cursor: "pointer" }} />
          {a.ativo ? "Ativa" : "Inativa"}
        </label>
      </div>

      {a.gatilho === 'cliente_inativo' && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Disparar quando o cliente não vem há (dias)
          </label>
          <input type="number" min={1} value={a.dias_inatividade ?? 30}
            onChange={e => onCampoChange(a.id, 'dias_inatividade', e.target.value)}
            style={{ width: 100, padding: "8px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, fontFamily: "var(--font-body)" }} />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
          Modelo da Mensagem
        </label>
        <textarea
          ref={el => { textareaRefs.current[a.id] = el; }}
          value={a.mensagem_template}
          onChange={e => onCampoChange(a.id, 'mensagem_template', e.target.value)}
          style={{ width: "100%", height: 100, padding: "12px 16px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, fontFamily: "var(--font-body)", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
        />
        {placeholders.length > 0 && (
          <div style={{ background: "#F8FAFC", border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: "10px 14px", marginTop: 10 }}>
            <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Variáveis disponíveis</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {placeholders.map(p => (
                <button key={p.var} type="button" title={p.desc}
                  onClick={() => onInserirVariavel(a.id, p.var, a.mensagem_template || '')}
                  style={{ background: "#EFF6FF", color: "#3B82F6", border: "1px solid #BFDBFE", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-body)" }}>
                  {p.var}
                </button>
              ))}
            </div>
            {a.gatilho === 'aniversario' && (
              <p style={{ margin: "6px 0 0", fontSize: 11, color: C.textMuted }}>
                Dica: use emojis 🎂🎉💛 para tornar a mensagem mais especial.
              </p>
            )}
            {a.gatilho === 'cliente_inativo' && (
              <p style={{ margin: "6px 0 0", fontSize: 11, color: C.textMuted }}>
                <strong>{'{dias_ausente}'}</strong> e <strong>{'{ultimo_servico}'}</strong> são preenchidos automaticamente na hora do envio.
              </p>
            )}
          </div>
        )}
      </div>

      <button onClick={() => onSalvar(a)} disabled={salvandoId === a.id}
        style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "10px 20px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
        {salvandoId === a.id ? <FiLoader className="animate-spin" size={14} /> : <FiCheck size={14} />} Salvar
      </button>
    </div>
  );
}
