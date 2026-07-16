'use client'
import { useState, useRef, useEffect } from "react";
import { C } from "@/lib/constants";
import { RAIO_LG, RAIO_MD } from "@/lib/estiloGlobal";
import type { ContratoAtivo } from "@/hooks/useVerificarTermos";

interface Props {
  contrato: ContratoAtivo;
  aceitando: boolean;
  onAceitar: () => void;
}

export function ModalTermosAceite({ contrato, aceitando, onAceitar }: Props) {
  const [concordo, setConcordo]       = useState(false);
  const [leuFim, setLeuFim]           = useState(false);
  const conteudoRef                   = useRef<HTMLDivElement>(null);

  // Detecta quando o usuário rolou até o final
  useEffect(() => {
    const el = conteudoRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const chegouFim = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
      if (chegouFim) setLeuFim(true);
    }
    el.addEventListener("scroll", onScroll);
    // Se o conteúdo couber sem rolar, libera direto
    if (el.scrollHeight <= el.clientHeight) setLeuFim(true);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const podeConcordar = leuFim;
  const podeEnviar    = concordo && !aceitando;

  // Formata o conteúdo com quebras de linha
  const linhas = contrato.conteudo.split("\n");

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: RAIO_LG,
        width: "100%", maxWidth: 680,
        display: "flex", flexDirection: "column",
        maxHeight: "92vh", overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
      }}>
        {/* Cabeçalho */}
        <div style={{ padding: "22px 28px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.sidebarBg }}>
              {contrato.titulo}
            </h2>
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.textLight, background: C.bg, padding: "3px 10px", borderRadius: 20 }}>
              v{contrato.versao}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>
            Leia o contrato abaixo até o final para poder aceitar.
          </p>
        </div>

        {/* Conteúdo rolável */}
        <div
          ref={conteudoRef}
          style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}
        >
          {linhas.map((linha, i) => {
            if (!linha.trim()) return <div key={i} style={{ height: 10 }} />;
            if (linha.startsWith("## ")) return <h3 key={i} style={{ margin: "16px 0 6px", fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>{linha.slice(3)}</h3>;
            if (linha.startsWith("# "))  return <h2 key={i} style={{ margin: "20px 0 8px", fontSize: 16, fontWeight: 800, color: C.sidebarBg }}>{linha.slice(2)}</h2>;
            return <p key={i} style={{ margin: "0 0 6px", fontSize: 13, color: C.textMain, lineHeight: 1.7 }}>{linha}</p>;
          })}
        </div>

        {/* Gradiente de indicação de scroll */}
        {!leuFim && (
          <div style={{ height: 48, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.95))", marginTop: -48, pointerEvents: "none", flexShrink: 0, position: "relative", zIndex: 1 }} />
        )}

        {/* Rodapé */}
        <div style={{ padding: "18px 28px 24px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          {!leuFim && (
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#B45309", fontWeight: 700, textAlign: "center" }}>
              ↓ Role até o final para liberar o aceite
            </p>
          )}

          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: podeConcordar ? "pointer" : "not-allowed", opacity: podeConcordar ? 1 : 0.5, marginBottom: 18 }}>
            <input
              type="checkbox"
              checked={concordo}
              disabled={!podeConcordar}
              onChange={e => setConcordo(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, cursor: "pointer", accentColor: C.sidebarBg }}
            />
            <span style={{ fontSize: 13, color: C.textMain, lineHeight: 1.5 }}>
              Li, compreendi e concordo com os termos do <strong>{contrato.titulo}</strong>, versão {contrato.versao}.
              Entendo que este contrato tem validade legal e rege a relação entre meu estabelecimento e a plataforma Luarys.
            </span>
          </label>

          <button
            onClick={onAceitar}
            disabled={!podeEnviar}
            style={{
              width: "100%", padding: "13px", borderRadius: RAIO_MD, border: "none",
              background: podeEnviar ? C.sidebarBg : C.borderMid,
              color: "#fff", fontSize: 14, fontWeight: 800,
              cursor: podeEnviar ? "pointer" : "not-allowed",
              letterSpacing: "0.3px",
              transition: "background 0.2s",
            }}
          >
            {aceitando ? "Registrando aceite..." : "Concordar e Continuar"}
          </button>

          <p style={{ margin: "10px 0 0", fontSize: 11, color: C.textLight, textAlign: "center" }}>
            Seu aceite ficará registrado com data, hora e IP de acesso.
          </p>
        </div>
      </div>
    </div>
  );
}
