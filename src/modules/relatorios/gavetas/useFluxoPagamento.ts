// src/modules/relatorios/gavetas/useFluxoPagamento.ts
// Tipos, constantes e lógica de agrupamento de GavetaFluxoPagamento.tsx —
// extraído para manter o componente abaixo de 400 linhas (regra do projeto).
'use client'
import { useState, useMemo } from 'react';
import { useTaxasConfig } from '@/lib/useTaxasConfig';

export type Visao = 'atendimento' | 'pagamento' | 'previsto';
export type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'livre';

// Mapa bandeira → emoji de bandeira
export const EMOJI_BANDEIRA: Record<string, string> = {
  Visa:       '🔵',
  Mastercard: '🔴',
  Elo:        '🟡',
  Amex:       '🟢',
  Hipercard:  '🟠',
};

export const ICONE_FORMA: Record<string, string> = {
  'Cartão de Crédito': '💳',
  'Cartão de Débito':  '💳',
  'Pix':               '⚡',
  'Dinheiro':          '💵',
  'Outros':            '📋',
};

export const VISOES: { key: Visao; label: string }[] = [
  { key: 'atendimento', label: 'Por Data de Atendimento/Venda' },
  { key: 'pagamento',   label: 'Por Data de Pagamento/Estorno' },
  { key: 'previsto',    label: 'Por Data Prevista de Recebimento' },
];

export const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'hoje',   label: 'Hoje' },
  { key: 'semana', label: 'Esta Semana' },
  { key: 'mes',    label: 'Este Mês' },
  { key: 'ano',    label: 'Este Ano' },
  { key: 'livre',  label: 'Período Livre' },
];

export const GRID = '2fr 1fr 1fr 1fr 1fr 1fr';

// Converte timestamp UTC do banco para YYYY-MM-DD no fuso local do navegador.
export function localDateStr(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return String(iso).substring(0, 10);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);
}

// Débito tem sub-marcas (Visa Electron, Maestro/Redeshop) que são variantes da mesma bandeira.
// Normaliza para o nome canônico para evitar linhas duplicadas com taxas divergentes.
export function normalizarBandeira(bandeira: string | null, forma: string): string | null {
  if (!bandeira || forma !== 'Cartão de Débito') return bandeira;
  const b = String(bandeira).toUpperCase();
  if (b.includes('VISA')) return 'Visa';
  if (b.includes('MAESTRO') || b.includes('REDESHOP')) return 'Mastercard';
  if (b.includes('MASTER')) return 'Mastercard';
  if (b.includes('ELO')) return 'Elo';
  if (b.includes('AMEX') || b.includes('AMERICAN')) return 'Amex';
  return bandeira;
}

export function normalizarForma(forma: string): string {
  if (!forma) return 'Outros';
  const f = String(forma).toUpperCase();
  if (f.includes('CREDIT') || f.includes('CRÉDIT')) return 'Cartão de Crédito';
  if (f.includes('DEBIT')  || f.includes('DÉBIT'))  return 'Cartão de Débito';
  if (f.includes('PIX'))    return 'Pix';
  if (f.includes('DINHEIRO') || f.includes('CASH')) return 'Dinheiro';
  return 'Outros';
}

export function obterIntervalo(periodo: Periodo, delivre: string, atelivre: string): { de: string; ate: string } {
  const hoje = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (periodo === 'hoje')   return { de: iso(hoje), ate: iso(hoje) };
  if (periodo === 'semana') {
    const ds = hoje.getDay();
    const ini = new Date(hoje); ini.setDate(hoje.getDate() - ds);
    const fim = new Date(hoje); fim.setDate(hoje.getDate() + (6 - ds));
    return { de: iso(ini), ate: iso(fim) };
  }
  if (periodo === 'mes') {
    return {
      de:  iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
      ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    };
  }
  if (periodo === 'ano') return { de: `${hoje.getFullYear()}-01-01`, ate: `${hoje.getFullYear()}-12-31` };
  return { de: delivre, ate: atelivre };
}

export interface LinhaForma {
  forma: string;
  qtd: number;
  valorBruto: number;
  taxa: number;          // % médio ponderado
  custo: number;
  valorLiquido: number;
  subLinhas?: Array<{    // por bandeira, só em cartões
    bandeira: string;
    qtd: number;
    valorBruto: number;
    taxa: number;
    custo: number;
    valorLiquido: number;
  }>;
}

