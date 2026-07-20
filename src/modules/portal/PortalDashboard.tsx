'use client'
import { C } from "@/lib/constants";
import { FiMapPin, FiCalendar, FiFileText, FiClock, FiUser, FiPhone, FiMap, FiMessageCircle, FiStar, FiEdit2 } from "react-icons/fi";
import { PortalPagamentoReserva as _ } from "./PortalPagamentoReserva";
import { ModalPerfil }       from "./ModalPerfil";
import { ModalHistorico }    from "./ModalHistorico";
import { ModalAnamnese }     from "./ModalAnamnese";
import { ModalCancelamento } from "./ModalCancelamento";
import { PortalAvaliacoes }  from "./avaliacoes/PortalAvaliacoes";
import { PortalComunicados } from "./comunicados/PortalComunicados";
import { PortalVitrine }     from "./vitrine/PortalVitrine";
import { PortalCarrinho }    from "./vitrine/PortalCarrinho";
import { PortalPromocoes }   from "./vitrine/PortalPromocoes";
import { MotorAgendamento }  from "./components/MotorAgendamento";
import { usePortalDados }    from "./hooks/usePortalDados";
import { useAgendamentoFluxo } from "./hooks/useAgendamentoFluxo";
import {
  FONTE_CORPO, FONTE_TITULO, GRADIENTE_SLATE,
  cardConteudo, SOMBRA_SUAVE,
} from "./estiloPortal";
import { RAIO_MD, RAIO_LG, RAIO_XL, RAIO_3XL } from "@/lib/estiloGlobal";

