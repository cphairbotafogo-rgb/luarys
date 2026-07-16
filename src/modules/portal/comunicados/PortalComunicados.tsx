'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { FiSpeaker, FiExternalLink, FiChevronRight } from "react-icons/fi";
import { FONTE_TITULO, FONTE_CORPO, RAIO_LG, RAIO_MD } from "@/lib/estiloGlobal";
import { cardConteudo, eyebrow } from "../estiloPortal";

interface Props {
  salaoId: string;
}

const TIPO_CONFIG: Record<string, { rotulo: string; cor: string; fundo: string }> = {
  promocao:   { rotulo: "Promoção",   cor: "#B45309", fundo: "#FEF3C7" },
  lancamento: { rotulo: "Novidade",   cor: "#0F6E56", fundo: "#E1F5EE" },
  comunicado: { rotulo: "Comunicado", cor: "#185FA5", fundo: "#E6F1FB" },
};

export function PortalComunicados({ salaoId }: Props) {
  const [comunicados, setComunicados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { if (salaoId) carregar(); }, [salaoId]);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from("comunicados_salao")
      .select("id, tipo, titulo, descricao, imagem_url, link_acao, texto_botao, valido_ate")
      .eq("salao_id", salaoId)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("criado_em", { ascending: false });
    setComunicados(data || []);
    setCarregando(false);
  }

  if (carregando || comunicados.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FiSpeaker size={14} color={C.sidebarBg} />
        <p style={{ ...eyebrow, margin: 0, color: C.sidebarBg }}>Do Salão para Você</p>
      </div>

      {comunicados.map(c => {
        const config = TIPO_CONFIG[c.tipo] || TIPO_CONFIG.comunicado;
        const temImagem = !!c.imagem_url;
        return (
          <div key={c.id} style={{ ...cardConteudo, overflow: "hidden", padding: 0 }}>
            {temImagem && (
              <div style={{ width: "100%", height: 160, overflow: "hidden", background: C.bg }}>
                <img
                  src={c.imagem_url}
                  alt={c.titulo}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: config.fundo, color: config.cor, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {config.rotulo}
                </span>
                {c.valido_ate && (
                  <span style={{ fontSize: 11, color: C.textLight }}>
                    Até {new Date(c.valido_ate + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              <h4 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg, lineHeight: 1.3 }}>
                {c.titulo}
              </h4>
              {c.descricao && (
                <p style={{ fontFamily: FONTE_CORPO, margin: 0, fontSize: 13, color: C.textMain, lineHeight: 1.6 }}>
                  {c.descricao}
                </p>
              )}
              {c.link_acao && (
                <a
                  href={c.link_acao}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4, padding: "9px 16px", borderRadius: RAIO_MD, background: C.sidebarBg, color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: FONTE_TITULO, textDecoration: "none", alignSelf: "flex-start" }}
                >
                  {c.texto_botao || "Saiba mais"} <FiChevronRight size={13} />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
