'use client'
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_LG, RAIO_2XL } from "@/lib/estiloGlobal";
import { FiInfo, FiTool, FiGift, FiAlertTriangle, FiX } from "react-icons/fi";

const ESTILO_POR_TIPO: Record<string, { cor: string; bg: string; icone: any; label: string }> = {
  info:       { cor: "#1D4ED8", bg: "#EFF6FF", icone: FiInfo,          label: "Aviso" },
  manutencao: { cor: "#B45309", bg: "#FFFBEB", icone: FiTool,          label: "Manutenção" },
  novidade:   { cor: "#7C3AED", bg: "#F5F3FF", icone: FiGift,          label: "Novidade" },
  urgente:    { cor: "#DC2626", bg: "#FEF2F2", icone: FiAlertTriangle, label: "Importante" },
};

export function AvisoPlataforma({ perfil }: any) {
  const [avisos, setAvisos] = useState<any[]>([]);
  const [indice, setIndice] = useState(0);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    carregarAvisos();
  }, []);

  async function carregarAvisos() {
    if (!perfil?.id) return;

    const [resAvisos, resVistos] = await Promise.all([
      supabase.from('avisos_plataforma')
        .select('id, titulo, mensagem, tipo, criado_em')
        .eq('ativo', true)
        .eq('mostrar_no_sistema', true)
        .order('criado_em', { ascending: true }),
      supabase.from('avisos_visualizacoes').select('aviso_id').eq('usuario_id', perfil.id),
    ]);

    const vistos = new Set((resVistos.data || []).map((v: any) => v.aviso_id));
    const pendentes = (resAvisos.data || []).filter((a: any) => !vistos.has(a.id));
    setAvisos(pendentes);
  }

  async function marcarComoVisto() {
    const aviso = avisos[indice];
    if (!aviso || !perfil?.id) return;

    setEnviando(true);
    await supabase.from('avisos_visualizacoes').upsert({ aviso_id: aviso.id, usuario_id: perfil.id });
    setEnviando(false);

    if (indice + 1 < avisos.length) {
      setIndice(indice + 1);
    } else {
      setAvisos([]);
    }
  }

  if (avisos.length === 0) return null;

  const aviso = avisos[indice];
  const estilo = ESTILO_POR_TIPO[aviso.tipo] || ESTILO_POR_TIPO.info;
  const Icone = estilo.icone;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15, 23, 42, 0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, maxWidth: 460, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ background: estilo.bg, padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icone size={18} color={estilo.cor} />
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: estilo.cor, textTransform: "uppercase", letterSpacing: "0.5px" }}>{estilo.label}</span>
            <h3 style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 800, color: C.textMain }}>{aviso.titulo}</h3>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{aviso.mensagem}</p>
        </div>

        <div style={{ padding: "0 24px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {avisos.length > 1 && (
            <span style={{ fontSize: 12, color: C.textLight }}>{indice + 1} de {avisos.length}</span>
          )}
          <button
            onClick={marcarComoVisto}
            disabled={enviando}
            style={{
              marginLeft: "auto", padding: "10px 24px", borderRadius: RAIO_LG, border: "none",
              background: C.sidebarBg, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              opacity: enviando ? 0.7 : 1,
            }}
          >
            {indice + 1 < avisos.length ? "Próximo" : "Ok, entendi"}
          </button>
        </div>
      </div>
    </div>
  );
}