export function PortalDashboard({ clienteLogado, sairDoPortal, salaoSelecionado, trocarDeSalao }: any) {
  const pd = usePortalDados({ clienteLogado, salaoSelecionado });
  const ag = useAgendamentoFluxo({ clienteFresh: pd.clienteFresh, salaoSelecionado });

  if (!pd.clienteFresh || !salaoSelecionado) return null;

  const temVitrine = pd.vitrineConfig?.ativo;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONTE_CORPO }}>

      {/* ─── CABEÇALHO ─── */}
      <div style={{ background: C.bgCard, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, borderTop: `3px solid ${C.douradoEleva}`, position: "sticky", top: 0, zIndex: 50, boxShadow: SOMBRA_SUAVE }}>
        <div style={{ display: "flex", alignItems: "center", padding: "6px 14px 6px 10px", borderRadius: RAIO_LG, border: `1.5px solid ${C.douradoEleva}50`, background: `linear-gradient(135deg, ${C.douradoEleva}12, transparent)`, boxShadow: `0 0 0 3px ${C.douradoEleva}10` }}>
            <img src={C.logoUrl} alt="Luarys" style={{ height: 52, objectFit: "contain", display: "block" }} />
          </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontFamily: FONTE_TITULO, fontSize: 16, color: C.textMain, fontWeight: 800 }}>{salaoSelecionado?.nome_fantasia || "Unidade"}</span>
            <button onClick={trocarDeSalao} className="transition-all hover:opacity-70" style={{ background: "none", border: "none", color: C.sidebarBg, fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 2 }}>Trocar Unidade</button>
          </div>
          <div style={{ width: 1, height: 32, background: C.borderMid }} />
          <button onClick={sairDoPortal} className="transition-all hover:opacity-70" style={{ background: "none", border: "none", color: C.danger, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Sair</button>
        </div>
      </div>

      {/* ─── LAYOUT PRINCIPAL ─── */}
      <div className="portal-layout">

        {/* ══ COLUNA ESQUERDA — cliente, agendamentos, unidade ══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ─── BOAS VINDAS ─── */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.sidebarBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 22, boxShadow: `0 0 0 3px ${C.bg}, 0 0 0 5px ${C.douradoEleva}` }}>
              {pd.clienteFresh?.nome_completo?.substring(0, 1) || "C"}
            </div>
            <div>
              <h1 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 22, fontWeight: 800, color: C.sidebarBg, letterSpacing: "-0.5px" }}>Olá, {pd.clienteFresh?.nome_completo?.split(' ')[0] || "Cliente"}!</h1>
              <button onClick={() => pd.setModalPerfilAberto(true)} className="transition-all hover:opacity-70" style={{ background: "none", border: "none", color: C.sidebarBg, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "2px 0 0", textDecoration: "underline" }}><FiEdit2 size={12} /> Editar meu perfil</button>
            </div>
          </div>

          {/* ─── BANNER AGENDAMENTO ─── */}
          <div style={{ position: "relative", background: GRADIENTE_SLATE, borderRadius: RAIO_3XL, padding: 28, color: "#fff", overflow: "hidden", boxShadow: "0 18px 50px -22px rgba(44,54,67,0.55)" }}>
            <div style={{ position: "absolute", top: "-40%", right: "-12%", width: 240, height: 240, background: "rgba(255,255,255,0.04)", borderRadius: "50%" }} />
            <div style={{ position: "absolute", bottom: "-55%", left: "-10%", width: 280, height: 280, background: "rgba(212,175,55,0.06)", borderRadius: "50%" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <p style={{ fontFamily: FONTE_TITULO, margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: C.douradoEleva }}>Agendamento Online</p>
              <h2 style={{ fontFamily: FONTE_TITULO, margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>Pronta para brilhar?</h2>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>Faça o seu agendamento e consulte as suas informações num só lugar.</p>
              <button onClick={ag.abrirAgendamento} disabled={ag.carregandoDados} className="transition-all hover:opacity-95" style={{ marginTop: 20, background: C.bgCard, color: C.sidebarBg, border: "none", padding: "12px 24px", borderRadius: RAIO_LG, fontWeight: 800, fontSize: 14, cursor: ag.carregandoDados ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: FONTE_TITULO, opacity: ag.carregandoDados ? 0.7 : 1 }}>
                <FiCalendar size={16} /> {ag.carregandoDados ? "A carregar..." : "Novo Agendamento"}
              </button>
            </div>
          </div>

          {/* ─── ACESSO RÁPIDO ─── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div onClick={pd.abrirHistorico} className="transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ ...cardConteudo, padding: 20, cursor: "pointer" }}>
              <div style={{ width: 44, height: 44, borderRadius: RAIO_XL, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><FiClock size={22} color={C.sidebarBg} /></div>
              <h3 style={{ fontFamily: FONTE_TITULO, margin: "12px 0 4px", fontSize: 14, fontWeight: 800, color: C.textMain }}>Meus Serviços</h3>
              <p style={{ margin: 0, fontSize: 11, color: C.textLight }}>Ver histórico passado</p>
            </div>
            <div onClick={pd.abrirFichaTecnica} className="transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ ...cardConteudo, padding: 20, cursor: "pointer" }}>
              <div style={{ width: 44, height: 44, borderRadius: RAIO_XL, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><FiFileText size={22} color={C.sidebarBg} /></div>
              <h3 style={{ fontFamily: FONTE_TITULO, margin: "12px 0 4px", fontSize: 14, fontWeight: 800, color: C.textMain }}>Ficha Técnica</h3>
              <p style={{ margin: 0, fontSize: 11, color: C.textLight }}>Alergias e histórico</p>
            </div>
          </div>

          <PortalComunicados salaoId={salaoSelecionado?.id} />

          {/* ─── MEUS AGENDAMENTOS ─── */}
          <div style={{ ...cardConteudo, padding: 24 }}>
            <h3 style={{ fontFamily: FONTE_TITULO, margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: C.textMain }}>Meus Agendamentos</h3>
            {pd.carregandoProximo ? (
              <p style={{ textAlign: "center", fontSize: 13, color: C.textLight, margin: 0 }}>Consultando sua agenda...</p>
            ) : pd.proximosAgendamentos.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: C.textMuted, textAlign: "center", padding: "16px 0" }}>Você não tem nenhum agendamento futuro nesta unidade.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pd.proximosAgendamentos.map((ag: any) => (
                  <div key={ag.id} style={{ background: C.bg, borderRadius: RAIO_XL, padding: 16, display: "flex", flexDirection: "column", gap: 12, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>{ag.servicos?.nome_servico || "Serviço"}</h4>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMain, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><FiUser size={13} /> {ag.profissionais?.nome || "Equipe"}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textLight, display: "flex", alignItems: "center", gap: 6 }}><FiCalendar size={12} /> {ag.data?.split('-').reverse().join('/')} às {ag.inicio?.substring(0, 5)}</p>
                      </div>
                      <span style={{ background: ag.status === 'Confirmado' ? C.success : ag.status === 'Aguardando' ? C.warning : ag.status === 'Cancelado' ? C.danger : C.textMuted, color: "#fff", padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{ag.status}</span>
                    </div>
                    {['Confirmado', 'Aguardando'].includes(ag.status) && (
                      <button onClick={() => pd.abrirModalCancelamento(ag)} style={{ background: "none", border: `1px solid ${C.danger}`, color: C.danger, padding: "8px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}>Cancelar Agendamento</button>
                    )}
                    {ag.status === 'Finalizado' && (
                      <button onClick={() => pd.setAgendamentoParaAvaliar({ id: ag.id, servico: ag.servicos?.nome_servico || "Serviço", profissional: ag.profissionais?.nome || "Equipe", id_prof: ag.profissional_id, data: ag.data, inicio: ag.inicio })}
                        className="transition-all hover:opacity-90"
                        style={{ background: `${C.douradoEleva}1A`, border: `1px solid ${C.douradoEleva}`, color: C.douradoEleva, padding: "8px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <FiStar size={13} /> Avaliar este atendimento
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── SOBRE A UNIDADE ─── */}
          <div style={{ ...cardConteudo, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h3 style={{ fontFamily: FONTE_TITULO, margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: C.textMain }}>Sobre a Unidade</h3>
              <p style={{ margin: 0, fontSize: 13, color: C.textLight }}>{salaoSelecionado?.nome_fantasia}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 13, color: C.textMain, display: "flex", alignItems: "center", gap: 8 }}><FiMapPin size={14} /> {salaoSelecionado?.bairro || "Endereço não cadastrado"} - {salaoSelecionado?.estado || ""}</p>
              {salaoSelecionado?.telefone && <p style={{ margin: 0, fontSize: 13, color: C.textMain, display: "flex", alignItems: "center", gap: 8 }}><FiPhone size={14} /> {salaoSelecionado?.telefone}</p>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
              <a href={`https://maps.google.com/?q=${encodeURIComponent((salaoSelecionado?.nome_fantasia || '') + ' ' + (salaoSelecionado?.bairro || '') + ' ' + (salaoSelecionado?.estado || ''))}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", background: C.bg, color: C.textMain, padding: "12px", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 800, textAlign: "center", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><FiMap size={14} /> Ver no Mapa</a>
              <a href={`https://wa.me/${(ag.salaoFresh?.telefone || salaoSelecionado?.telefone || '').replace(/\D/g, '')}?text=Olá! Sou a ${pd.clienteFresh?.nome_completo?.split(' ')[0]} e estou no portal da cliente.`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", background: "#25D366", color: "#fff", padding: "12px", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 800, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><FiMessageCircle size={14} /> WhatsApp</a>
            </div>
          </div>

          {/* ─── PRIVACIDADE ─── */}
          <div style={{ ...cardConteudo, padding: '16px 20px' }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: C.textLight, fontFamily: FONTE_TITULO, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Privacidade & Dados</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.textMuted, textDecoration: 'underline' }}>Política de Privacidade</a>
              <span style={{ color: C.border }}>·</span>
              <a href="/termos" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.textMuted, textDecoration: 'underline' }}>Termos de Uso</a>
            </div>
            {pd.pedidoExclusaoEnviado ? (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: C.textLight, fontStyle: 'italic' }}>Solicitação registrada. Entraremos em contato em até 5 dias úteis.</p>
            ) : (
              <button onClick={() => pd.setModalExclusaoAberto(true)} style={{ marginTop: 10, background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#EF4444', cursor: 'pointer', textDecoration: 'underline', fontFamily: FONTE_CORPO }}>
                Solicitar exclusão da minha conta
              </button>
            )}
          </div>
        </div>

        {/* ══ COLUNA DIREITA — promoções e produtos (só quando vitrine ativa) ══ */}
        {temVitrine && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <PortalPromocoes salaoId={salaoSelecionado?.id} telefone={salaoSelecionado?.telefone} />
            {pd.vitrineConfig?.modo !== "desativada" && (
              <PortalVitrine salaoId={salaoSelecionado?.id} clienteId={pd.clienteFresh?.id} clienteNome={pd.clienteFresh?.nome_completo || "Cliente"} modo={pd.vitrineConfig.modo}
                onAbrirCarrinho={(c: any) => { pd.setCarrinhoVitrine(c); pd.setCarrinhoAberto(true); }} />
            )}
          </div>
        )}

      </div>

      {/* ─── MODAIS ─── */}
      <ModalPerfil clienteFresh={pd.clienteFresh} setClienteFresh={pd.setClienteFresh} modalAberto={pd.modalPerfilAberto} fecharModal={() => pd.setModalPerfilAberto(false)} />
      <ModalHistorico modalAberto={pd.modalHistoricoAberto} fecharModal={() => pd.setModalHistoricoAberto(false)} carregando={pd.carregandoHistorico} historico={pd.historico}
        onAvaliar={(ag: any) => pd.setAgendamentoParaAvaliar({ id: ag.id, servico: ag?.servicos?.nome_servico || "Serviço", profissional: ag?.profissionais?.nome || "Equipe", id_prof: ag?.profissional_id, data: ag?.data, inicio: ag?.inicio })} />
      <ModalAnamnese modalAberto={pd.modalAnamneseAberto} fecharModal={() => pd.setModalAnamneseAberto(false)} salvando={pd.salvandoAnamnese} dadosAnamnese={pd.dadosAnamnese} setDadosAnamnese={pd.setDadosAnamnese} salvarFichaTecnica={pd.salvarFichaTecnica} />
      <ModalCancelamento modalAberto={pd.modalCancelamentoAberto} fecharModal={() => pd.setModalCancelamentoAberto(false)} permiteCancelamentoGratuito={pd.permiteCancelamentoGratuito} cienteCancelamento={pd.cienteCancelamento} setCienteCancelamento={pd.setCienteCancelamento} confirmarCancelamentoAgendamento={pd.confirmarCancelamentoAgendamento} cancelandoAgendamento={pd.cancelandoAgendamento} />

      {pd.modalExclusaoAberto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9991, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 16, fontWeight: 800, color: '#111827', margin: '0 0 12px' }}>Solicitar exclusão da conta</h3>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: '0 0 12px' }}>Ao confirmar, sua conta será encerrada <strong>imediatamente</strong>. Seus dados de cadastro (nome, e-mail, telefone, CPF) e ficha de saúde serão apagados.</p>
            <p style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5, margin: '0 0 20px' }}>Registros de agendamentos e pagamentos passados são preservados de forma anônima. Dados fiscais são retidos por 5 anos conforme a <a href="/privacidade" target="_blank" style={{ color: '#6B7280' }}>Política de Privacidade</a>.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => pd.setModalExclusaoAberto(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>Cancelar</button>
              <button onClick={pd.solicitarExclusaoConta} disabled={pd.enviandoExclusao} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: pd.enviandoExclusao ? 'not-allowed' : 'pointer', fontFamily: FONTE_TITULO }}>
                {pd.enviandoExclusao ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pd.agendamentoParaAvaliar && (
        <PortalAvaliacoes agendamento={pd.agendamentoParaAvaliar} salaoId={salaoSelecionado?.id} clienteId={pd.clienteFresh?.id} onFechar={() => pd.setAgendamentoParaAvaliar(null)} onAvaliado={() => pd.setAgendamentoParaAvaliar(null)} />
      )}

      {pd.carrinhoAberto && pd.carrinhoVitrine.length > 0 && (
        <PortalCarrinho carrinho={pd.carrinhoVitrine} modo={pd.vitrineConfig?.modo} salaoId={salaoSelecionado?.id} clienteId={pd.clienteFresh?.id} clienteNome={pd.clienteFresh?.nome_completo || "Cliente"} telefoneWhatsAppSalao={ag.salaoFresh?.telefone} onFechar={() => pd.setCarrinhoAberto(false)} onPedidoConcluido={() => { pd.setCarrinhoAberto(false); pd.setCarrinhoVitrine([]); }} />
      )}

      <MotorAgendamento ag={{ ...ag, clienteNome: pd.clienteFresh?.nome_completo, onAgendado: pd.buscarProximaVisita }} />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        input::placeholder, textarea::placeholder { color: #94A3B8 !important; opacity: 1 !important; }
        .portal-layout {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 24px 16px 60px;
        }
        @media (min-width: 640px) {
          .portal-layout {
            flex-direction: row;
            align-items: flex-start;
            gap: 32px;
            padding: 28px 3% 60px;
          }
          .portal-layout > div { flex: 1; min-width: 0; }
        }
        @media (min-width: 1280px) {
          .portal-layout { padding: 32px 4% 60px; }
        }
      `}} />
    </div>
  );
}
