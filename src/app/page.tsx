'use client'
// Toast provider — substitui alert() nativo em todo o sistema
import { ToastProvider, useToast, setToastApi } from '@/components/Toast';
import { ConfirmacaoProvider } from '@/components/ConfirmacaoGlobal';
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { carregarPerfilUsuario } from "./auth/carregarPerfil";
import { temPermissao } from "@/lib/permissoes";
import { derivarAcessoPlano } from "@/lib/planos";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { BannerAmbienteDemo } from "@/components/BannerAmbienteDemo";
import { AvisoPlataforma } from "@/components/AvisoPlataforma";
import { BannerTrial } from "@/components/BannerTrial";
import { TelaTrialExpirado } from "@/components/TelaTrialExpirado";
import { AbaPrecificacao } from "@/modules/precificacao/AbaPrecificacao";
import { AbaCrescimento } from "@/modules/crescimento/AbaCrescimento";
import { AbaListaEspera } from "@/modules/agenda/AbaListaEspera";
import { AbaAniversario } from "@/modules/aniversario/AbaAniversario";
import { DadosGlobaisProvider } from "@/lib/contexto/DadosGlobaisContext";

// ─── Telas ────────────────────────────────────────────────────────
import { Login } from "@/modules/auth/Login";
import { AbaDashboard } from "@/modules/dashboard/AbaDashboard";
import { AbaRelatorios } from "@/modules/relatorios/AbaRelatorios";
import { AbaAgenda } from "@/modules/agenda/AbaAgenda";
import { AbaCRM } from "@/modules/crm/AbaCRM";
import { AbaFinanceiro } from "@/modules/financeiro/AbaFinanceiro";
import { AbaEstoque } from "@/modules/estoque/AbaEstoque";
import { AbaServicos } from "@/modules/servicos/AbaServicos";
import { AbaEquipe } from "@/modules/equipe/AbaEquipe";
import { AbaConfiguracoes } from "@/modules/configuracoes/AbaConfiguracoes";
import { GavetaNFSe } from "@/modules/GavetaNFSe";
import { SistemaNFCe } from "@/modules/GavetaNFCe";
import { AbaCaixa } from "@/modules/caixa/AbaCaixa";
import { AbaMigracao } from "@/modules/configuracoes/migracao/AbaMigracao";
import { AbaComunicacao } from "@/modules/configuracoes/AbaComunicacao";
import { ConfiguracaoNFSe } from "@/modules/configuracoes/nfse";
import { ModalAceiteContrato } from "@/components/ModalAceiteContrato";

