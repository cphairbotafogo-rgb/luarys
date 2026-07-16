'use client'
/**
 * FIX [C-1] — src/app/portal/page.tsx
 *
 * PROBLEMA: Arquivo era uma cópia do PortalDashboard sem `export default`,
 *           o que impede o Next.js de reconhecê-lo como página da rota /portal.
 *
 * SOLUÇÃO: Este arquivo agora é um orquestrador fino com 3 estados:
 *   1. Seleção de salão  → tela de busca por slug
 *   2. Login/Cadastro    → PortalLogin (do módulo)
 *   3. Dashboard         → PortalDashboard (do módulo)
 *
 * Os componentes PortalLogin e PortalDashboard continuam sendo a
 * fonte única da verdade — sem duplicação de lógica.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { FiMapPin } from 'react-icons/fi';
import { PortalLogin }     from '@/modules/portal/PortalLogin';
import { PortalDashboard } from '@/modules/portal/PortalDashboard';
import { PortalCadastro }  from '@/modules/portal/PortalCadastro';
import { LOGO_ALTURA, FONTE_CORPO, FONTE_TITULO, cardPremium, eyebrow, fileteDourado, tituloSecao } from '@/modules/portal/estiloPortal';

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type Fase = 'cadastro' | 'selecionar_salao' | 'login' | 'dashboard';

// ─── TELA DE SELEÇÃO / BUSCA DE SALÃO ────────────────────────────────────────
function TelaSelecaoSalao({ onSalaoSelecionado, onIrParaCadastro }: { onSalaoSelecionado: (s: any) => void; onIrParaCadastro: () => void }) {
  const [busca, setBusca] = useState('');
  const [saloes, setSaloes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [jaBuscou, setJaBuscou] = useState(false);

  // Mostra os salões já cadastrados de cara, em ordem alfabética, em vez
  // de deixar a lista vazia até o cliente digitar algo. Quem não sabe o
  // nome exato do salão consegue escolher visualmente.
  useEffect(() => {
    setCarregando(true);
    supabase
      .from('saloes')
      .select('id, nome_fantasia, slug, bairro, cidade, estado, telefone, cobrar_sinal, porcentagem_sinal')
      .order('nome_fantasia', { ascending: true })
      .limit(20)
      .then(({ data, error }) => {
        if (error) setErro('Erro ao carregar salões. Tente novamente.');
        setSaloes(data || []);
        setCarregando(false);
      });
  }, []);

  async function pesquisar(e: React.FormEvent) {
    e.preventDefault();
    setJaBuscou(true);
    setCarregando(true);
    setErro('');

    // Busca vazia = volta a mostrar a lista completa (mesmo comportamento
    // do carregamento inicial), em vez de não fazer nada.
    const query = supabase
      .from('saloes')
      .select('id, nome_fantasia, slug, bairro, cidade, estado, telefone, cobrar_sinal, porcentagem_sinal')
      .order('nome_fantasia', { ascending: true })
      .limit(20);

    const { data, error } = busca.trim()
      ? await query.or(`slug.ilike.%${busca.trim()}%,nome_fantasia.ilike.%${busca.trim()}%`)
      : await query;

    if (error) setErro('Erro ao buscar. Tente novamente.');
    setSaloes(data || []);
    setCarregando(false);
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 20,
      fontFamily: FONTE_CORPO
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img src={C.logoUrl} alt="Eleva" style={{ height: LOGO_ALTURA, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
        <div style={fileteDourado} />
      </div>

      <div style={{ ...cardPremium, width: '100%', maxWidth: 440, padding: '40px 32px' }}>
        <p style={{ ...eyebrow, textAlign: 'center', margin: 0 }}>A sua experiência premium</p>
        <h1 style={tituloSecao}>Portal do Cliente</h1>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: C.textLight, textAlign: 'center' }}>
          Escolha um salão da lista ou busque pelo nome
        </p>

        <form onSubmit={pesquisar} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Ex: Studio Maria ou @mariabeleza"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 10,
              border: `1px solid ${C.borderMid}`, fontSize: 14,
              outlineColor: C.sidebarBg, color: C.textMain,
              backgroundColor: C.bgCard, boxSizing: 'border-box' as const,
              fontFamily: FONTE_CORPO
            }}
          />
          <button
            type="submit"
            disabled={carregando}
            className="transition-all hover:opacity-95 shadow-sm"
            style={{
              padding: '12px 20px', background: C.sidebarBg, color: '#fff',
              border: 'none', borderRadius: 10, fontWeight: 700,
              fontSize: 14, cursor: carregando ? 'not-allowed' : 'pointer',
              fontFamily: FONTE_TITULO
            }}
          >
            {carregando ? '...' : 'Buscar'}
          </button>
        </form>

        {erro && (
          <p style={{ marginTop: 12, color: C.danger, fontSize: 12, fontWeight: 600 }}>{erro}</p>
        )}

        {saloes.length > 0 && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {saloes.map(s => (
              <button
                key={s.id}
                onClick={() => onSalaoSelecionado(s)}
                className="transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  width: '100%', padding: '14px 16px', background: C.bgCard,
                  border: `1px solid ${C.border}`, borderRadius: 12,
                  borderLeft: `3px solid ${C.douradoEleva}`,
                  cursor: 'pointer', textAlign: 'left'
                }}
              >
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.textMain }}>
                  {s.nome_fantasia}
                </p>
                {s.cidade && (
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textLight, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FiMapPin size={11} /> {s.bairro ? `${s.bairro} · ` : ''}{s.cidade}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {saloes.length === 0 && jaBuscou && !carregando && (
          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: C.textMuted }}>
            Nenhum salão encontrado. Verifique o nome ou link.
          </p>
        )}

        {saloes.length === 0 && !jaBuscou && !carregando && (
          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: C.textMuted }}>
            Nenhum salão cadastrado ainda.
          </p>
        )}

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: C.textMuted, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
          Sou cliente novo. <span onClick={onIrParaCadastro} className="transition-all hover:opacity-70" style={{ color: C.sidebarBg, fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>Cadastre-se</span>
        </p>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: C.textLight, letterSpacing: '0.3px' }}>Desenvolvido por <span style={{ color: C.douradoEleva, fontWeight: 700 }}>Eleva</span></p>
    </div>
  );
}

// ─── ORQUESTRADOR PRINCIPAL (export default obrigatório para Next.js) ─────────
export default function PortalPage() {
  const [fase, setFase]                     = useState<Fase>('selecionar_salao');
  const [salaoSelecionado, setSalaoSelecionado] = useState<any>(null);
  const [clienteLogado, setClienteLogado]   = useState<any>(null);
  const [restaurando, setRestaurando]       = useState(true);

  const [clienteRecemCadastradoId, setClienteRecemCadastradoId] = useState<string | null>(null);

  const [credencial, setCredencial] = useState('');
  const [senha, setSenha] = useState('');
  const [carregandoLogin, setCarregandoLogin] = useState(false);
  const [erroLogin, setErroLogin] = useState('');

  // Restaura sessão ativa após reload sem exigir novo login
  useEffect(() => {
    async function restaurarSessao() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setRestaurando(false); return; }

        const salaoSalvo = localStorage.getItem('portal_salao');
        if (!salaoSalvo) { setRestaurando(false); return; }

        const salao = JSON.parse(salaoSalvo);
        const { data: vinculo } = await supabase
          .from('clientes')
          .select('*')
          .eq('salao_id', salao.id)
          .eq('usuario_portal_id', session.user.id)
          .maybeSingle();

        if (vinculo) {
          setSalaoSelecionado(salao);
          setClienteLogado(vinculo);
          setFase('dashboard');
        }
      } catch {}
      setRestaurando(false);
    }
    restaurarSessao();
  }, []);

  // Tenta resolver o slug da URL ao montar (ex: /portal?s=meu-salao)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('s') || params.get('slug');
    if (!slug) return;

    supabase
      .from('saloes')
      .select('id, nome_fantasia, slug, bairro, cidade, estado, telefone, cobrar_sinal, porcentagem_sinal')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSalaoSelecionado(data);
          setFase('login');
        }
      });
  }, []);

  // ─── AUTENTICAÇÃO DO CLIENTE ─────────────────────────────────────────────
  async function fazerLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!credencial.trim() || !senha.trim() || !salaoSelecionado) return;

    setCarregandoLogin(true);
    setErroLogin('');

    // Autentica via Supabase Auth (email + senha com hash)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: credencial.trim().toLowerCase(),
      password: senha,
    });

    if (authError || !authData.user) {
      setErroLogin('E-mail ou senha incorretos. Verifique seus dados ou cadastre-se.');
      setCarregandoLogin(false);
      return;
    }

    const userId = authData.user.id;

    // Busca o vínculo "clientes" deste usuário com o salão selecionado
    const { data: vinculo } = await supabase
      .from('clientes')
      .select('*')
      .eq('salao_id', salaoSelecionado.id)
      .eq('usuario_portal_id', userId)
      .maybeSingle();

    if (vinculo) {
      setClienteLogado(vinculo);
      setFase('dashboard');
      try { localStorage.setItem('portal_salao', JSON.stringify(salaoSelecionado)); } catch {}
      setCarregandoLogin(false);
      return;
    }

    // Sem vínculo ainda — busca perfil em usuarios_portal para criar o vínculo
    const { data: dadosPortal } = await supabase
      .from('usuarios_portal')
      .select('nome_completo, email, cpf, telefone_whatsapp')
      .eq('id', userId)
      .maybeSingle();

    // Fallback: se não tem linha em usuarios_portal (conta criada antes desta
    // tabela existir ou via outro caminho), usa os dados do Auth diretamente
    // e cria a linha em usuarios_portal para normalizar para o futuro.
    const nomeFallback = authData.user.user_metadata?.nome_completo
      || authData.user.user_metadata?.full_name
      || authData.user.email?.split('@')[0]
      || 'Cliente';

    const emailFallback = authData.user.email || '';

    if (!dadosPortal) {
      // Tenta criar o registro em usuarios_portal para normalizar
      await supabase.from('usuarios_portal').insert([{
        id: userId,
        nome_completo: nomeFallback,
        email: emailFallback,
        telefone_whatsapp: '',
        cpf: null,
      }]);
    }

    const dadosFinais = dadosPortal || {
      nome_completo: nomeFallback,
      email: emailFallback,
      cpf: null,
      telefone_whatsapp: '',
    };

    const { data: novoVinculo, error: erroInsertVinculo } = await supabase
      .from('clientes')
      .insert([{
        salao_id: salaoSelecionado.id,
        usuario_portal_id: userId,
        nome_completo: dadosFinais.nome_completo,
        email: dadosFinais.email,
        cpf: dadosFinais.cpf,
        telefone_whatsapp: dadosFinais.telefone_whatsapp,
        total_gasto: 0,
        total_visitas: 0,
      }])
      .select()
      .maybeSingle();

    if (erroInsertVinculo || !novoVinculo) {
      setErroLogin('Não foi possível concluir seu acesso a este salão. Tente novamente.');
      setCarregandoLogin(false);
      return;
    }

    setClienteLogado(novoVinculo);
    setFase('dashboard');
    try { localStorage.setItem('portal_salao', JSON.stringify(salaoSelecionado)); } catch {}
    setCarregandoLogin(false);
  }

  async function sairDoPortal() {
    await supabase.auth.signOut();
    try { localStorage.removeItem('portal_salao'); } catch {}
    setClienteLogado(null);
    setCredencial('');
    setSenha('');
    setErroLogin('');
    setFase('login');
  }

  function trocarDeSalao() {
    try { localStorage.removeItem('portal_salao'); } catch {}
    setClienteLogado(null);
    setSalaoSelecionado(null);
    setCredencial('');
    setSenha('');
    setErroLogin('');
    setFase('selecionar_salao');
  }

  async function aoSelecionarSalao(salao: any) {
    setSalaoSelecionado(salao);

    // Se acabou de se cadastrar nesta sessão, já sabemos quem ele é —
    // não faz sentido pedir telefone/CPF de novo. Busca (ou cria) o
    // vínculo "clientes" deste salão específico, usando o endereço
    // pendente salvo durante o cadastro, se houver.
    if (clienteRecemCadastradoId) {
      setCarregandoLogin(true);

      const { data: vinculoExistente } = await supabase
        .from('clientes')
        .select('*')
        .eq('salao_id', salao.id)
        .eq('usuario_portal_id', clienteRecemCadastradoId)
        .maybeSingle();

      if (vinculoExistente) {
        setClienteLogado(vinculoExistente);
        setFase('dashboard');
        try { localStorage.setItem('portal_salao', JSON.stringify(salao)); } catch {}
        setCarregandoLogin(false);
        return;
      }

      // Não existe vínculo com ESTE salão ainda — busca os dados básicos
      // em usuarios_portal para criar o vínculo (cliente) aqui.
      const { data: dadosPortal } = await supabase
        .from('usuarios_portal')
        .select('nome_completo, email, cpf, telefone_whatsapp')
        .eq('id', clienteRecemCadastradoId)
        .maybeSingle();

      let enderecoPendente: any = {};
      try {
        const salvo = sessionStorage.getItem('eleva_endereco_pendente');
        if (salvo) enderecoPendente = JSON.parse(salvo);
      } catch { /* ignora se não conseguir ler */ }

      const { data: novoVinculo } = await supabase
        .from('clientes')
        .insert([{
          salao_id: salao.id,
          usuario_portal_id: clienteRecemCadastradoId,
          nome_completo: dadosPortal?.nome_completo,
          email: dadosPortal?.email,
          cpf: dadosPortal?.cpf,
          telefone_whatsapp: dadosPortal?.telefone_whatsapp,
          ...enderecoPendente,
          total_gasto: 0,
          total_visitas: 0,
        }])
        .select()
        .maybeSingle();

      try { sessionStorage.removeItem('eleva_endereco_pendente'); } catch { /* ignora */ }
      setClienteLogado(novoVinculo);
      setFase('dashboard');
      try { localStorage.setItem('portal_salao', JSON.stringify(salao)); } catch {}
      setCarregandoLogin(false);
      return;
    }

    setFase('login');
  }

  function irParaCadastro() {
    setFase('cadastro');
  }

  // Depois que a Edge Function cria a conta (auth.users + usuarios_portal),
  // o cliente ainda não escolheu salão — segue para a tela de busca normal.
  // O id retornado fica disponível via clienteRecemCadastradoId para o
  // próximo login (assim que escolher o salão) já reconhecer quem ele é,
  // sem precisar digitar telefone/CPF de novo nesta mesma sessão.
  function aoConcluirCadastro(resultado: { id: string }) {
    setClienteRecemCadastradoId(resultado.id);
    setFase('selecionar_salao');
  }

  // ─── RENDER POR FASE ─────────────────────────────────────────────────────
  if (restaurando) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: C.textLight, fontFamily: FONTE_CORPO }}>A carregar...</p>
    </div>
  );

  if (fase === 'cadastro') {
    return (
      <PortalCadastro
        onCadastroConcluido={aoConcluirCadastro}
        irParaLogin={() => setFase('selecionar_salao')}
      />
    );
  }

  if (fase === 'selecionar_salao') {
    return <TelaSelecaoSalao onSalaoSelecionado={aoSelecionarSalao} onIrParaCadastro={irParaCadastro} />;
  }

  if (fase === 'login') {
    return (
      <PortalLogin
        credencial={credencial}
        setCredencial={setCredencial}
        senha={senha}
        setSenha={setSenha}
        fazerLogin={fazerLogin}
        carregando={carregandoLogin}
        erro={erroLogin}
        salaoSelecionado={salaoSelecionado}
        trocarDeSalao={trocarDeSalao}
        irParaCadastro={irParaCadastro}
      />
    );
  }

  // fase === 'dashboard'
  return (
    <PortalDashboard
      clienteLogado={clienteLogado}
      sairDoPortal={sairDoPortal}
      salaoSelecionado={salaoSelecionado}
      trocarDeSalao={trocarDeSalao}
    />
  );
}