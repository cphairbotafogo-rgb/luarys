// src/modules/caixa/useAbaCaixa.ts
// Hook central do módulo Frente de Caixa.
// Concentra: estado global, fetches, cálculo de totais e todos os handlers
// de lançamento, edição, autorização, correção e estorno.
'use client'
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { temPermissao } from "@/lib/permissoes";
import {
  BANDEIRAS, FiltroPeriodo, ModoCaixa, FormLancar,
  Transacao, AgEmAberto, normalizarFinanceiro, formaParaFinanceiro,
} from "./tipos";
import { lancarOS } from "./acoes/lancarOS";
import { estornarOS } from "./acoes/estornarOS";

const FORM_INICIAL: FormLancar = { cliente: '', valor: '', forma: 'Pix', bandeira: '' };

export function useAbaCaixa(perfil: any) {
  const toast = useToast();

  // ── Dados principais ───────────────────────────────────────────────────────
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [agEmAberto, setAgEmAberto] = useState<AgEmAberto[]>([]);
  const [profissionaisLista, setProfissionaisLista] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // ── Filtros ────────────────────────────────────────────────────────────────
  const hoje = new Date();
  const offMs = hoje.getTimezoneOffset() * 60000;
  const hojeStr = new Date(hoje.getTime() - offMs).toISOString().split('T')[0];

  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('hoje');
  const [dataIni, setDataIni] = useState(hojeStr);
  const [dataFim, setDataFim] = useState(hojeStr);
  const [filtroProfissional, setFiltroProfissional] = useState<string>('todos');
  const [filtroOS, setFiltroOS] = useState('');

  // Refs para o intervalo não capturar closure antigo
  const dataIniRef = useRef(hojeStr);
  const dataFimRef = useRef(hojeStr);
  useEffect(() => { dataIniRef.current = dataIni; }, [dataIni]);
  useEffect(() => { dataFimRef.current = dataFim; }, [dataFim]);

  // ── Estado de UI dos modais ────────────────────────────────────────────────
  const [mostrarAbertos, setMostrarAbertos] = useState(true);
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({});
  const [modalLancamento, setModalLancamento] = useState(false);
  const [modalEdicao, setModalEdicao] = useState<Transacao | null>(null);
  const [modalAutorizacao, setModalAutorizacao] = useState<Transacao | null>(null);

  // ── Estado do modal de edição ──────────────────────────────────────────────
  const [modoCaixa, setModoCaixa] = useState<ModoCaixa>('opcoes');
  const [novaDataCaixa, setNovaDataCaixa] = useState('');
  const [pinCaixaAcao, setPinCaixaAcao] = useState('');
  const [motivoEstornoCaixa, setMotivoEstornoCaixa] = useState('');
  const [novaFormaPagamento, setNovaFormaPagamento] = useState('');
  const [senhaGerente, setSenhaGerente] = useState('');
  const [formLancar, setFormLancar] = useState<FormLancar>(FORM_INICIAL);

  const pAcesso = perfil?.permissoes?.perfil_acesso || '';
  const isGerenteOuDono = perfil?.isDono || temPermissao(perfil, 'caixa.alterar_preco') || ['Administrador', 'Gerente'].includes(pAcesso);

  // ── Fetch principal ────────────────────────────────────────────────────────
  async function carregarCaixaDiario(ini?: string, fim?: string) {
    if (!perfil?.salao_id) return;
    setCarregando(true);

    const agora = new Date();
    const offsetMs = agora.getTimezoneOffset() * 60000;
    const hojeLocal = new Date(agora.getTime() - offsetMs).toISOString().split('T')[0];
    const dIni = ini || dataIni || hojeLocal;
    const dFim = fim || dataFim || hojeLocal;

    // Converte datas locais para UTC antes de comparar — sem isso, serviços
    // fechados após 21h (Brasil UTC-3) aparecem no dia seguinte.
    const iniDate = new Date(`${dIni}T00:00:00`);
    const fimDate = new Date(`${dFim}T23:59:59`);
    // Guarda contra data inválida (ex.: meio da digitação) — .toISOString() estouraria.
    if (isNaN(iniDate.getTime()) || isNaN(fimDate.getTime())) { setCarregando(false); return; }
    const iniUTC = iniDate.toISOString();
    const fimUTC = fimDate.toISOString();

    const [resCaixa, resFinanceiro, resAbertos, resServicos, resProfissionais] = await Promise.all([
      supabase.from('caixa_transacoes').select('*')
        .eq('salao_id', perfil.salao_id)
        .gte('data_hora', iniUTC).lte('data_hora', fimUTC)
        .neq('status', 'Estornado').order('data_hora', { ascending: false }),
      supabase.from('financeiro').select('*')
        .eq('salao_id', perfil.salao_id).eq('tipo', 'entrada')
        .in('categoria', ['Serviços Prestados', 'Receita de Serviços', 'Venda de Produtos'])
        .gte('data_movimentacao', iniUTC).lte('data_movimentacao', fimUTC)
        .neq('status', 'Estornado').order('data_movimentacao', { ascending: false }),
      supabase.from('agendamentos')
        .select('id, inicio, data, status, cliente_nome, servico_id, profissional_id')
        .eq('salao_id', perfil.salao_id)
        .gte('data', dIni).lte('data', dFim)
        .in('status', ['Agendado', 'Confirmado', 'Aguardando', 'Em Atendimento', 'Finalizado'])
        .order('data', { ascending: true }).order('inicio', { ascending: true }),
      supabase.from('servicos').select('id, nome_servico').eq('salao_id', perfil.salao_id),
      supabase.from('profissionais').select('id, nome').eq('salao_id', perfil.salao_id),
    ]);

    const mapaServicos = new Map<string, string>();
    (resServicos.data || []).forEach((s: any) => mapaServicos.set(s.id, s.nome_servico));
    const mapaProfissionais = new Map<string, string>();
    (resProfissionais.data || []).forEach((p: any) => mapaProfissionais.set(p.id, p.nome));

    const agsEnriquecidos = (resAbertos.data || []).map((ag: any) => ({
      ...ag,
      _nome_servico: mapaServicos.get(ag.servico_id) || '—',
      _nome_profissional: mapaProfissionais.get(ag.profissional_id) || '—',
    }));

    const caixaData = resCaixa.data || [];
    const finData   = resFinanceiro.error ? [] : (resFinanceiro.data || []);

    let todasTransacoes: Transacao[];
    if (caixaData.length > 0) {
      const caixaChaves = new Set(caixaData.map((t: any) => `${t.cliente_nome}|${new Date(t.data_hora).toISOString().slice(0, 16)}`));
      const finNorm = finData
        .filter((f: any) => !caixaChaves.has(`${f.cliente_nome}|${new Date(f.data_movimentacao).toISOString().slice(0, 16)}`))
        .map(normalizarFinanceiro);
      todasTransacoes = [...caixaData, ...finNorm];
    } else {
      todasTransacoes = finData.map(normalizarFinanceiro);
    }

    todasTransacoes.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime());
    setTransacoes(todasTransacoes);
    setAgEmAberto(agsEnriquecidos);
    setProfissionaisLista(resProfissionais.data || []);
    setCarregando(false);
  }

  // Só busca quando as DUAS datas estão completas e plausíveis (ano >= 2020), com
  // debounce — evita uma busca a cada tecla enquanto o usuário digita a data (o
  // navegador emite anos intermediários tipo "0002" no meio da digitação).
  useEffect(() => {
    if (!perfil?.salao_id) return;
    const valida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00`).getFullYear() >= 2020;
    if (!valida(dataIni) || !valida(dataFim)) return;
    const t = setTimeout(() => carregarCaixaDiario(dataIni, dataFim), 350);
    return () => clearTimeout(t);
  }, [perfil, dataIni, dataFim]);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    const intervalo = setInterval(() => carregarCaixaDiario(dataIniRef.current, dataFimRef.current), 60000);
    return () => clearInterval(intervalo);
  }, [perfil?.salao_id]);

  // ── Filtros de período ─────────────────────────────────────────────────────
  function calcularPeriodo(tipo: FiltroPeriodo) {
    setFiltroPeriodo(tipo);
    const agora = new Date();
    const off = agora.getTimezoneOffset() * 60000;
    const hj = new Date(agora.getTime() - off).toISOString().split('T')[0];
    if (tipo === 'hoje') { setDataIni(hj); setDataFim(hj); }
    else if (tipo === 'semana') {
      const dom = new Date(agora.getTime() - off);
      dom.setDate(dom.getDate() - dom.getDay());
      setDataIni(dom.toISOString().split('T')[0]); setDataFim(hj);
    } else if (tipo === 'mes') {
      setDataIni(hj.slice(0, 7) + '-01'); setDataFim(hj);
    }
  }

  // ── Lançar atendimento ─────────────────────────────────────────────────────
  async function lancarAtendimento(e: any) {
    e.preventDefault();
    if (formLancar.forma.includes('Cartão') && !formLancar.bandeira) {
      toast.aviso('Selecione a bandeira do cartão antes de continuar.'); return;
    }
    const result = await lancarOS({ salaoId: perfil.salao_id, formLancar, operadorNome: perfil?.nome });
    if (!result.ok) { toast.erro(result.erro || 'Erro ao lançar.'); return; }
    setModalLancamento(false);
    setFormLancar(FORM_INICIAL);
    carregarCaixaDiario();
  }

  // ── Modal de edição ────────────────────────────────────────────────────────
  function tentarEditar(transacao: Transacao) {
    if (isGerenteOuDono) abrirModalEdicao(transacao);
    else setModalAutorizacao(transacao);
  }

  async function autorizarEdicao(e: any) {
    e.preventDefault();
    const { data, error } = await supabase.from('saloes').select('pin_gerente').eq('id', perfil.salao_id).maybeSingle();
    if (error || !data) { toast.erro('Erro ao validar PIN. Tente novamente.'); return; }
    if (!data.pin_gerente) { toast.erro('PIN de gerente não configurado. Acesse Configurações → Segurança para definir um PIN.'); return; }
    if (senhaGerente === data.pin_gerente) {
      abrirModalEdicao(modalAutorizacao!);
      setModalAutorizacao(null); setSenhaGerente('');
    } else { toast.erro('PIN incorreto.'); }
  }

  function abrirModalEdicao(transacao: Transacao) {
    setNovaFormaPagamento(transacao.forma_pagamento || '');
    setNovaDataCaixa((transacao.data_hora || '').split('T')[0] || '');
    setPinCaixaAcao(''); setMotivoEstornoCaixa(''); setModoCaixa('opcoes');
    setModalEdicao(transacao);
  }

  function fecharModalEdicao() { setModalEdicao(null); setPinCaixaAcao(''); setMotivoEstornoCaixa(''); }

  async function verificarPin(pin: string): Promise<boolean> {
    const { data: sl, error } = await supabase.from('saloes').select('pin_gerente').eq('id', perfil.salao_id).maybeSingle();
    if (error || !sl) { toast.erro('Erro ao validar PIN. Tente novamente.'); return false; }
    if (!sl.pin_gerente) { toast.erro('PIN de gerente não configurado. Acesse Configurações → Segurança.'); return false; }
    if (pin !== sl.pin_gerente) { toast.erro('PIN incorreto.'); return false; }
    return true;
  }

  async function salvarCorrecaoPagamento(e: any) {
    e.preventDefault();
    if (!modalEdicao) return;
    const isFinanceiro = modalEdicao._origem === 'financeiro';
    const realId = isFinanceiro ? String(modalEdicao.id).replace('fin-', '') : modalEdicao.id;
    const tabela = isFinanceiro ? 'financeiro' : 'caixa_transacoes';
    const campo  = isFinanceiro ? 'metodo_pagamento' : 'forma_pagamento';
    const { error } = await supabase.from(tabela).update({ [campo]: novaFormaPagamento, forma_pagamento: novaFormaPagamento }).eq('id', realId);
    if (error) { toast.erro('Erro ao corrigir: ' + error.message); return; }
    toast.sucesso('Forma de pagamento corrigida!');
    fecharModalEdicao(); carregarCaixaDiario();
  }

  async function salvarCorrecaoData() {
    if (!novaDataCaixa) { toast.aviso('Informe a nova data.'); return; }
    if (novaDataCaixa > hojeStr) { toast.aviso('Não é permitido alterar para uma data futura.'); return; }
    if (!await verificarPin(pinCaixaAcao)) return;
    if (!modalEdicao) return;
    const isFinanceiro = modalEdicao._origem === 'financeiro';
    const realId = isFinanceiro ? String(modalEdicao.id).replace('fin-', '') : modalEdicao.id;
    if (isFinanceiro) {
      const novaDataISO = new Date(novaDataCaixa + 'T12:00:00Z').toISOString();
      const { error } = await supabase.from('financeiro').update({ data_movimentacao: novaDataISO }).eq('id', realId);
      if (error) { toast.erro('Erro: ' + error.message); return; }
      // sincroniza o espelho em caixa_transacoes para evitar duplicidade visual
      if (modalEdicao.os_numero && perfil?.salao_id) {
        await supabase.from('caixa_transacoes').update({ data_hora: novaDataISO }).eq('salao_id', perfil.salao_id).eq('os_numero', modalEdicao.os_numero);
      }
    } else {
      const hora = (modalEdicao.data_hora || '').split('T')[1] || '12:00:00';
      const { error } = await supabase.from('caixa_transacoes').update({ data_hora: new Date(`${novaDataCaixa}T${hora}`).toISOString() }).eq('id', realId);
      if (error) { toast.erro('Erro: ' + error.message); return; }
    }
    toast.sucesso('Data corrigida para ' + new Date(novaDataCaixa + 'T12:00:00').toLocaleDateString('pt-BR') + '!');
    fecharModalEdicao(); carregarCaixaDiario();
  }

  async function executarEstornoCaixa() {
    if (!modalEdicao) return;
    const result = await estornarOS({
      salaoId: perfil.salao_id,
      transacao: modalEdicao,
      pin: pinCaixaAcao,
      motivo: motivoEstornoCaixa,
      autorizador: perfil?.nome || 'Gerente',
    });
    if (!result.ok) { toast.erro(result.erro || 'Erro ao estornar.'); return; }
    toast.sucesso('Estorno realizado com sucesso! Agendamentos revertidos para Confirmado.');
    fecharModalEdicao(); carregarCaixaDiario();
  }

  // ── Totais calculados ──────────────────────────────────────────────────────
  const fp = (t: Transacao) => (t.forma_pagamento || '').toLowerCase();

  const profSelecionado = filtroProfissional === 'todos'
    ? null
    : profissionaisLista.find((p: any) => p.id === filtroProfissional) || null;

  const agEmAbertoFiltrados = profSelecionado
    ? agEmAberto.filter((ag: any) => ag.profissional_id === filtroProfissional)
    : agEmAberto;

  const transacoesPeriodo = profSelecionado
    ? transacoes.filter(t => {
        const nomeT = (t.profissional_nome || '').toLowerCase();
        if (!nomeT) return true;
        return nomeT.includes(profSelecionado.nome.toLowerCase());
      })
    : transacoes;

  const transacoesFiltradas = filtroOS.trim()
    ? (() => {
        const termo = filtroOS.trim().toLowerCase();
        return transacoesPeriodo.filter(t =>
          (t.os_numero || '').toLowerCase().includes(termo) ||
          (t.cliente_nome || '').toLowerCase().includes(termo)
        );
      })()
    : transacoesPeriodo;

  const totalGeral      = transacoesPeriodo.reduce((acc, t) => acc + Number(t.valor_total), 0);
  const totalPix        = transacoesPeriodo.filter(t => fp(t).includes('pix')).reduce((a, t) => a + Number(t.valor_total), 0);
  const totalCartaoCred = transacoesPeriodo.filter(t => fp(t).includes('créd') || fp(t).includes('cred')).reduce((a, t) => a + Number(t.valor_total), 0);
  const totalCartaoDeb  = transacoesPeriodo.filter(t => fp(t).includes('déb') || fp(t).includes('deb')).reduce((a, t) => a + Number(t.valor_total), 0);
  const totalDinheiro   = transacoesPeriodo.filter(t => fp(t).includes('din')).reduce((a, t) => a + Number(t.valor_total), 0);

  const tituloResumo = filtroPeriodo === 'hoje'   ? 'Resumo do Turno'
    : filtroPeriodo === 'semana' ? 'Resumo da Semana'
    : filtroPeriodo === 'mes'    ? 'Resumo do Mês'
    : `${dataIni.split('-').reverse().join('/')} – ${dataFim.split('-').reverse().join('/')}`;

  return {
    transacoes, transacoesFiltradas, agEmAberto, agEmAbertoFiltrados, profissionaisLista, carregando,
    filtroPeriodo, dataIni, setDataIni, dataFim, setDataFim,
    filtroProfissional, setFiltroProfissional, calcularPeriodo,
    filtroOS, setFiltroOS,
    totalGeral, totalPix, totalCartaoCred, totalCartaoDeb, totalDinheiro,
    tituloResumo,
    mostrarAbertos, setMostrarAbertos, gruposExpandidos,
    toggleGrupo: (cliente: string) => setGruposExpandidos(prev => ({ ...prev, [cliente]: !prev[cliente] })),
    modalLancamento, setModalLancamento, formLancar, setFormLancar, lancarAtendimento,
    modalEdicao, modalAutorizacao, setModalAutorizacao,
    modoCaixa, setModoCaixa,
    novaDataCaixa, setNovaDataCaixa,
    pinCaixaAcao, setPinCaixaAcao,
    motivoEstornoCaixa, setMotivoEstornoCaixa,
    novaFormaPagamento, setNovaFormaPagamento,
    senhaGerente, setSenhaGerente,
    isGerenteOuDono,
    tentarEditar, autorizarEdicao, fecharModalEdicao,
    salvarCorrecaoPagamento, salvarCorrecaoData, executarEstornoCaixa,
    // Refresh manual (ex.: após salvar uma despesa) — recarrega o período atual.
    recarregar: () => carregarCaixaDiario(dataIni, dataFim),
  };
}
