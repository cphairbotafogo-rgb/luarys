'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { TelaMobile } from './TelaMobile';

export function PainelMobile() {
  const [sessao, setSessao] = useState<any>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      if (data.session?.user) carregarPerfil(data.session.user.id);
      else setCarregando(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_, s) => {
      setSessao(s);
      if (s?.user) carregarPerfil(s.user.id);
      else { setPerfil(null); setCarregando(false); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function carregarPerfil(userId: string) {
    const { data } = await supabase.from('perfis_usuarios').select('id,nome,salao_id,papel').eq('id', userId).maybeSingle();
    setPerfil(data);
    setCarregando(false);
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true); setErro('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    if (error) { setErro('E-mail ou senha incorretos.'); setEntrando(false); }
  }

  async function sair() {
    await supabase.auth.signOut();
    setPerfil(null); setSessao(null);
  }

  if (carregando) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.sidebarBg }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${C.douradoEleva}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );

  if (!sessao || !perfil) return (
    <div style={{ minHeight: '100vh', background: C.sidebarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={C.logoUrl} alt="Luarys" style={{ height: 44, objectFit: 'contain' }} />
          <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>Painel do Lojista</p>
        </div>
        <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '14px 16px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'var(--font-body)' }} />
          <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} required style={{ padding: '14px 16px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'var(--font-body)' }} />
          {erro && <p style={{ color: '#FCA5A5', fontSize: 13, margin: 0, textAlign: 'center' }}>{erro}</p>}
          <button type="submit" disabled={entrando} style={{ padding: '14px', borderRadius: 12, border: 'none', background: C.douradoEleva, color: C.sidebarBg, fontWeight: 900, fontSize: 15, cursor: entrando ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-title)', marginTop: 4 }}>{entrando ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );

  return <TelaMobile perfil={perfil} onSair={sair} />;
}
