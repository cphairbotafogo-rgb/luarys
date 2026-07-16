'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_SM, RAIO_MD } from "@/lib/estiloGlobal";
import {
  FiShield, FiLock, FiLogOut, FiEye, FiEyeOff,
  FiGrid, FiUsers, FiCreditCard, FiPackage, FiMessageCircle,
  FiFileText, FiDollarSign, FiAlertCircle, FiBell, FiFolder, FiActivity,
} from "react-icons/fi";
import { TelaCentral } from "./shared";
import { AbaDashboard }      from "./abas/AbaDashboard";
import { AbaEmpresas }       from "./abas/AbaEmpresas";
import { AbaCatalogo }       from "./abas/AbaCatalogo";
import { AbaWhatsappConfig } from "./abas/AbaWhatsappConfig";
import { AbaNFSeConfig }     from "./abas/AbaNFSeConfig";
import { ContasRecebimento } from "./abas/ContasRecebimento";
import { AbaNotasFiscais }   from "./abas/AbaNotasFiscais";
import { AbaAvisos }         from "./abas/AbaAvisos";
import { AbaDocumentos }     from "./abas/AbaDocumentos";
import { AbaAssinaturas }    from "./abas/AbaAssinaturas";
import { AbaSistema }        from "./abas/AbaSistema";

type AbaAdmin =
  | 'dashboard' | 'empresas' | 'assinaturas' | 'planos'
  | 'whatsapp'  | 'nfse_config' | 'contas' | 'notas_fiscais'
  | 'avisos'    | 'documentos'  | 'sistema';

const ABAS: { chave: AbaAdmin; label: string; icone: React.ReactNode; grupo?: string }[] = [
  { chave: 'dashboard',     label: 'Dashboard',            icone: <FiGrid size={15} />,         grupo: 'Visão Geral' },
  { chave: 'empresas',      label: 'Empresas',             icone: <FiUsers size={15} />,        grupo: 'Gestão' },
  { chave: 'assinaturas',   label: 'Assinaturas',          icone: <FiCreditCard size={15} />,   grupo: 'Gestão' },
  { chave: 'planos',        label: 'Planos & Módulos',     icone: <FiPackage size={15} />,      grupo: 'Gestão' },
  { chave: 'sistema',       label: 'Saúde do Sistema',     icone: <FiActivity size={15} />,     grupo: 'Gestão' },
  { chave: 'contas',        label: 'Contas Recebimento',   icone: <FiDollarSign size={15} />,   grupo: 'Financeiro' },
  { chave: 'notas_fiscais', label: 'Notas Fiscais',        icone: <FiFileText size={15} />,     grupo: 'Financeiro' },
  { chave: 'whatsapp',      label: 'WhatsApp Luarys',      icone: <FiMessageCircle size={15} />, grupo: 'Configurações' },
  { chave: 'nfse_config',   label: 'NFS-e Luarys',        icone: <FiAlertCircle size={15} />,  grupo: 'Configurações' },
  { chave: 'avisos',        label: 'Avisos',               icone: <FiBell size={15} />,         grupo: 'Configurações' },
  { chave: 'documentos',    label: 'Documentos',           icone: <FiFolder size={15} />,       grupo: 'Configurações' },
];

// ─── Login ────────────────────────────────────────────────────────────────────

