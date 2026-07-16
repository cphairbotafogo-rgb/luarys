'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { FiMapPin } from 'react-icons/fi';
import { PortalLogin } from '@/modules/portal/PortalLogin';
import { PortalCadastro } from '@/modules/portal/PortalCadastro';
import { TelaInicialMobile } from './TelaInicialMobile';
import { LOGO_ALTURA, FONTE_CORPO, FONTE_TITULO, cardPremium, eyebrow, fileteDourado, tituloSecao } from '@/modules/portal/estiloPortal';
import { RAIO_LG, RAIO_XL } from '@/lib/estiloGlobal';

type Fase = 'selecionar_salao' | 'login' | 'cadastro' | 'dashboard';

function TelaSelecaoSalao({ onSalaoSelecionado, onIrParaCadastro }: { onSalaoSelecionado: (s: any) => void; onIrParaCadastro: () => void }) {
  const [busca, setBusca] = useState('');
  const [saloes, setSaloes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [jaBuscou, setJaBuscou] = useState(false);

  useEffect(() => {
    setCarregando(true);
    supabase.from('saloes').select('id,nome_fantasia,slug,bairro,cidade,estado,telefone,cobrar_sinal,porcentagem_sinal').order('nome_fantasia', { ascending: true }).limit(20)
      .then(({ data }) => { setSaloes(data || []); setCarregando(false); });
  }, []);

  async function pesquisar(e: React.FormEvent) {
    e.preventDefault(); setJaBuscou(true); setCarregando(true);
    const q = supabase.from('saloes').select('id,nome_fantasia,slug,bairro,cidade,estado,telefone,cobrar_sinal,porcentagem_sinal').order('nome_fantasia', { ascending: true }).limit(20);
    const { data } = busca.trim() ? await q.or(`slug.ilike.%${busca.trim()}%,nome_fantasia.ilike.%${busca.trim()}%`) : await q;
    setSaloes(data || []); setCarregando(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: FONTE_CORPO }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img src={C.logoUrl} alt="Eleva" style={{ height: LOGO_ALTURA, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
        <div style={fileteDourado} />
      </div>
      <div style={{ ...cardPremium, width: '100%', maxWidth: 440, padding: '40px 24px' }}>
        <p style={{ ...eyebrow, textAlign: 'center', margin: 0 }}>A sua experiência premium</p>
        <h1 style={tituloSecao}>Portal do Cliente</h1>
        <form onSubmit={pesquisar} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <input type="text" placeholder="Busque pelo nome do salão..." value={busca} onChange={e => setBusca(e.target.value)} style={{ flex: 1, padding: '12px 14px', borderRadius: RAIO_LG, border: `1px solid ${C.borderMid}`, fontSize: 14, outlineColor: C.sidebarBg, color: C.textMain, backgroundColor: C.bgCard, boxSizing: 'border-box' as const, fontFamily: FONTE_CORPO }} />
          <button type="submit" disabled={carregando} style={{ padding: '12px 18px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_LG, fontWeight: 700, fontSize: 14, cursor: carregando ? 'not-allowed' : 'pointer', fontFamily: FONTE_TITULO }}>{carregando ? '...' : 'Ir'}</button>
        </form>
        {saloes.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
            {saloes.map(s => (
              <button key={s.id} onClick={() => onSalaoSelecionado(s)} style={{ width: '100%', padding: '14px 16px', background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, borderLeft: `3px solid ${C.douradoEleva}`, cursor: 'pointer', textAlign: 'left', minHeight: 56 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.textMain }}>{s.nome_fantasia}</p>
                {s.cidade && <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textLight, display: 'flex', alignItems: 'center', gap: 4 }}><FiMapPin size={11} /> {s.bairro ? `${s.bairro} · ` : ''}{s.cidade}</p>}
              </button>
            ))}
          </div>
        )}
        {saloes.length === 0 && jaBuscou && !carregando && <p style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: C.textMuted }}>Nenhum salão encontrado.</p>}
        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: C.textMuted, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          Sou cliente nova. <span onClick={onIrParaCadastro} style={{ color: C.sidebarBg, fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>Criar conta</span>
        </p>
      </div>
    </div>
  );
}

export function PortalMobile() {
  const [fase, setFase] = useState<Fase>('selecionar_salao');
  const [salaoSelecionado, setSalaoSelecionado] = useState<any>(null);
  const [clienteLogado, setClienteLogado] = useState<any>(null);
  const [clienteRecemCadastradoId, setClienteRecemCadastradoId] = useState<string | null>(null);
  const [credencial, setCredencial] = useState('');
  const [senha, setSenha] = useState('');
  const [carregandoLogin, setCarregandoLogin] = useState(false);
  const [erroLogin, setErroLogin] = useState('');

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('s') || new URLSearchParams(window.location.search).get('slug');
    if (!slug) return;
    supabase.from('saloes').select('id,nome_fantasia,slug,bairro,cidade,estado,telefone,cobrar_sinal,porcentagem_sinal').eq('slug', slug).maybeSingle()
      .then(({ data }) => { if (data) { setSalaoSelecionado(data); setFase('login'); } });
  }, []);

  async function fazerLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!credencial.trim() || !senha.trim() || !salaoSelecionado) return;
    setCarregandoLogin(true); setErroLogin('');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: credencial.trim().toLowerCase(), password: senha });
    if (authError || !authData.user) { setErroLogin('E-mail ou senha incorretos. Verifique seus dados ou cadastre-se.'); setCarregandoLogin(false); return; }
    const userId = authData.user.id;
    const { data: vinculo } = await supabase.from('clientes').select('*').eq('salao_id', salaoSelecionado.id).eq('usuario_portal_id', userId).maybeSingle();
    if (vinculo) { setClienteLogado(vinculo); setFase('dashboard'); setCarregandoLogin(false); return; }
    const { data: dadosPortal } = await supabase.from('usuarios_portal').select('nome_completo,email,cpf,telefone_whatsapp').eq('id', userId).maybeSingle();
    if (!dadosPortal) { setErroLogin('E-mail ou senha incorretos. Verifique seus dados ou cadastre-se.'); setCarregandoLogin(false); return; }
    const { data: novoVinculo, error: errInsert } = await supabase.from('clientes').insert([{ salao_id: salaoSelecionado.id, usuario_portal_id: userId, nome_completo: dadosPortal.nome_completo, email: dadosPortal.email, cpf: dadosPortal.cpf, telefone_whatsapp: dadosPortal.telefone_whatsapp, total_gasto: 0, total_visitas: 0 }]).select().maybeSingle();
    if (errInsert || !novoVinculo) { setErroLogin('Não foi possível concluir o acesso. Tente novamente.'); setCarregandoLogin(false); return; }
    setClienteLogado(novoVinculo); setFase('dashboard'); setCarregandoLogin(false);
  }

  async function sairDoPortal() { await supabase.auth.signOut(); setClienteLogado(null); setCredencial(''); setSenha(''); setErroLogin(''); setFase('login'); }
  function trocarDeSalao() { setClienteLogado(null); setSalaoSelecionado(null); setCredencial(''); setSenha(''); setErroLogin(''); setFase('selecionar_salao'); }

  if (fase === 'selecionar_salao') return <TelaSelecaoSalao onSalaoSelecionado={s => { setSalaoSelecionado(s); setFase('login'); }} onIrParaCadastro={() => setFase('cadastro')} />;
  if (fase === 'cadastro') return <PortalCadastro onCadastroConcluido={({ id }: any) => { setClienteRecemCadastradoId(id); setFase('selecionar_salao'); }} irParaLogin={() => setFase('login')} />;
  if (fase === 'login') return <PortalLogin credencial={credencial} setCredencial={setCredencial} senha={senha} setSenha={setSenha} fazerLogin={fazerLogin} carregando={carregandoLogin} erro={erroLogin} salaoSelecionado={salaoSelecionado} trocarDeSalao={trocarDeSalao} irParaCadastro={() => setFase('cadastro')} />;
  return <TelaInicialMobile clienteLogado={clienteLogado} salaoSelecionado={salaoSelecionado} sairDoPortal={sairDoPortal} trocarDeSalao={trocarDeSalao} />;
}
