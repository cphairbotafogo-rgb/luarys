'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { FiStar, FiUser, FiMessageCircle, FiTrendingUp } from "react-icons/fi";

interface Props { perfil: any; }

function EstrelasMini({ nota }: { nota: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <FiStar key={n} size={12} fill={nota >= n ? C.douradoEleva : "none"} color={nota >= n ? C.douradoEleva : C.borderMid} />
      ))}
    </span>
  );
}

export function PainelAvaliacoes({ perfil }: Props) {
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "salao" | "profissional">("todos");

  useEffect(() => { if (perfil?.salao_id) carregarAvaliacoes(); }, [perfil]);

  async function carregarAvaliacoes() {
    setCarregando(true);
    const { data } = await supabase
      .from("avaliacoes_atendimento")
      .select(`
        id, nota_salao, nota_profissional, comentario, criado_em,
        agendamentos ( inicio, data, servico_nome:servico_id(nome) ),
        profissionais ( nome_completo )
      `)
      .eq("salao_id", perfil.salao_id)
      .order("criado_em", { ascending: false })
      .limit(200);
    setAvaliacoes(data || []);
    setCarregando(false);
  }

  const mediaGeral = avaliacoes.length
    ? (avaliacoes.reduce((s, a) => s + a.nota_salao, 0) / avaliacoes.length).toFixed(1)
    : "—";

  const avaliacoesProfissional = avaliacoes.filter(a => a.nota_profissional != null);
  const mediaProf = avaliacoesProfissional.length
    ? (avaliacoesProfissional.reduce((s, a) => s + a.nota_profissional, 0) / avaliacoesProfissional.length).toFixed(1)
    : "—";

  const comComentario = avaliacoes.filter(a => a.comentario).length;

  const cardStat = { background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: "16px 20px" };

  if (carregando) return (
    <div style={{ padding: 40, textAlign: "center", color: C.textLight, fontSize: 13 }}>A carregar avaliações...</div>
  );

  if (avaliacoes.length === 0) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <FiStar size={36} color={C.borderMid} style={{ marginBottom: 12 }} />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textMain }}>Nenhuma avaliação ainda</p>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: C.textLight }}>As avaliações dos clientes aparecerão aqui após os primeiros atendimentos finalizados.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        <div style={cardStat}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Nota do salão</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: C.sidebarBg }}>{mediaGeral}</span>
            <FiStar size={16} fill={C.douradoEleva} color={C.douradoEleva} />
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textLight }}>{avaliacoes.length} avaliação{avaliacoes.length !== 1 ? "ões" : ""}</p>
        </div>

        <div style={cardStat}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Nota profissionais</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: C.sidebarBg }}>{mediaProf}</span>
            {mediaProf !== "—" && <FiStar size={16} fill={C.douradoEleva} color={C.douradoEleva} />}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textLight }}>{avaliacoesProfissional.length} com nota</p>
        </div>

        <div style={cardStat}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Com comentário</p>
          <span style={{ fontSize: 28, fontWeight: 800, color: C.sidebarBg }}>{comComentario}</span>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textLight }}>de {avaliacoes.length} avaliações</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {(["todos", "salao", "profissional"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: "6px 14px", borderRadius: 99, border: `1px solid ${filtro === f ? C.sidebarBg : C.border}`, background: filtro === f ? C.sidebarBg : C.bgCard, color: filtro === f ? "#fff" : C.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {f === "todos" ? "Todas" : f === "salao" ? "Nota do salão" : "Nota do profissional"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {avaliacoes
          .filter(a => filtro === "todos" || (filtro === "profissional" ? a.nota_profissional != null : true))
          .map(av => (
            <div key={av.id} style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <EstrelasMini nota={av.nota_salao} />
                    <span style={{ fontSize: 11, color: C.textLight }}>salão</span>
                    {av.nota_profissional && (
                      <>
                        <span style={{ color: C.borderMid, fontSize: 11 }}>·</span>
                        <EstrelasMini nota={av.nota_profissional} />
                        <span style={{ fontSize: 11, color: C.textLight }}>
                          {av.profissionais?.nome_completo?.split(" ")[0] || "profissional"}
                        </span>
                      </>
                    )}
                  </div>
                  {av.agendamentos && (
                    <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>
                      {av.agendamentos?.servico_nome?.nome || "Serviço"} · {av.agendamentos?.data?.split("-").reverse().join("/")} às {av.agendamentos?.inicio?.substring(0, 5)}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 11, color: C.textLight }}>
                  {new Date(av.criado_em).toLocaleDateString("pt-BR")}
                </span>
              </div>
              {av.comentario && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: C.bg, borderRadius: RAIO_MD, borderLeft: `3px solid ${C.douradoEleva}` }}>
                  <p style={{ margin: 0, fontSize: 13, color: C.textMain, lineHeight: 1.5, fontStyle: "italic" }}>"{av.comentario}"</p>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
