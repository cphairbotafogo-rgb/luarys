// src/modules/relatorios/gavetas/comissoes/useGavetaComissoes.ts
// Hook central da GavetaComissoes.
// Concentra: estado, fetches, lógica de acerto, recálculo e ajustes (extras).
'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { FormExtra, TipoImpressao } from "./tipos";

const FORM_EXTRA_INICIAL: FormExtra = { profissional_id: '', tipo: 'recebivel', descricao: '', valor: '' };

export function useGavetaComissoes(perfil: any) {
  const toast = useToast();
  const [carregando, setCarregando] = useState(false);

  // ── Filtros ────────────────────────────────────────────────────────────────
  const hoje          = new Date().toISOString().split('T')[0];
  const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [dataInicio, setDataInicio]       = useState(primeiroDiaMes);
  const [dataFim, setDataFim]             = useState(hoje);
  const [profissionalFiltro, setProfissionalFiltro] = useState<string>('TODOS');
  const [tipoVendaFiltro, setTipoVendaFiltro]       = useState<string>('TODOS');
  const [statusPagamentoFiltro, setStatusPagamentoFiltro] = useState<string>('TODOS');
  const [exibirEstornos, setExibirEstornos] = useState(false);

  // ── Dados ──────────────────────────────────────────────────────────────────
  const [profissionais, setProfissionais]           = useState<any[]>([]);
  const [comissoes, setComissoes]                   = useState<any[]>([]);
  const [bloqueiosCapacidade, setBloqueiosCapacidade] = useState<any[]>([]);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [visao, setVisao] = useState<'detalhada' | 'consolidada'>('detalhada');
  const [comissoesSelecionadas, setComissoesSelecionadas] = useState<string[]>([]);
  const [processandoPagamento, setProcessandoPagamento]   = useState(false);
  const [formaPagamentoAcerto, setFormaPagamentoAcerto]   = useState('Dinheiro');

  // ── Modal impressão ────────────────────────────────────────────────────────
  const [modalImpressao, setModalImpressao] = useState(false);
  const [tipoImpressao, setTipoImpressao]   = useState<TipoImpressao | null>(null);

  // ── Modal recálculo ────────────────────────────────────────────────────────
  const [modalRecalculo, setModalRecalculo]               = useState(false);
  const [dataRecalculo, setDataRecalculo]                 = useState(primeiroDiaMes);
  const [profissionaisRecalculo, setProfissionaisRecalculo] = useState<string[]>([]);
  const [processandoRecalculo, setProcessandoRecalculo]   = useState(false);

  // ── Modal ajuste (extras) ──────────────────────────────────────────────────
  const [extras, setExtras]         = useState<any[]>([]);
  const [modalExtra, setModalExtra] = useState(false);
  const [formExtra, setFormExtra]   = useState<FormExtra>(FORM_EXTRA_INICIAL);
  const [salvandoExtra, setSalvandoExtra] = useState(false);

  // ── Carregar profissionais ─────────────────────────────────────────────────
  useEffect(() => {
    async function carregarProfs() {
      if (!perfil?.salao_id) return;
      const { data, error } = await supabase
        .from('profissionais').select('id, nome, ativo, perfil_avancado')
        .eq('salao_id', perfil.salao_id).order('nome');
      if (error && process.env.NODE_ENV === 'development') console.error('Erro ao carregar profissionais:', error);
      if (data) setProfissionais([...data].sort((a, b) => (a.ativo === b.ativo ? 0 : a.ativo ? -1 : 1)));
    }
    carregarProfs();
  }, [perfil]);

  // ── Extras: carregar / salvar / deletar ───────────────────────────────────
  async function carregarExtras() {
    if (!perfil?.salao_id) return;
    const { data } = await supabase
      .from('comissao_extras')
      .select('*, profissionais(id, nome)')
      .eq('salao_id', perfil.salao_id)
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)
      .order('created_at', { ascending: false });
    setExtras(data || []);
  }

  useEffect(() => { carregarExtras(); }, [perfil?.salao_id, dataInicio, dataFim]);

  async function salvarExtra() {
    if (!formExtra.profissional_id || !formExtra.descricao || !formExtra.valor) {
      toast.aviso('Preencha todos os campos do ajuste.');
      return;
    }
    setSalvandoExtra(true);
    const { error } = await supabase.from('comissao_extras').insert([{
      salao_id: perfil.salao_id,
      profissional_id: formExtra.profissional_id,
      tipo: formExtra.tipo,
      descricao: formExtra.descricao,
      valor: parseFloat(formExtra.valor),
    }]);
    if (error) { toast.erro('Erro ao salvar ajuste: ' + error.message); setSalvandoExtra(false); return; }
    toast.sucesso('Ajuste lançado com sucesso!');
    setModalExtra(false);
    setFormExtra(FORM_EXTRA_INICIAL);
    setSalvandoExtra(false);
    carregarExtras();
  }

  async function deletarExtra(id: string) {
    if (!await confirmarAcaoGlobal({ titulo: 'Remover este ajuste?', perigoso: true })) return;
    const { error } = await supabase.from('comissao_extras').delete().eq('id', id);
    if (error) { toast.erro('Erro ao remover: ' + error.message); return; }
    toast.sucesso('Ajuste removido.');
    carregarExtras();
  }

  // ── Gerar relatório de comissões ───────────────────────────────────────────
  async function gerarRelatorioComissoes() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    setComissoesSelecionadas([]);

    try {
      let query = supabase
        .from('comissoes')
        .select(`
          id, created_at, data_evento, status, valor_servico, valor_comissao, porcentagem_comissao, tipo,
          profissional_id, agendamento_id,
          profissionais!profissional_id (id, nome)
        `)
        .eq('salao_id', perfil.salao_id)
        // Competência = data do serviço (data_evento), não o dia do fechamento.
        .gte('data_evento', dataInicio)
        .lte('data_evento', dataFim)
        .order('data_evento', { ascending: false });

      if (!exibirEstornos) query = query.neq('status', 'Cancelado').neq('status', 'Estornado');
      if (profissionalFiltro !== 'TODOS') query = query.eq('profissional_id', profissionalFiltro);

      const { data: comissoesRaw, error } = await query;
      if (error) throw error;

      const comissoesBase = comissoesRaw || [];

      // join manual: agendamentos → serviços
      const idsAgendamentos = [...new Set(comissoesBase.map((c: any) => c.agendamento_id).filter(Boolean))];
      let agendamentosMap: Record<string, any> = {};

      if (idsAgendamentos.length > 0) {
        const { data: agsData } = await supabase
          .from('agendamentos').select('id, data, cliente_nome, servico_id').in('id', idsAgendamentos);

        const idsServicos = [...new Set((agsData || []).map((a: any) => a.servico_id).filter(Boolean))];
        let servicosMap: Record<string, any> = {};
        if (idsServicos.length > 0) {
          const { data: servsData } = await supabase
            .from('servicos').select('id, nome_servico, preco_padrao').in('id', idsServicos);
          (servsData || []).forEach((s: any) => { servicosMap[s.id] = s; });
        }
        (agsData || []).forEach((ag: any) => {
          agendamentosMap[ag.id] = { ...ag, servicos: servicosMap[ag.servico_id] || null };
        });
      }

      let data = comissoesBase.map((c: any) => ({ ...c, agendamentos: agendamentosMap[c.agendamento_id] || null }));

      if (statusPagamentoFiltro !== 'TODOS') {
        data = data.filter(item => {
          if (statusPagamentoFiltro === 'LANCADOS')     return item.status === 'Pago';
          if (statusPagamentoFiltro === 'NAO_LANCADOS') return item.status === 'Pendente';
          return true;
        });
      }

      if (tipoVendaFiltro !== 'TODOS') {
        data = data.filter(item => {
          if (tipoVendaFiltro === 'SERVICOS') return true;
          if (tipoVendaFiltro === 'PRODUTOS') return false;
          if (tipoVendaFiltro === 'PACOTES')  return false;
          return true;
        });
      }

      setComissoes(data);

      // busca separada para capacidade (bloqueios + finalizados)
      const { data: agsCapacidade } = await supabase
        .from('agendamentos')
        .select('id, profissional_id, data, status, duracao_min, observacao')
        .eq('salao_id', perfil.salao_id)
        .in('status', ['Bloqueado', 'Finalizado'])
        .gte('data', dataInicio)
        .lte('data', dataFim);

      setBloqueiosCapacidade(agsCapacidade || []);
    } catch (error: any) {
      toast.erro('Erro ao buscar comissões: ' + error.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    gerarRelatorioComissoes();
  }, [perfil, dataInicio, dataFim, profissionalFiltro, exibirEstornos, statusPagamentoFiltro]);

  // ── Acerto: selecionar e pagar ─────────────────────────────────────────────
  const toggleComissao = (id: string) => {
    setComissoesSelecionadas(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const selecionarTodasPendentes = () => {
    const pendentes = comissoes.filter(c => c.status === 'Pendente').map(c => c.id);
    setComissoesSelecionadas(
      comissoesSelecionadas.length === pendentes.length && pendentes.length > 0 ? [] : pendentes
    );
  };

  async function lancarDespesaComissao(nomeProf: string, totalComissao: number, qtd: number, formaPagamento = 'Dinheiro'): Promise<boolean> {
    const hoje = new Date();
    const dataHoje = hoje.toISOString().split('T')[0];
    const { error } = await supabase.from('despesas').insert({
      salao_id: perfil.salao_id,
      descricao: `Comissão – ${nomeProf} (${qtd} serviço${qtd > 1 ? 's' : ''})`,
      categoria: 'Comissões',
      tipo_custo: 'variavel',
      valor: totalComissao,
      data_vencimento: dataHoje,
      status: 'Pago',
      data_pagamento: dataHoje,
      forma_pagamento: formaPagamento,
      observacao: `Quitação via Relatórios em ${hoje.toLocaleString('pt-BR')}`,
    });
    if (error) { toast.aviso(`Comissão de ${nomeProf}: falha ao lançar despesa: ${error.message}`); return false; }
    return true;
  }

  const pagarTodoProfissional = async (nome: string, ids: string[]) => {
    if (ids.length === 0) return;
    if (!await confirmarAcaoGlobal({ titulo: `Quitar comissões de ${nome}?`, descricao: `${ids.length} pendência(s) serão marcadas como pagas e lançadas no financeiro.`, perigoso: false })) return;
    setProcessandoPagamento(true);
    try {
      // busca valor total antes de marcar como pago
      const { data: rows } = await supabase
        .from('comissoes').select('valor_comissao').eq('salao_id', perfil.salao_id).in('id', ids);
      const totalComissao = (rows || []).reduce((acc: number, r: any) => acc + Number(r.valor_comissao || 0), 0);

      const { error } = await supabase.from('comissoes').update({ status: 'Pago' }).eq('salao_id', perfil.salao_id).in('id', ids);
      if (error) throw error;

      if (totalComissao > 0) {
        const ok = await lancarDespesaComissao(nome, totalComissao, ids.length, formaPagamentoAcerto);
        if (!ok) {
          await supabase.from('comissoes').update({ status: 'Pendente' }).eq('salao_id', perfil.salao_id).in('id', ids);
          toast.erro(`Despesa falhou. Comissões de ${nome} revertidas para Pendente.`);
          gerarRelatorioComissoes();
          return;
        }
      }
      toast.sucesso(`Pendências de ${nome} quitadas com sucesso!`);
      gerarRelatorioComissoes();
    } catch (e: any) {
      toast.erro('Erro ao quitar: ' + e.message);
    } finally {
      setProcessandoPagamento(false);
    }
  };

  const marcarComoPago = async () => {
    if (comissoesSelecionadas.length === 0) return;
    if (!await confirmarAcaoGlobal({ titulo: `Confirmar acerto de ${comissoesSelecionadas.length} comissões?`, descricao: 'As comissões selecionadas serão marcadas como pagas e lançadas no financeiro.', perigoso: false })) return;
    setProcessandoPagamento(true);
    try {
      // busca valor total e profissionais antes de marcar
      const { data: rows } = await supabase
        .from('comissoes').select('id, valor_comissao, profissionais(nome)').eq('salao_id', perfil.salao_id).in('id', comissoesSelecionadas);

      const { error } = await supabase.from('comissoes').update({ status: 'Pago' }).eq('salao_id', perfil.salao_id).in('id', comissoesSelecionadas);
      if (error) throw error;

      const porProf = new Map<string, { total: number; qtd: number; ids: string[] }>();
      (rows || []).forEach((r: any) => {
        const nome = (r.profissionais as any)?.nome || 'Profissional';
        const atual = porProf.get(nome) || { total: 0, qtd: 0, ids: [] };
        porProf.set(nome, { total: atual.total + Number(r.valor_comissao || 0), qtd: atual.qtd + 1, ids: [...atual.ids, r.id] });
      });
      for (const [nome, { total, qtd, ids: profIds }] of porProf.entries()) {
        if (total > 0) {
          const ok = await lancarDespesaComissao(nome, total, qtd, formaPagamentoAcerto);
          if (!ok) await supabase.from('comissoes').update({ status: 'Pendente' }).eq('salao_id', perfil.salao_id).in('id', profIds);
        }
      }

      toast.sucesso(`✅ Acerto concluído! ${comissoesSelecionadas.length} comissões foram marcadas como PAGAS.`);
      setComissoesSelecionadas([]);
      gerarRelatorioComissoes();
    } catch (error: any) {
      toast.erro('Erro ao pagar comissões: ' + error.message);
    } finally {
      setProcessandoPagamento(false);
    }
  };

  // ── Recálculo ──────────────────────────────────────────────────────────────
  const toggleProfissionalRecalculo = (id: string) => {
    setProfissionaisRecalculo(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selecionarTodosProfissionaisRecalculo = () => {
    setProfissionaisRecalculo(
      profissionaisRecalculo.length === profissionais.length ? [] : profissionais.map(p => p.id)
    );
  };

  const executarRecalculo = async () => {
    if (profissionaisRecalculo.length === 0) { toast.aviso('Selecione pelo menos um profissional.'); return; }
    if (!await confirmarAcaoGlobal({ titulo: 'Recalcular comissões?', descricao: 'Isso recalcula todas as comissões pendentes a partir da data escolhida. Esta ação não pode ser desfeita.', perigoso: true, rotuloCta: 'Recalcular' })) return;

    setProcessandoRecalculo(true);
    try {
      // 1. Configurações do salão e taxas de cartão
      const [resSalao, resTaxas] = await Promise.all([
        supabase.from('saloes')
          .select('config_comissao_custo_op, config_comissao_taxa_op_modo, config_comissao_taxa_op_percentual')
          .eq('id', perfil.salao_id).maybeSingle(),
        supabase.from('config_taxas')
          .select('taxas_cartoes, taxa_pix')
          .eq('salao_id', perfil.salao_id).maybeSingle(),
      ]);
      const salaoConf   = resSalao.data;
      const confTaxas   = resTaxas.data;
      const modoTaxaOp  = salaoConf?.config_comissao_taxa_op_modo || 'nao_descontar';
      const percCustom  = Number(salaoConf?.config_comissao_taxa_op_percentual) || 0;
      const taxasCartoes: any = confTaxas?.taxas_cartoes || {};
      const taxaPixRate = Number(confTaxas?.taxa_pix) || 0;

      // 2. Profissionais e comissões pendentes
      const [{ data: profsDb }, { data: comissoesParaRecalcular, error }] = await Promise.all([
        supabase.from('profissionais').select('id, servicos_comissoes, comissao_produtos').eq('salao_id', perfil.salao_id),
        supabase.from('comissoes').select('*').eq('salao_id', perfil.salao_id)
          .eq('status', 'Pendente').gte('data_evento', dataRecalculo)
          .in('profissional_id', profissionaisRecalculo),
      ]);
      if (error) throw error;
      if (!comissoesParaRecalcular || comissoesParaRecalcular.length === 0) {
        toast.aviso('Nenhum registro pendente para recalcular.');
        setModalRecalculo(false);
        return;
      }

      // 3. Serviço por agendamento
      const idsAg = [...new Set(comissoesParaRecalcular.map((c: any) => c.agendamento_id).filter(Boolean))];
      const servicoPorAg: Record<string, string> = {};
      if (idsAg.length > 0) {
        const { data: ags } = await supabase.from('agendamentos').select('id, servico_id').in('id', idsAg);
        (ags || []).forEach((ag: any) => { servicoPorAg[ag.id] = ag.servico_id; });
      }

      // 3.5. Insumos por serviço (ficha técnica) — base antes de aplicar a %
      const modoDescontoCusto = salaoConf?.config_comissao_custo_op || 'nao_descontar';
      const idsServicosRecalc = [...new Set(Object.values(servicoPorAg))].filter(Boolean) as string[];
      const custoInsumosPorServico: Record<string, number> = {};
      if (modoDescontoCusto !== 'nao_descontar' && idsServicosRecalc.length > 0) {
        const { data: fichas } = await supabase
          .from('ficha_tecnica').select('servico_id, quantidade, produtos(custo_medio)').in('servico_id', idsServicosRecalc);
        (fichas || []).forEach((f: any) => {
          const c = (Number(f.quantidade) || 0) * (Number((f.produtos as any)?.custo_medio) || 0);
          custoInsumosPorServico[f.servico_id] = (custoInsumosPorServico[f.servico_id] || 0) + c;
        });
      }

      // 4. Forma de pagamento por agendamento (via financeiro)
      const pagamentoPorAg: Record<string, { forma: string; bandeira: string }> = {};
      if (idsAg.length > 0) {
        const { data: fins } = await supabase.from('financeiro')
          .select('agendamento_ids, forma_pagamento, bandeira_cartao')
          .eq('salao_id', perfil.salao_id).eq('tipo', 'entrada');
        (fins || []).forEach((f: any) => {
          (f.agendamento_ids || []).forEach((agId: string) => {
            if (idsAg.includes(agId)) {
              pagamentoPorAg[agId] = { forma: f.forma_pagamento || '', bandeira: f.bandeira_cartao || '' };
            }
          });
        });
      }

      // 5. Calcula e atualiza cada comissão
      const updates = comissoesParaRecalcular.map((com: any) => {
        const profRegra  = profsDb?.find((p: any) => p.id === com.profissional_id);
        let percentual = 0;
        if (com.tipo === 'produto') {
          percentual = Number(profRegra?.comissao_produtos) || 0;
        } else {
          const servicoId = servicoPorAg[com.agendamento_id];
          percentual = Number(profRegra?.servicos_comissoes?.[servicoId]) || 0;
        }

        const bruto = Math.max(0, Number(com.valor_servico) || 0);
        const servicoIdCom = servicoPorAg[com.agendamento_id];
        const custoInsumos = modoDescontoCusto !== 'nao_descontar' ? (custoInsumosPorServico[servicoIdCom] || 0) : 0;
        const valorBase = Math.max(0, bruto - custoInsumos);
        let novaComissao = (valorBase * percentual) / 100;

        // Dedução da taxa da operadora
        if (modoTaxaOp !== 'nao_descontar' && percentual > 0) {
          const pgto = pagamentoPorAg[com.agendamento_id] || { forma: '', bandeira: '' };
          let taxaPercent = 0;
          const forma = pgto.forma.toLowerCase();
          if (forma.includes('crédito') || forma.includes('credito')) {
            taxaPercent = Number(taxasCartoes[pgto.bandeira]?.cred_1) || Number(taxasCartoes['Visa']?.cred_1) || 0;
          } else if (forma.includes('débito') || forma.includes('debito')) {
            taxaPercent = Number(taxasCartoes[pgto.bandeira]?.debito) || Number(taxasCartoes['Visa']?.debito) || 0;
          } else if (forma.includes('pix')) {
            taxaPercent = taxaPixRate;
          }
          if (taxaPercent > 0) {
            const taxaTotal = valorBase * (taxaPercent / 100);
            let deducao = 0;
            if (modoTaxaOp === 'proporcional') deducao = taxaTotal * (percentual / 100);
            else if (modoTaxaOp === 'total')   deducao = taxaTotal;
            else if (modoTaxaOp === 'metade')  deducao = taxaTotal * 0.5;
            else if (modoTaxaOp === 'personalizado') deducao = taxaTotal * (percCustom / 100);
            novaComissao = Math.max(0, novaComissao - deducao);
          }
        }

        return supabase.from('comissoes')
          .update({ valor_comissao: novaComissao, porcentagem_comissao: percentual })
          .eq('salao_id', perfil.salao_id).eq('id', com.id);
      });

      await Promise.all(updates);
      toast.sucesso(`Recálculo concluído! ${updates.length} comissões atualizadas com taxas aplicadas.`);
      setModalRecalculo(false);
      gerarRelatorioComissoes();
    } catch (error: any) {
      toast.erro('Erro durante o recálculo: ' + error.message);
    } finally {
      setProcessandoRecalculo(false);
    }
  };

  // ── Impressão ──────────────────────────────────────────────────────────────
  const dispararImpressao = (tipo: TipoImpressao) => {
    setTipoImpressao(tipo);
    setModalImpressao(false);
    setTimeout(() => { window.print(); setTipoImpressao(null); }, 500);
  };

  return {
    carregando,
    // filtros
    dataInicio, setDataInicio, dataFim, setDataFim,
    profissionalFiltro, setProfissionalFiltro,
    tipoVendaFiltro, setTipoVendaFiltro,
    statusPagamentoFiltro, setStatusPagamentoFiltro,
    exibirEstornos, setExibirEstornos,
    // dados
    profissionais, comissoes, bloqueiosCapacidade, extras,
    // visão e seleção
    visao, setVisao,
    comissoesSelecionadas, processandoPagamento,
    formaPagamentoAcerto, setFormaPagamentoAcerto,
    toggleComissao, selecionarTodasPendentes, pagarTodoProfissional, marcarComoPago,
    gerarRelatorioComissoes,
    // modais impressão
    modalImpressao, setModalImpressao, tipoImpressao, dispararImpressao,
    // modal recálculo
    modalRecalculo, setModalRecalculo,
    dataRecalculo, setDataRecalculo,
    profissionaisRecalculo, toggleProfissionalRecalculo, selecionarTodosProfissionaisRecalculo,
    processandoRecalculo, executarRecalculo,
    // modal ajuste
    modalExtra, setModalExtra, formExtra, setFormExtra,
    salvandoExtra, salvarExtra, deletarExtra,
  };
}
