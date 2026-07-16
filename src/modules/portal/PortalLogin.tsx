'use client'
import { C } from "@/lib/constants";
import {
  LOGO_ALTURA, FONTE_CORPO, cardPremium, eyebrow,
  fileteDourado, tituloSecao, botaoPrimario, inputPadrao, labelPadrao,
} from "./estiloPortal";
import { RAIO_LG } from "@/lib/estiloGlobal";

export function PortalLogin({ credencial, setCredencial, senha, setSenha, fazerLogin, carregando, erro, salaoSelecionado, trocarDeSalao, irParaCadastro }: any) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONTE_CORPO }}>

      {/* Branding premium */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <img src={C.logoUrl} alt="Eleva" style={{ height: LOGO_ALTURA, objectFit: "contain", display: "block", margin: "0 auto" }} />
        <div style={fileteDourado} />
      </div>

      <div style={{ ...cardPremium, width: "100%", maxWidth: 440, padding: "40px 32px" }}>

        {salaoSelecionado && (
          <div style={{ background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_LG, padding: "12px 16px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{salaoSelecionado.nome_fantasia}</span>
            <button onClick={trocarDeSalao} className="transition-all hover:opacity-70" style={{ background: "none", border: "none", color: C.sidebarBg, fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Trocar</button>
          </div>
        )}

        <p style={{ ...eyebrow, textAlign: "center", margin: 0 }}>Portal do Cliente</p>
        <h1 style={tituloSecao}>Bem-vinda de volta</h1>
        <p style={{ margin: "0 0 28px", fontSize: 13, color: C.textLight, textAlign: "center" }}>Acesse a sua conta para agendar</p>

        <form onSubmit={fazerLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelPadrao}>E-mail</label>
            <input type="email" value={credencial} onChange={e => setCredencial(e.target.value)} required placeholder="seu@email.com" style={inputPadrao} />
          </div>
          <div>
            <label style={labelPadrao}>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="Sua senha" style={inputPadrao} />
          </div>

          {erro && <p style={{ margin: 0, color: C.danger, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{erro}</p>}

          <button type="submit" disabled={carregando} className="transition-all hover:opacity-95 shadow-sm" style={{ ...botaoPrimario, marginTop: 8, background: carregando ? C.borderMid : C.sidebarBg, cursor: carregando ? "not-allowed" : "pointer" }}>
            {carregando ? "A entrar..." : "Entrar"}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: C.textMuted, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
          Sou cliente nova.{" "}
          <span onClick={irParaCadastro} className="transition-all hover:opacity-70" style={{ color: C.sidebarBg, fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>Criar minha conta</span>
        </p>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: C.textLight, letterSpacing: "0.3px" }}>Desenvolvido por <span style={{ color: C.douradoEleva, fontWeight: 700 }}>Eleva</span></p>
    </div>
  );
}
