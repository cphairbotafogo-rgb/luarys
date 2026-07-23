// src/modules/relatorios/gavetas/useBuscaServico.ts
// Estado e lógica de busca de GavetaBuscaServico.tsx — extraído para manter
// o componente abaixo de 400 linhas (regra do projeto).
'use client'
import { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function fmt(d: string | null | undefined) {
  if (!d) return '—';
  const [a, m, dd] = d.split('T')[0].split('-');
  return `${dd}/${m}/${a}`;
}

export function corDias(dias: number) {
  if (dias > 90) return { cor: '#EF4444', bg: '#FEE2E2' };
  if (dias > 45) return { cor: '#D97706', bg: '#FEF3C7' };
  return { cor: '#10B981', bg: '#D1FAE5' };
}

export function hoje() { return new Date().toISOString().split('T')[0]; }
export function dataHaPeriodo(anos = 2) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anos);
  return d.toISOString().split('T')[0];
}

export function useBuscaServico(perfil: any, dados: any) {
  const [dataInicio, setDataInicio] = useState(dataHaPeriodo(2));
  const [dataFim, setDataFim]       = useState(hoje());
  const [servicoId, setServicoId]       = useState('');
  const [buscaServico, setBuscaServico] = useState('');
  const [dropdownServicoAberto, setDropdownServicoAberto] = useState(false);
  const refBuscaServico = useRef<HTMLDivElement>(null);
  const [buscaNome, setBuscaNome]   = useState('');
  const [resultado, setResultado]   = useState<any[]>([]);
  const [buscando, setBuscando]     = useState(false);
  const [executado, setExecutado]   = useState(false);
  const [ordenarPor, setOrdenarPor] = useState<'diasSemVir' | 'visitas' | 'ultimaVisita'>('diasSemVir');

  // Fonte 1: agendamentos têm join servicos embutido → popula instantaneamente
  const servicosDosAgs = useMemo(() => {
    const mapa: Record<string, any> = {};
    (dados?.agendamentos || []).forEach((ag: any) => {
      if (!ag.servico_id) return;
      const s = ag.servicos as any;
      if (!s?.nome_servico) return;
      if (!mapa[ag.servico_id]) {
        mapa[ag.servico_id] = { id: ag.servico_id, nome_servico: s.nome_servico, categoria: s.categoria || '' };
      }
    });
    return Object.values(mapa);
  }, [dados?.agendamentos]);

  const [servicosQuery, setServicosQuery] = useState<any[]>([]);
  const [carregandoServs, setCarregandoServs] = useState(false);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    setCarregandoServs(true);
    supabase
      .from('servicos')
      .select('id, nome_servico, categoria')
      .eq('salao_id', perfil.salao_id)
      .order('nome_servico')
      .limit(500)
      .then(({ data, error }) => {
        if (error) console.error('[GavetaBuscaServico] query servicos:', error.message);
        setServicosQuery(data || []);
        setCarregandoServs(false);
      });
  }, [perfil?.salao_id]);

  const servicos = useMemo(() => {
    if (servicosQuery.length > 0) return servicosQuery;
    return [...servicosDosAgs].sort((a: any, b: any) =>
      (a.nome_servico || '').localeCompare(b.nome_servico || '', 'pt-BR')
    );
  }, [servicosQuery, servicosDosAgs]);

  const servicosFiltrados = useMemo(() => {
    if (!buscaServico.trim()) return servicos;
    const term = buscaServico.toLowerCase();
    return servicos.filter((s: any) =>
      (s.nome_servico || '').toLowerCase().includes(term) ||
      (s.categoria || '').toLowerCase().includes(term)
    );
  }, [servicos, buscaServico]);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (refBuscaServico.current && !refBuscaServico.current.contains(e.target as Node)) {
        setDropdownServicoAberto(false);
      }
    }
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  const presets = [
    { label: 'Este mês',   fn: () => { const d = new Date(); setDataInicio(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]); setDataFim(hoje()); } },
    { label: 'Este ano',   fn: () => { setDataInicio(`${new Date().getFullYear()}-01-01`); setDataFim(hoje()); } },
    { label: 'Último ano', fn: () => { setDataInicio(dataHaPeriodo(1)); setDataFim(hoje()); } },
    { label: '2 anos',     fn: () => { setDataInicio(dataHaPeriodo(2)); setDataFim(hoje()); } },
    { label: 'Tudo',       fn: () => { setDataInicio('2018-01-01'); setDataFim(hoje()); } },
  ];

  async function buscar() {
    if (!servicoId || !perfil?.salao_id) return;
    setBuscando(true);
    setResultado([]);
    setExecutado(false);

    const { data, error } = await supabase
      .from('agendamentos')
      .select('cliente_id, cliente_nome, data')
      .eq('salao_id', perfil.salao_id)
      .eq('servico_id', servicoId)
      .eq('status', 'Finalizado')
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: false })
      .limit(5000);

    if (error) {
      console.error('[GavetaBuscaServico] buscar:', error.message);
      setBuscando(false);
      return;
    }

    const hojeStr = new Date().toISOString().split('T')[0];
    const mapa: Record<string, any> = {};

    (data || []).forEach((ag: any) => {
      const nome = ag.cliente_nome || '—';
      const id   = ag.cliente_id   || nome;
      const d    = (ag.data || '').split('T')[0];
      if (!mapa[id]) {
        mapa[id] = { nome, ultimaVisita: d, primeiraVisita: d, visitas: 0 };
      }
      mapa[id].visitas++;
      if (d > mapa[id].ultimaVisita)   mapa[id].ultimaVisita   = d;
      if (d < mapa[id].primeiraVisita) mapa[id].primeiraVisita = d;
    });

    const lista = Object.values(mapa).map((c: any) => ({
      ...c,
      diasSemVir: Math.floor(
        (new Date(hojeStr).getTime() - new Date(c.ultimaVisita).getTime()) / 86_400_000
      ),
    }));

    setResultado(lista);
    setBuscando(false);
    setExecutado(true);
  }

  const listaExibida = useMemo(() => {
    const filtrada = buscaNome
      ? resultado.filter(c => c.nome.toLowerCase().includes(buscaNome.toLowerCase()))
      : resultado;

    return [...filtrada].sort((a, b) => {
      if (ordenarPor === 'diasSemVir')    return b.diasSemVir - a.diasSemVir;
      if (ordenarPor === 'visitas')       return b.visitas    - a.visitas;
      return b.ultimaVisita.localeCompare(a.ultimaVisita);
    });
  }, [resultado, buscaNome, ordenarPor]);

  const dropdownCarregando = carregandoServs && servicos.length === 0;

  return {
    dataInicio, setDataInicio, dataFim, setDataFim,
    servicoId, setServicoId, buscaServico, setBuscaServico,
    dropdownServicoAberto, setDropdownServicoAberto, refBuscaServico,
    buscaNome, setBuscaNome, buscando, executado, ordenarPor, setOrdenarPor,
    servicosDosAgs, servicosQuery, servicosFiltrados, carregandoServs, dropdownCarregando,
    presets, buscar, listaExibida,
  };
}
