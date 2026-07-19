'use client'
import { useState } from "react";
import { C } from "@/lib/constants";
import { FONTE_CORPO, FONTE_TITULO, fileteDourado, labelPadrao } from "./estiloPortal";
import { AnimacaoLogo } from '@/app/AnimacaoLogo';
import { RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { FiEye, FiEyeOff } from 'react-icons/fi';

const D = C.douradoEleva;

const inputBase = {
  width: '100%', padding: '13px 14px',
  borderRadius: RAIO_LG, border: `1.5px solid ${C.borderMid}`,
  fontSize: 14, outlineColor: D, color: C.textMain,
  backgroundColor: '#FAFAF9', boxSizing: 'border-box' as const,
  fontFamily: FONTE_CORPO,
};

const ANIM = `
  @keyframes fadeUpPortal {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

export function PortalLogin({
  credencial, setCredencial, senha, setSenha,
  fazerLogin, carregando, erro,
  salaoSelecionado, trocarDeSalao, irParaCadastro,
}: any) {
  const [mostrarSenha, setMostrarSenha] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #FAFAF9 0%, #F2EEE4 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 20, fontFamily: FONTE_CORPO, position: 'relative',
    }}>

      {/* Brilho dourado difuso */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 320, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center top, ${D}18 0%, transparent 65%)`,
      }} />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative', animation: 'fadeUpPortal 0.5s ease-out both' }}>
        <AnimacaoLogo compacto />
        <div style={{ ...fileteDourado, marginTop: 14 }} />
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 480, background: '#FFFFFF',
        borderRadius: RAIO_XL,
        boxShadow: '0 4px 40px -8px rgba(44,54,67,0.13), 0 1px 4px rgba(44,54,67,0.06)',
        padding: '40px 32px',
        animation: 'fadeUpPortal 0.5s 0.08s ease-out both',
      }}>

        {salaoSelecionado && (
          <div style={{ background: '#FAFAF9', border: `1.5px solid ${C.borderMid}`, borderRadius: RAIO_LG, padding: '12px 16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{salaoSelecionado.nome_fantasia}</span>
            <button onClick={trocarDeSalao} style={{ background: 'none', border: 'none', color: D, fontSize: 12, fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Trocar</button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: D }}>Portal do Cliente</p>
          <h1 style={{ fontFamily: FONTE_TITULO, margin: '0 0 8px', fontSize: 26, fontWeight: 900, color: C.sidebarBg, letterSpacing: '-0.5px' }}>Bem-vinda de volta</h1>
          <p style={{ margin: 0, fontSize: 13, color: C.textLight }}>Acesse a sua conta para agendar</p>
        </div>

        <form onSubmit={fazerLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelPadrao}>E-mail</label>
            <input type="email" value={credencial} onChange={e => setCredencial(e.target.value)} required placeholder="seu@email.com" style={inputBase} />
          </div>

          <div>
            <label style={labelPadrao}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                placeholder="Sua senha"
                style={{ ...inputBase, paddingRight: 46 }}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', padding: 0 }}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          {erro && <p style={{ margin: 0, color: C.danger, fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            style={{
              width: '100%', padding: '13px 20px', marginTop: 8,
              background: carregando ? C.borderMid : C.sidebarBg,
              color: '#fff', border: 'none', borderRadius: RAIO_LG,
              fontWeight: 800, fontSize: 14, fontFamily: FONTE_TITULO,
              cursor: carregando ? 'not-allowed' : 'pointer',
            }}
          >
            {carregando ? 'A entrar...' : 'Entrar'}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: C.textMuted, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
          Sou cliente nova.{' '}
          <span onClick={irParaCadastro} style={{ color: D, fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>Criar minha conta</span>
        </p>
      </div>

      <p style={{ marginTop: 28, fontSize: 12, color: C.textLight, letterSpacing: '0.3px', animation: 'fadeUpPortal 0.5s 0.2s ease-out both' }}>
        Desenvolvido por <span style={{ color: D, fontWeight: 700 }}>Luarys</span>
      </p>

      <style dangerouslySetInnerHTML={{ __html: ANIM }} />
    </div>
  );
}
