'use client'

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FiCheckCircle, FiXCircle, FiLoader, FiArrowLeft } from "react-icons/fi";
import { C } from "@/lib/constants";
import { RAIO_2XL, RAIO_LG, SOMBRA_CARD } from "@/lib/estiloGlobal";

type Estado = "carregando" | "sucesso" | "erro";

// Next 16: useSearchParams() exige <Suspense> em volta para o build estático.
export default function PaginaConfirmarExclusao() {
  return (
    <Suspense fallback={null}>
      <ConteudoExclusao />
    </Suspense>
  );
}

function ConteudoExclusao() {
  const params = useSearchParams();
  const router = useRouter();

  const [estado, setEstado] = useState<Estado>("carregando");
  const [mensagemErro, setMensagemErro] = useState<string>("");

  useEffect(() => {
    const ok = params.get("ok");
    const erro = params.get("erro");
    const token = params.get("token");

    // Redirect da API já resolveu — apenas exibir resultado
    if (ok === "1") {
      setEstado("sucesso");
      return;
    }
    if (erro) {
      setMensagemErro(decodeURIComponent(erro));
      setEstado("erro");
      return;
    }

    // Token presente — chamar a API agora
    if (token) {
      fetch(`/api/portal/confirmar-exclusao?token=${encodeURIComponent(token)}`)
        .then(async (res) => {
          if (res.ok) {
            setEstado("sucesso");
          } else {
            const corpo = await res.json().catch(() => ({}));
            setMensagemErro(corpo?.erro ?? "Ocorreu um erro ao processar sua solicitação.");
            setEstado("erro");
          }
        })
        .catch(() => {
          setMensagemErro("Não foi possível conectar ao servidor. Tente novamente mais tarde.");
          setEstado("erro");
        });
      return;
    }

    // Sem parâmetros reconhecidos
    setMensagemErro("Link inválido. Verifique o e-mail de confirmação e tente novamente.");
    setEstado("erro");
  }, [params]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: RAIO_2XL,
          boxShadow: SOMBRA_CARD,
          padding: 48,
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
        }}
      >
        {estado === "carregando" && <TelaCarregando />}
        {estado === "sucesso" && <TelaSucesso onVoltar={() => router.push("/portal")} />}
        {estado === "erro" && (
          <TelaErro mensagem={mensagemErro} onVoltar={() => router.push("/portal")} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-telas ────────────────────────────────────────────────────────────────

const btnStyle = {
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "12px 24px", background: C.sidebarBg, color: "#fff",
  border: "none", borderRadius: RAIO_LG, fontSize: 14, fontWeight: 600, cursor: "pointer",
} as const;

function BotaoVoltar({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={btnStyle}><FiArrowLeft size={16} />Voltar ao portal</button>;
}

function TelaCarregando() {
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <FiLoader size={48} style={{ color: C.textMuted, animation: "spin 1s linear infinite", marginBottom: 20 }} />
      <p style={{ color: C.textMain, fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>Processando sua solicitação...</p>
      <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>Aguarde um instante.</p>
    </>
  );
}

function TelaSucesso({ onVoltar }: { onVoltar: () => void }) {
  return (
    <>
      <FiCheckCircle size={56} style={{ color: C.success, marginBottom: 20 }} />
      <h1 style={{ color: C.textMain, fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>Conta excluída com sucesso</h1>
      <p style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.6, margin: "0 0 32px" }}>
        Recebemos sua confirmação. Seus dados pessoais serão removidos em até{" "}
        <strong>15 dias</strong> conforme determina a LGPD (Lei 13.709/2018).
      </p>
      <BotaoVoltar onClick={onVoltar} />
    </>
  );
}

function TelaErro({ mensagem, onVoltar }: { mensagem: string; onVoltar: () => void }) {
  return (
    <>
      <FiXCircle size={56} style={{ color: C.danger, marginBottom: 20 }} />
      <h1 style={{ color: C.textMain, fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>Não foi possível confirmar a exclusão</h1>
      <p style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.6, margin: "0 0 32px" }}>{mensagem}</p>
      <BotaoVoltar onClick={onVoltar} />
    </>
  );
}
