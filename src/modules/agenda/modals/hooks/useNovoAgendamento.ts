'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { temPermissao } from "@/lib/permissoes";
import { MSG_ZAP_PADRAO } from "@/lib/mensagensPadrao";

export function useNovoAgendamento({ perfil, dadosIniciais, agendamentosExistentes, onClose, onSalvarEFaturar }: any) {
  const toast = useToast();
  const podeEditarValor = temPermissao(perfil, 'agenda.editar_valor_servico');

  const [isMounted, setIsMounted] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [bancoProfissionais, setBancoProfissionais] = useState<any[]>([]);
  const [bancoServicos, setBancoServicos] = useState<any[]>([]);
  const [bancoClientes, setBancoClientes] = useState<any[]>([]);
  const [msgWhatsAppPadrao, setMsgWhatsAppPadrao] = useState(MSG_ZAP_PADRAO);
  const [nomeSalao, setNomeSalao] = useState("");

  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null);
  const [dropdownAtivo, setDropdownAtivo] = useState<string | null>(null);
  const [highlightedCliente, setHighlightedCliente] = useState(-1);
  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [nomeParaCadastro, setNomeParaCadastro] = useState("");

  const normalizarTexto = (texto: string) =>
    (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const gerarIdSeguro = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

  const [itensAgendamento, setItensAgendamento] = useState([{
    id: "item-inicial",
    buscaServico: "", servico_id: "",
    buscaProfissional: "", profissional_id: dadosIniciais?.profissional_id || "",
    data: dadosIniciais?.data || "", hora: dadosIniciais?.hora || "",
    duracao: 60, valor: "",
    valorEditadoManualmente: false,
    eh_encaixe: false,
  }]);

  const adicionarNovoItem = () => {
    const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
    setItensAgendamento(prev => {
      // Herda data e horário do primeiro item — recepção altera se necessário
      const dataInicial = prev[0]?.data || hoje;
      const horaInicial = prev[0]?.hora || "";
      return [...prev, {
        id: gerarIdSeguro(), buscaServico: "", servico_id: "",
        buscaProfissional: "", profissional_id: "", data: dataInicial, hora: horaInicial,
        duracao: 60, valor: "", valorEditadoManualmente: false, eh_encaixe: false,
      }];
    });
  };

  useEffect(() => {
    setIsMounted(true);
    // Abre dropdown de cliente automaticamente ao montar (a menos que já haja cliente pré-selecionado)
    if (!dadosIniciais?.cliente_id && !dadosIniciais?.cliente_nome) {
      setDropdownAtivo("cliente");
    }
    if (!dadosIniciais?.data) {
      const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
      setItensAgendamento(prev => prev.map((item, idx) => idx === 0 ? { ...item, data: hoje } : item));
    }
  }, [dadosIniciais]);

  useEffect(() => {
    async function carregarListas() {
      if (!perfil?.salao_id) return;
      const [resProf, resServ, resClientes, resSalao, resCrm] = await Promise.allSettled([
        supabase.from('profissionais').select('id, nome, servicos_comissoes').eq('salao_id', perfil.salao_id),
        supabase.from('servicos').select('*').eq('salao_id', perfil.salao_id),
        supabase.from('clientes').select('*').eq('salao_id', perfil.salao_id),
        supabase.from('saloes').select('msg_whatsapp, nome_fantasia').eq('id', perfil.salao_id).maybeSingle(),
        supabase.from('crm_clientes').select('cliente_id, etiquetas').eq('salao_id', perfil.salao_id),
      ]);
      // Carrega texto padrão do WhatsApp configurado em Comunicação → Textos Padrões
      if (resSalao.status === 'fulfilled' && resSalao.value?.data) {
        if (resSalao.value.data.msg_whatsapp) setMsgWhatsAppPadrao(resSalao.value.data.msg_whatsapp);
        if (resSalao.value.data.nome_fantasia) setNomeSalao(resSalao.value.data.nome_fantasia);
      }
      const getD = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value?.data : null;
      const profs = getD(resProf) || [];
      const servs = (getD(resServ) || []).map((s: any) => ({
        id: s.id, nome: s.nome_servico, preco: s.preco_padrao,
        duracao: s.duracao_minutos || s.duracao || 60,
      }));
      setBancoProfissionais(profs);
      setBancoServicos(servs);
      // Mescla etiquetas do CRM nos objetos de cliente
      const etiqPorCliente: Record<string, any[]> = {};
      (getD(resCrm) || []).forEach((crm: any) => { etiqPorCliente[crm.cliente_id] = crm.etiquetas || []; });
      const clientesBrutos = getD(resClientes);
      const clientes = clientesBrutos
        ? clientesBrutos.map((c: any) => ({ ...c, etiquetas: etiqPorCliente[c.id] || [] }))
        : null;
      if (clientes) {
        setBancoClientes(clientes);
        // Pré-seleciona cliente quando aberto via Fechamento de Conta
        if (dadosIniciais?.cliente_id || dadosIniciais?.cliente_nome) {
          const clientePreSel = clientes.find((c: any) =>
            dadosIniciais.cliente_id ? c.id === dadosIniciais.cliente_id : c.nome_completo === dadosIniciais.cliente_nome
          );
          if (clientePreSel) {
            setClienteSelecionado(clientePreSel);
            setBuscaCliente(clientePreSel.nome_completo);
          }
        }
      }
      if (dadosIniciais?.profissional_id && profs.length > 0) {
        const prof = profs.find((p: any) => p.id === dadosIniciais.profissional_id);
        if (prof) setItensAgendamento(prev => prev.map((item, idx) => idx === 0 ? { ...item, buscaProfissional: prof.nome } : item));
      }
    }
    carregarListas();
  }, [perfil?.salao_id, dadosIniciais]);

  useEffect(() => {
    const handler = () => setDropdownAtivo(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const termoLimpo = normalizarTexto(buscaCliente).trim().replace(/[\.\-\(\)\s]/g, '');
  const resultadosCliente = bancoClientes.filter(cli => {
    if (!termoLimpo) return true;
    const nomeLimpo = normalizarTexto(cli.nome_completo || '').replace(/[\.\-\(\)\s]/g, '');
    const telLimpo = (cli.telefone_whatsapp || '').replace(/[\.\-\(\)\s]/g, '');
    const cpfLimpo = (cli.cpf || '').replace(/[\.\-\(\)\s]/g, '');
    const telJsonMatch = Array.isArray(cli.telefones)
      ? cli.telefones.some((t: any) => (t.numero || '').replace(/[\.\-\(\)\s]/g, '').includes(termoLimpo))
      : false;
    return nomeLimpo.includes(termoLimpo) || telLimpo.includes(termoLimpo) || cpfLimpo.includes(termoLimpo) || telJsonMatch;
  }).sort((a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || '', 'pt-BR')).slice(0, 10);

  const getServicosFiltrados = (busca: string, profissionalId?: string) => {
    let lista = bancoServicos;
    if (profissionalId) {
      const prof = bancoProfissionais.find(p => p.id === profissionalId);
      const comissoes = prof?.servicos_comissoes;
      if (comissoes && typeof comissoes === 'object' && Object.keys(comissoes).length > 0) {
        const ids = new Set(Object.keys(comissoes));
        const filtrada = lista.filter(s => ids.has(String(s.id)));
        // Se nenhum serviço do banco bate com os IDs de comissão (IDs desatualizados),
        // exibe todos os serviços para não deixar a lista vazia.
        if (filtrada.length > 0) lista = filtrada;
      }
    }
    return lista.filter(s => normalizarTexto(s.nome).includes(normalizarTexto(busca)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  };

  const getProfissionaisFiltrados = (busca: string) =>
    bancoProfissionais.filter(p => normalizarTexto(p.nome).includes(normalizarTexto(busca)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const selecionarCliente = (cliente: any) => {
    setClienteSelecionado(cliente);
    setBuscaCliente(cliente.nome_completo);
    setDropdownAtivo(null);
  };

  const atualizarItem = (id: string, campo: string, valor: any) =>
    setItensAgendamento(prev => prev.map(item => item.id === id ? { ...item, [campo]: valor } : item));

  const atualizarItemCampos = (id: string, campos: Record<string, any>) =>
    setItensAgendamento(prev => prev.map(item => item.id === id ? { ...item, ...campos } : item));

  const totalGeral = itensAgendamento.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

  // Abre WhatsApp com o texto padrão configurado em Comunicação → Textos Padrões
  function abrirWhatsAppConfirmacao() {
    if (!clienteSelecionado) return;
    const telefone = clienteSelecionado.telefone_whatsapp
      || (Array.isArray(clienteSelecionado.telefones) && clienteSelecionado.telefones[0]?.numero)
      || clienteSelecionado.telefone;
    if (!telefone) { toast.aviso('Este cliente não tem telefone cadastrado.'); return; }
    const numeroLimpo = String(telefone).replace(/\D/g, '');
    const primeiroNome = (clienteSelecionado.nome_completo || '').split(' ')[0];
    const primeiroItem = itensAgendamento[0];
    const dataFormatada = primeiroItem?.data
      ? primeiroItem.data.split('-').reverse().join('/') : '';
    const horario = primeiroItem?.hora || '';
    const nomeServico = primeiroItem?.servico_id
      ? (bancoServicos.find(s => s.id === primeiroItem.servico_id)?.nome || '') : '';
    const nomeProfissional = primeiroItem?.profissional_id
      ? (bancoProfissionais.find(p => p.id === primeiroItem.profissional_id)?.nome || '') : '';
    let mensagem = msgWhatsAppPadrao
      .replace(/\{nome_do_cliente\}/g, primeiroNome)
      .replace(/\{data\}/g, dataFormatada)
      .replace(/\{horario\}/g, horario)
      .replace(/\{servico\}/g, nomeServico)
      .replace(/\{nome_salao\}/g, nomeSalao);
    if (nomeProfissional) {
      mensagem = mensagem.replace(/\{profissional\}/g, nomeProfissional);
    } else {
      // Remove a linha inteira que contém {profissional}
      mensagem = mensagem.replace(/.*\{profissional\}.*\n?/g, '');
    }
    window.open(`https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
  }

  function buildPayload() {
    return itensAgendamento.map(item => {
      const cat = bancoServicos.find(s => s.id === item.servico_id);
      return {
        salao_id: perfil.salao_id,
        cliente_id: clienteSelecionado.id,
        cliente_nome: clienteSelecionado.nome_completo,
        profissional_id: item.profissional_id,
        servico_id: item.servico_id,
        data: item.data, inicio: item.hora,
        duracao_min: Number(item.duracao) || cat?.duracao || 60,
        valor_final: item.valor !== "" && item.valor != null ? Number(item.valor) : (cat?.preco ?? null),
        preco_editado_manualmente: item.valorEditadoManualmente || false,
        data_hora_inicio: new Date(`${item.data}T${item.hora}:00`).toISOString(),
        status: 'Agendado',
        eh_encaixe: item.eh_encaixe || false,
        cor: '#1E293B',
      };
    });
  }

  function validar() {
    if (!clienteSelecionado) { toast.aviso('Selecione ou cadastre um cliente.'); return false; }
    for (const item of itensAgendamento) {
      if (!item.servico_id || !item.profissional_id || !item.data || !item.hora) {
        toast.aviso('Preencha todos os campos do serviço (Serviço, Profissional, Data e Hora).');
        return false;
      }
    }
    return true;
  }

  const handleConfirmarAgendamento = async () => {
    if (!validar()) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from('agendamentos').insert(buildPayload());
      if (error) throw error;
      onClose(true);
    } catch (e: any) {
      console.error('[useNovoAgendamento] confirmar:', e?.message ?? e);
      toast.erro('Erro ao gravar: ' + (e?.message || 'verifique o console.'));
    }
    finally { setSalvando(false); }
  };

  const handleSalvarEFaturar = async () => {
    if (!validar()) return;
    setSalvando(true);
    try {
      const { data: inseridos, error } = await supabase.from('agendamentos').insert(buildPayload()).select();
      if (error) throw error;
      if (typeof onSalvarEFaturar === 'function') onSalvarEFaturar(inseridos ?? [], bancoServicos);
      else onClose(true);
    } catch (e: any) {
      console.error('[useNovoAgendamento] salvar-e-faturar:', e?.message ?? e);
      toast.erro('Erro ao gravar: ' + (e?.message || 'verifique o console.'));
    }
    finally { setSalvando(false); }
  };

  return {
    isMounted, salvando, podeEditarValor,
    buscaCliente, setBuscaCliente,
    clienteSelecionado, selecionarCliente,
    dropdownAtivo, setDropdownAtivo,
    highlightedCliente, setHighlightedCliente,
    modalCadastroAberto, setModalCadastroAberto,
    nomeParaCadastro, setNomeParaCadastro,
    resultadosCliente, bancoClientes, setBancoClientes,
    bancoServicos, bancoProfissionais,
    itensAgendamento, setItensAgendamento,
    adicionarNovoItem, atualizarItem, atualizarItemCampos,
    getServicosFiltrados, getProfissionaisFiltrados,
    totalGeral, toast,
    handleConfirmarAgendamento, handleSalvarEFaturar,
    agendamentosExistentes,
    abrirWhatsAppConfirmacao,
  };
}
