'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { FiStar, FiCheckCircle, FiX } from "react-icons/fi";
import {
  FONTE_TITULO, FONTE_CORPO, RAIO_MD,
  botaoPrimario, labelPadrao,
} from "@/lib/estiloGlobal";
import { cardConteudo } from "../estiloPortal";

interface Props {
  agendamento: any;
  salaoId: string;
  clienteId: string;
  onFechar: () => void;
  onAvaliado: () => void;
}

function Estrelas({ valor, onChange, desabilitado }: { valor: number; onChange?: (n: number) => void; desabilitado?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={desabilitado}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !desabilitado && setHover(n)}
          onMouseLeave={() => !desabilitado && setHover(0)}
          style={{ background: "none", border: "none", cursor: desabilitado ? "default" : "pointer", padding: 2 }}
        >
          <FiStar
            size={28}
            style={{ transition: "all 0.15s" }}
            fill={(hover || valor) >= n ? C.douradoEleva : "none"}
            color={(hover || valor) >= n ? C.douradoEleva : C.borderMid}
          />
        </button>
      ))}
    </div>
  );
}

export function PortalAvaliacoes({ agendamento, salaoId, clienteId, onFechar, onAvaliado }: Props) {
  const toast = useToast();
  const [notaSalao, setNotaSalao] = useState(0);
  const [notaProfissional, setNotaProfissional] = useState(0);
  const [comentario, setComentario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [jaAvaliado, setJaAvaliado] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => { verificarAvaliacao(); }, [agendamento?.id]);

  async function verificarAvaliacao() {
    if (!agendamento?.id) return;
    setVerificando(true);
    const { data } = await supabase
      .from("avaliacoes_atendimento")
      .select("id")
      .eq("agendamento_id", agendamento.id)
      .maybeSingle();
    setJaAvaliado(!!data);
    setVerificando(false);
  }

  async function enviarAvaliacao() {
    if (notaSalao === 0) {
      toast.aviso("Dê pelo menos uma nota para o salão antes de enviar.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("avaliacoes_atendimento").insert([{
      salao_id: salaoId,
      agendamento_id: agendamento.id,
      cliente_id: clienteId,
      profissional_id: agendamento.id_prof || null,
      nota_salao: notaSalao,
      nota_profissional: notaProfissional > 0 ? notaProfissional : null,
      comentario: comentario.trim() || null,
    }]);
    setSalvando(false);
    if (error) {
      toast.erro("Não foi possível enviar a avaliação. Tente novamente.");
      return;
    }
    toast.sucesso("Obrigada pela sua avaliação!");
    onAvaliado();
  }

  if (verificando) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ ...cardConteudo, width: "100%", maxWidth: 480, padding: "28px 24px 32px", borderRadius: 20, fontFamily: FONTE_CORPO }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <p style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: C.douradoEleva }}>
              {jaAvaliado ? "Avaliação enviada" : "Avaliar atendimento"}
            </p>
            <h2 style={{ fontFamily: FONTE_TITULO, margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: C.sidebarBg }}>
              {agendamento?.servico || "Atendimento"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textLight }}>
              com {agendamento?.profissional || "profissional"} · {agendamento?.data?.split("-").reverse().join("/")}
            </p>
          </div>
          <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 4 }}>
            <FiX size={20} />
          </button>
        </div>

        {jaAvaliado ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 0" }}>
            <FiCheckCircle size={44} color={C.success} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textMain, textAlign: "center" }}>
              Você já avaliou este atendimento.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: C.textLight, textAlign: "center" }}>
              Obrigada pelo seu feedback — ele nos ajuda a melhorar cada vez mais!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            <div>
              <label style={{ ...labelPadrao, marginBottom: 10 }}>Como foi o atendimento no salão?</label>
              <Estrelas valor={notaSalao} onChange={setNotaSalao} />
              {notaSalao > 0 && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: C.textLight }}>
                  {["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente!"][notaSalao]}
                </p>
              )}
            </div>

            <div>
              <label style={{ ...labelPadrao, marginBottom: 10 }}>
                Como foi o atendimento de {agendamento?.profissional?.split(" ")[0] || "profissional"}?
                <span style={{ fontWeight: 400, color: C.textLight, marginLeft: 4 }}>(opcional)</span>
              </label>
              <Estrelas valor={notaProfissional} onChange={setNotaProfissional} />
              {notaProfissional > 0 && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: C.textLight }}>
                  {["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente!"][notaProfissional]}
                </p>
              )}
            </div>

            <div>
              <label style={labelPadrao}>Deixe um comentário <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
              <textarea
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Como foi a sua experiência? O que podemos melhorar?"
                style={{ width: "100%", padding: "10px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, fontFamily: FONTE_CORPO, color: C.textMain, resize: "none", boxSizing: "border-box", outline: "none" }}
              />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: C.textLight, textAlign: "right" }}>{comentario.length}/500</p>
            </div>

            <button
              onClick={enviarAvaliacao}
              disabled={salvando || notaSalao === 0}
              className="transition-all hover:opacity-95"
              style={{ ...botaoPrimario, opacity: notaSalao === 0 ? 0.5 : 1, cursor: notaSalao === 0 ? "not-allowed" : "pointer" }}
            >
              {salvando ? "Enviando..." : "Enviar Avaliação"}
            </button>

          </div>
        )}
      </div>
    </div>
  );
}
