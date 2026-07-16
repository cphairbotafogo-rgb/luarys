'use client'
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_2XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { Btn } from "@/components/ui";
import { FiMail, FiLock, FiLogIn } from "react-icons/fi";

export function Login() {
  // ─── LÓGICA COGNITIVA INTACTA (PRESERVADA) ──────────────────────────────────
  const toast = useToast();
    const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleLogin(e: any) {
    e.preventDefault();
    setCarregando(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: senha,
    });

    if (error) {
      toast.erro("Erro ao entrar: " + error.message);

      setCarregando(false);
    } else {
      window.location.hash = 'dashboard';
      window.location.reload(); 
    }
  }

  // ─── OVERHAUL DE ESTILOS ESTÉTICOS (Clean & Clinical) ───
  const inputStyle = { 
    width: "100%", padding: "12px 16px 12px 44px", borderRadius: RAIO_MD, 
    border: `1px solid ${C.borderMid}`, outlineColor: C.sidebarBg, 
    boxSizing: "border-box" as const, fontSize: 13, color: C.textMain,
    backgroundColor: "#fff", fontFamily: "var(--font-body)", fontWeight: 500
  };

  const labelStyle = { 
    display: "block", marginBottom: 6, fontSize: 10, fontWeight: 700, 
    color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.5px",
    fontFamily: "var(--font-title)"
  };

  return (
    <div className="font-body" style={{ display: "flex", height: "100vh", width: "100vw", background: C.bg, alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.bgCard, padding: "48px", borderRadius: RAIO_2XL, width: "100%", maxWidth: 420, boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.08)", border: `1px solid ${C.border}` }}>
        
        {/* LOGO CENTRALIZADA — usa o mesmo arquivo SVG do Portal (logo.png
            não existe mais no projeto e aparecia quebrada), no mesmo
            tamanho padrão usado nas telas de login/cadastro do Portal
            (PortalLogin.tsx e PortalCadastro.tsx: height 100). */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
          <img src="/logo_luarys.png" alt="Logo Luarys" style={{ height: 100, objectFit: "contain", display: 'block' }} />
        </div>

        {/* FORMULÁRIO DE ACESSO CRIPTOGRAFADO */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* CAMPO: EMAIL */}
          <div>
            <label style={labelStyle}>E-mail Institucional</label>
            <div style={{ position: "relative" }}>
              <FiMail size={16} color={C.textLight} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="seu@email.com"
                style={inputStyle}
              />
            </div>
          </div>

          {/* CAMPO: SENHA */}
          <div>
            <label style={labelStyle}>Senha de Segurança</label>
            <div style={{ position: "relative" }}>
              <FiLock size={16} color={C.textLight} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type="password" 
                required 
                value={senha} 
                onChange={(e) => setSenha(e.target.value)} 
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>
          </div>
          
          {/* BOTÃO SUBMIT PREMIUM */}
          <Btn 
            type="submit" 
            variant="primary" 
            disabled={carregando}
            style={{ 
              marginTop: 12, padding: "14px 0", fontSize: 12, 
              background: C.sidebarBg, color: "#fff", border: "none", 
              borderRadius: RAIO_MD, fontWeight: 700, fontFamily: "var(--font-title)", 
              textTransform: "uppercase", letterSpacing: "0.5px", cursor: carregando ? "not-allowed" : "pointer" 
            }} 
          >
            {carregando ? "A autenticar credenciais..." : <><FiLogIn size={16} /> Entrar no Sistema</>}
          </Btn>

        </form>

      </div>
    </div>
  );
}