// src/modules/agenda/AgendaSidebar.tsx
'use client'
import { useEffect, useRef } from "react";
import { C } from "@/lib/constants";
import { COR_POR_STATUS } from "@/lib/agendaUtils";
import { useEhMobile } from "@/lib/useEhMobile";
import { FiX } from "react-icons/fi";

// Lista de status visíveis na legenda da sidebar
const STATUS_LEGENDA = [
  { nome: 'Agendado',             status: 'Agendado'             },
  { nome: 'Confirmado',           status: 'Confirmado'           },
  { nome: 'Aguardando',           status: 'Aguardando'           },
  { nome: 'Em Atendimento',       status: 'Em Atendimento'       },
  { nome: 'Finalizado',           status: 'Finalizado'           },
  { nome: 'Faltou',               status: 'Faltou'               },
  { nome: 'Cancelado',            status: 'Cancelado'            },
  { nome: 'Aguardando Pagamento', status: 'Aguardando Pagamento' },
];

export function AgendaSidebar({
  sidebarAberta,
  setSidebarAberta,
  tamanhoLinha,
  setTamanhoLinha,
  tamanhoColuna,
  setTamanhoColuna
}: any) {
  // No celular a sidebar "empurrando" a grade (padrão desktop) deixa a agenda
  // inutilizável — 260px de legenda tomam quase toda a tela de 375px. No
  // celular ela vira uma gaveta que desliza por cima, como o menu principal.
  const ehMobile = useEhMobile();

  // `sidebarAberta` nasce true (padrão desktop, empurra a grade). No celular
  // isso viraria uma gaveta já aberta cobrindo a agenda ao entrar na tela —
  // fecha uma vez, assim que detecta o celular, sem brigar com o toggle manual depois.
  const jaFechouAoDetectarMobile = useRef(false);
  useEffect(() => {
    if (ehMobile && !jaFechouAoDetectarMobile.current) {
      jaFechouAoDetectarMobile.current = true;
      setSidebarAberta?.(false);
    }
  }, [ehMobile, setSidebarAberta]);

  const conteudo = (
    <div style={{ width: 260 }}>

      {/* Legenda de status */}
      <div style={{ padding: "24px 20px", borderBottom: `1px solid ${C.borderMid}` }}>
        <h4 className="font-title uppercase tracking-widest" style={{ margin: "0 0 16px", fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Status do Agendamento</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {STATUS_LEGENDA.map(({ nome, status }) => (
            <div key={status} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 12, height: 12, borderRadius: "50%",
                background: COR_POR_STATUS[status],
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                // Faltou tem borda tracejada; Aguardando Pagamento tem pontilhada âmbar
                outline: status === 'Faltou' ? `2px dashed ${COR_POR_STATUS[status]}` : status === 'Aguardando Pagamento' ? `2px dotted ${COR_POR_STATUS[status]}` : undefined,
                outlineOffset: (status === 'Faltou' || status === 'Aguardando Pagamento') ? '2px' : undefined,
              }} />
              <span style={{ fontSize: 13, color: C.textMain, fontWeight: 500 }}>{nome}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tamanho da grade */}
      <div style={{ padding: "24px 20px", borderBottom: `1px solid ${C.borderMid}` }}>
        <h4 className="font-title uppercase tracking-widest" style={{ margin: "0 0 16px", fontSize: 11, color: C.textMuted, fontWeight: 700 }}>Tamanho da grade</h4>
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: C.textLight, fontWeight: 600, marginBottom: 10, display: "block" }}>Linha (Altura):</span>
          <div style={{ display: "flex", gap: 12 }}>
            {['PP', 'P', 'M', 'G'].map(tam => (
              <label key={`l-${tam}`} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: C.textMain, fontWeight: 500 }}>
                <input type="radio" name="linha" checked={tamanhoLinha === tam} onChange={() => setTamanhoLinha(tam)} style={{ accentColor: C.sidebarBg }} /> {tam}
              </label>
            ))}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 12, color: C.textLight, fontWeight: 600, marginBottom: 10, display: "block" }}>Coluna (Largura):</span>
          <div style={{ display: "flex", gap: 12 }}>
            {['PP', 'P', 'M', 'G'].map(tam => (
              <label key={`c-${tam}`} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: C.textMain, fontWeight: 500 }}>
                <input type="radio" name="coluna" checked={tamanhoColuna === tam} onChange={() => setTamanhoColuna(tam)} style={{ accentColor: C.sidebarBg }} /> {tam}
              </label>
            ))}
          </div>
        </div>
      </div>

    </div>
  );

  if (ehMobile) {
    return (
      <>
        {sidebarAberta && (
          <div
            onClick={() => setSidebarAberta?.(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 499 }}
          />
        )}
        <div className="font-body" style={{
          position: "fixed", top: 0, left: 0, height: "100dvh", width: 260,
          background: C.bgCard, boxShadow: "4px 0 24px rgba(0,0,0,0.25)",
          transform: sidebarAberta ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease", zIndex: 500,
          overflowY: "auto", overflowX: "hidden",
        }}>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 0" }}>
            <button onClick={() => setSidebarAberta?.(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex" }}>
              <FiX size={20} />
            </button>
          </div>
          {conteudo}
        </div>
      </>
    );
  }

  return (
    <div className="font-body" style={{ width: sidebarAberta ? 260 : 0, opacity: sidebarAberta ? 1 : 0, transition: "all 0.3s ease", background: C.bgCard, borderRight: sidebarAberta ? `1px solid ${C.borderMid}` : 'none', overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {conteudo}
    </div>
  );
}