// ─── O SEGURANÇA DA PORTA ──────────────────────────────────────────
export default function AppWrapper() {
  const [sessao, setSessao] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [erroAcesso, setErroAcesso] = useState("");

  async function carregarPerfil(userId: string) {
    setErroAcesso("");
    const resultado = await carregarPerfilUsuario(userId);
    if (resultado.tipo === 'dono' || resultado.tipo === 'funcionario') {
      setPerfil(resultado.perfil as any);
    } else {
      const motivo = resultado.tipo === 'sem_acesso'
        ? resultado.motivo
        : "Conta não encontrada no sistema. Contacte o suporte.";
      setErroAcesso(motivo);
      await supabase.auth.signOut();
      setSessao(null);
    }
    setCarregandoAuth(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session as any);
      if (session) carregarPerfil(session.user.id);
      else setCarregandoAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessao(session as any);
      if (session) carregarPerfil(session.user.id);
      else { setPerfil(null); setErroAcesso(""); }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (carregandoAuth) return <div style={{height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.deepPurple, fontWeight: "bold"}}>Autenticando credenciais...</div>;

  if (erroAcesso) return (
    <div style={{height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg}}>
      <div style={{fontSize: 48, marginBottom: 16}}>🚫</div>
      <h2 style={{color: "#EF4444", fontWeight: 900}}>Acesso Restrito</h2>
      <p style={{color: C.textLight, marginTop: 8, fontSize: 14}}>{erroAcesso}</p>
      <button onClick={() => window.location.reload()} style={{marginTop: 24, padding: "10px 24px", background: C.violet, color: "#fff", border: "none", borderRadius: RAIO_MD, cursor: "pointer", fontWeight: "bold"}}>Voltar ao Login</button>
    </div>
  );

  if (!sessao) return <Login />;
  if (!perfil) return <div style={{height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.deepPurple, fontWeight: "bold"}}>Preparando sua mesa de trabalho...</div>;

  return (
    <ConfirmacaoProvider>
      <ToastProvider>
        <ToastInitializer />
        <ElevaApp perfil={perfil} />
      </ToastProvider>
    </ConfirmacaoProvider>
  );
}

// Conecta o toast global para uso fora de componentes React (hooks de lógica pura)
function ToastInitializer() {
  const toastApi = useToast();
  setToastApi(toastApi);
  return null;
}

// Abas que ficam montadas em background após a primeira visita.
// Troca de aba só esconde/mostra (display:none) — estado e dados preservados.
const ABAS_PERSISTENTES = ['agenda', 'crm', 'caixa', 'financeiro', 'relatorios'];

// ─── O SISTEMA (O Maestro) ──────────────────────────────────────────
function ElevaApp({ perfil }: any) {
  const [ambienteDemoVisivel, setAmbienteDemoVisivel] = useState<boolean>(!!perfil?.ambienteDemo);
  const [aba, setAba] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      // FIX: hash pode vir como "#servicos?editar=ID" (navegação direta de
      // outra aba, ex: clique num alerta do Diagnóstico de Precificação).
      // Antes o código pegava o hash inteiro, incluindo "?editar=ID", e
      // como isso nunca bate com nenhuma string de abasValidas, a
      // navegação direta silenciosamente caía no fallback (dashboard).
      const hash = window.location.hash.replace('#', '').split('?')[0];
      
      // 🟢 CORREÇÃO: "comunicacao" adicionada às abas válidas permitidas
      const abasValidas = ["dashboard", "relatorios", "agenda", "lista_espera", "crm", "comunicacao", "caixa", "financeiro", "estoque", "equipe", "servicos", "configuracoes", "nfse", "nfse_setup", "nfce", "migracao", "precificacao", "crescimento"];
      if (abasValidas.includes(hash)) return hash;
    }
    return perfil.permissoes?.ver_dashboard ? "dashboard" : "agenda";
  });

  useEffect(() => {
    const lidarComMudancaDeHash = () => {
      const hash = window.location.hash.replace('#', '').split('?')[0];
      if (hash) setAba(hash);
    };
    window.addEventListener('hashchange', lidarComMudancaDeHash);
    return () => window.removeEventListener('hashchange', lidarComMudancaDeHash);
  }, []);

  // Rastreia quais abas pesadas já foram visitadas (montagem lazy)
  const [abasVisitadas, setAbasVisitadas] = useState<Set<string>>(() => new Set([aba]));
  useEffect(() => {
    if (!ABAS_PERSISTENTES.includes(aba)) return;
    setAbasVisitadas(prev => {
      if (prev.has(aba)) return prev;
      const next = new Set(prev);
      next.add(aba);
      return next;
    });
  }, [aba]);

  const titles: any = {
    dashboard: "Visão Geral",
    relatorios: "Relatórios e Inteligência",
    agenda: "Gestão de Agenda",
    lista_espera: "Fila de Espera",
    crm: "CRM de Clientes",
    comunicacao: "Central de Comunicação", // 🟢 Título oficial da aba
    caixa: "Frente de Caixa (PDV)",
    financeiro: "Financeiro",
    estoque: "Controle de Estoque",
    servicos: "Catálogo de Serviços",
    equipe: "Equipe",
    configuracoes: "Configurações",
    nfse_setup: "Configuração NFS-e",
    nfse: "Emitir NFS-e",
    nfce: "Notas Fiscais de Consumidor (NFC-e)",

    migracao: "Migração de Dados",
    precificacao: "Luarys Precifica",
    crescimento: "Luarys Cresce",
  };

  const TelaBloqueada = () => (
    <div style={{padding: 40, textAlign: "center", color: C.textLight, marginTop: 40}}>
      <div style={{fontSize: 48, marginBottom: 16}}>🔒</div>
      <h2 style={{color: C.charcoal}}>Acesso Não Autorizado</h2>
      <p>Você não possui as permissões necessárias para ver esta tela.</p>
    </div>
  );

  const TelaModuloPago = ({ nome }: { nome: string }) => (
    <div style={{padding: 40, textAlign: "center", color: C.textLight, marginTop: 40}}>
      <div style={{fontSize: 48, marginBottom: 16}}>🔒</div>
      <h2 style={{color: C.charcoal, margin: "0 0 8px"}}>Módulo não contratado</h2>
      <p style={{margin: "0 0 4px"}}><strong>{nome}</strong> é um módulo opcional que precisa ser ativado separadamente.</p>
      <p style={{margin: "0 0 20px", fontSize: 13}}>Acesse <strong>Configurações → Meu Plano</strong> para contratar este módulo.</p>
      <button onClick={() => { window.location.hash = 'configuracoes'; }} style={{padding: "10px 24px", background: C.violet, color: "#fff", border: "none", borderRadius: RAIO_MD, cursor: "pointer", fontWeight: 700, fontSize: 13}}>Ver Módulos Disponíveis</button>
    </div>
  );

  const pAcesso = perfil?.permissoes?.perfil_acesso || '';
  const podeVerEstoque = perfil?.isDono || temPermissao(perfil, 'modulo.estoque') || ['Administrador', 'Administrativo', 'Gerente', 'Estoquista', 'Recepcionista', 'Recepção'].includes(pAcesso);

  // Render das abas persistentes (com checagem de permissão)
  function renderAbaConteudo(id: string) {
    switch (id) {
      case 'agenda':    return <AbaAgenda perfil={perfil} />;
      case 'crm':       return <AbaCRM perfil={perfil} />;
      case 'caixa':     return <AbaCaixa perfil={perfil} setAba={setAba} />;
      case 'financeiro':
        if (!temPermissao(perfil, 'modulo.financeiro') && !perfil.permissoes?.ver_financeiro) return <TelaBloqueada />;
        if (!perfil.moduloFinanceiroLiberado) return <TelaModuloPago nome="Módulo Financeiro" />;
        return <AbaFinanceiro perfil={perfil} />;
      case 'relatorios':
        if (!temPermissao(perfil, 'modulo.relatorios') && !perfil.permissoes?.ver_dashboard) return <TelaBloqueada />;
        if (!perfil.moduloRelatoriosLiberado) return <TelaModuloPago nome="Módulo Relatórios" />;
        return <AbaRelatorios perfil={perfil} />;
      default: return null;
    }
  }

  // Render das abas leves (desmontam ao sair — sem estado a preservar)
  const renderAba = () => {
    if (aba === "dashboard") return perfil.permissoes?.ver_dashboard ? <AbaDashboard setAba={setAba} perfil={perfil} /> : <TelaBloqueada />;
    if (aba === "nfse_setup") {
      if (!perfil.isDono) return <TelaBloqueada />;
      if (!perfil.moduloFiscalLiberado) return <TelaModuloPago nome="Configuração NFS-e" />;
      return <ConfiguracaoNFSe perfil={perfil} onEmitirNotas={() => { window.location.hash = 'nfse'; setAba('nfse'); }} />;
    }
    if (aba === "nfse") {
      if (!perfil.isDono) return <TelaBloqueada />;
      if (!perfil.moduloFiscalLiberado) return <TelaModuloPago nome="Emitir NFS-e" />;
      return <GavetaNFSe perfil={perfil} />;
    }
    if (aba === "nfce") {
      if (!perfil.isDono) return <TelaBloqueada />;
      if (!perfil.moduloFiscalLiberado) return <TelaModuloPago nome="NFC-e (Nota Fiscal de Consumidor)" />;
      return <SistemaNFCe perfil={perfil} />;
    }

    if (aba === "migracao") return perfil.isDono ? <AbaMigracao perfil={perfil} /> : <TelaBloqueada />;

    if (aba === "precificacao") {
      if (!perfil.isDono && !temPermissao(perfil, 'modulo.precificacao')) return <TelaBloqueada />;
      if (!perfil.moduloPrecificacaoLiberado) return <TelaModuloPago nome="Luarys Precifica" />;
      return <AbaPrecificacao perfil={perfil} />;
    }
    if (aba === "crescimento") {
      if (!perfil.isDono && !temPermissao(perfil, 'modulo.crescimento')) return <TelaBloqueada />;
      if (!perfil.moduloCrescimentoLiberado) return <TelaModuloPago nome="Luarys Cresce" />;
      return <AbaCrescimento perfil={perfil} />;
    }

    if (aba === "lista_espera") return <AbaListaEspera perfil={perfil} />;
    if (aba === "aniversario") return <AbaAniversario perfil={perfil} setAba={setAba} />;

    if (aba === "comunicacao") {
      if (!perfil.isDono && !temPermissao(perfil, 'modulo.comunicacao')) return <TelaBloqueada />;
      if (!perfil.moduloComunicacaoLiberado) return <TelaModuloPago nome="Módulo Comunicação" />;
      return <AbaComunicacao perfil={perfil} />;
    }
    if (aba === "estoque") {
      if (!podeVerEstoque) return <TelaBloqueada />;
      if (!perfil.moduloEstoqueLiberado) return <TelaModuloPago nome="Módulo Estoque" />;
      return <AbaEstoque perfil={perfil} />;
    }
    if (aba === "equipe") return perfil.permissoes?.editar_equipe ? <AbaEquipe perfil={perfil} /> : <TelaBloqueada />;
    if (aba === "servicos") return (perfil.isDono || temPermissao(perfil, 'modulo.servicos')) ? <AbaServicos perfil={perfil} /> : <TelaBloqueada />;
    if (aba === "configuracoes") return (perfil.isDono || temPermissao(perfil, 'modulo.configuracoes')) ? <AbaConfiguracoes perfil={perfil} /> : <TelaBloqueada />;
    return null;
  };

  // ── Lógica de trial ──────────────────────────────────────────────────────
  const agora = new Date();
  const trialExp = perfil?.trial_expiracao ? new Date(perfil.trial_expiracao) : null;
  const temPlanoAtivo = !!(perfil?.plano_chave || perfil?.acesso_total);
  const trialExpirado = trialExp ? trialExp < agora : false;
  const trialAtivo    = trialExp ? trialExp >= agora : false;
  const deveBloquear  = trialExpirado && !temPlanoAtivo && perfil?.isDono;

  return (
    <DadosGlobaisProvider perfil={perfil}>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Poppins','Segoe UI',system-ui,sans-serif", background: C.bg }}>
        {/* Bloqueio total quando trial expirou sem plano */}
        {deveBloquear && <TelaTrialExpirado perfil={perfil} />}

        <ModalAceiteContrato perfil={perfil} />
        <AvisoPlataforma perfil={perfil} />
        <Sidebar aba={aba} setAba={setAba} perfil={perfil} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Banner de contagem regressiva do trial */}
          {trialAtivo && !temPlanoAtivo && perfil?.isDono && (
            <BannerTrial
              trialExpiracao={perfil.trial_expiracao}
              onEscolherPlano={() => setAba('configuracoes')}
            />
          )}

          {aba !== "agenda" && (
            <Header title={titles[aba]} onNovoAgendamento={() => setAba("agenda")} perfil={perfil} />
          )}

          {perfil?.isDono && ambienteDemoVisivel && (
            <BannerAmbienteDemo perfil={perfil} onLimpo={() => setAmbienteDemoVisivel(false)} />
          )}

          {/* Container de abas: persistentes ficam montadas (display:none quando inativas) */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {/* Abas persistentes — montagem lazy, preservam estado entre navegações */}
            {ABAS_PERSISTENTES.map(id =>
              abasVisitadas.has(id) ? (
                <div key={id} style={{
                  position: 'absolute', inset: 0, overflowY: 'auto',
                  display: aba === id ? 'block' : 'none',
                }}>
                  {renderAbaConteudo(id)}
                </div>
              ) : null
            )}
            {/* Abas leves — comportamento original (desmontam ao sair) */}
            {!ABAS_PERSISTENTES.includes(aba) && (
              <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
                {renderAba()}
              </div>
            )}
          </div>
        </div>
      </div>
    </DadosGlobaisProvider>
  );
}