function TelaLoginAdmin({ aoEntrar }: { aoEntrar: () => void }) {
  const [passo, setPasso]           = useState<'chave' | 'credenciais'>('chave');
  const [chave, setChave]           = useState('');
  const [mostrarChave, setMostrarChave] = useState(false);
  const [email, setEmail]           = useState('');
  const [senha, setSenha]           = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro]             = useState('');

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: RAIO_MD,
    border: `1px solid ${C.borderMid}`, fontSize: 14, color: C.textMain,
    outline: 'none', boxSizing: 'border-box', background: C.bgCard,
  };

  async function verificarChave(e: React.SyntheticEvent) {
    e.preventDefault(); setErro(''); setCarregando(true);
    const res = await fetch('/api/admin/verify-key', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: chave }),
    });
    setCarregando(false);
    if (!res.ok) { setErro('Chave de acesso incorreta.'); return; }
    setPasso('credenciais');
  }

  async function entrar(e: React.SyntheticEvent) {
    e.preventDefault(); setErro(''); setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) { setErro('E-mail ou senha incorretos.'); return; }
    aoEntrar();
  }

  return (
    <TelaCentral>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <FiShield size={40} color={C.sidebarBg} />
          <h2 style={{ margin: '14px 0 6px', fontSize: 20, fontWeight: 800, color: C.sidebarBg }}>Painel da Plataforma</h2>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>
            {passo === 'chave' ? 'Digite a chave de acesso da plataforma.' : 'Identifique-se com sua conta Luarys.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {(['chave', 'credenciais'] as const).map(p => (
            <div key={p} style={{ flex: 1, height: 3, borderRadius: 2, background: passo === 'credenciais' || p === 'chave' ? C.sidebarBg : C.borderMid, opacity: p === passo ? 1 : (passo === 'credenciais' ? 0.4 : 0.2) }} />
          ))}
        </div>

        {passo === 'chave' ? (
          <form onSubmit={verificarChave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Chave de Acesso</label>
              <div style={{ position: 'relative' }}>
                <input type={mostrarChave ? 'text' : 'password'} required autoFocus value={chave} onChange={e => setChave(e.target.value)} placeholder="••••••••••••" style={{ ...inputSt, paddingRight: 44 }} />
                <button type="button" onClick={() => setMostrarChave(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, padding: 0 }}>
                  {mostrarChave ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>
            {erro && <p style={{ margin: 0, fontSize: 12, color: '#EF4444', fontWeight: 700, background: '#FEF2F2', padding: '8px 12px', borderRadius: RAIO_SM }}>{erro}</p>}
            <button type="submit" disabled={carregando} style={{ marginTop: 4, padding: 13, borderRadius: RAIO_MD, border: 'none', background: carregando ? C.borderMid : C.sidebarBg, color: '#fff', fontSize: 13, fontWeight: 800, cursor: carregando ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {carregando ? 'Verificando...' : 'Continuar'}
            </button>
          </form>
        ) : (
          <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>E-mail</label>
              <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" style={inputSt} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={mostrarSenha ? 'text' : 'password'} required value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" style={{ ...inputSt, paddingRight: 44 }} />
                <button type="button" onClick={() => setMostrarSenha(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, padding: 0 }}>
                  {mostrarSenha ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>
            {erro && <p style={{ margin: 0, fontSize: 12, color: '#EF4444', fontWeight: 700, background: '#FEF2F2', padding: '8px 12px', borderRadius: RAIO_SM }}>{erro}</p>}
            <button type="submit" disabled={carregando} style={{ marginTop: 4, padding: 13, borderRadius: RAIO_MD, border: 'none', background: carregando ? C.borderMid : C.sidebarBg, color: '#fff', fontSize: 13, fontWeight: 800, cursor: carregando ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
            <button type="button" onClick={() => { setPasso('chave'); setErro(''); setEmail(''); setSenha(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.textLight, textDecoration: 'underline', padding: 0 }}>
              ← Voltar
            </button>
          </form>
        )}
      </div>
    </TelaCentral>
  );
}

// ─── Painel principal ─────────────────────────────────────────────────────────

export default function AdminPage() {
  const [carregando, setCarregando] = useState(true);
  const [logado, setLogado]         = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [abaAdmin, setAbaAdmin]     = useState<AbaAdmin>('dashboard');

  useEffect(() => { verificarAcesso(); }, []);

  async function verificarAcesso() {
    setCarregando(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLogado(false); setAutorizado(false); setCarregando(false); return; }
    setLogado(true);
    const { data: perfil } = await supabase.from('perfis_usuarios').select('is_plataforma_admin').eq('id', session.user.id).maybeSingle();
    setAutorizado(!!perfil?.is_plataforma_admin);
    setCarregando(false);
  }

  async function sair() {
    await supabase.auth.signOut();
    setLogado(false); setAutorizado(false);
  }

  if (carregando) return <TelaCentral><p style={{ color: C.textLight, fontWeight: 700 }}>Verificando credenciais...</p></TelaCentral>;
  if (!logado)    return <TelaLoginAdmin aoEntrar={verificarAcesso} />;

  if (!autorizado) return (
    <TelaCentral>
      <FiLock size={48} color="#EF4444" />
      <h2 style={{ color: '#EF4444', margin: '16px 0 8px' }}>Acesso Restrito</h2>
      <p style={{ color: C.textLight, marginBottom: 16 }}>Esta área é exclusiva da administração da plataforma Luarys.</p>
      <button onClick={sair} style={{ background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '8px 16px', cursor: 'pointer', fontSize: 13, color: C.textMuted, fontWeight: 600 }}>Sair</button>
    </TelaCentral>
  );

  // Agrupa abas por grupo para o sidebar
  const grupos = [...new Set(ABAS.map(a => a.grupo).filter(Boolean))] as string[];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif" }}>

      {/* ── Topbar ── */}
      <div style={{ background: C.sidebarBg, color: '#fff', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FiShield size={20} />
          <span style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Luarys Admin</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 20, letterSpacing: '0.5px' }}>PLATAFORMA</span>
        </div>
        <button onClick={sair} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: RAIO_MD, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 700 }}>
          <FiLogOut size={13} /> Sair
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <nav style={{ width: 220, background: C.bgCard, borderRight: `1px solid ${C.border}`, overflowY: 'auto', flexShrink: 0, paddingTop: 12, paddingBottom: 24 }}>
          {grupos.map(grupo => (
            <div key={grupo}>
              <p style={{ margin: '16px 20px 6px', fontSize: 9, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{grupo}</p>
              {ABAS.filter(a => a.grupo === grupo).map(aba => (
                <button
                  key={aba.chave}
                  onClick={() => setAbaAdmin(aba.chave)}
                  style={{
                    width: '100%', padding: '9px 20px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                    background: abaAdmin === aba.chave ? C.sidebarBg + '12' : 'transparent',
                    color: abaAdmin === aba.chave ? C.sidebarBg : C.textMuted,
                    borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                    borderLeft: `3px solid ${abaAdmin === aba.chave ? C.sidebarBg : 'transparent'}`,
                    fontSize: 13, fontWeight: abaAdmin === aba.chave ? 700 : 500, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ opacity: abaAdmin === aba.chave ? 1 : 0.5 }}>{aba.icone}</span>
                  {aba.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Conteúdo ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '36px 48px' }}>
          {abaAdmin === 'dashboard'     && <AbaDashboard />}
          {abaAdmin === 'empresas'      && <AbaEmpresas />}
          {abaAdmin === 'assinaturas'   && <AbaAssinaturas />}
          {abaAdmin === 'planos'        && <AbaCatalogo />}
          {abaAdmin === 'sistema'       && <AbaSistema />}
          {abaAdmin === 'whatsapp'      && <AbaWhatsappConfig />}
          {abaAdmin === 'nfse_config'   && <AbaNFSeConfig />}
          {abaAdmin === 'contas'        && <ContasRecebimento />}
          {abaAdmin === 'notas_fiscais' && <AbaNotasFiscais />}
          {abaAdmin === 'avisos'        && <AbaAvisos />}
          {abaAdmin === 'documentos'    && <AbaDocumentos />}
        </main>

      </div>
    </div>
  );
}
