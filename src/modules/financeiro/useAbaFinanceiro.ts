// src/modules/financeiro/useAbaFinanceiro.ts
// Hook central do módulo financeiro.
// Estado, fetch unificado (financeiro + despesas), cálculos e salvarTransacao.
'use client'
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { useTaxasConfig } from '@/lib/useTaxasConfig';
import { FormTransacao, formVazioFactory, sugerirTipoCusto } from './tipos';

export function useAbaFinanceiro(perfil: any) {
  const toast = useToast();
  const { obterTaxa } = useTaxasConfig(perfil);

  const hoje = new Date();
  const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDiaDoMes  = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
  const diaDeHoje       = hoje.toISOString().split('T')[0];

  const [transacoes, setTransacoes]         = useState<any[]>([]);
  const [comissoes, setComissoes]           = useState<any[]>([]);
  const [profissionais, setProfissionais]   = useState<any[]>([]);
  const [fornecedores, setFornecedores]     = useState<any[]>([]);
  const [carregando, setCarregando]         = useState(true);
  const [dataInicio, setDataInicio]         = useState(primeiroDiaDoMes);
  const [dataFim, setDataFim]               = useState(ultimoDiaDoMes);
  const [form, setForm]                     = useState<FormTransacao>(() => formVazioFactory(diaDeHoje));
  const [modalNovaTransacao, setModalNovaTransacao] = useState(false);
  const [transacaoSelecionada, setTransacaoSelecionada] = useState<any>(null);
  const [expandirReceitas, setExpandirReceitas] = useState(false);
  const [expandirDespesas, setExpandirDespesas] = useState(false);
  const [modalDespesaAberto, setModalDespesaAberto] = useState(false);

  // ── Fetch principal ────────────────────────────────────────────────────────
  async function carregarFinanceiro() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const inicioUTC = `${dataInicio}T00:00:00Z`;
    const fimUTC    = `${dataFim}T23:59:59Z`;

    try {
      // Despesas: busca por vencimento E por pagamento, depois deduplica por ID
      // para não perder despesas cujo pagamento caiu em mês diferente do vencimento.
      const [resFin, resDespVenc, resDespPago, resCom, resProf, resForn] = await Promise.all([
        supabase.from('financeiro').select('*').eq('salao_id', perfil.salao_id).gte('data_movimentacao', inicioUTC).lte('data_movimentacao', fimUTC),
        supabase.from('despesas').select('id, descricao, categoria, tipo_custo, valor, data_pagamento, data_vencimento, status, forma_pagamento, observacao').eq('salao_id', perfil.salao_id).gte('data_vencimento', dataInicio).lte('data_vencimento', dataFim),
        supabase.from('despesas').select('id, descricao, categoria, tipo_custo, valor, data_pagamento, data_vencimento, status, forma_pagamento, observacao').eq('salao_id', perfil.salao_id).gte('data_pagamento', dataInicio).lte('data_pagamento', dataFim),
        supabase.from('comissoes').select('*').eq('salao_id', perfil.salao_id).order('data_criacao', { ascending: false }),
        supabase.from('profissionais').select('id, nome, ativo').eq('salao_id', perfil.salao_id).order('nome'),
        supabase.from('fornecedores').select('id, nome_empresa').eq('salao_id', perfil.salao_id),
      ]);

      // Deduplica despesas por ID
      const despesasMap = new Map<string, any>();
      [...(resDespVenc.data || []), ...(resDespPago.data || [])].forEach(d => despesasMap.set(d.id, d));

      let listaUnificada: any[] = [];
      if (resFin.data) listaUnificada = [...resFin.data.map((r: any) => ({ ...r, _tabela: 'financeiro' }))];

      if (despesasMap.size > 0) {
        const despesasFormatadas = Array.from(despesasMap.values()).map(d => ({
          id: d.id,
          _tabela: 'despesas',
          tipo: 'saida',
          descricao: d.descricao,
          categoria: d.categoria,
          tipo_custo: d.tipo_custo || null,
          valor: d.valor,
          data_movimentacao: d.data_pagamento || d.data_vencimento,
          data_vencimento: d.data_vencimento,
          status: d.status,
          forma_pagamento: d.forma_pagamento || 'Não informada',
          observacao: d.observacao || null,
        }));
        listaUnificada = [...listaUnificada, ...despesasFormatadas];
      }

      listaUnificada.sort((a, b) =>
        new Date(b.data_movimentacao).getTime() - new Date(a.data_movimentacao).getTime()
      );

      setTransacoes(listaUnificada);
      if (resCom.data) setComissoes(resCom.data);
      if (resProf.data) setProfissionais([...resProf.data].sort((a, b) => (a.ativo === b.ativo ? 0 : a.ativo ? -1 : 1)));
      if (resForn.data) setFornecedores(resForn.data);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Erro ao carregar financeiro:', err);
    }

    setCarregando(false);
  }

  useEffect(() => { carregarFinanceiro(); }, [perfil, dataInicio, dataFim]);

  // ── Cálculos derivados ─────────────────────────────────────────────────────
  const entradas = transacoes.filter(t => t.tipo === 'entrada' && t.status !== 'Pendente' && t.status !== 'Estornado');
  const saidas   = transacoes.filter(t => t.tipo === 'saida'   && t.status !== 'Estornado');

  const totalEntradas = entradas.reduce((acc, curr) => acc + Number(curr.valor), 0);
  const totalSaidas   = saidas.reduce((acc, curr) => acc + Number(curr.valor), 0);
  const saldo         = totalEntradas - totalSaidas;

  const despesasPorCategoria = saidas.reduce((acc: any, t) => {
    acc[t.categoria] = (acc[t.categoria] || 0) + Number(t.valor);
    return acc;
  }, {});

  const totalSaidasPagas    = saidas.filter(t => t.status !== 'Pendente').reduce((a, c) => a + Number(c.valor), 0);
  const totalSaidasPendentes = saidas.filter(t => t.status === 'Pendente').reduce((a, c) => a + Number(c.valor), 0);

  const totaisPix      = entradas.filter(t => t.forma_pagamento === 'PIX' || t.descricao?.includes('PIX')).reduce((a, c) => a + Number(c.valor), 0);
  const totaisCartao   = entradas.filter(t => t.forma_pagamento?.includes('Cartão') || t.descricao?.includes('Cartão')).reduce((a, c) => a + Number(c.valor), 0);
  const totaisDinheiro = entradas.filter(t => t.forma_pagamento === 'DINHEIRO' || t.descricao?.includes('Dinheiro') || t.forma_pagamento === 'Dinheiro').reduce((a, c) => a + Number(c.valor), 0);

  // ── Conciliação ────────────────────────────────────────────────────────────
  const dadosConciliacao = useMemo(() => {
    const grupos: Record<string, any> = {};
    entradas.forEach(item => {
      const valorBruto        = parseFloat(item.valor) || 0;
      const taxaOperadoraPerc = obterTaxa(item.forma_pagamento, item.bandeira_cartao || null);
      const taxaAntecipacao   = parseFloat(item.taxa_antecipacao) || 0;
      const taxaOpeReais      = valorBruto * (taxaOperadoraPerc / 100);
      const valorLiquido      = valorBruto - taxaOpeReais - taxaAntecipacao;

      let tipoPagamento = (item.forma_pagamento || item.categoria || 'DINHEIRO').toUpperCase();
      if (tipoPagamento.includes('CREDITO') || tipoPagamento.includes('CRÉDITO')) tipoPagamento = 'CREDITO';
      else if (tipoPagamento.includes('DEBITO') || tipoPagamento.includes('DÉBITO')) tipoPagamento = 'DEBITO';
      else if (tipoPagamento.includes('PIX')) tipoPagamento = 'PIX';
      else tipoPagamento = 'DINHEIRO';

      let statusConciliacao = 'Pendente';
      if (item.status === 'Pago' || item.status === 'Recebido' || item.status === 'Conciliado') statusConciliacao = 'Conciliado';

      if (!grupos[tipoPagamento]) {
        grupos[tipoPagamento] = { tipo: tipoPagamento, valorBruto: 0, descontoOperadora: 0, descontoAntecipacao: 0, valorLiquido: 0, bandeiras: {} };
      }
      grupos[tipoPagamento].valorBruto          += valorBruto;
      grupos[tipoPagamento].descontoOperadora    += taxaOpeReais;
      grupos[tipoPagamento].descontoAntecipacao  += taxaAntecipacao;
      grupos[tipoPagamento].valorLiquido         += valorLiquido;

      const band = item.bandeira_cartao || 'Geral';
      if (!grupos[tipoPagamento].bandeiras[band]) {
        grupos[tipoPagamento].bandeiras[band] = { bandeira: band, valorBruto: 0, descontoOperadora: 0, descontoAntecipacao: 0, valorLiquido: 0, transacoes: [] };
      }
      grupos[tipoPagamento].bandeiras[band].valorBruto         += valorBruto;
      grupos[tipoPagamento].bandeiras[band].descontoOperadora  += taxaOpeReais;
      grupos[tipoPagamento].bandeiras[band].descontoAntecipacao += taxaAntecipacao;
      grupos[tipoPagamento].bandeiras[band].valorLiquido       += valorLiquido;
      grupos[tipoPagamento].bandeiras[band].transacoes.push({
        id: item.id, data: item.data_movimentacao || item.created_at,
        cliente: item.descricao || 'Entrada', parcela: item.parcelas || '1/1',
        valorBruto, taxaOperadoraPerc, taxaAntecipacao, taxaOpeReais, valorLiquido, statusConciliacao,
      });
    });
    return grupos;
  }, [entradas, obterTaxa]);

  // ── Salvar transação avulsa ────────────────────────────────────────────────
  async function salvarTransacao(e: any) {
    e.preventDefault();
    if (!form.descricao || !form.valor || !form.data_movimentacao) { toast.aviso('Preencha os campos obrigatórios.'); return; }

    const valorNum = parseFloat(form.valor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) { toast.aviso('Valor inválido.'); return; }

    // tipo_custo obrigatório para saídas
    if (form.tipo === 'saida' && !form.tipo_custo) {
      toast.aviso('Selecione se essa despesa é Fixa ou Variável.');
      return;
    }

    // relacao_id obrigatório se tipo escolhido mas sem ID
    // ('' seria enviado como UUID inválido ao Postgres — sempre null se não selecionado)
    if (form.relacao_tipo !== 'Nenhuma' && !form.relacao_id) {
      toast.aviso(`Selecione ${form.relacao_tipo === 'Profissional' ? 'o profissional' : 'o fornecedor'} relacionado, ou volte "Relação do Lançamento" para "Sem relação definida".`);
      return;
    }

    const dados: any = {
      salao_id: perfil.salao_id,
      tipo: form.tipo,
      descricao: form.descricao,
      categoria: form.categoria,
      tipo_custo: form.tipo === 'saida' ? form.tipo_custo : null,
      valor: valorNum,
      data_movimentacao: new Date(form.data_movimentacao + 'T12:00:00Z').toISOString(),
      status: form.status,
      forma_pagamento: form.forma_pagamento,
      relacao_id: (form.relacao_tipo !== 'Nenhuma' && form.relacao_id) ? form.relacao_id : null,
    };

    if (form.relacao_tipo === 'Profissional') {
      const p = profissionais.find(x => x.id === form.relacao_id);
      if (p) dados.descricao = `${dados.descricao} - ${p.nome}`;
    } else if (form.relacao_tipo === 'Fornecedor') {
      const f = fornecedores.find(x => x.id === form.relacao_id);
      if (f) dados.descricao = `${dados.descricao} - ${f.nome_empresa}`;
    }

    const { error } = await supabase.from('financeiro').insert([dados]);
    if (!error) {
      setModalNovaTransacao(false);
      setForm(formVazioFactory(diaDeHoje));
      carregarFinanceiro();
    } else {
      toast.erro('Erro: ' + error.message);
    }
  }

  return {
    carregando, diaDeHoje,
    transacoes, comissoes, profissionais, fornecedores,
    dataInicio, setDataInicio, dataFim, setDataFim,
    // derivados
    entradas, saidas, totalEntradas, totalSaidas, saldo,
    despesasPorCategoria, totalSaidasPagas, totalSaidasPendentes,
    totaisPix, totaisCartao, totaisDinheiro,
    dadosConciliacao,
    // ui
    form, setForm,
    modalNovaTransacao, setModalNovaTransacao,
    transacaoSelecionada, setTransacaoSelecionada,
    expandirReceitas, setExpandirReceitas,
    expandirDespesas, setExpandirDespesas,
    modalDespesaAberto, setModalDespesaAberto,
    carregarFinanceiro, salvarTransacao,
    sugerirTipoCusto,
  };
}
