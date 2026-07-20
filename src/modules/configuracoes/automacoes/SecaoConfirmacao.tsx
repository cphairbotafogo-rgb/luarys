'use client'
import { FiClock, FiCheck, FiLoader, FiInfo } from "react-icons/fi";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { TEMPLATES_CONFIRMACAO } from "./constants";

const OPCOES_ANTECEDENCIA = [
  { horas: 24, label: '24h antes', desc: 'Na véspera do horário' },
  { horas: 12, label: '12h antes', desc: 'Na manhã ou tarde anterior' },
  { horas:  6, label: '6h antes',  desc: 'Horas antes do horário' },
] as const;

interface Props {
  msgAtual: string;
  antecedenciaHoras: number;
  salvando: boolean;
  salvandoAntecedencia: boolean;
  onSalvarTemplate: (texto: string) => void;
  onSalvarAntecedencia: (horas: number) => void;
}

export function SecaoConfirmacao({
  msgAtual, antecedenciaHoras,
  salvando, salvandoAntecedencia,
  onSalvarTemplate, onSalvarAntecedencia,
}: Props) {
  const idAtual = TEMPLATES_CONFIRMACAO.find(t => t.texto === msgAtual)?.id ?? null;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 24, marginBottom: 24 }}>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: RAIO_LG, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FiClock size={18} color="#3B82F6" />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.textMain }}>Lembrete de Horário</h4>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textLight }}>
            Enviado automaticamente antes do horário reservado via API
          </p>
        </div>
      </div>

      {/* Seleção de antecedência */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Enviar com quanto tempo de antecedência?
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {OPCOES_ANTECEDENCIA.map(op => {
            const ativa = antecedenciaHoras === op.horas;
            return (
              <button
                key={op.horas}
                onClick={() => onSalvarAntecedencia(op.horas)}
                disabled={salvandoAntecedencia}
                style={{
                  flex: 1, padding: "12px 8px", borderRadius: RAIO_LG, cursor: salvandoAntecedencia ? "wait" : "pointer",
                  background: ativa ? C.sidebarBg : "#fff",
                  border: `2px solid ${ativa ? C.sidebarBg : C.borderMid}`,
                  transition: "all 0.15s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 900, color: ativa ? "#fff" : C.textMain }}>
                  {op.label}
                  {ativa && !salvandoAntecedencia && (
                    <FiCheck size={11} style={{ marginLeft: 5, verticalAlign: "middle" }} />
                  )}
                  {ativa && salvandoAntecedencia && (
                    <FiLoader size={11} className="animate-spin" style={{ marginLeft: 5, verticalAlign: "middle" }} />
                  )}
                </span>
                <span style={{ fontSize: 10, color: ativa ? "rgba(255,255,255,0.7)" : C.textLight, fontWeight: 600, textAlign: "center" }}>
                  {op.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Aviso utility */}
      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: RAIO_MD, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <FiInfo size={13} color="#15803D" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, color: "#166534", lineHeight: 1.5 }}>
          Templates pré-definidos para classificação <strong>Utility</strong> pela Meta — menor custo e menor risco de bloqueio. Não editáveis para manter a conformidade.
        </p>
      </div>

      {/* 3 cartões de template */}
      <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Modelo da mensagem
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {TEMPLATES_CONFIRMACAO.map(t => {
          const selecionado = idAtual === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSalvarTemplate(t.texto)}
              disabled={salvando}
              style={{
                textAlign: "left", cursor: salvando ? "wait" : "pointer",
                background: selecionado ? "#EFF6FF" : "#fff",
                border: `2px solid ${selecionado ? "#3B82F6" : C.borderMid}`,
                borderRadius: RAIO_LG, padding: "14px 16px",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    background: selecionado ? "#3B82F6" : "transparent",
                    border: `2px solid ${selecionado ? "#3B82F6" : C.borderMid}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {selecionado && (salvando
                      ? <FiLoader size={10} color="#fff" className="animate-spin" />
                      : <FiCheck size={10} color="#fff" />
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: selecionado ? "#1D4ED8" : C.textMain }}>
                    {t.titulo}
                  </span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  {t.descricao}
                </span>
              </div>
              <pre style={{
                margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.7,
                fontFamily: "var(--font-body)", whiteSpace: "pre-wrap", wordBreak: "break-word",
                background: selecionado ? "rgba(219,234,254,0.4)" : C.bg,
                borderRadius: RAIO_MD, padding: "10px 12px",
              }}>
                {t.texto}
              </pre>
            </button>
          );
        })}
      </div>

      <p style={{ margin: 0, fontSize: 11, color: C.textLight, lineHeight: 1.6 }}>
        Clique em um template para selecioná-lo. A linha com <strong>{'{profissional}'}</strong> é suprimida quando o agendamento não tiver profissional.
      </p>
    </div>
  );
}
