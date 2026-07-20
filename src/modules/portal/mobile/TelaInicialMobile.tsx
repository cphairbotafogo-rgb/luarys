'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, getDataHojeLocal } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { FiEdit2, FiCalendar, FiUser, FiMapPin, FiPhone, FiMap, FiMessageCircle, FiClock, FiFileText, FiStar } from 'react-icons/fi';
import { RAIO_MD, RAIO_LG, RAIO_XL, RAIO_3XL } from '@/lib/estiloGlobal';
import { LOGO_ALTURA_HEADER, FONTE_TITULO, FONTE_CORPO, GRADIENTE_SLATE, cardConteudo } from '@/modules/portal/estiloPortal';
import { PortalComunicados } from '@/modules/portal/comunicados/PortalComunicados';
import { PortalVitrine } from '@/modules/portal/vitrine/PortalVitrine';
import { PortalCarrinho } from '@/modules/portal/vitrine/PortalCarrinho';
import { PortalPromocoes } from '@/modules/portal/vitrine/PortalPromocoes';
import { PortalAvaliacoes } from '@/modules/portal/avaliacoes/PortalAvaliacoes';
import { ModalPerfil } from '@/modules/portal/ModalPerfil';
import { ModalHistorico } from '@/modules/portal/ModalHistorico';
import { ModalAnamnese } from '@/modules/portal/ModalAnamnese';
import { ModalCancelamento } from '@/modules/portal/ModalCancelamento';
import { NavBarMobile } from './NavBarMobile';
import { TelaAgendamentoMobile } from './TelaAgendamentoMobile';
import { BotaoTrocarLayout } from '@/components/BotaoTrocarLayout';

interface Props {
  clienteLogado: any;
  salaoSelecionado: any;
  sairDoPortal: () => void;
  trocarDeSalao: () => void;
}

