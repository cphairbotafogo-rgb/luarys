'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getDataHojeLocal } from "@/lib/constants";
import { useToast } from "@/components/Toast";

export function usePortalDados({ clienteLogado, salaoSelecionado }: { clienteLogado: any; salaoSelecionado: any }) {
  const toast = useToast();

  const [clienteFresh, setClienteFresh] = useState<any>(clienteLogado);
  const [vitrineConfig, setVitrineConfig] = useState<any>(null);
  const [vitrineLiberada, setVitrineLiberada] = useState(false);

  // ─── PRÓXIMA VISITA ───────────────────────────────────────────────────────────
  const [proximoAgendamento, setProximoAgendamento] = useState<any>(null);
  const [carregandoProximo, setCarregandoProximo] = useState(true);

  async function buscarProximaVisita() {
    if (!clienteFresh?.id || !salaoSelecionado?.id) return;
    setCarregandoProximo(true);
    const hojeIso = getDataHojeLocal();
    const { data, error } = await supabase
      .from('agendamentos')
      .select(`id, data, inicio, status, created_at, observacao, profissionais ( nome ), servicos ( nome_servico )`)
      .eq('cliente_id', clienteFresh.id)
      .eq('salao_id', salaoSelecionado.id)
      .gte('data', hojeIso)
      .neq('status', 'Cancelado')
      .order('data', { ascending: true })
      .order('inicio', { ascending: true })
      .limit(1);
    if (!error && data && data.length > 0) setProximoAgendamento(data[0]);
    else setProximoAgendamento(null);
    setCarregandoProximo(false);
  }

  useEffect(() => {
    buscarProximaVisita();
    if (salaoSelecionado?.id) {
      Promise.all([
        supabase.from("vitrine_config").select("modo, ativo").eq("salao_id", salaoSelecionado.id).maybeSingle(),
        supabase.from("saloes").select("vitrine_liberada").eq("id", salaoSelecionado.id).maybeSingle(),
      ]).then(([resConfig, resSalao]) => {
        setVitrineConfig(resConfig.data);
        setVitrineLiberada(resSalao.data?.vitrine_liberada ?? false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteFresh, salaoSelecionado]);

  // ─── CANCELAMENTO ────────────────────────────────────────────────────────────
  const [modalCancelamentoAberto, setModalCancelamentoAberto] = useState(false);
  const [cienteCancelamento, setCienteCancelamento] = useState(false);
  const [cancelandoAgendamento, setCancelandoAgendamento] = useState(false);

  let permiteCancelamentoGratuito = false;
  let motivoRegistoLegal = "";
  if (proximoAgendamento?.data && proximoAgendamento?.inicio) {
    const agora = new Date().getTime();
    const dataHoraServico = new Date(`${proximoAgendamento.data}T${proximoAgendamento.inicio}`).getTime();
    const faltaMs = dataHoraServico - agora;
    const criacao = new Date(proximoAgendamento.created_at || new Date()).getTime();
    const decorrido = agora - criacao;
    if (faltaMs >= 24 * 60 * 60 * 1000) {
      permiteCancelamentoGratuito = true;
      motivoRegistoLegal = " | [Cancelado pelo Cliente] Dentro do prazo seguro (> 24h).";
    } else if (decorrido <= 15 * 60 * 1000) {
      permiteCancelamentoGratuito = true;
      motivoRegistoLegal = " | [Cancelado pelo Cliente] Tolerância de arrependimento de 15 min.";
    } else {
      motivoRegistoLegal = " | [Cancelado pelo Cliente] Fora do prazo (< 24h). Retenção de sinal aceita (Art. 418 CC).";
    }
  }

  function abrirModalCancelamento() {
    setCienteCancelamento(false);
    setModalCancelamentoAberto(true);
  }

  async function confirmarCancelamentoAgendamento() {
    if (!proximoAgendamento?.id) return;
    setCancelandoAgendamento(true);
    const novaObs = (proximoAgendamento.observacao || "") + motivoRegistoLegal;
    const { error } = await supabase.from('agendamentos').update({ status: 'Cancelado', observacao: novaObs }).eq('id', proximoAgendamento.id);
    if (!error) {
      toast.sucesso("Agendamento cancelado com sucesso.");
      setModalCancelamentoAberto(false);
      await buscarProximaVisita();
    } else {
      toast.erro("Erro ao cancelar: " + error.message);
    }
    setCancelandoAgendamento(false);
  }

  // ─── ANAMNESE ────────────────────────────────────────────────────────────────
  const [modalAnamneseAberto, setModalAnamneseAberto] = useState(false);
  const [salvandoAnamnese, setSalvandoAnamnese] = useState(false);
  const [dadosAnamnese, setDadosAnamnese] = useState({ tipo_cabelo: '', quimicas_anteriores: '', alergias: '', medicamentos: '', objetivos: '' });

  function abrirFichaTecnica() {
    setDadosAnamnese(clienteFresh?.anamnese || { tipo_cabelo: '', quimicas_anteriores: '', alergias: '', medicamentos: '', objetivos: '' });
    setModalAnamneseAberto(true);
  }

  async function salvarFichaTecnica(e: any) {
    e.preventDefault();
    if (!clienteFresh?.id) return;
    setSalvandoAnamnese(true);
    const { error } = await supabase.from('clientes').update({ anamnese: dadosAnamnese }).eq('id', clienteFresh.id);
    if (!error) {
      setClienteFresh({ ...clienteFresh, anamnese: dadosAnamnese });
      setModalAnamneseAberto(false);
      toast.sucesso("Ficha técnica salva!");
    } else { toast.erro("Erro ao salvar: " + error.message); }
    setSalvandoAnamnese(false);
  }

  // ─── HISTÓRICO ───────────────────────────────────────────────────────────────
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  async function abrirHistorico() {
    if (!clienteFresh?.id) return;
    setModalHistoricoAberto(true);
    setCarregandoHistorico(true);
    let ids = [clienteFresh.id];
    if (clienteFresh.usuario_portal_id) {
      const { data: v } = await supabase.from('clientes').select('id').eq('usuario_portal_id', clienteFresh.usuario_portal_id);
      if (v?.length) ids = v.map((x: any) => x.id);
    }
    const { data } = await supabase
      .from('agendamentos')
      .select(`id, data, inicio, status, cliente_id, profissionais ( nome ), servicos ( nome_servico )`)
      .in('cliente_id', ids)
      .order('data', { ascending: false })
      .order('inicio', { ascending: false });
    if (data?.length) {
      const { data: vnc } = await supabase.from('clientes').select('id, saloes ( nome )').in('id', ids);
      const nomePorId: Record<string, string> = {};
      (vnc || []).forEach((v: any) => { nomePorId[v.id] = v.saloes?.nome || 'Salão'; });
      setHistorico(data.map((ag: any) => ({ ...ag, nome_salao: nomePorId[ag.cliente_id] || 'Salão' })));
    } else { setHistorico([]); }
    setCarregandoHistorico(false);
  }

  // ─── AVALIAÇÃO ───────────────────────────────────────────────────────────────
  const [agendamentoParaAvaliar, setAgendamentoParaAvaliar] = useState<any>(null);

  // ─── EXCLUSÃO DE CONTA ───────────────────────────────────────────────────────
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const [enviandoExclusao, setEnviandoExclusao] = useState(false);
  const [pedidoExclusaoEnviado, setPedidoExclusaoEnviado] = useState(false);

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
      toast.erro('Não foi possível processar a exclusão. Tente novamente ou contate privacidade@luarys.com.br.');
      setEnviandoExclusao(false);
    }
  }

  // ─── VITRINE / CARRINHO ──────────────────────────────────────────────────────
  const [carrinhoVitrine, setCarrinhoVitrine] = useState<any[]>([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

  // ─── PERFIL ──────────────────────────────────────────────────────────────────
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);

  return {
    clienteFresh, setClienteFresh,
    vitrineConfig, vitrineLiberada,
    proximoAgendamento, carregandoProximo, buscarProximaVisita,
    permiteCancelamentoGratuito, motivoRegistoLegal,
    modalCancelamentoAberto, setModalCancelamentoAberto,
    cienteCancelamento, setCienteCancelamento,
    cancelandoAgendamento, abrirModalCancelamento, confirmarCancelamentoAgendamento,
    modalAnamneseAberto, setModalAnamneseAberto,
    salvandoAnamnese, dadosAnamnese, setDadosAnamnese,
    abrirFichaTecnica, salvarFichaTecnica,
    modalHistoricoAberto, setModalHistoricoAberto,
    historico, carregandoHistorico, abrirHistorico,
    agendamentoParaAvaliar, setAgendamentoParaAvaliar,
    modalExclusaoAberto, setModalExclusaoAberto,
    enviandoExclusao, pedidoExclusaoEnviado, setPedidoExclusaoEnviado,
    solicitarExclusaoConta,
    carrinhoVitrine, setCarrinhoVitrine, carrinhoAberto, setCarrinhoAberto,
    modalPerfilAberto, setModalPerfilAberto,
  };
}
