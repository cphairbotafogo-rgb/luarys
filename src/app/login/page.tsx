'use client'
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_LG } from "@/lib/estiloGlobal";
import { FiAlertCircle, FiMail, FiLock } from "react-icons/fi";
import { AnimacaoLogo } from "@/app/AnimacaoLogo";

const D = C.douradoEleva;

export default function LoginLojista() {
  const [email, setEmail]               = useState("");
  const [senha, setSenha]               = useState("");
  const [carregando, setCarregando]     = useState(false);
  const [erro, setErro]                 = useState<string | null>(null);
  const [mensagemReset, setMensagemReset] = useState<string | null>(null);
  const router = useRouter();

  async function recuperarSenha() {
    if (!email) { setErro("Digite seu e-mail acima para receber o link de recuperação."); return; }
    setCarregando(true); setErro(null); setMensagemReset(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
    setCarregando(false);
    if (error) { setErro("Não foi possível enviar o e-mail. Verifique o endereço."); return; }
    setMensagemReset("Link enviado! Verifique sua caixa de entrada.");
  }

  async function fazerLogin(e: any) {
    e.preventDefault();
    if (!email || !senha) { setErro("Por favor, preencha o e-mail e a senha."); return; }
    setCarregando(true); setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) { setErro("E-mail ou senha incorretos."); setCarregando(false); return; }
    router.replace('/');
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: C.bg, fontFamily: "var(--font-body)" }}>

      {/* ─── LADO ESQUERDO — Painel institucional (desktop only) ──────────────── */}
      <div
        className="hidden md:flex"
        style={{
          flex: 1,
          background: `linear-gradient(145deg, ${C.sidebarBg} 0%, #1A2130 100%)`,
          flexDirection: "column", justifyContent: "center",
          padding: "60px 64px", position: "relative", overflow: "hidden",
        }}
      >
        {/* Decorações de fundo */}
        <div style={{ position: "absolute", top: "-15%", left: "-15%", width: 500, height: 500, borderRadius: "50%", background: "rgba(255,255,255,0.02)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-15%", width: 700, height: 700, borderRadius: "50%", background: "rgba(255,255,255,0.02)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "35%", right: "8%", width: 2, height: 160, background: `linear-gradient(to bottom, transparent, ${D}44, transparent)`, pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 10, maxWidth: 420 }}>
          {/* Eyebrow dourado */}
          <p style={{ margin: "0 0 20px", fontSize: 10, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase" as const, color: D, fontFamily: "var(--font-title)" }}>
            Sistema de Gestão
          </p>
          <h1 style={{ fontFamily: "var(--font-title)", fontSize: 38, fontWeight: 700, lineHeight: 1.2, margin: "0 0 24px", color: "#FAFAF9", letterSpacing: "-0.5px" }}>
            Sua gestão<br />num nível<br />
            <span style={{ color: D }}>mais elevado.</span>
          </h1>
          <p style={{ margin: "0 0 40px", fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>
            Acesse o centro de inteligência analítica da sua unidade para gerenciar escalas técnicas, faturamento consolidado e fluxos operacionais.
          </p>

          {/* Métricas decorativas */}
          <div style={{ display: "flex", gap: 32 }}>
            {[
              { label: "Módulos", valor: "13+" },
              { label: "Relatórios", valor: "∞" },
              { label: "Suporte", valor: "24h" },
            ].map(m => (
              <div key={m.label}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: D, fontFamily: "var(--font-title)" }}>{m.valor}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 600, letterSpacing: "0.5px" }}>{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filete dourado no rodapé */}
        <div style={{ position: "absolute", bottom: 40, left: 64, right: 64, height: 1, background: `linear-gradient(90deg, ${D}00, ${D}55, ${D}00)` }} />
      </div>

      {/* ─── LADO DIREITO — Formulário ────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        padding: "40px 32px", background: C.bgCard,
        borderLeft: `1px solid ${C.border}`,
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Logo animada */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <AnimacaoLogo compacto />
            <div style={{
              width: 56, height: 3, margin: "16px auto 0", borderRadius: 3,
              background: `linear-gradient(90deg, transparent, ${D}, transparent)`,
            }} />
          </div>

          {/* Título do formulário */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase" as const, color: D, fontFamily: "var(--font-title)" }}>
              Autenticação
            </p>
            <h2 style={{ fontFamily: "var(--font-title)", fontSize: 22, fontWeight: 800, color: C.sidebarBg, margin: 0, letterSpacing: "-0.3px" }}>
              Entrar no sistema
            </h2>
          </div>

          <form onSubmit={fazerLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {erro && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", padding: "13px 16px", borderRadius: RAIO_MD, color: "#B91C1C", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <FiAlertCircle size={15} /> {erro}
              </div>
            )}
            {mensagemReset && (
              <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", padding: "13px 16px", borderRadius: RAIO_MD, color: "#065F46", fontSize: 12, fontWeight: 600 }}>
                {mensagemReset}
              </div>
            )}

            {/* E-mail */}
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" as const, color: C.textMuted, fontFamily: "var(--font-title)" }}>
                E-mail profissional
              </label>
              <div style={{ position: "relative" }}>
                <FiMail size={15} color={C.textLight} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="exemplo@unidade.com"
                  style={{ width: "100%", padding: "13px 14px 13px 40px", borderRadius: RAIO_LG, border: `1.5px solid ${C.borderMid}`, outlineColor: D, fontSize: 14, color: C.textMain, backgroundColor: C.bg, boxSizing: "border-box" as const, fontFamily: "var(--font-body)", fontWeight: 500 }}
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" as const, color: C.textMuted, fontFamily: "var(--font-title)" }}>
                  Senha
                </label>
                <button type="button" onClick={recuperarSenha} disabled={carregando} style={{ background: "none", border: "none", color: D, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.3px", padding: 0 }}>
                  Recuperar senha
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <FiLock size={15} color={C.textLight} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: "100%", padding: "13px 14px 13px 40px", borderRadius: RAIO_LG, border: `1.5px solid ${C.borderMid}`, outlineColor: D, fontSize: 14, color: C.textMain, backgroundColor: C.bg, boxSizing: "border-box" as const, fontFamily: "var(--font-body)", fontWeight: 500 }}
                />
              </div>
            </div>

            {/* Botão */}
            <button
              type="submit" disabled={carregando}
              style={{
                width: "100%", padding: "15px 24px", marginTop: 8,
                background: carregando ? C.borderMid : C.sidebarBg,
                color: "#fff", border: "none", borderRadius: RAIO_LG,
                fontSize: 13, fontWeight: 800, cursor: carregando ? "not-allowed" : "pointer",
                fontFamily: "var(--font-title)", letterSpacing: "1.5px", textTransform: "uppercase" as const,
                transition: "all 0.18s", boxShadow: carregando ? "none" : `0 4px 20px -6px ${C.sidebarBg}88`,
              }}
            >
              {carregando ? "A validar..." : "Entrar no Painel"}
            </button>
          </form>

          <p style={{ margin: "32px 0 0", textAlign: "center", fontSize: 11, color: C.textLight }}>
            Desenvolvido por <span style={{ color: D, fontWeight: 700 }}>Luarys</span>
          </p>
        </div>
      </div>

    </div>
  );
}
