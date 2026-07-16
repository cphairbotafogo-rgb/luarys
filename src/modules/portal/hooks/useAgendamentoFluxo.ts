'use client'
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { brl, getDataHojeLocal } from "@/lib/constants";
import { useToast } from "@/components/Toast";

export function useAgendamentoFluxo({ clienteFresh, salaoSelecionado }: { clienteFresh: any; salaoSelecionado: any }) {
  const toast = useToast();

  const [modalAberto, setModalAberto] = useState(false);
  const [passo, setPasso] = useState(1);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [idAgendamentoCriado, setIdAgendamentoCriado] = useState<number | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [servicos, setServicos] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [salaoFresh, setSalaoFresh] = useState<any>(salaoSelecionado);

  const [dataEscolhida, setDataEscolhida] = useState("");
  const [horaEscolhida, setHoraEscolhida] = useState("");
  const [servicoEscolhido, setServicoEscolhido] = useState<any>(null);
  const [profissionalEscolhido, setProfissionalEscolhido] = useState<any>(null);
  const [termoBusca, setTermoBusca] = useState("");
  const [setorFiltro, setSetorFiltro] = useState("");
  const [agendamentosDoDia, setAgendamentosDoDia] = useState<any[]>([]);
  const [buscandoAgenda, setBuscandoAgenda] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);

  async function abrirAgendamento() {
    if (!salaoSelecionado?.id) {
      toast.erro("Não foi possível identificar a unidade. Tente trocar de unidade.");
      return;
    }
    setCarregandoDados(true);
    setErroCarregamento(null);
    let payload: any = null;
    try {
      const res = await fetch(`/api/portal/dados-agendamento?salao_id=${salaoSelecionado.id}`, { cache: 'no-store' });
      const text = await res.text();
      if (!text) throw new Error(`Resposta vazia (status ${res.status})`);
      payload = JSON.parse(text);
      if (!res.ok) throw new Error(payload?.error ?? `Erro ${res.status}`);
    } catch (e: any) {
      setErroCarregamento('Não foi possível carregar os serviços. Tente novamente.');
      setCarregandoDados(false);
      return;
    }
    setServicos(payload.servicos ?? []);
    setProfissionais((payload.profissionais ?? []).filter((p: any) =>
      p.ativo !== false && p.produtivo !== false && p.perfil_avancado?.exibir_na_agenda !== false
    ));
    if (payload.salao) setSalaoFresh(payload.salao);
    setDataEscolhida(""); setHoraEscolhida(""); setServicoEscolhido(null);
    setProfissionalEscolhido(null); setTermoBusca(""); setSetorFiltro("");
    setAceitouTermos(false); setAgendamentosDoDia([]);
    setModalAberto(true);
    setPasso(1);
    setCarregandoDados(false);
  }

  function converterParaMinutos(horaStr: string) {
    if (!horaStr) return 0;
    const [h, m] = horaStr.split(':').map(Number);
    return h * 60 + m;
  }

  async function aoEscolherData(dataStr: string) {
    setDataEscolhida(dataStr);
    setHoraEscolhida("");
    if (!dataStr || !salaoSelecionado?.id) return;
    setBuscandoAgenda(true);

    const horariosPadrao = [
      { id: 1, ativo: true, inicio: '09:00', fim: '19:00' }, { id: 2, ativo: true, inicio: '09:00', fim: '19:00' },
      { id: 3, ativo: true, inicio: '09:00', fim: '19:00' }, { id: 4, ativo: true, inicio: '09:00', fim: '19:00' },
      { id: 5, ativo: true, inicio: '09:00', fim: '19:00' }, { id: 6, ativo: true, inicio: '09:00', fim: '18:00' },
      { id: 0, ativo: false, inicio: '10:00', fim: '15:00' },
    ];
    let configHorarios: any[] = [];
    try {
      configHorarios = typeof salaoFresh?.horarios_funcionamento === 'string'
        ? JSON.parse(salaoFresh.horarios_funcionamento)
        : (salaoFresh?.horarios_funcionamento || horariosPadrao);
    } catch { configHorarios = horariosPadrao; }
    if (!configHorarios?.length) configHorarios = horariosPadrao;

    const { data: diaExc } = await supabase
      .from('dias_excepcionais').select('tipo, hora_abertura, hora_fechamento')
      .eq('salao_id', salaoSelecionado.id).eq('data', dataStr).maybeSingle();

    if (diaExc?.tipo === 'fechado') { setHorariosDisponiveis([]); setBuscandoAgenda(false); return; }

    const diaDaSemana = new Date(dataStr + "T12:00:00").getDay();
    let configDoDia: any = configHorarios.find((h: any) => h.id === diaDaSemana);
    if (diaExc?.tipo === 'horario_especial' && diaExc.hora_abertura && diaExc.hora_fechamento) {
      configDoDia = { ativo: true, inicio: diaExc.hora_abertura, fim: diaExc.hora_fechamento };
    }

    let horariosGerados: string[] = [];
    if (configDoDia?.ativo) {
      let t = converterParaMinutos(configDoDia.inicio);
      const fim = converterParaMinutos(configDoDia.fim);
      while (t <= fim) {
        horariosGerados.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
        t += 30;
      }
    }
    setHorariosDisponiveis(horariosGerados);

    const { data } = await supabase.from('agendamentos')
      .select('profissional_id, inicio, duracao_minutos, status')
      .eq('salao_id', salaoSelecionado.id).eq('data', dataStr)
      .not('status', 'in', '("Cancelado","Faltou")');
    if (data) setAgendamentosDoDia(data);
    setBuscandoAgenda(false);
  }

  function isHorarioEsgotado(hora: string) {
    if (!profissionais?.length) return false;
    const inicio = converterParaMinutos(hora);
    const duracao = servicoEscolhido?.duracao_minutos || 30;
    const fim = inicio + duracao;
    const profsLivres = profissionais.filter((p: any) => {
      const temConflito = agendamentosDoDia.some((ag: any) => {
        if (ag?.profissional_id !== p.id) return false;
        const agI = converterParaMinutos(ag.inicio);
        const agF = agI + (ag.duracao_minutos || 30);
        return inicio < agF && fim > agI;
      });
      if (temConflito) return false;
      const cfg = p?.horarios_funcionamento || p?.perfil_avancado?.horarios || salaoFresh?.horarios_funcionamento;
      if (!cfg) return true;
      try {
        const arr = typeof cfg === 'string' ? JSON.parse(cfg) : cfg;
        const dia = new Date(dataEscolhida + "T12:00:00").getDay();
        const cfgDia = arr.find((h: any) => h.id === dia);
        if (!cfgDia?.ativo) return false;
        const tI = converterParaMinutos(cfgDia.inicio);
        const tF = converterParaMinutos(cfgDia.fim);
        if (inicio < tI || fim > tF) return false;
        if (cfgDia.inicio_intervalo && cfgDia.fim_intervalo) {
          const aI = converterParaMinutos(cfgDia.inicio_intervalo);
          const aF = converterParaMinutos(cfgDia.fim_intervalo);
          if (inicio < aF && fim > aI) return false;
        }
      } catch { /* usa padrão */ }
      return true;
    });
    return profsLivres.length === 0;
  }

  async function confirmarAgendamento(statusForcado: string | null = null, profissionalParam?: any) {
    const profFinal = profissionalParam || profissionalEscolhido;
    if (!dataEscolhida || !horaEscolhida || !servicoEscolhido?.id || !profFinal?.id || !salaoSelecionado?.id || !clienteFresh?.id) return null;
    setSalvando(true);

    const cobrarSinal = salaoFresh?.cobrar_sinal;
    const valorSinal = (servicoEscolhido?.preco_padrao || 0) * ((salaoFresh?.porcentagem_sinal || 0) / 100);
    const textoObs = cobrarSinal ? `[Portal do Cliente] Aceitou Termos de Reserva (CC 418). Taxa: ${brl(valorSinal)}.` : '[Portal do Cliente]';

    if (idAgendamentoCriado && statusForcado === 'Confirmado') {
      const { error } = await supabase.from('agendamentos').update({ status: 'Confirmado' }).eq('id', idAgendamentoCriado);
      setSalvando(false);
      if (!error) setPasso(6);
      return idAgendamentoCriado;
    }

    const duracao = servicoEscolhido?.duracao_minutos || 30;
    const iniMin = converterParaMinutos(horaEscolhida);
    const fimMin = iniMin + duracao;
    const { data: agsDia } = await supabase.from('agendamentos')
      .select('inicio, duracao_minutos').eq('salao_id', salaoSelecionado.id)
      .eq('profissional_id', profFinal.id).eq('data', dataEscolhida)
      .not('status', 'in', '("Cancelado","Faltou")');
    const temConflito = (agsDia || []).some((ag: any) => {
      const ai = converterParaMinutos(ag.inicio);
      const af = ai + (ag.duracao_minutos || 30);
      return iniMin < af && fimMin > ai;
    });
    if (temConflito) {
      toast.aviso('Este horário acabou de ser reservado. Escolha outro horário.');
      setSalvando(false);
      setPasso(3);
      const d = dataEscolhida;
      setDataEscolhida('');
      setTimeout(() => setDataEscolhida(d), 50);
      return null;
    }

    const statusFinal = statusForcado || (cobrarSinal ? 'Aguardando' : 'Confirmado');
    const { data, error } = await supabase.from('agendamentos').insert([{
      salao_id: salaoSelecionado.id, cliente_id: clienteFresh.id, profissional_id: profFinal.id,
      servico_id: servicoEscolhido.id, data: dataEscolhida, inicio: horaEscolhida,
      duracao_minutos: duracao, status: statusFinal,
      cliente_nome: clienteFresh.nome_completo || 'Cliente',
      observacao: textoObs, valor_sinal: cobrarSinal ? valorSinal : 0,
    }]).select('id');
    setSalvando(false);
    if (!error && data) {
      const novoId = data[0].id;
      setIdAgendamentoCriado(novoId);
      await supabase.from('notificacoes').insert([{
        salao_id: salaoSelecionado.id,
        titulo: 'Novo Agendamento Online!',
        mensagem: `${clienteFresh.nome_completo.split(' ')[0]} agendou ${servicoEscolhido.nome_servico} para ${dataEscolhida.split('-').reverse().join('/')} às ${horaEscolhida}. Status: ${statusFinal}.`,
      }]);
      if (!cobrarSinal || statusFinal === 'Confirmado') setPasso(6);
      return novoId;
    } else {
      if ((error as any)?.code === '23505') {
        toast.aviso('Este horário foi reservado agora por outro cliente. Escolha outro horário.');
        setPasso(3);
        const d = dataEscolhida;
        setDataEscolhida('');
        setTimeout(() => setDataEscolhida(d), 50);
      } else {
        toast.erro('Erro ao agendar. Tente novamente.');
      }
      return null;
    }
  }

  const setoresUnicos = [...new Set(servicos.map((s: any) => s?.setor).filter(Boolean))].sort() as string[];
  const servicosFiltrados = servicos.filter(s => {
    const matchNome = s?.nome_servico?.toLowerCase().includes((termoBusca || "").toLowerCase());
    const matchSetor = !setorFiltro || s?.setor === setorFiltro;
    return matchNome && matchSetor;
  });
  const profissionaisDisponiveis = profissionais.filter((p: any) => {
    if (!p?.id) return false;
    const duracao = servicoEscolhido?.duracao_minutos || 30;
    const ini = converterParaMinutos(horaEscolhida);
    const fim = ini + duracao;
    const ocupado = agendamentosDoDia.some((ag: any) => {
      if (ag?.profissional_id !== p.id) return false;
      const ai = converterParaMinutos(ag.inicio);
      const af = ai + (ag.duracao_minutos || 30);
      return ini < af && fim > ai;
    });
    if (ocupado) return false;
    if (p?.servicos_habilitados && !p.servicos_habilitados.includes(servicoEscolhido?.id)) return false;
    const cfg = p?.horarios_funcionamento || p?.perfil_avancado?.horarios || salaoFresh?.horarios_funcionamento;
    if (!cfg) return true;
    try {
      const arr = typeof cfg === 'string' ? JSON.parse(cfg) : cfg;
      const dia = new Date(dataEscolhida + "T12:00:00").getDay();
      const cfgDia = arr.find((h: any) => h.id === dia);
      if (!cfgDia?.ativo) return false;
      const tI = converterParaMinutos(cfgDia.inicio);
      const tF = converterParaMinutos(cfgDia.fim);
      if (ini < tI || fim > tF) return false;
      if (cfgDia.inicio_intervalo && cfgDia.fim_intervalo) {
        const aI = converterParaMinutos(cfgDia.inicio_intervalo);
        const aF = converterParaMinutos(cfgDia.fim_intervalo);
        if (ini < aF && fim > aI) return false;
      }
    } catch { /* usa padrão */ }
    return true;
  });

  return {
    modalAberto, setModalAberto,
    passo, setPasso,
    carregandoDados, erroCarregamento,
    salaoFresh,
    dataEscolhida, horaEscolhida, setHoraEscolhida,
    servicoEscolhido, setServicoEscolhido,
    profissionalEscolhido, setProfissionalEscolhido,
    termoBusca, setTermoBusca,
    setorFiltro, setSetorFiltro,
    buscandoAgenda, salvando,
    aceitouTermos, setAceitouTermos,
    horariosDisponiveis,
    setoresUnicos, servicosFiltrados, profissionaisDisponiveis,
    abrirAgendamento, aoEscolherData, isHorarioEsgotado, confirmarAgendamento,
  };
}
