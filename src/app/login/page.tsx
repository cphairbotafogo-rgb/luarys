'use client'
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { FiAlertCircle } from "react-icons/fi";

export default function LoginLojista() {
  // ─── LÓGICA COGNITIVA INTACTA (PRESERVADA) ──────────────────────────────────
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagemReset, setMensagemReset] = useState<string | null>(null);
  const router = useRouter();

  async function recuperarSenha() {
    if (!email) { setErro("Digite seu e-mail acima para receber o link de recuperação."); return; }
    setCarregando(true); setErro(null); setMensagemReset(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
    setCarregando(false);
    if (error) { setErro("Não foi possível enviar o e-mail. Verifique o endereço."); return; }
    setMensagemReset("Link de recuperação enviado! Verifique sua caixa de entrada.");
  }

  async function fazerLogin(e: any) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    if (!email || !senha) {
      setErro("Por favor, preencha o e-mail e a senha.");
      setCarregando(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro("E-mail ou senha incorretos.");
      setCarregando(false);
      return;
    }

    router.replace('/');
  }

  // ─── REFINAMENTO DOS ESTILOS (Clean & Clinical) ───
  const inputStyle = { 
    width: "100%", padding: "14px 16px", borderRadius: RAIO_MD, 
    border: `1px solid ${C.borderMid}`, outlineColor: C.sidebarBg, 
    boxSizing: "border-box" as const, fontSize: 14, color: C.textMain,
    backgroundColor: "#fff", fontFamily: "var(--font-body)", fontWeight: 500
  };

  const labelStyle = { 
    fontSize: 10, fontWeight: 700, color: C.textMuted, 
    textTransform: "uppercase" as const, letterSpacing: "0.5px",
    fontFamily: "var(--font-title)"
  };

  return (
    <div className="font-body" style={{ minHeight: "100vh", display: "flex", background: C.bg }}>
      
      {/* LADO ESQUERDO: Painel de Apresentação Corporativo (Oculto em Mobile) */}
      <div className="hidden md:flex" style={{ flex: 1, background: `linear-gradient(135deg, ${C.sidebarBg} 0%, #1E252F 100%)`, color: "#fff", flexDirection: "column", justifyContent: "center", padding: "60px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 10, maxWidth: 440, margin: "0 auto" }}>
          <h1 className="font-title uppercase tracking-widest" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.3, marginBottom: 24, color: C.sidebarText }}>
            Sua gestão<br/>num nível<br/>mais elevado.
          </h1>
          <p style={{ fontSize: 14, color: C.sidebarText, opacity: 0.8, lineHeight: 1.6, fontWeight: 500 }}>
            Acesse o centro de inteligência analítica da sua unidade para gerenciar escalas técnicas, faturamento consolidado e fluxos operacionais.
          </p>
        </div>
        {/* Geometrias sutis de fundo */}
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: 400, height: 400, background: "rgba(255,255,255,0.02)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 600, height: 600, background: "rgba(255,255,255,0.02)", borderRadius: "50%" }} />
      </div>

      {/* LADO DIREITO: Form de Autenticação */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 32, background: C.bgCard }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          
          {/* BLOCO DE BRANDING CENTRAL */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <img 
              src={C.logoUrl} 
              alt="Luarys"
              style={{ width: "100%", maxWidth: "160px", height: "auto", display: "block", margin: "0 auto 28px" }} 
            />
            <h2 className="font-title uppercase tracking-wider" style={{ fontSize: 14, fontWeight: 700, color: C.sidebarBg, margin: "0 0 8px" }}>
              Autenticação do Sistema
            </h2>
            <p style={{ color: C.textMuted, margin: 0, fontSize: 13, fontWeight: 500 }}>
              Insira as suas credenciais para acessar a mesa de controle.
            </p>
          </div>

          <form onSubmit={fazerLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* ALERTA DE ERRO FORMATADO */}
            {erro && (
              <div style={{ background: C.dangerBg, border: `1px solid ${C.border}`, padding: "14px 16px", borderRadius: RAIO_MD, color: C.dangerText, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <FiAlertCircle size={16} /> {erro}
              </div>
            )}

            {/* CONFIRMAÇÃO DE RESET */}
            {mensagemReset && (
              <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", padding: "14px 16px", borderRadius: RAIO_MD, color: "#065F46", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {mensagemReset}
              </div>
            )}

            {/* CAMPO: EMAIL */}
            <div>
              <label style={{ ...labelStyle, marginBottom: 8, display: "block" }}>E-mail Profissional</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="exemplo@unidade.com"
                style={inputStyle}
              />
            </div>

            {/* CAMPO: SENHA */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={labelStyle}>Palavra-passe</label>
                <button
                  type="button"
                  onClick={recuperarSenha}
                  disabled={carregando}
                  className="font-title uppercase tracking-wider transition-all hover:opacity-80"
                  style={{ background: "none", border: "none", color: C.textLight, fontSize: 10, fontWeight: 700, cursor: carregando ? "not-allowed" : "pointer" }}
                >
                  Recuperar Senha
                </button>
              </div>
              <input 
                type="password" 
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>

            {/* BOTÃO SUBMIT */}
            <button 
              type="submit" 
              disabled={carregando}
              className="font-title uppercase tracking-wider transition-all hover:opacity-95 shadow-sm"
              style={{ width: "100%", padding: 16, marginTop: 12, background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: carregando ? "not-allowed" : "pointer" }}
            >
              {carregando ? "A validar credenciais..." : "Entrar no Painel"}
            </button>
          </form>

        </div>
      </div>

    </div>
  );
}