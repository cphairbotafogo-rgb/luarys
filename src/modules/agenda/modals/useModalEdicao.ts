// src/modules/agenda/modals/useModalEdicao.ts
// Estado e lógica dos serviços adicionais do ModalEdicao.
'use client'
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

export interface ServicoExtraItem {
  _key: number;
  servico_id: string;
  servico_nome: string;
  profissional_id: string;
  valor: string;
  buscaAberta: boolean;
}

export function useModalEdicao(editandoAg: any, servicosDb: any[], perfil: any, carregarDadosParaAgenda?: () => void) {
  const toast = useToast();
  const [servicoAberto, setServicoAberto]     = useState(false);
  const [salvandoEFechando, setSalvandoEFechando] = useState(false);
  const [servicosExtras, setServicosExtras]   = useState<ServicoExtraItem[]>([]);
  const [salvandoExtras, setSalvandoExtras]   = useState(false);

  function adicionarServicoExtra() {
    setServicosExtras(prev => [...prev, {
      _key: Date.now(),
      servico_id: '',
      servico_nome: '',
      profissional_id: editandoAg.id_prof,
      valor: '',
      buscaAberta: false,
    }]);
  }

  function removerServicoExtra(key: number) {
    setServicosExtras(prev => prev.filter(s => s._key !== key));
  }

  function atualizarExtra(key: number, campo: string, valor: any) {
    setServicosExtras(prev => prev.map(s => s._key === key ? { ...s, [campo]: valor } : s));
  }

  function selecionarServicoExtra(key: number, servico: any) {
    setServicosExtras(prev => prev.map(s => s._key === key ? {
      ...s,
      servico_id: servico.id,
      servico_nome: servico.nome_servico,
      valor: s.valor || (servico.preco_padrao ?? ''),
      buscaAberta: false,
    } : s));
  }

  async function salvarServicosExtras() {
    const validos = servicosExtras.filter(s => s.servico_nome && s.profissional_id);
    if (validos.length === 0) return;
    setSalvandoExtras(true);
    try {
      const inserts = validos.map(s => ({
        salao_id: perfil.salao_id,
        profissional_id: s.profissional_id,
        cliente_nome: editandoAg.cliente,
        cliente_id: editandoAg.cliente_id || null,
        servico_id: s.servico_id || null,
        data: editandoAg.data,
        inicio: editandoAg.inicio,
        duracao_min: servicosDb.find((x: any) => x.id === s.servico_id)?.duracao_minutos || 30,
        status: editandoAg.status || 'Agendado',
        cor: editandoAg.cor || '#1E293B',
        valor_final: s.valor ? parseFloat(String(s.valor).replace(',', '.')) : null,
        observacao: `[Serviço adicional vinculado ao ag. ${editandoAg.id}]`,
      }));
      const { error } = await supabase.from('agendamentos').insert(inserts);
      if (error) throw error;
      setServicosExtras([]);
      carregarDadosParaAgenda?.();
    } catch (e: any) {
      toast.erro('Erro ao salvar serviços extras: ' + e.message);
    } finally {
      setSalvandoExtras(false);
    }
  }

  // Totais calculados
  const totalExtras = servicosExtras.reduce((acc, s) => {
    const v = parseFloat(String(s.valor || '0').replace(',', '.'));
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
  const valorPrincipal = editandoAg.valor_final ?? servicosDb.find((s: any) => s.nome_servico === editandoAg.servico)?.preco_padrao ?? 0;
  const totalGeral = Number(valorPrincipal) + totalExtras;

  return {
    servicoAberto, setServicoAberto,
    salvandoEFechando, setSalvandoEFechando,
    servicosExtras, salvandoExtras,
    totalExtras, valorPrincipal, totalGeral,
    adicionarServicoExtra, removerServicoExtra,
    atualizarExtra, selecionarServicoExtra, salvarServicosExtras,
  };
}
