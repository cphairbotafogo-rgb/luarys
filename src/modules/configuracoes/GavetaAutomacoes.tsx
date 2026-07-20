'use client'
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { FiZap, FiSend, FiLoader, FiPlus, FiRefreshCw, FiInfo } from "react-icons/fi";
import { useGuardModulo } from "@/lib/useGuardModulo";
import { BloqueioModulo } from "@/components/BloqueioModulo";
import { MSG_CONFIRMACAO_PADRAO, gerarLinkWhatsapp } from "./automacoes/constants";
import { SecaoConfirmacao } from "./automacoes/SecaoConfirmacao";
import { AutomacaoCard } from "./automacoes/AutomacaoCard";
import { FilaItemCard } from "./automacoes/FilaItemCard";

export function GavetaAutomacoes({ perfil }: any) {
  const toast = useToast();
  const liberado = useGuardModulo(perfil?.salao_id, 'pacote_whatsapp');
  const [subTab, setSubTab] = useState<'regras' | 'fila'>('regras');
  const [automacoes, setAutomacoes] = useState<any[]>([]);
  const [fila, setFila] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [msgConfirmacao, setMsgConfirmacao] = useState(MSG_CONFIRMACAO_PADRAO);
  const [salvandoConfirmacao, setSalvandoConfirmacao] = useState(false);
  const [antecedenciaHoras, setAntecedenciaHoras] = useState<number>(24);
  const [salvandoAntecedencia, setSalvandoAntecedencia] = useState(false);
  const textareaAutoRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  function inserirVariavelAutomacao(autoId: string, variavel: string, template: string) {
    const el = textareaAutoRefs.current[autoId];
    if (!el) { atualizarCampoLocal(autoId, 'mensagem_template', template + variavel); return; }
    const start = el.selectionStart ?? template.length;
    const end   = el.selectionEnd   ?? start;
    const nova  = template.slice(0, start) + variavel + template.slice(end);
    atualizarCampoLocal(autoId, 'mensagem_template', nova);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variavel.length, start + variavel.length);
    });
  }

  useEffect(() => { carregarTudo(); }, [perfil]);

  async function carregarTudo() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    await Promise.all([carregarAutomacoes(), carregarFila(), carregarMsgConfirmacao()]);
    setCarregando(false);
  }

  async function carregarMsgConfirmacao() {
    const { data } = await supabase
      .from('saloes')
      .select('msg_confirmacao_agendamento, confirmacao_antecedencia_horas')
      .eq('id', perfil.salao_id)
      .maybeSingle();
    if (data?.msg_confirmacao_agendamento) setMsgConfirmacao(data.msg_confirmacao_agendamento);
    if (data?.confirmacao_antecedencia_horas) setAntecedenciaHoras(data.confirmacao_antecedencia_horas);
  }

  async function salvarMsgConfirmacao(texto: string) {
    setSalvandoConfirmacao(true);
    const { error } = await supabase.from('saloes').update({ msg_confirmacao_agendamento: texto }).eq('id', perfil.salao_id);
    setSalvandoConfirmacao(false);
    if (error) toast.erro('Erro ao salvar: ' + error.message);
    else { setMsgConfirmacao(texto); toast.sucesso('Template salvo!'); }
  }

  async function salvarAntecedencia(horas: number) {
    setSalvandoAntecedencia(true);
    const { error } = await supabase.from('saloes').update({ confirmacao_antecedencia_horas: horas }).eq('id', perfil.salao_id);
    setSalvandoAntecedencia(false);
    if (error) toast.erro('Erro ao salvar: ' + error.message);
    else { setAntecedenciaHoras(horas); toast.sucesso(`Lembrete definido para ${horas}h antes!`); }
  }

  async function carregarAutomacoes() {
    const { data } = await supabase.from('automacoes').select('id, nome, gatilho, mensagem_template, ativo, dias_inatividade').eq('salao_id', perfil.salao_id).order('created_at');
    setAutomacoes(data || []);
  }

  async function carregarFila() {
    const { data } = await supabase.from('fila_envio').select('id, automacao_id, cliente_nome, telefone, mensagem').eq('salao_id', perfil.salao_id).eq('status', 'pendente').order('criado_em', { ascending: false }).limit(100);
    setFila(data || []);
  }

  async function criarRegrasPadrao() {
    const padroes = [
      { salao_id: perfil.salao_id, nome: 'Aniversário do Cliente', gatilho: 'aniversario', mensagem_template: 'Olá {nome_do_cliente}! 🎉 Hoje é seu dia e queremos celebrar com você! Agende um horário esta semana e aproveite um mimo especial da nossa equipe. Feliz aniversário! 💛', ativo: true },
      { salao_id: perfil.salao_id, nome: 'Recuperação de Clientes Inativos', gatilho: 'cliente_inativo', dias_inatividade: 30, mensagem_template: 'Olá {nome_do_cliente}! Notamos que faz um tempinho que você não vem nos visitar. Que tal agendar um horário e renovar o visual? Estamos com novidades esperando por você! 💇✨', ativo: true },
    ];
    const { error } = await supabase.from('automacoes').insert(padroes);
    if (error) { toast.erro('Erro ao criar regras: ' + error.message); return; }
    toast.sucesso('Regras padrão criadas! Ajuste as mensagens como preferir.');
    carregarAutomacoes();
  }

  async function alternarAtivo(automacao: any) {
    const novoValor = !automacao.ativo;
    setAutomacoes(prev => prev.map(a => a.id === automacao.id ? { ...a, ativo: novoValor } : a));
    const { error } = await supabase.from('automacoes').update({ ativo: novoValor }).eq('id', automacao.id);
    if (error) {
      toast.erro('Erro ao atualizar: ' + error.message);
      setAutomacoes(prev => prev.map(a => a.id === automacao.id ? { ...a, ativo: !novoValor } : a));
    }
  }

  function atualizarCampoLocal(id: string, campo: string, valor: any) {
    setAutomacoes(prev => prev.map(a => a.id === id ? { ...a, [campo]: valor } : a));
  }

  async function salvarRegra(automacao: any) {
    setSalvandoId(automacao.id);
    const payload: any = { mensagem_template: automacao.mensagem_template, nome: automacao.nome };
    if (automacao.gatilho === 'cliente_inativo') payload.dias_inatividade = Number(automacao.dias_inatividade) || 30;
    const { error } = await supabase.from('automacoes').update(payload).eq('id', automacao.id);
    setSalvandoId(null);
    if (error) toast.erro('Erro ao salvar: ' + error.message);
    else toast.sucesso('Regra salva!');
  }

  async function gerarFila() {
    if (!perfil?.salao_id) return;
    setGerando(true);
    let totalNovas = 0;
    try {
      const ativas = automacoes.filter(a => a.ativo);
      const hoje = new Date();
      for (const auto of ativas) {
        let linhas: any[] = [];
        if (auto.gatilho === 'aniversario') {
          const { data: crmData } = await supabase.from('crm_clientes').select('cliente_id, aceita_campanhas, clientes (id, nome_completo, telefone_whatsapp, nascimento)').eq('salao_id', perfil.salao_id).eq('aceita_campanhas', true);
          linhas = (crmData || []).filter((c: any) => {
            const nasc = c.clientes?.nascimento;
            if (!nasc) return false;
            const d = new Date(nasc + 'T12:00:00');
            return d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth();
          }).map((c: any) => ({
            salao_id: perfil.salao_id, automacao_id: auto.id, cliente_id: c.clientes?.id, cliente_nome: c.clientes?.nome_completo, telefone: c.clientes?.telefone_whatsapp,
            mensagem: (auto.mensagem_template || '').replaceAll('{nome_do_cliente}', (c.clientes?.nome_completo || '').split(' ')[0] || 'cliente').replaceAll('{nome_salao}', perfil?.nome_salao || ''),
            chave_dedup: `${c.clientes?.id}-${hoje.getFullYear()}`, status: 'pendente',
          }));
        } else if (auto.gatilho === 'cliente_inativo') {
          const dias = Number(auto.dias_inatividade) || 30;
          const limite = new Date(); limite.setDate(limite.getDate() - dias);
          const { data: crmData } = await supabase.from('crm_clientes').select('cliente_id, data_ultima_visita, aceita_campanhas, clientes (id, nome_completo, telefone_whatsapp)').eq('salao_id', perfil.salao_id).eq('aceita_campanhas', true).not('data_ultima_visita', 'is', null).lte('data_ultima_visita', limite.toISOString().split('T')[0]);
          linhas = (crmData || []).map((c: any) => {
            const diasAusente = c.data_ultima_visita ? Math.floor((Date.now() - new Date(c.data_ultima_visita).getTime()) / 86400000) : dias;
            return { salao_id: perfil.salao_id, automacao_id: auto.id, cliente_id: c.clientes?.id, cliente_nome: c.clientes?.nome_completo, telefone: c.clientes?.telefone_whatsapp,
              mensagem: (auto.mensagem_template || '').replaceAll('{nome_do_cliente}', (c.clientes?.nome_completo || '').split(' ')[0] || 'cliente').replaceAll('{nome_salao}', perfil?.nome_salao || '').replaceAll('{dias_ausente}', String(diasAusente)).replaceAll('{ultimo_servico}', c.ultimo_servico || ''),
              chave_dedup: `${c.clientes?.id}-${c.data_ultima_visita}`, status: 'pendente' };
          });
        }
        linhas = linhas.filter(l => l.cliente_id && l.telefone);
        if (linhas.length > 0) {
          const { data: inseridas, error } = await supabase.from('fila_envio').upsert(linhas, { onConflict: 'automacao_id,chave_dedup', ignoreDuplicates: true }).select('id');
          if (error) throw error;
          totalNovas += inseridas?.length || 0;
        }
      }
      toast.sucesso(totalNovas > 0 ? `${totalNovas} nova(s) mensagem(ns) adicionada(s) à fila!` : 'Nenhuma mensagem nova — tudo já foi gerado.');
      carregarFila();
    } catch (e: any) {
      toast.erro('Erro ao gerar fila: ' + e.message);
    } finally {
      setGerando(false);
    }
  }

  async function abrirEMarcarEnviado(item: any) {
    window.open(gerarLinkWhatsapp(item.telefone, item.mensagem), '_blank');
    setFila(prev => prev.filter(f => f.id !== item.id));
    await supabase.from('fila_envio').update({ status: 'enviado', enviado_em: new Date().toISOString() }).eq('id', item.id);
  }

  async function ignorarItem(item: any) {
    setFila(prev => prev.filter(f => f.id !== item.id));
    await supabase.from('fila_envio').update({ status: 'ignorado' }).eq('id', item.id);
  }

  const tabBtnStyle = (ativa: boolean) => ({
    padding: "10px 20px", borderRadius: RAIO_MD, border: `1px solid ${ativa ? C.sidebarBg : C.borderMid}`,
    background: ativa ? C.sidebarBg : "#fff", color: ativa ? "#fff" : C.textMain,
    fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase" as const,
  });

  if (liberado === null) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: C.sidebarBg, fontWeight: 700, padding: 40 }}>
      <FiLoader className="animate-spin" size={18} /> A verificar acesso...
    </div>
  );
  if (!liberado) return (
    <BloqueioModulo salaoId={perfil?.salao_id} moduloChave="pacote_whatsapp" nome="WhatsApp Business"
      descricao="Envio automático de mensagens via API oficial do WhatsApp. Sem QR Code, sem risco de banimento." preco={99.90}
      itens={['Confirmação automática de agendamento', 'Mensagem de aniversário do cliente', 'Recuperação de clientes inativos', 'Integração via API oficial Meta (Zenvia)', 'Relatório de envios e taxa de entrega']} />
  );
  if (carregando) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: C.sidebarBg, fontWeight: 700, padding: 40 }}>
      <FiLoader className="animate-spin" size={18} /> A carregar automações...
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.sidebarBg}`, borderRadius: RAIO_XL, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
        <FiZap size={28} color={C.sidebarBg} />
        <div>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Motor de Automação</h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>
            Crie regras de mensagem (aniversário, recuperação de clientes inativos) e gere a fila de envio. Só entram na fila clientes que aceitaram receber campanhas (LGPD).
          </p>
        </div>
      </div>

      <SecaoConfirmacao
        msgAtual={msgConfirmacao}
        antecedenciaHoras={antecedenciaHoras}
        salvando={salvandoConfirmacao}
        salvandoAntecedencia={salvandoAntecedencia}
        onSalvarTemplate={salvarMsgConfirmacao}
        onSalvarAntecedencia={salvarAntecedencia}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button style={tabBtnStyle(subTab === 'regras')} onClick={() => setSubTab('regras')}><FiZap size={14} /> Regras</button>
        <button style={tabBtnStyle(subTab === 'fila')} onClick={() => setSubTab('fila')}><FiSend size={14} /> Fila de Envio {fila.length > 0 && `(${fila.length})`}</button>
      </div>

      {subTab === 'regras' && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {automacoes.length === 0 && (
            <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 40, textAlign: "center" }}>
              <FiInfo size={24} color={C.textLight} style={{ marginBottom: 8 }} />
              <p style={{ margin: "0 0 16px", color: C.textLight, fontSize: 13, fontStyle: "italic" }}>Nenhuma regra configurada ainda.</p>
              <button onClick={criarRegrasPadrao} style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "12px 24px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FiPlus size={14} /> Criar Regras Padrão (Aniversário + Recuperação)
              </button>
            </div>
          )}
          {automacoes.map(a => (
            <AutomacaoCard key={a.id} automacao={a} salvandoId={salvandoId} textareaRefs={textareaAutoRefs}
              onToggle={alternarAtivo} onCampoChange={atualizarCampoLocal} onSalvar={salvarRegra} onInserirVariavel={inserirVariavelAutomacao} />
          ))}
        </div>
      )}

      {subTab === 'fila' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button onClick={gerarFila} disabled={gerando || automacoes.filter(a => a.ativo).length === 0}
              style={{ background: gerando ? C.borderMid : C.success, color: "#fff", border: "none", padding: "12px 24px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: gerando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              {gerando ? <FiLoader className="animate-spin" size={14} /> : <FiRefreshCw size={14} />} Gerar Fila Agora
            </button>
            {automacoes.filter(a => a.ativo).length === 0 && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: C.textLight, fontStyle: "italic" }}>Ative pelo menos uma regra na aba "Regras" para gerar a fila.</p>
            )}
          </div>
          {fila.length === 0 ? (
            <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 40, textAlign: "center" }}>
              <FiInfo size={24} color={C.textLight} style={{ marginBottom: 8 }} />
              <p style={{ margin: 0, color: C.textLight, fontSize: 13, fontStyle: "italic" }}>Fila vazia. Clique em "Gerar Fila Agora" para buscar clientes que se encaixam nas regras ativas.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {fila.map(item => (
                <FilaItemCard key={item.id} item={item} automacao={automacoes.find(a => a.id === item.automacao_id)}
                  onEnviar={abrirEMarcarEnviado} onIgnorar={ignorarItem} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
