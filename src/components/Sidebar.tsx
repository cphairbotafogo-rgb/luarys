'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { C } from '@/lib/constants';
import {
  FiLogOut, FiChevronDown, FiChevronUp, FiLock,
  FiFileText, FiDatabase, FiEdit2, FiChevronLeft, FiChevronRight, FiMenu, FiX,
} from 'react-icons/fi';
import { CATALOGO_ITENS_SIDEBAR } from './sidebar/catalogoItensSidebar';
import { usePreferenciasSidebar } from './sidebar/usePreferenciasSidebar';
import { montarItensVisiveis } from './sidebar/montarItensVisiveis';
import { EditorSidebar } from './sidebar/EditorSidebar';

export function Sidebar({ aba, setAba, perfil }: any) {
  const [menuNotasAberto, setMenuNotasAberto] = useState(
    aba === 'nfse' || aba === 'nfce' || aba === 'nfse_setup',
  );
  const [editorAberto,        setEditorAberto]        = useState(false);
  const [agendamentosFuturos, setAgendamentosFuturos] = useState<number | null>(null);
  const [recolhida, setRecolhida] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_recolhida') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('sidebar_recolhida', String(recolhida));
  }, [recolhida]);

  // ── Tela estreita (celular): o menu vira uma gaveta que desliza por cima
  // do conteúdo, em vez de dividir a largura com ele (não cabe as duas coisas
  // numa tela de celular). O conceito de "recolher" (72px só com ícones) é
  // só de desktop — no celular é aberto/fechado, tudo ou nada.
  const [ehMobile, setEhMobile] = useState(false);
  const [abertaMobile, setAbertaMobile] = useState(false);

  useEffect(() => {
    function checar() { setEhMobile(window.innerWidth < 768); }
    checar();
    window.addEventListener('resize', checar);
    return () => window.removeEventListener('resize', checar);
  }, []);

  // Fecha a gaveta automaticamente ao trocar de aba — sem isso, o menu fica
  // aberto por cima da tela nova que acabou de ser escolhida.
  useEffect(() => { if (ehMobile) setAbertaMobile(false); }, [aba, ehMobile]);

  // "Recolhida" (72px só ícone) só existe no desktop — no celular a gaveta é
  // sempre largura cheia quando aberta, então toda a UI interna que decide
  // ícone-só-vs-ícone+texto usa esta versão, nunca a flag bruta.
  const recolhidaEfetiva = !ehMobile && recolhida;

  useEffect(() => {
    if (!perfil?.salao_id) return;
    const hoje = new Date().toISOString().split('T')[0];
    supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('salao_id', perfil.salao_id)
      .in('status', ['Agendado', 'Confirmado'])
      .gte('data', hoje)
      .then(({ count }) => setAgendamentosFuturos(count ?? 0));
  }, [perfil?.salao_id]);

  const { preferencias, alternarOculto, reordenar, restaurar } = usePreferenciasSidebar(perfil?.id);

  async function fazerSair() {
    const ok = await confirmarAcaoGlobal({
      titulo: 'Sair do sistema?',
      descricao: 'Você será desconectado. Para voltar, basta fazer login novamente.',
      rotuloCta: 'Sair',
      perigoso: false,
    });
    if (ok) {
      await supabase.auth.signOut();
      window.location.href = '/';
    }
  }

  const btnStyle = (ativa: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center',
    gap: recolhidaEfetiva ? 0 : '12px',
    width: '100%',
    padding: recolhidaEfetiva ? '12px 0' : '12px 16px',
    justifyContent: recolhidaEfetiva ? 'center' : 'flex-start',
    background: ativa ? C.activeMenuBg : 'transparent',
    color: ativa ? '#FFFFFF' : C.sidebarText,
    border: 'none', borderRadius: '8px', fontSize: '14px',
    fontWeight: ativa ? '600' : '400',
    cursor: 'pointer', textAlign: 'left', textDecoration: 'none',
    transition: 'all 0.2s ease-in-out',
  });

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '10px', fontWeight: '700', color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '1px',
    margin: '24px 0 8px 16px', display: 'block',
  };

  const NavLink = ({ id, icon, label, subItem = false, bloqueado = false }: any) => (
    <a
      href={`#${id}`}
      title={recolhidaEfetiva ? label : undefined}
      onClick={(e) => {
        if (!e.ctrlKey && !e.metaKey && e.button === 0) {
          e.preventDefault();
          setAba(id);
          window.history.pushState(null, '', `#${id}`);
        }
      }}
      className="font-body"
      style={{
        ...btnStyle(aba === id),
        padding: recolhidaEfetiva ? '12px 0' : subItem ? '10px 16px 10px 44px' : '12px 16px',
        fontSize: subItem && !recolhidaEfetiva ? '13px' : '14px',
        position: 'relative',
        justifyContent: recolhidaEfetiva ? 'center' : bloqueado ? 'space-between' : 'flex-start',
      }}
    >
      {subItem && !recolhidaEfetiva && (
        <div style={{
          position: 'absolute', left: '22px', top: 0, bottom: 0,
          width: '1px', background: aba === id ? '#FFFFFF' : '#475569',
        }} />
      )}
      <span style={{ display: 'flex', alignItems: 'center', gap: recolhidaEfetiva ? 0 : (subItem ? '8px' : '12px') }}>
        <span style={{ display: 'flex', alignItems: 'center', opacity: aba === id ? 1 : 0.8 }}>{icon}</span>
        {!recolhidaEfetiva && <span style={{ opacity: aba === id ? 1 : 0.9 }}>{label}</span>}
      </span>
      {bloqueado && !recolhidaEfetiva && <FiLock size={12} style={{ opacity: 0.6 }} title="Módulo pago" />}
    </a>
  );

  const itensVisiveis = montarItensVisiveis(CATALOGO_ITENS_SIDEBAR, perfil, preferencias);
  const itensEditaveisDoLogin = CATALOGO_ITENS_SIDEBAR.filter(i => !i.fixo && i.condicao(perfil));
  const secoes: Array<'Operação' | 'Gestão & Negócio' | 'Fiscal & Ajustes'> = [
    'Operação', 'Gestão & Negócio', 'Fiscal & Ajustes',
  ];

  return (
    <>
      {/* Botão de menu — só no celular, sempre visível (aba não tem Header próprio) */}
      {ehMobile && (
        <button
          onClick={() => setAbertaMobile(v => !v)}
          aria-label={abertaMobile ? 'Fechar menu' : 'Abrir menu'}
          style={{
            position: 'fixed', top: 12, left: 12, zIndex: 10002,
            width: 40, height: 40, borderRadius: 10,
            background: C.sidebarBg, color: '#fff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)', cursor: 'pointer',
          }}
        >
          {abertaMobile ? <FiX size={20} /> : <FiMenu size={20} />}
        </button>
      )}

      {/* Fundo escurecido — clique fecha a gaveta */}
      {ehMobile && abertaMobile && (
        <div
          onClick={() => setAbertaMobile(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999 }}
        />
      )}

      <style>{`.luarys-sidebar-drawer { height: 100vh; height: 100dvh; }`}</style>
      <div className="luarys-sidebar-drawer" style={{
        width: ehMobile ? '280px' : (recolhida ? '72px' : '280px'),
        background: C.sidebarBg,
        display: 'flex', flexDirection: 'column',
        padding: recolhidaEfetiva ? '24px 8px' : '24px 16px',
        boxSizing: 'border-box', justifyContent: 'space-between',
        overflowY: 'auto', overflowX: 'hidden',
        boxShadow: ehMobile ? '4px 0 24px rgba(0,0,0,0.25)' : '4px 0 24px rgba(0,0,0,0.05)',
        transition: ehMobile ? 'transform 0.25s ease' : 'width 0.25s ease, padding 0.25s ease',
        flexShrink: 0,
        position: ehMobile ? 'fixed' : 'relative',
        top: ehMobile ? 0 : undefined,
        left: ehMobile ? 0 : undefined,
        transform: ehMobile ? (abertaMobile ? 'translateX(0)' : 'translateX(-100%)') : undefined,
        zIndex: 10000,
      }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* LOGOTIPO */}
        <div style={{ padding: '0 4px 12px', display: 'flex', justifyContent: 'center' }}>
          {recolhidaEfetiva ? (
            <img
              src="/luarys-favicon-256.png"
              alt=""
              aria-hidden="true"
              style={{ width: '40px', height: '40px', objectFit: 'contain', filter: 'drop-shadow(0px 4px 12px rgba(0,0,0,0.3))' }}
            />
          ) : (
            <img
              src={C.logoUrl}
              alt="Luarys"
              style={{ width: '100%', maxWidth: '204px', height: 'auto', display: 'block', filter: 'drop-shadow(0px 4px 10px rgba(0,0,0,0.2))' }}
            />
          )}
        </div>

        {/* BOTÃO RECOLHER / EXPANDIR — só desktop; no celular a gaveta é aberta/fechada, não tem meio-termo */}
        {!ehMobile && (
          <button
            onClick={() => setRecolhida(r => !r)}
            title={recolhida ? 'Expandir menu' : 'Recolher menu'}
            className="transition-all hover:bg-white/5"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, cursor: 'pointer',
              padding: '6px 10px',
              color: '#94A3B8', marginBottom: 4,
              fontSize: 11, fontWeight: 600,
              gap: 6,
            }}
          >
            {recolhida
              ? <FiChevronRight size={16} />
              : <><FiChevronLeft size={14} /> Recolher</>
            }
          </button>
        )}

        {/* CARTÃO DE USUÁRIO */}
        <div
          onClick={fazerSair}
          title={recolhidaEfetiva ? `${perfil?.nome} — clique para sair` : 'Clique para sair da conta'}
          className="transition-all hover:bg-white/5"
          style={{
            background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: recolhidaEfetiva ? 'center' : 'flex-start',
            gap: '12px', cursor: 'pointer', marginBottom: '8px',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div
            className="font-title font-bold text-xs"
            style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: C.douradoLuarys, color: C.sidebarBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {perfil?.nome?.substring(0, 2).toUpperCase() || 'OP'}
          </div>
          {!recolhidaEfetiva && (
            <div style={{ overflow: 'hidden' }}>
              <p className="font-body" style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {perfil?.nome}
              </p>
              <p className="font-title" style={{ margin: '2px 0 0', fontSize: '10px', color: C.douradoLuarys, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {perfil?.isDono ? 'Proprietário' : perfil?.permissoes?.perfil_acesso || 'Colaborador'}
              </p>
            </div>
          )}
        </div>

        {/* PERSONALIZAR MENU — oculto quando recolhido */}
        {!recolhidaEfetiva && (
          <button
            onClick={() => setEditorAberto(true)}
            className="transition-all hover:bg-white/5"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', marginBottom: 8, fontSize: 11, fontWeight: 600, color: '#94A3B8' }}
          >
            <FiEdit2 size={12} /> Personalizar menu
          </button>
        )}

        {/* NAVEGAÇÃO */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {secoes.map(secao => {
            const itensDaSecao = itensVisiveis.filter(item => item.secao === secao);
            if (itensDaSecao.length === 0) return null;

            return (
              <div key={secao}>
                {recolhidaEfetiva
                  ? <div style={{ height: 12 }} />
                  : <span className="font-title" style={sectionTitleStyle}>{secao}</span>
                }

                {itensDaSecao.map(item => {
                  if (item.id === 'nfse') {
                    // Recolhido: ícone único que expande o menu ao clicar
                    if (recolhidaEfetiva) {
                      return (
                        <button
                          key="grupo-notas-fiscais"
                          onClick={() => { setRecolhida(false); setMenuNotasAberto(true); }}
                          title="Notas Fiscais"
                          className="font-body transition-all hover:bg-white/5"
                          style={{ ...btnStyle(false), border: 'none' }}
                        >
                          <FiFileText size={18} style={{ opacity: 0.8 }} />
                        </button>
                      );
                    }
                    return (
                      <div key="grupo-notas-fiscais" style={{ display: 'flex', flexDirection: 'column' }}>
                        <button
                          onClick={() => setMenuNotasAberto(!menuNotasAberto)}
                          className="font-body transition-all hover:bg-white/5"
                          style={{ ...btnStyle(false), justifyContent: 'space-between', padding: '12px 16px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.8 }}>
                            <FiFileText size={18} />
                            <span>Notas Fiscais</span>
                          </div>
                          <div style={{ opacity: 0.6 }}>
                            {menuNotasAberto ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                          </div>
                        </button>
                        {menuNotasAberto && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <NavLink id="nfse_setup" icon={<FiDatabase size={16} />} label="Configurar NFS-e" subItem bloqueado={!perfil?.moduloFiscalLiberado} />
                            <NavLink id="nfse"       icon={<FiFileText size={16} />} label="Serviços (NFS-e)"  subItem bloqueado={!perfil?.moduloFiscalLiberado} />
                            <NavLink id="nfce"       icon={<FiDatabase size={16} />} label="Produtos (NFC-e)"  subItem bloqueado={!perfil?.moduloFiscalLiberado} />
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (item.id === 'nfse_setup') return null;
                  if (item.id === 'nfce')       return null;

                  return (
                    <div key={item.id}>
                      <NavLink
                        id={item.id} icon={item.icon} label={item.label}
                        bloqueado={item.bloqueado ? item.bloqueado(perfil) : false}
                      />
                      {item.id === 'agenda' && agendamentosFuturos !== null && !recolhidaEfetiva && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px 6px 44px' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: agendamentosFuturos > 0 ? '#4ADE80' : '#475569', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
                            {agendamentosFuturos > 0
                              ? `${agendamentosFuturos} agendamento${agendamentosFuturos > 1 ? 's' : ''} futuro${agendamentosFuturos > 1 ? 's' : ''}`
                              : 'Nenhum agendamento futuro'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>

      {/* BOTÃO DE SAÍDA */}
      <div style={{ marginTop: '24px' }}>
        <button
          onClick={fazerSair}
          title={recolhidaEfetiva ? 'Sair da Conta' : undefined}
          className="font-body transition-all hover:bg-white/5"
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: recolhidaEfetiva ? 'center' : 'flex-start',
            gap: '12px', width: '100%',
            padding: recolhidaEfetiva ? '12px 0' : '12px 16px',
            background: 'transparent', color: '#94A3B8',
            border: 'none', borderRadius: '8px',
            fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          }}
        >
          <FiLogOut size={18} style={{ opacity: 0.7 }} />
          {!recolhidaEfetiva && 'Sair da Conta'}
        </button>
      </div>

      {editorAberto && (
        <EditorSidebar
          itensEditaveis={itensEditaveisDoLogin}
          preferencias={preferencias}
          onAlternarOculto={alternarOculto}
          onReordenar={reordenar}
          onRestaurar={restaurar}
          onFechar={() => setEditorAberto(false)}
        />
      )}
      </div>
    </>
  );
}
