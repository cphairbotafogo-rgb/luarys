'use client'
/**
 * src/modules/relatorios/gavetas/produtividade/useProdutividade.ts
 *
 * Hook que busca e processa os dados de produtividade por profissional.
 * Separado do componente visual para facilitar testes e reutilização.
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { DadosProfissional, DadosDia, PeriodoFiltro } from './tipos';

const LS_KEY = 'eleva_meta_valor_hora';

function lerMetaLS(): number {
  if (typeof window === 'undefined') return 150;
  return Number(localStorage.getItem(LS_KEY) || '150') || 150;
}

export function useProdutividade(perfil: any) {
  const [carregando, setCarregando]           = useState(false);
  const [profissionais, setProfissionais]     = useState<DadosProfissional[]>([]);
  const [dadosDia, setDadosDia]               = useState<DadosDia[]>([]);
  const [metaValorHora, _setMetaValorHora]    = useState<number>(lerMetaLS);
  const [metaBrutaMes, setMetaBrutaMes]       = useState<number>(0);
  const [ultimaBusca, setUltimaBusca]         = useState<PeriodoFiltro | null>(null);

  function setMetaValorHora(v: number) {
    _setMetaValorHora(v);
    localStorage.setItem(LS_KEY, String(v));
  }

  // Carregar meta do mês do banco para exibir como referência
  useEffect(() => {
    if (!perfil?.salao_id) return;
    const mes = new Date().toISOString().slice(0, 7);
    supabase.from('metas_salao').select('meta_bruta')
      .eq('salao_id', perfil.salao_id).eq('mes', mes).maybeSingle()
      .then(({ data }) => { if (data?.meta_bruta) setMetaBrutaMes(Number(data.meta_bruta)); });
  }, [perfil?.salao_id]);

  const buscar = useCallback(async (filtro: PeriodoFiltro) => {
    if (!perfil?.salao_id) return;
    setCarregando(true);

    try {
      const [{ data: ags }, { data: bloqueios }, { data: profs }] = await Promise.all([
        supabase.from('agendamentos')
          .select('id, profissional_id, data, duracao_min, valor_final')
          .eq('salao_id', perfil.salao_id).eq('status', 'Finalizado')
          .gte('data', filtro.dataInicio).lte('data', filtro.dataFim),
        supabase.from('agendamentos')
          .select('profissional_id, duracao_min')
          .eq('salao_id', perfil.salao_id).eq('status', 'Bloqueado')
          .gte('data', filtro.dataInicio).lte('data', filtro.dataFim),
        supabase.from('profissionais')
          .select('id, nome, produtivo')
          .eq('salao_id', perfil.salao_id).order('nome'),
      ]);

      if (!ags || !profs) return;

      // FIX: usar TODOS os profissionais ativos como base
      // Profissionais sem atendimento no período aparecem com zeros
      // Apenas exclui quem tem ativo=false explicitamente
      const profsAtivos = profs.filter((p: any) => p.ativo !== false);

      // ── DADOS AGREGADOS POR PROFISSIONAL ──────────────────────────────
      const mapaPros: Record<string, DadosProfissional> = {};
      profsAtivos.forEach((p: any) => {
        mapaPros[p.id] = {
          id: p.id, nome: p.nome,
          atendimentos: 0, minutosTrabalhados: 0, minutosBloqueados: 0, faturamento: 0,
          horasTrabalhadas: 0, valorHora: 0, ticketMedio: 0, taxaOcupacao: 0,
        };
      });

      ags.forEach((ag: any) => {
        const p = mapaPros[ag.profissional_id];
        if (!p) return;
        p.atendimentos++;
        p.minutosTrabalhados += Number(ag.duracao_min) || 0;
        p.faturamento        += Number(ag.valor_final) || 0;
      });

      (bloqueios || []).forEach((b: any) => {
        const p = mapaPros[b.profissional_id];
        if (!p) return;
        p.minutosBloqueados += Number(b.duracao_min) || 0;
      });

      const resultado: DadosProfissional[] = Object.values(mapaPros)
        .map(p => {
          const totalMin = p.minutosTrabalhados + p.minutosBloqueados;
          return {
            ...p,
            horasTrabalhadas: p.minutosTrabalhados / 60,
            valorHora: p.minutosTrabalhados > 0
              ? p.faturamento / (p.minutosTrabalhados / 60) : 0,
            ticketMedio: p.atendimentos > 0
              ? p.faturamento / p.atendimentos : 0,
            taxaOcupacao: totalMin > 0 ? (p.minutosTrabalhados / totalMin) * 100 : 0,
            semDuracao: p.minutosTrabalhados === 0 && p.atendimentos > 0,
          };
        })
        // Ordena: quem tem atendimento > quem não tem; dentro de cada grupo, por valorHora desc
        .sort((a, b) => {
          // Sem atendimento no período vai pro final
          if (a.atendimentos === 0 && b.atendimentos > 0) return 1;
          if (a.atendimentos > 0 && b.atendimentos === 0) return -1;
          // Sem duração (mas com atendimentos) fica antes de sem atendimento
          if ((a as any).semDuracao && !(b as any).semDuracao) return 1;
          if (!(a as any).semDuracao && (b as any).semDuracao) return -1;
          return b.valorHora - a.valorHora;
        });

      // ── DADOS DIÁRIOS (para o gráfico de linha por dia) ───────────────
      const mapaDias: Record<string, DadosDia> = {};
      ags.forEach((ag: any) => {
        const prof = profsAtivos.find((p: any) => p.id === ag.profissional_id);
        if (!prof) return;
        const chave = `${ag.data}_${ag.profissional_id}`;
        if (!mapaDias[chave]) {
          mapaDias[chave] = {
            data: ag.data, profissionalId: ag.profissional_id,
            profissionalNome: prof.nome,
            atendimentos: 0, minutos: 0, faturamento: 0, valorHora: 0,
          };
        }
        mapaDias[chave].atendimentos++;
        mapaDias[chave].minutos   += Number(ag.duracao_min) || 0;
        mapaDias[chave].faturamento += Number(ag.valor_final) || 0;
      });

      const diasResultado = Object.values(mapaDias)
        .map(d => ({
          ...d,
          valorHora: d.minutos > 0 ? d.faturamento / (d.minutos / 60) : 0,
        }))
        .sort((a, b) => a.data.localeCompare(b.data));

      setProfissionais(resultado);
      setDadosDia(diasResultado);
      setUltimaBusca(filtro);
    } finally {
      setCarregando(false);
    }
  }, [perfil?.salao_id]);

  return {
    carregando, profissionais, dadosDia,
    metaValorHora, setMetaValorHora,
    metaBrutaMes,
    ultimaBusca, buscar,
  };
}