export function TelaInicialMobile({ clienteLogado, salaoSelecionado, sairDoPortal, trocarDeSalao }: Props) {
  const toast = useToast();
  const [clienteFresh, setClienteFresh] = useState<any>(clienteLogado);
  const [proximosAgs, setProximosAgs] = useState<any[]>([]);
  const [carregandoProximo, setCarregandoProximo] = useState(true);
  const [agParaCancelar, setAgParaCancelar] = useState<any>(null);
  const [vitrineConfig, setVitrineConfig] = useState<any>(null);
  const [vitrineLiberada, setVitrineLiberada] = useState(false);
  const [carrinho, setCarrinho] = useState<any[]>([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [agendamentoAberto, setAgendamentoAberto] = useState(false);
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [modalAnamneseAberto, setModalAnamneseAberto] = useState(false);
  const [salvandoAnamnese, setSalvandoAnamnese] = useState(false);
  const [dadosAnamnese, setDadosAnamnese] = useState({ tipo_cabelo: '', quimicas_anteriores: '', alergias: '', medicamentos: '', objetivos: '' });
  const [modalCancelamentoAberto, setModalCancelamentoAberto] = useState(false);
  const [cienteCancelamento, setCienteCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [agParaAvaliar, setAgParaAvaliar] = useState<any>(null);
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const [enviandoExclusao, setEnviandoExclusao] = useState(false);

  async function solicitarExclusaoConta() {
    setEnviandoExclusao(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/portal/solicitar-exclusao', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    });
    if (res.ok) {
      await supabase.auth.signOut();
      window.location.href = '/portal';
    } else {
      toast.erro('Não foi possível processar a exclusão. Entre em contato via privacidade@luarys.com.br.');
      setEnviandoExclusao(false);
    }
  }

  useEffect(() => {
    buscarProximaVisita();
    if (salaoSelecionado?.id) {
      Promise.all([
        supabase.from('vitrine_config').select('modo,ativo').eq('salao_id', salaoSelecionado.id).maybeSingle(),
        supabase.from('saloes').select('vitrine_liberada').eq('id', salaoSelecionado.id).maybeSingle(),
      ]).then(([resConfig, resSalao]) => {
        setVitrineConfig(resConfig.data);
        setVitrineLiberada(resSalao.data?.vitrine_liberada ?? false);
      });
    }
  }, [clienteFresh, salaoSelecionado]);

  async function buscarProximaVisita() {
    if (!clienteFresh?.id || !salaoSelecionado?.id) return;
    setCarregandoProximo(true);
    const { data } = await supabase.from('agendamentos').select('id,data,inicio,status,created_at,observacao,profissionais(nome),servicos(nome_servico)').eq('cliente_id', clienteFresh.id).eq('salao_id', salaoSelecionado.id).gte('data', getDataHojeLocal()).neq('status', 'Cancelado').order('data', { ascending: true }).order('inicio', { ascending: true }).limit(10);
    setProximosAgs(data ?? []);
    setCarregandoProximo(false);
  }

  let permiteCancelamento = false, motivoLegal = '';
  if (agParaCancelar?.data && agParaCancelar?.inicio) {
    const falta = new Date(`${agParaCancelar.data}T${agParaCancelar.inicio}`).getTime() - Date.now();
    const desde = Date.now() - new Date(agParaCancelar.created_at || new Date()).getTime();
    if (falta >= 86400000) { permiteCancelamento = true; motivoLegal = ' | Cancelado dentro do prazo (> 24h).'; }
    else if (desde <= 900000) { permiteCancelamento = true; motivoLegal = ' | Cancelado dentro dos 15 min de tolerância.'; }
    else { motivoLegal = ' | Fora do prazo. Retenção de sinal aplicada (Art. 418 CC).'; }
  }

  async function cancelarAgendamento() {
    if (!agParaCancelar?.id) return;
    setCancelando(true);
    const { error } = await supabase.from('agendamentos').update({ status: 'Cancelado', observacao: (agParaCancelar.observacao || '') + motivoLegal }).eq('id', agParaCancelar.id);
    if (!error) { toast.sucesso('Agendamento cancelado.'); setModalCancelamentoAberto(false); setAgParaCancelar(null); await buscarProximaVisita(); }
    else toast.erro('Erro ao cancelar: ' + error.message);
    setCancelando(false);
  }

  async function abrirHistorico() {
    setModalHistoricoAberto(true); setCarregandoHistorico(true);
    let ids = [clienteFresh.id];
    if (clienteFresh.usuario_portal_id) { const { data: vinculos } = await supabase.from('clientes').select('id').eq('usuario_portal_id', clienteFresh.usuario_portal_id); if (vinculos?.length) ids = vinculos.map((v: any) => v.id); }
    const { data } = await supabase.from('agendamentos').select('id,data,inicio,status,cliente_id,profissionais(nome),servicos(nome_servico)').in('cliente_id', ids).order('data', { ascending: false }).order('inicio', { ascending: false });
    setHistorico(data || []);
    setCarregandoHistorico(false);
  }

  async function salvarAnamnese(e: any) {
    e.preventDefault(); if (!clienteFresh?.id) return;
    setSalvandoAnamnese(true);
    const { error } = await supabase.from('clientes').update({ anamnese: dadosAnamnese }).eq('id', clienteFresh.id);
    if (!error) { setClienteFresh({ ...clienteFresh, anamnese: dadosAnamnese }); setModalAnamneseAberto(false); toast.sucesso('Ficha salva!'); }
    else toast.erro('Erro: ' + error.message);
    setSalvandoAnamnese(false);
  }

  if (agendamentoAberto) return <TelaAgendamentoMobile salaoSelecionado={salaoSelecionado} clienteFresh={clienteFresh} onVoltar={() => setAgendamentoAberto(false)} onFinalizado={() => { setAgendamentoAberto(false); buscarProximaVisita(); }} />;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONTE_CORPO, paddingBottom: 80 }}>
      <div style={{ background: C.bgCard, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}`, borderTop: `3px solid ${C.douradoEleva}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <img src={C.logoUrl} alt="Eleva" style={{ height: LOGO_ALTURA_HEADER, objectFit: 'contain' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, margin: '0 12px' }}>
          <span style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 800, color: C.textMain, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{salaoSelecionado?.nome_fantasia}</span>
          <button onClick={trocarDeSalao} style={{ background: 'none', border: 'none', color: C.sidebarBg, fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Trocar</button>
        </div>
        <button onClick={sairDoPortal} style={{ background: 'none', border: 'none', color: C.danger, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Sair</button>
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.sidebarBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0, boxShadow: `0 0 0 3px ${C.bg}, 0 0 0 5px ${C.douradoEleva}` }}>{clienteFresh?.nome_completo?.substring(0, 1) || 'C'}</div>
          <div><h1 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 20, fontWeight: 800, color: C.sidebarBg }}>Olá, {clienteFresh?.nome_completo?.split(' ')[0] || 'Cliente'}!</h1>
            <button onClick={() => setModalPerfilAberto(true)} style={{ background: 'none', border: 'none', color: C.sidebarBg, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', textDecoration: 'underline' }}><FiEdit2 size={11} /> Editar perfil</button>
          </div>
        </div>

        <div style={{ position: 'relative', background: GRADIENTE_SLATE, borderRadius: RAIO_3XL, padding: 24, color: '#fff', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontFamily: FONTE_TITULO, margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.douradoEleva }}>Agendamento Online</p>
            <h2 style={{ fontFamily: FONTE_TITULO, margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>Pronta para brilhar?</h2>
            <button onClick={() => setAgendamentoAberto(true)} style={{ marginTop: 16, background: C.bgCard, color: C.sidebarBg, border: 'none', padding: '12px 20px', borderRadius: RAIO_LG, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONTE_TITULO, width: '100%', justifyContent: 'center' }}>
              <FiCalendar size={16} /> Novo Agendamento
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div onClick={abrirHistorico} style={{ ...cardConteudo, padding: 16, cursor: 'pointer' }}><div style={{ width: 40, height: 40, borderRadius: RAIO_LG, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiClock size={20} color={C.sidebarBg} /></div><h3 style={{ fontFamily: FONTE_TITULO, margin: '10px 0 2px', fontSize: 13, fontWeight: 800, color: C.textMain }}>Meus Serviços</h3><p style={{ margin: 0, fontSize: 11, color: C.textLight }}>Ver histórico</p></div>
          <div onClick={() => { setDadosAnamnese(clienteFresh?.anamnese || dadosAnamnese); setModalAnamneseAberto(true); }} style={{ ...cardConteudo, padding: 16, cursor: 'pointer' }}><div style={{ width: 40, height: 40, borderRadius: RAIO_LG, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiFileText size={20} color={C.sidebarBg} /></div><h3 style={{ fontFamily: FONTE_TITULO, margin: '10px 0 2px', fontSize: 13, fontWeight: 800, color: C.textMain }}>Ficha Técnica</h3><p style={{ margin: 0, fontSize: 11, color: C.textLight }}>Alergias e dados</p></div>
        </div>

        <PortalComunicados salaoId={salaoSelecionado?.id} />

        {vitrineLiberada && vitrineConfig?.ativo && vitrineConfig?.modo !== 'desativada' && (
          <div style={{ marginTop: 16 }}>
            <PortalVitrine salaoId={salaoSelecionado?.id} clienteId={clienteFresh?.id} clienteNome={clienteFresh?.nome_completo || 'Cliente'} modo={vitrineConfig.modo} onAbrirCarrinho={c => { setCarrinho(c); setCarrinhoAberto(true); }} />
          </div>
        )}
        {vitrineLiberada && vitrineConfig?.ativo && (
          <div style={{ marginTop: 16 }}>
            <PortalPromocoes salaoId={salaoSelecionado?.id} telefone={salaoSelecionado?.telefone} />
          </div>
        )}

        <div style={{ ...cardConteudo, padding: 20, marginTop: 16 }}>
          <h3 style={{ fontFamily: FONTE_TITULO, margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: C.textMain }}>Meus Agendamentos</h3>
          {carregandoProximo ? (
            <p style={{ textAlign: 'center', color: C.textLight, fontSize: 13, margin: 0 }}>Consultando...</p>
          ) : proximosAgs.length === 0 ? (
            <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', margin: 0 }}>Nenhum agendamento futuro.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {proximosAgs.map((a: any) => (
                <div key={a.id} style={{ background: C.bg, borderRadius: RAIO_XL, padding: 14, border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>{a.servicos?.nome_servico}</h4>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textMain, display: 'flex', alignItems: 'center', gap: 4 }}><FiUser size={11} /> {a.profissionais?.nome}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textLight, display: 'flex', alignItems: 'center', gap: 4 }}><FiCalendar size={11} /> {a.data?.split('-').reverse().join('/')} às {a.inicio?.substring(0, 5)}</p>
                    </div>
                    <span style={{ background: a.status === 'Confirmado' ? C.success : a.status === 'Aguardando' ? C.warning : C.danger, color: '#fff', padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800 }}>{a.status}</span>
                  </div>
                  {['Confirmado', 'Aguardando'].includes(a.status) && (
                    <button onClick={() => { setAgParaCancelar(a); setCienteCancelamento(false); setModalCancelamentoAberto(true); }} style={{ marginTop: 12, background: 'none', border: `1px solid ${C.danger}`, color: C.danger, padding: '8px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%' }}>Cancelar Agendamento</button>
                  )}
                  {a.status === 'Finalizado' && (
                    <button onClick={() => setAgParaAvaliar({ id: a.id, servico: a.servicos?.nome_servico, profissional: a.profissionais?.nome, id_prof: a.profissional_id, data: a.data, inicio: a.inicio })} style={{ marginTop: 12, background: `${C.douradoEleva}1A`, border: `1px solid ${C.douradoEleva}`, color: C.douradoEleva, padding: '8px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><FiStar size={13} /> Avaliar atendimento</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...cardConteudo, padding: 20, marginTop: 16 }}>
          <h3 style={{ fontFamily: FONTE_TITULO, margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: C.textMain }}>Sobre a Unidade</h3>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: C.textMain, display: 'flex', alignItems: 'center', gap: 8 }}><FiMapPin size={13} /> {salaoSelecionado?.bairro} - {salaoSelecionado?.estado}</p>
          {salaoSelecionado?.telefone && <p style={{ margin: '0 0 12px', fontSize: 13, color: C.textMain, display: 'flex', alignItems: 'center', gap: 8 }}><FiPhone size={13} /> {salaoSelecionado?.telefone}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <a href={`https://maps.google.com/?q=${encodeURIComponent((salaoSelecionado?.nome_fantasia || '') + ' ' + (salaoSelecionado?.bairro || ''))}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', background: C.bg, color: C.textMain, padding: '10px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, textAlign: 'center', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><FiMap size={13} /> Ver no Mapa</a>
            <a href={`https://wa.me/${(salaoSelecionado?.telefone || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', background: '#25D366', color: '#fff', padding: '10px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><FiMessageCircle size={13} /> WhatsApp</a>
          </div>
        </div>

        {/* Privacidade & Dados */}
        <div style={{ ...cardConteudo, padding: '14px 18px', marginTop: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, color: C.textLight, fontFamily: FONTE_TITULO, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Privacidade & Dados</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.textMuted, textDecoration: 'underline' }}>Política de Privacidade</a>
            <span style={{ color: C.border }}>·</span>
            <a href="/termos" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.textMuted, textDecoration: 'underline' }}>Termos de Uso</a>
          </div>
          <button
            onClick={() => setModalExclusaoAberto(true)}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#EF4444', cursor: 'pointer', textDecoration: 'underline', fontFamily: FONTE_CORPO }}
          >
            Solicitar exclusão da minha conta
          </button>
        </div>

        <div style={{ textAlign: 'center', padding: '24px 0 8px' }}><BotaoTrocarLayout versaoAtual="mobile" /></div>
      </div>

      {/* Modal de exclusão */}
      {modalExclusaoAberto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9991, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0' }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', padding: '24px 20px 36px' }}>
            <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 10px' }}>Solicitar exclusão da conta</h3>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: '0 0 10px' }}>
              Seus dados de cadastro e ficha de saúde serão apagados <strong>imediatamente</strong>. Registros de agendamentos ficam preservados de forma anônima.
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5, margin: '0 0 20px' }}>
              Dados fiscais são retidos por 5 anos por obrigação legal.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModalExclusaoAberto(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>Cancelar</button>
              <button onClick={solicitarExclusaoConta} disabled={enviandoExclusao} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: enviandoExclusao ? 'not-allowed' : 'pointer', fontFamily: FONTE_TITULO }}>
                {enviandoExclusao ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <NavBarMobile onAgendar={() => setAgendamentoAberto(true)} onHistorico={abrirHistorico} onPerfil={() => setModalPerfilAberto(true)} />
      <ModalPerfil clienteFresh={clienteFresh} setClienteFresh={setClienteFresh} modalAberto={modalPerfilAberto} fecharModal={() => setModalPerfilAberto(false)} />
      <ModalHistorico modalAberto={modalHistoricoAberto} fecharModal={() => setModalHistoricoAberto(false)} carregando={carregandoHistorico} historico={historico} onAvaliar={(ag: any) => setAgParaAvaliar({ id: ag.id, servico: ag?.servicos?.nome_servico, profissional: ag?.profissionais?.nome, id_prof: ag?.profissional_id, data: ag?.data, inicio: ag?.inicio })} />
      <ModalAnamnese modalAberto={modalAnamneseAberto} fecharModal={() => setModalAnamneseAberto(false)} salvando={salvandoAnamnese} dadosAnamnese={dadosAnamnese} setDadosAnamnese={setDadosAnamnese} salvarFichaTecnica={salvarAnamnese} />
      <ModalCancelamento modalAberto={modalCancelamentoAberto} fecharModal={() => setModalCancelamentoAberto(false)} permiteCancelamentoGratuito={permiteCancelamento} cienteCancelamento={cienteCancelamento} setCienteCancelamento={setCienteCancelamento} confirmarCancelamentoAgendamento={cancelarAgendamento} cancelandoAgendamento={cancelando} />
      {agParaAvaliar && <PortalAvaliacoes agendamento={agParaAvaliar} salaoId={salaoSelecionado?.id} clienteId={clienteFresh?.id} onFechar={() => setAgParaAvaliar(null)} onAvaliado={() => setAgParaAvaliar(null)} />}
      {carrinhoAberto && carrinho.length > 0 && <PortalCarrinho carrinho={carrinho} modo={vitrineConfig?.modo} salaoId={salaoSelecionado?.id} clienteId={clienteFresh?.id} clienteNome={clienteFresh?.nome_completo || 'Cliente'} telefoneWhatsAppSalao={salaoSelecionado?.telefone} onFechar={() => setCarrinhoAberto(false)} onPedidoConcluido={() => { setCarrinhoAberto(false); setCarrinho([]); }} />}
    </div>
  );
}
