// src/modules/agenda/useAbaAgenda.ts
// Hook central da AbaAgenda.
// Concentra: estado de modais, formulários e todas as funções de negócio.
// Os hooks de dados/layout/caixa são chamados AQUI e re-exportados para o shell.
'use client'
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { temPermissao } from '@/lib/permissoes';
import { corDoTipoBloqueio, TIPOS_BLOQUEIO } from '@/modules/agenda/modals/ModalAusencia';
import { useAgendaDados } from '@/modules/agenda/modals/hooks/useAgendaDados';
import { useFechamentoCaixa } from '@/modules/agenda/modals/hooks/useFechamentoCaixa';
import { useAgendaLayout } from '@/modules/agenda/modals/hooks/useAgendaLayout';
import { COR_POR_STATUS } from '@/lib/agendaUtils';
import { MSG_ZAP_PADRAO } from '@/lib/mensagensPadrao';

export function useAbaAgenda(perfil: any, dataAtual: Date, setDataAtual: (d: Date) => void) {
  const toast = useToast();

  // ── Motores externos ────────────────────────────────────────────────────────
  const {
    clientesDb, setClientesDb, servicosDb, profissionaisDb, produtosDb,
    dadosSalao, agendamentos, setAgendamentos, etiquetasDb, setEtiquetasDb,
    carregando, carregarDadosParaAgenda,
  } = useAgendaDados(perfil, dataAtual);

  const {
    tamanhoLinha, alterarTamanhoLinha, tamanhoColuna, alterarTamanhoColuna,
    mostrarFolgas, setMostrarFolgas, sidebarAberta, setSidebarAberta,
    redimensionando, gridScrollRef, ALTURA_HORA, ALTURA_MINUTO, LARGURA_COLUNA,
    HORA_INICIO, HORA_FIM, horasDoDia, horariosDoDia, diaSalaoFechado,
    iniciarRedimensionamento, aoMoverMouse, aoSoltarMouse,
  } = useAgendaLayout(dadosSalao, dataAtual, setAgendamentos);

  // ── Estado de modais ────────────────────────────────────────────────────────
  const [modalNovoAberto, setModalNovoAberto]             = useState(false);
  const [modalEdicaoAberto, setModalEdicaoAberto]         = useState(false);
  const [modalClienteRapido, setModalClienteRapido]       = useState(false);
  const [modalCancelamentoAberto, setModalCancelamentoAberto] = useState(false);
  const [modalEdicaoCliente, setModalEdicaoCliente]       = useState(false);
  const [modalAusenciaAberto, setModalAusenciaAberto]     = useState(false);
  const [agDetalhesFinalizado, setAgDetalhesFinalizado]   = useState<any>(null);

  // ── Estado de formulários ───────────────────────────────────────────────────
  const [menuContexto, setMenuContexto]   = useState({ visivel: false, x: 0, y: 0, profId: '', hora: '' });
  const [bloqueioEditandoId, setBloqueioEditandoId] = useState<any>(null);
  const [bloqueioParaDetalhes, setBloqueioParaDetalhes] = useState<any>(null);
  const [dadosIniciaisModalNovo, setDadosIniciaisModalNovo] = useState<any>(null);
  const [formAusencia, setFormAusencia]   = useState({ profissional: '', dataInicio: '', horaInicio: '12:00', dataFim: '', horaFim: '13:00', tipo: 'Falta', motivo: 'Almoço', observacoes: '' });
  const [dadosCancelamento, setDadosCancelamento] = useState<any>({ quem: 'Cliente', motivo: '' });
  const [mostrandoNovaEtiqueta, setMostrandoNovaEtiqueta] = useState(false);
  const [novaTag, setNovaTag]             = useState({ nome: '', cor: '#F26522' });
  const [editandoAg, setEditandoAg]       = useState<any>({ id: null, cliente: '', servico: '', id_prof: '', data: '', inicio: '', duracaoMin: 60, observacao: '', etiquetas: [], totalBruto: 0 });
  const [indexTelefoneZap, setIndexTelefoneZap] = useState(0);
  const [abaAtivaCrm, setAbaAtivaCrm]     = useState('cadastro');
  const [formCliente, setFormCliente]     = useState<any>({});
  const [filtroFuncao, setFiltroFuncao]   = useState('');

  // ── Motor de caixa ──────────────────────────────────────────────────────────
  const { mesStr, diaStr, dataHojeStr } = useMemo(() => {
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    return { mesStr: mes, diaStr: dia, dataHojeStr: `${dataAtual.getFullYear()}-${mes}-${dia}` };
  }, [dataAtual]);

  const {
    modalCaixaAberto, setModalCaixaAberto, dadosCaixa, setDadosCaixa,
    abrirFechamentoDeCaixa, adicionarItemAvulsoCaixa, finalizarFechamentoConta,
  } = useFechamentoCaixa({
    perfil, agendamentos, setAgendamentos, clientesDb, servicosDb, profissionaisDb,
    produtosDb, dataHojeStr, editandoAg, setModalEdicaoAberto,
  });

  // ── Permissões e listas derivadas ───────────────────────────────────────────
  const pAcesso = perfil?.permissoes?.perfil_acesso || '';
  const isAdminOuRecepcao = perfil?.isDono || temPermissao(perfil, 'agenda.agendar_outro_profissional') || ['Administrador', 'Recepcionista', 'Gerente'].includes(pAcesso);
  const todasFuncoes = [...new Set(profissionaisDb.map((p: any) => p.perfil_avancado?.contrato?.funcao).filter(Boolean))].sort() as string[];
  const profissionaisAgenda = profissionaisDb.filter((p: any) => p.ativo !== false && p.produtivo !== false && p.perfil_avancado?.exibir_na_agenda !== false);
  const profissionaisVisiveis = profissionaisAgenda.filter((p: any) => isAdminOuRecepcao || p.id === perfil?.profissional_id || p.email === perfil?.email);

  // ── Funções utilitárias ─────────────────────────────────────────────────────
  function somarMinutos(horaStr: string, min: number) {
    if (!horaStr) return '13:00';
    const [h, m] = horaStr.split(':').map(Number);
    const t = h * 60 + m + min;
    return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  function verificarAniversario(nomeCliente: string) {
    const c = clientesDb.find((x: any) => x.nome_completo === nomeCliente);
    if (!c?.nascimento) return false;
    const hoje = new Date(), nasc = new Date(c.nascimento);
    return nasc.getDate() === hoje.getDate() && nasc.getMonth() === hoje.getMonth();
  }

  // ── Menu de contexto (clique direito na grade vazia) ────────────────────────
  function lidarComCliqueDireito(e: any, profId: string, hora: string) {
    e.preventDefault();
    setMenuContexto({ visivel: true, x: e.clientX, y: e.clientY, profId, hora });
  }

  function registrarAlmocoRapido(minutos: number) {
    const bloqueio = { id: 'block-' + Date.now(), id_prof: menuContexto.profId, cliente: 'BLOQUEIO OPERACIONAL', servico: 'Bloqueio de Agenda', data: dataHojeStr, inicio: menuContexto.hora, duracaoMin: minutos, status: 'Bloqueado', observacao: '[Bloqueio operacional] Almoço / Pausa', cor: corDoTipoBloqueio('Bloqueio operacional') };
    setAgendamentos([...agendamentos, bloqueio]);
    setMenuContexto({ ...menuContexto, visivel: false });
  }

  function abrirModalAusenciaPeloMenu() {
    setBloqueioEditandoId(null);
    setFormAusencia({ profissional: menuContexto.profId, dataInicio: dataHojeStr, horaInicio: menuContexto.hora, dataFim: dataHojeStr, horaFim: somarMinutos(menuContexto.hora, 60), tipo: 'Falta', motivo: 'Almoço', observacoes: '' });
    setMenuContexto({ ...menuContexto, visivel: false });
    setModalAusenciaAberto(true);
  }

  function abrirEdicaoBloqueio(bloqueio: any) {
    // Mostra primeiro o modal compacto de detalhes; edição completa via abrirFormEdicaoBloqueio
    setBloqueioParaDetalhes(bloqueio);
  }

  function abrirFormEdicaoBloqueio(bloqueio: any) {
    setBloqueioEditandoId(bloqueio.id);
    const match = String(bloqueio.observacao || '').match(/^\[(.+?)\]\s*(.*)$/);
    const tipoExtraido = match ? match[1] : null;
    const motivoExtraido = match ? match[2] : bloqueio.observacao;
    const tipoValido = TIPOS_BLOQUEIO.some((t: any) => t.valor === tipoExtraido) ? tipoExtraido! : (bloqueio.cliente === 'LIBERAÇÃO' ? 'Liberação' : 'Falta');
    setFormAusencia({ profissional: bloqueio.id_prof, dataInicio: bloqueio.data, horaInicio: bloqueio.inicio, dataFim: bloqueio.data, horaFim: somarMinutos(bloqueio.inicio, bloqueio.duracaoMin), tipo: tipoValido, motivo: motivoExtraido, observacoes: '' });
    setBloqueioParaDetalhes(null);
    setModalAusenciaAberto(true);
  }

  async function excluirBloqueioRapido() {
    if (!bloqueioParaDetalhes) return;
    if (!await confirmarAcaoGlobal({ titulo: 'Remover este bloqueio?', perigoso: true })) return;
    if (!String(bloqueioParaDetalhes.id).startsWith('block-')) {
      await supabase.from('agendamentos').delete().eq('id', bloqueioParaDetalhes.id);
    }
    setBloqueioParaDetalhes(null);
    carregarDadosParaAgenda();
  }

  // ── Menu de contexto sobre card (clique direito no agendamento) ─────────────
  async function alterarStatusRapido(ag: any, novoStatus: string) {
    const novaCor = COR_POR_STATUS[novoStatus] || ag.cor || '#8EA291';
    setAgendamentos((prev: any[]) => prev.map(a => a.id === ag.id ? { ...a, status: novoStatus, cor: novaCor } : a));
    const { error } = await supabase.from('agendamentos').update({ status: novoStatus, cor: novaCor }).eq('id', ag.id);
    if (error) { toast.erro('Erro ao alterar status: ' + error.message); carregarDadosParaAgenda(); }
    else toast.sucesso(`Status alterado para "${novoStatus}"`);
  }

  function iniciarCancelamentoPeloMenu(ag: any, tipoAcao: 'cancelado' | 'faltou') {
    setEditandoAg({ ...ag, observacao: ag.observacao || '', etiquetas: ag.etiquetas || [] });
    setDadosCancelamento({ quem: 'Cliente', motivo: '', tipoAcao });
    setModalCancelamentoAberto(true);
  }

  function abrirEdicaoClientePeloMenu(ag: any) {
    const c = clientesDb.find((x: any) => x.nome_completo === ag.cliente);
    if (c) {
      // Prioriza obs_fixa (crm_clientes.observacoes) para o campo "Observações Fixas" da ficha
      setFormCliente({ ...c, observacoes: c.obs_fixa ?? c.observacoes ?? '' });
      setAbaAtivaCrm('cadastro');
      setModalEdicaoCliente(true);
    }
    else toast.aviso('Cliente não encontrado no cadastro.');
  }

  function fecharContaPeloMenu(ag: any) {
    setEditandoAg({ ...ag, observacao: ag.observacao || '', etiquetas: ag.etiquetas || [] });
    // Passa ag direto para evitar race condition: setEditandoAg é assíncrono
    // e abrirFechamentoDeCaixa() leria o estado antigo se não tiver override.
    abrirFechamentoDeCaixa(ag);
  }

  // ── Salvar edição do agendamento ────────────────────────────────────────────
  async function salvarEdicaoAgendamento() {
    const payload: any = {
      observacao: editandoAg.observacao,
      profissional_id: editandoAg.id_prof, data: editandoAg.data,
      inicio: editandoAg.inicio, duracao_min: editandoAg.duracaoMin,
      valor_final: editandoAg.valor_final ?? null,
      preco_editado_manualmente: editandoAg.preco_editado_manualmente || false,
      status: editandoAg.status || 'Agendado',
      servico_id: editandoAg.servico_id || null,
      eh_encaixe: editandoAg.eh_encaixe || false,
    };
    const { error } = await supabase.from('agendamentos').update(payload).eq('id', editandoAg.id);
    if (error) {
      toast.erro('Não foi possível salvar as alterações. Tente novamente.');
      if (process.env.NODE_ENV === 'development') console.error('Erro salvarEdicaoAgendamento:', { message: error.message, details: (error as any).details, hint: (error as any).hint, code: (error as any).code });
      throw error;
    }
    if (editandoAg.cliente_id) {
      await supabase.from('crm_clientes').update({ etiquetas: editandoAg.etiquetas || [] }).eq('cliente_id', editandoAg.cliente_id).eq('salao_id', perfil.salao_id);
    }
    const recorrencia = editandoAg.recorrencia || 'nao';
    if (recorrencia !== 'nao') {
      const intervalo = ({ semanal: 7, quinzenal: 15, mensal: 30 } as any)[recorrencia] || 30;
      const ocorrencias = [];
      let base = new Date(editandoAg.data + 'T12:00:00');
      for (let i = 1; i <= 6; i++) {
        base = new Date(base.getTime() + intervalo * 86400000);
        ocorrencias.push({ salao_id: perfil.salao_id, profissional_id: editandoAg.id_prof, cliente_id: editandoAg.cliente_id, cliente_nome: editandoAg.cliente, servico_id: editandoAg.servico_id || null, data: base.toISOString().split('T')[0], inicio: editandoAg.inicio, duracao_min: editandoAg.duracaoMin, status: 'Agendado', cor: '#1E293B', observacao: `[Recorrência ${recorrencia}] ${editandoAg.observacao || ''}`.trim(), valor_final: editandoAg.valor_final ?? null });
      }
      await supabase.from('agendamentos').insert(ocorrencias);
    }
    await carregarDadosParaAgenda();
  }

  // ── Ausência ────────────────────────────────────────────────────────────────
  async function salvarAusencia() {
    if (!formAusencia.profissional) { toast.aviso('Selecione um profissional.'); return; }
    const [hI, mI] = formAusencia.horaInicio.split(':').map(Number);
    const [hF, mF] = formAusencia.horaFim.split(':').map(Number);
    let duracao = (hF * 60 + mF) - (hI * 60 + mI);
    if (duracao <= 0) duracao = 60;
    const motivoCompleto = formAusencia.motivo + (formAusencia.observacoes ? ` - ${formAusencia.observacoes}` : '');
    const payload = { salao_id: perfil.salao_id, profissional_id: formAusencia.profissional, cliente_nome: formAusencia.tipo.toUpperCase(), servico_id: null, data: formAusencia.dataInicio, inicio: formAusencia.horaInicio, duracao_min: duracao, status: 'Bloqueado', observacao: `[${formAusencia.tipo}] ${motivoCompleto}`, cor: corDoTipoBloqueio(formAusencia.tipo) };
    if (bloqueioEditandoId && !String(bloqueioEditandoId).startsWith('block-')) {
      await supabase.from('agendamentos').update(payload).eq('id', bloqueioEditandoId);
    } else {
      await supabase.from('agendamentos').insert([payload]);
    }
    carregarDadosParaAgenda();
    setModalAusenciaAberto(false);
  }

  async function excluirAusencia() {
    if (!await confirmarAcaoGlobal({ titulo: 'Remover este bloqueio?', perigoso: true })) return;
    if (bloqueioEditandoId && !String(bloqueioEditandoId).startsWith('block-')) {
      await supabase.from('agendamentos').delete().eq('id', bloqueioEditandoId);
    }
    carregarDadosParaAgenda();
    setModalAusenciaAberto(false);
  }

  // ── Comunicação ─────────────────────────────────────────────────────────────
  function handleAbrirWhatsApp() {
    const c = clientesDb.find((x: any) => x.nome_completo === editandoAg.cliente);
    if (!c?.telefone_whatsapp) { toast.aviso('Este cliente não tem telefone cadastrado.'); return; }
    const num = c.telefone_whatsapp.replace(/\D/g, '');
    const primeiroNome = (editandoAg.cliente || '').split(' ')[0];
    const dataFormatada = editandoAg.data ? editandoAg.data.split('-').reverse().join('/') : '';
    const prof = profissionaisDb.find((p: any) => p.id === editandoAg.id_prof);
    const nomeSalao = dadosSalao?.nome_fantasia || dadosSalao?.razao_social || 'nosso salão';
    const templateBase = dadosSalao?.msg_whatsapp || MSG_ZAP_PADRAO;
    let mensagem = templateBase
      .replace(/\{nome_do_cliente\}/g, primeiroNome)
      .replace(/\{data\}/g, dataFormatada)
      .replace(/\{horario\}/g, editandoAg.inicio || '')
      .replace(/\{servico\}/g, editandoAg.servico || '')
      .replace(/\{nome_salao\}/g, nomeSalao);
    if (prof?.nome) {
      mensagem = mensagem.replace(/\{profissional\}/g, prof.nome);
    } else {
      mensagem = mensagem.replace(/.*\{profissional\}.*\n?/g, '');
    }
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`, '_blank');
  }

  function handleAbrirEmail() {
    const c = clientesDb.find((x: any) => x.nome_completo === editandoAg.cliente);
    if (!c?.email) { toast.aviso('Este cliente não tem e-mail cadastrado.'); return; }
    const nome = editandoAg.cliente.split(' ')[0];
    const corpoBase = dadosSalao?.msg_email || `Olá ${nome},\n\nGostaria de confirmar os detalhes do seu atendimento conosco...`;
    const corpo = corpoBase.replace(/\{nome_do_cliente\}/g, nome);
    window.location.href = `mailto:${c.email}?subject=${encodeURIComponent('Confirmação de Agendamento')}&body=${encodeURIComponent(corpo)}`;
  }

  // ── Etiquetas ───────────────────────────────────────────────────────────────
  async function removerEtiqueta(id: any) {
    const novas = (editandoAg.etiquetas || []).filter((t: any) => t.id !== id);
    setEditandoAg({ ...editandoAg, etiquetas: novas });
    if (editandoAg.cliente_id) await supabase.from('crm_clientes').update({ etiquetas: novas }).eq('cliente_id', editandoAg.cliente_id).eq('salao_id', perfil.salao_id);
  }

  async function adicionarEtiqueta(id: any) {
    const tag = etiquetasDb.find((t: any) => String(t.id) === String(id));
    if (!tag || editandoAg.etiquetas.find((t: any) => t.id === tag.id)) return;
    const novas = [...(editandoAg.etiquetas || []), tag];
    setEditandoAg({ ...editandoAg, etiquetas: novas });
    if (editandoAg.cliente_id) await supabase.from('crm_clientes').update({ etiquetas: novas }).eq('cliente_id', editandoAg.cliente_id).eq('salao_id', perfil.salao_id);
  }

  async function salvarNovaEtiqueta() {
    if (!novaTag.nome.trim()) return;
    const { data, error } = await supabase.from('etiquetas').insert([{ nome: novaTag.nome.trim(), cor: novaTag.cor, salao_id: perfil.salao_id }]).select('*').single();
    if (!error && data) { setEtiquetasDb((prev: any[]) => [...prev, data]); setEditandoAg({ ...editandoAg, etiquetas: [...(editandoAg.etiquetas || []), data] }); }
    setMostrandoNovaEtiqueta(false);
    setNovaTag({ nome: '', cor: '#8B5CF6' });
  }

  async function confirmarCancelamento() {
    const ehFaltou = dadosCancelamento.tipoAcao === 'faltou';
    const payload = { status: ehFaltou ? 'Faltou' : 'Cancelado', cor: '#EF4444', cancelado_por: ehFaltou ? 'cliente_faltou' : (dadosCancelamento.quem || '').toLowerCase(), motivo_cancelamento: dadosCancelamento.motivo || '' };
    await supabase.from('agendamentos').update(payload).eq('id', editandoAg.id);

    // Cancelamento com sinal pago → cria lançamento de saída para rastrear o reembolso
    if (!ehFaltou) {
      const valorSinal = Number(editandoAg.valor_sinal) || 0;
      if (valorSinal > 0) {
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        await supabase.from('financeiro').insert({
          salao_id: perfil.salao_id,
          tipo: 'saida',
          categoria: 'Reembolso de Sinal',
          valor: valorSinal,
          cliente_nome: editandoAg.cliente,
          status: 'Pendente',
          descricao: `Sinal a devolver — cancelamento por ${dadosCancelamento.quem || 'recepcionista'}: ${dadosCancelamento.motivo || 'sem motivo'}`,
          data_movimentacao: new Date().toISOString(),
          agendamento_ids: UUID_RE.test(String(editandoAg.id)) ? [editandoAg.id] : null,
        });
      }
    }
    try {
      await supabase.from('auditoria_log').insert([{ salao_id: perfil.salao_id, usuario_id: perfil.id, tabela: 'agendamentos_cancelamento', operacao: 'CANCELAMENTO', registro_id: editandoAg.id, dados_antigos: { cliente_nome: editandoAg.cliente, profissional_id: editandoAg.id_prof, data_hora_inicio: `${editandoAg.data}T${editandoAg.inicio}:00`, servico: editandoAg.servico, status_anterior: editandoAg.status }, dados_novos: { status: payload.status, cancelado_por: payload.cancelado_por, motivo: payload.motivo_cancelamento, tipo: ehFaltou ? 'faltou' : 'cancelado' } }]);
    } catch(e) { console.warn('auditoria_log:', e); }

    // Distribuição do sinal entre os profissionais (apenas no-show com sinal confirmado)
    if (ehFaltou) {
      try {
        const { data: ag } = await supabase
          .from('agendamentos')
          .select('valor_sinal, sinal_pago, servico_id, profissional_id')
          .eq('id', editandoAg.id)
          .maybeSingle();

        const valorSinal = Number(ag?.valor_sinal) || 0;
        const sinalPago = ag?.sinal_pago === true;
        const servicoId = ag?.servico_id || editandoAg.servico_id;
        const profissionalId = ag?.profissional_id || editandoAg.id_prof;

        if (sinalPago && valorSinal > 0 && profissionalId) {
          // Busca % de comissão do profissional para este serviço
          const { data: prof } = await supabase
            .from('profissionais')
            .select('servicos_comissoes')
            .eq('id', profissionalId)
            .maybeSingle();

          const comissoes: Record<string, number> = prof?.servicos_comissoes || {};
          const percentual = servicoId ? (Number(comissoes[servicoId]) || 0) : 0;

          if (percentual > 0) {
            const valorComissao = Math.round(valorSinal * (percentual / 100) * 100) / 100;
            await supabase.from('comissoes').insert({
              salao_id: perfil.salao_id,
              profissional_id: profissionalId,
              id_prof: profissionalId,
              agendamento_id: editandoAg.id,
              status: 'Pendente',
              valor_servico: valorSinal,
              porcentagem_comissao: percentual,
              valor_comissao: valorComissao,
              tipo: 'no_show',
              servico_nome: `Retenção No-Show — ${editandoAg.servico || ''}`,
            });
          }
        }
      } catch (e) { console.warn('[no-show] Erro ao lançar comissão:', e); }
    }

    setModalCancelamentoAberto(false);
    carregarDadosParaAgenda();
  }

  async function salvarFichaCliente() {
    // Remove campos que não pertencem à tabela clientes antes do update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { obs_fixa, etiquetas, _crm_id, ...clienteParaSalvar } = formCliente;
    await supabase.from('clientes').update(clienteParaSalvar).eq('id', formCliente.id);
    if (formCliente.id) {
      await supabase.from('crm_clientes').update({
        etiquetas: formCliente.etiquetas || [],
        observacoes: formCliente.observacoes || null,
      }).eq('cliente_id', formCliente.id).eq('salao_id', perfil.salao_id);
      // Propaga o nome atualizado para todos os agendamentos existentes deste cliente
      if (formCliente.nome_completo) {
        await supabase.from('agendamentos')
          .update({ cliente_nome: formCliente.nome_completo })
          .eq('cliente_id', formCliente.id)
          .eq('salao_id', perfil.salao_id);
      }
    }
    setModalEdicaoCliente(false);
    carregarDadosParaAgenda();
  }

  return {
    // dados
    clientesDb, servicosDb, profissionaisDb, produtosDb, etiquetasDb, setEtiquetasDb,
    dadosSalao, agendamentos, setAgendamentos, carregando, carregarDadosParaAgenda,
    // layout
    tamanhoLinha, alterarTamanhoLinha, tamanhoColuna, alterarTamanhoColuna,
    mostrarFolgas, setMostrarFolgas, sidebarAberta, setSidebarAberta,
    redimensionando, gridScrollRef, ALTURA_HORA, ALTURA_MINUTO, LARGURA_COLUNA,
    HORA_INICIO, HORA_FIM, horasDoDia, horariosDoDia, diaSalaoFechado,
    iniciarRedimensionamento, aoMoverMouse, aoSoltarMouse,
    // datas
    mesStr, diaStr, dataHojeStr,
    // permissões
    isAdminOuRecepcao, todasFuncoes, profissionaisAgenda, profissionaisVisiveis,
    // filtros
    filtroFuncao, setFiltroFuncao,
    // modais
    modalNovoAberto, setModalNovoAberto,
    modalEdicaoAberto, setModalEdicaoAberto,
    modalClienteRapido, setModalClienteRapido,
    modalCancelamentoAberto, setModalCancelamentoAberto,
    modalEdicaoCliente, setModalEdicaoCliente,
    modalAusenciaAberto, setModalAusenciaAberto,
    agDetalhesFinalizado, setAgDetalhesFinalizado,
    modalCaixaAberto, setModalCaixaAberto,
    // formulários
    menuContexto, setMenuContexto,
    bloqueioEditandoId, setBloqueioEditandoId,
    dadosIniciaisModalNovo, setDadosIniciaisModalNovo,
    formAusencia, setFormAusencia,
    dadosCancelamento, setDadosCancelamento,
    mostrandoNovaEtiqueta, setMostrandoNovaEtiqueta,
    novaTag, setNovaTag,
    editandoAg, setEditandoAg,
    indexTelefoneZap, setIndexTelefoneZap,
    abaAtivaCrm, setAbaAtivaCrm,
    formCliente, setFormCliente,
    // caixa
    dadosCaixa, setDadosCaixa,
    abrirFechamentoDeCaixa, adicionarItemAvulsoCaixa, finalizarFechamentoConta,
    // funções
    lidarComCliqueDireito, registrarAlmocoRapido, abrirModalAusenciaPeloMenu,
    bloqueioParaDetalhes, setBloqueioParaDetalhes,
    abrirEdicaoBloqueio, abrirFormEdicaoBloqueio, excluirBloqueioRapido,
    alterarStatusRapido, iniciarCancelamentoPeloMenu,
    abrirEdicaoClientePeloMenu, fecharContaPeloMenu,
    salvarEdicaoAgendamento, salvarAusencia, excluirAusencia,
    handleAbrirWhatsApp, handleAbrirEmail,
    removerEtiqueta, adicionarEtiqueta, salvarNovaEtiqueta,
    confirmarCancelamento, salvarFichaCliente,
    somarMinutos, verificarAniversario,
  };
}