export function useFluxoPagamento(dados: any, perfil: any) {
  const [visao, setVisao]     = useState<Visao>('atendimento');
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const hojeStr = localDateStr(new Date().toISOString());
  const [delivre, setDelivre] = useState(hojeStr.substring(0, 8) + '01');
  const [atelivre, setAtelivre] = useState(hojeStr);

  const { obterTaxa, configCarregada } = useTaxasConfig(perfil);

  const financeiro: any[] = dados?.financeiro || [];
  const { de, ate } = obterIntervalo(periodo, delivre, atelivre);

  const dadosFiltrados = useMemo(() => {
    return financeiro.filter((f: any) => {
      if (f.status === 'Estornado') return false;
      const data = localDateStr(f.data_movimentacao);
      return data >= de && data <= ate;
    });
  }, [financeiro, de, ate]);

  // Agrupa por forma e, dentro de cartões, por bandeira
  const linhas = useMemo<LinhaForma[]>(() => {
    const mapa: Record<string, {
      qtd: number; bruto: number; custo: number;
      porBandeira: Record<string, { qtd: number; bruto: number; custo: number }>;
    }> = {};

    dadosFiltrados.forEach((f: any) => {
      const forma    = normalizarForma(f.forma_pagamento || f.metodo_pagamento || '');
      const bandeira = normalizarBandeira(f.bandeira_cartao || null, forma);
      const valor    = Number(f.valor || 0);
      const taxa     = obterTaxa(forma, bandeira);
      const custo    = valor * taxa / 100;

      if (!mapa[forma]) mapa[forma] = { qtd: 0, bruto: 0, custo: 0, porBandeira: {} };
      mapa[forma].qtd++;
      mapa[forma].bruto += valor;
      mapa[forma].custo += custo;

      if ((forma === 'Cartão de Crédito' || forma === 'Cartão de Débito') && bandeira) {
        if (!mapa[forma].porBandeira[bandeira]) mapa[forma].porBandeira[bandeira] = { qtd: 0, bruto: 0, custo: 0 };
        mapa[forma].porBandeira[bandeira].qtd++;
        mapa[forma].porBandeira[bandeira].bruto += valor;
        mapa[forma].porBandeira[bandeira].custo += custo;
      }
    });

    return Object.entries(mapa)
      .sort(([, a], [, b]) => b.bruto - a.bruto)
      .map(([forma, v]) => {
        const taxaMedia = v.bruto > 0 ? (v.custo / v.bruto) * 100 : 0;
        const subLinhas = Object.entries(v.porBandeira)
          .sort(([, a], [, b]) => b.bruto - a.bruto)
          .map(([band, sb]) => {
            const t = sb.bruto > 0 ? (sb.custo / sb.bruto) * 100 : 0;
            return {
              bandeira: band, qtd: sb.qtd,
              valorBruto: sb.bruto, taxa: t,
              custo: sb.custo, valorLiquido: sb.bruto - sb.custo,
            };
          });

        return {
          forma, qtd: v.qtd,
          valorBruto: v.bruto, taxa: taxaMedia,
          custo: v.custo, valorLiquido: v.bruto - v.custo,
          subLinhas: subLinhas.length > 0 ? subLinhas : undefined,
        };
      });
  }, [dadosFiltrados, obterTaxa]);

  const totalQtd     = linhas.reduce((a, l) => a + l.qtd, 0);
  const totalBruto   = linhas.reduce((a, l) => a + l.valorBruto, 0);
  const totalCusto   = linhas.reduce((a, l) => a + l.custo, 0);
  const totalLiquido = totalBruto - totalCusto;
  const taxaGeral    = totalBruto > 0 ? (totalCusto / totalBruto) * 100 : 0;

  function toggleExpandido(forma: string) {
    setExpandido(prev => ({ ...prev, [forma]: !prev[forma] }));
  }

  function exportarCSV() {
    if (linhas.length === 0) return;
    let csv = 'Forma de Pagamento,Bandeira,Qtd,Valor Bruto,Taxa %,Custo Operadora,Valor Líquido\n';
    linhas.forEach(l => {
      if (l.subLinhas && l.subLinhas.length > 0) {
        l.subLinhas.forEach(s => {
          csv += `${l.forma},${s.bandeira},${s.qtd},"${s.valorBruto.toFixed(2).replace('.', ',')}","${s.taxa.toFixed(2).replace('.', ',')}%","${s.custo.toFixed(2).replace('.', ',')}","${s.valorLiquido.toFixed(2).replace('.', ',')}"\n`;
        });
      } else {
        csv += `${l.forma},—,${l.qtd},"${l.valorBruto.toFixed(2).replace('.', ',')}","${l.taxa.toFixed(2).replace('.', ',')}%","${l.custo.toFixed(2).replace('.', ',')}","${l.valorLiquido.toFixed(2).replace('.', ',')}"\n`;
      }
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fluxo_pagamento_${de}_a_${ate}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  return {
    visao, setVisao, periodo, setPeriodo, expandido, toggleExpandido,
    delivre, setDelivre, atelivre, setAtelivre,
    de, ate, linhas, configCarregada,
    totalQtd, totalBruto, totalCusto, totalLiquido, taxaGeral,
    exportarCSV,
  };
}
