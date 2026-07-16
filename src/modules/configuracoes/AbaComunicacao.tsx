'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_XL, RAIO_2XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { FiMessageSquare, FiMail, FiMessageCircle, FiSend, FiUsers, FiFilter, FiFileText, FiSave, FiSettings, FiLock, FiZap, FiLoader } from "react-icons/fi";
import { GavetaAutomacoes } from "./GavetaAutomacoes";
import { useGuardModulo } from "@/lib/useGuardModulo";
import { BloqueioModulo } from "@/components/BloqueioModulo";
import { MSG_ANIVERSARIO_PADRAO } from "@/lib/aniversarios";
import { MSG_ZAP_PADRAO } from "@/lib/mensagensPadrao";
import { PainelWhatsapp } from "@/modules/whatsapp/PainelWhatsapp";

export function AbaComunicacao({ perfil }: any) {
  const toast = useToast();
  const liberado = useGuardModulo(perfil?.salao_id, 'comunicacao');
  const [abaInterna, setAbaInterna] = useState<'marketing' | 'automacoes' | 'textos' | 'whatsapp'>('marketing');
  const [carregando, setCarregando] = useState(true);

  // Marketing
  const [canal, setCanal] = useState<'whatsapp' | 'email' | 'sms'>('whatsapp');
  const [publico, setPublico] = useState('todos');
  const [mensagemMarketing, setMensagemMarketing] = useState('');
  const [msgZap, setMsgZap] = useState(MSG_ZAP_PADRAO);
  const [msgEmail, setMsgEmail] = useState("Olá {nome_do_cliente},\n\nGostaria de confirmar os detalhes do seu atendimento conosco...");
  const [msgZapAniversario, setMsgZapAniversario] = useState(MSG_ANIVERSARIO_PADRAO);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  useEffect(() => {
    async function carregar() {
      if (!perfil?.salao_id) return;
      setCarregando(true);
      const { data } = await supabase
        .from('saloes')
        .select('msg_whatsapp, msg_email, msg_whatsapp_aniversario')
        .eq('id', perfil.salao_id)
        .maybeSingle();

      if (data) {
        if (data.msg_whatsapp) setMsgZap(data.msg_whatsapp);
        if (data.msg_email) setMsgEmail(data.msg_email);
        if (data.msg_whatsapp_aniversario) setMsgZapAniversario(data.msg_whatsapp_aniversario);
      }
      setCarregando(false);
    }
    carregar();
  }, [perfil]);

  async function salvarTextos() {
    if (!perfil?.salao_id) return;
    setSalvandoConfig(true);
    try {
      const { data, error } = await supabase.from('saloes').update({
        msg_whatsapp: msgZap,
        msg_email: msgEmail,
        msg_whatsapp_aniversario: msgZapAniversario,
      }).eq('id', perfil.salao_id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Nenhuma linha atualizada — verifique as permissões do banco.');
      toast.sucesso('Textos padrões salvos!');
    } catch (e: any) {
      toast.erro('Erro ao salvar: ' + e.message);
    } finally {
      setSalvandoConfig(false);
    }
  }

  function handleEnviar() {
    if (!mensagemMarketing) { toast.aviso('Digite uma mensagem antes de enviar.'); return; }
    toast.info('Disparo iniciado! A integração processará em segundo plano.');
  }

  const inputStyle = { padding:"12px 14px", borderRadius:8, border:`1px solid ${C.borderMid}`, width:"100%", boxSizing:"border-box" as const, outlineColor: C.sidebarBg, fontSize: 13, fontFamily: "var(--font-body)", color: C.textMain, fontWeight: 500 };
  const labelStyle = { margin:"0 0 6px", fontSize:10, fontWeight:800, color:C.textLight, display:"block", textTransform: "uppercase" as const, letterSpacing: "0.5px" };
  const btnCanalStyle = (ativo: boolean) => ({
    flex: 1, padding: "16px", borderRadius: RAIO_XL, border: `2px solid ${ativo ? C.sidebarBg : C.borderMid}`,
    background: ativo ? C.sidebarBg : "#fff", color: ativo ? "#fff" : C.textMuted,
    fontWeight: 700, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 8, cursor: "pointer", transition: "0.2s"
  });
  const tabBtnStyle = (ativa: boolean) => ({
    display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: "none", border: "none", borderBottom: ativa ? `2px solid ${C.sidebarBg}` : "2px solid transparent", color: ativa ? C.sidebarBg : C.textLight, textTransform: "uppercase" as const, letterSpacing: "0.5px", transition: "all 0.2s"
  });

  if (liberado === null) return <div style={{ padding: 32, color: C.textLight, display: 'flex', alignItems: 'center', gap: 10 }}><FiLoader className="animate-spin" size={16} /> Verificando acesso...</div>;
  if (!liberado) return <BloqueioModulo salaoId={perfil?.salao_id} moduloChave="comunicacao" nome="Central de Comunicação" descricao="Dispare campanhas de WhatsApp e e-mail, crie automações e gerencie lembretes para seus clientes." preco={39.90} itens={['Campanhas em massa por WhatsApp', 'Envio de e-mail marketing', 'Automações de aniversário e pós-visita', 'Textos padrões personalizáveis', 'Integração com agenda']} />;
  if (carregando) return <div style={{ padding: 32, fontWeight: "bold", color: C.textLight }}>Carregando...</div>;

  return (
    <div className="font-body" style={{ padding: 32, overflowY: "auto", flex: 1, background: C.bg }}>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 12, textTransform: "uppercase", letterSpacing: "1px" }}>
          <FiMessageSquare size={24} /> Central de Comunicação
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: C.textMuted }}>
          Gerencie campanhas, automações e textos padrões do seu salão.
        </p>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${C.borderMid}`, marginBottom: 32, gap: 16 }}>
        <button style={tabBtnStyle(abaInterna === 'marketing')} onClick={() => setAbaInterna('marketing')}>
          <FiSend size={16} /> Campanhas (Massa)
        </button>
        <button style={tabBtnStyle(abaInterna === 'automacoes')} onClick={() => setAbaInterna('automacoes')}>
          <FiZap size={16} /> Automações
        </button>
        <button style={tabBtnStyle(abaInterna === 'textos')} onClick={() => setAbaInterna('textos')}>
          <FiSettings size={16} /> Textos Padrões
        </button>
        <button style={tabBtnStyle(abaInterna === 'whatsapp')} onClick={() => setAbaInterna('whatsapp')}>
          <FiMessageCircle size={16} /> WhatsApp API
        </button>
      </div>

      {abaInterna === 'automacoes' && <GavetaAutomacoes perfil={perfil} />}
      {abaInterna === 'whatsapp' && <PainelWhatsapp />}

      {abaInterna === 'marketing' && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: 32 }}>
          <div style={{ background: C.bgCard, padding: 32, borderRadius: RAIO_2XL, border: `1px solid ${C.border}` }}>
            <h3 style={{ margin: "0 0 24px", fontSize: 14, fontWeight: 800, color: C.textMain, textTransform: "uppercase" }}>1. Escolha o Canal</h3>

            <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
              <button style={btnCanalStyle(canal === 'whatsapp')} onClick={() => setCanal('whatsapp')}>
                <FiMessageCircle size={24} /> WhatsApp
              </button>
              <button style={btnCanalStyle(canal === 'email')} onClick={() => setCanal('email')}>
                <FiMail size={24} /> E-mail
              </button>
              <button style={{...btnCanalStyle(canal === 'sms'), opacity: 0.5}} disabled>
                <FiMessageSquare size={24} /> SMS (Breve)
              </button>
            </div>


            <h3 style={{ margin: "0 0 24px", fontSize: 14, fontWeight: 800, color: C.textMain, textTransform: "uppercase" }}>2. Selecione o Público</h3>
            <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <FiUsers style={{ position: "absolute", left: 14, top: 14, color: C.textLight }} />
                <select style={{ ...inputStyle, paddingLeft: 42 }} value={publico} onChange={e => setPublico(e.target.value)}>
                  <option value="todos">Todos os Clientes Ativos</option>
                  <option value="aniversariantes">Aniversariantes do Mês</option>
                  <option value="inativos_30d">Não visitam há 30 dias</option>
                  <option value="vip">Clientes VIP</option>
                </select>
              </div>
              <button disabled style={{ padding: "0 24px", background: C.bg, color: C.textLight, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, cursor: "not-allowed", opacity: 0.6 }} title="Em breve">
                <FiFilter /> Filtro Avançado
              </button>
            </div>

            <h3 style={{ margin: "0 0 24px", fontSize: 14, fontWeight: 800, color: C.textMain, textTransform: "uppercase" }}>3. Escreva sua Mensagem</h3>
            <textarea
              style={{ ...inputStyle, height: 150, resize: "none" }}
              placeholder="Olá {nome_do_cliente}! Temos uma novidade..."
              value={mensagemMarketing}
              onChange={e => setMensagemMarketing(e.target.value)}
            />
            <p style={{ margin: "8px 0 24px", fontSize: 11, color: C.textLight }}>Use <strong style={{color: C.sidebarBg}}>{"{nome_do_cliente}"}</strong> para personalizar a mensagem.</p>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleEnviar}
                style={{ padding: "16px 32px", background: C.success, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textTransform: "uppercase" }}
              >
                <FiSend size={18} /> Preparar Disparo
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ background: C.bg, padding: 24, borderRadius: RAIO_2XL, border: `1px solid ${C.borderMid}` }}>
              <h4 style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase" }}><FiFileText size={16} /> Templates Rápidos</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  disabled={false}
                  onClick={() => setMensagemMarketing("Olá {nome_do_cliente}! Parabéns pelo seu dia! 🎉 Agende seu horário e ganhe 15% de desconto!")}
                  style={{ padding: "12px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, textAlign: "left", cursor: "pointer", fontSize: 12, color: C.textMain, fontWeight: 500 }}
                >🎂 Feliz Aniversário</button>
                <button
                  disabled={false}
                  onClick={() => setMensagemMarketing("Saudades de você, {nome_do_cliente}! Faz um tempinho que não nos vemos. Que tal renovar o visual esta semana?")}
                  style={{ padding: "12px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, textAlign: "left", cursor: "pointer", fontSize: 12, color: C.textMain, fontWeight: 500 }}
                >👋 Recuperar Cliente</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {abaInterna === 'textos' && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: C.bgCard, padding: 32, borderRadius: RAIO_2XL, border: `1px solid ${C.border}`, marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
              <FiMessageSquare size={18} /> Textos Padrões (Botões da Agenda)
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              Estes textos são usados quando você clica nos botões de WhatsApp ou E-mail dentro da ficha de agendamento.
            </p>

            {/* WhatsApp Manual */}
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>Mensagem WhatsApp (Manual)</label>
              <textarea
                style={{ ...inputStyle, height: 200, resize: "vertical", lineHeight: 1.6 }}
                value={msgZap}
                onChange={e => setMsgZap(e.target.value)}
              />

              {/* Chips de variáveis — igual à tela de Confirmação de Agendamento */}
              <div style={{ marginTop: 10 }}>
                <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Variáveis disponíveis
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {['{nome_do_cliente}','{data}','{horario}','{servico}','{profissional}','{nome_salao}'].map(v => (
                    <span
                      key={v}
                      onClick={() => setMsgZap(prev => prev + v)}
                      title="Clique para inserir no final"
                      style={{ padding: "4px 10px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}
                    >{v}</span>
                  ))}
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: C.textLight, lineHeight: 1.5 }}>
                  A linha com <strong style={{ fontFamily: "monospace" }}>{"{profissional}"}</strong> é removida automaticamente se o agendamento não tiver profissional.
                </p>
              </div>
            </div>

            {/* WhatsApp Aniversário */}
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>Mensagem WhatsApp (Aniversário)</label>
              <textarea
                style={{ ...inputStyle, height: 160, resize: "vertical", lineHeight: 1.6 }}
                value={msgZapAniversario}
                onChange={e => setMsgZapAniversario(e.target.value)}
              />
              <div style={{ marginTop: 10 }}>
                <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Variáveis disponíveis
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {['{nome_do_cliente}', '{nome_salao}'].map(v => (
                    <span
                      key={v}
                      onClick={() => setMsgZapAniversario(prev => prev + v)}
                      title="Clique para inserir no final"
                      style={{ padding: "4px 10px", background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}
                    >{v}</span>
                  ))}
                </div>
                <button
                  onClick={() => setMsgZapAniversario(MSG_ANIVERSARIO_PADRAO)}
                  style={{ marginTop: 8, padding: "5px 12px", background: "transparent", color: C.textMuted, border: `1px solid ${C.borderMid}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  ↺ Restaurar Padrão
                </button>
              </div>
            </div>

            {/* E-mail Manual */}
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>Corpo do E-mail (Manual)</label>
              <textarea style={{ ...inputStyle, height: 120, resize: "vertical" }} value={msgEmail} onChange={e => setMsgEmail(e.target.value)} />
              <p style={{ margin: "6px 0 0", fontSize: 11, color: C.textLight }}>Variável disponível: <strong style={{ fontFamily: "monospace" }}>{"{nome_do_cliente}"}</strong></p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => setMsgZap(MSG_ZAP_PADRAO)}
                style={{ padding: "13px 20px", background: "transparent", color: C.textMuted, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              >
                ↺ Restaurar Padrão
              </button>
              <button
                onClick={salvarTextos}
                disabled={salvandoConfig}
                style={{ padding: "13px 32px", background: salvandoConfig ? C.borderMid : C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: salvandoConfig ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase" }}
              >
                <FiSave size={15} /> {salvandoConfig ? 'Salvando...' : 'Salvar Textos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
