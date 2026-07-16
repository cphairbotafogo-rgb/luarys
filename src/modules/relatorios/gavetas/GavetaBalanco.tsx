'use client'

import { useState, useEffect } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_XL, RAIO_MD } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiDownload, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';

export function GavetaBalanco({ dados, perfil }: any) {
  const toast = useToast();

  const [mesAtual, setMesAtual] = useState(new Date().getMonth());
  const [anoAtual, setAnoAtual] = useState(new Date().getFullYear());

  const [finFetch,  setFinFetch]  = useState<any[] | null>(null);
  const [despFetch, setDespFetch] = useState<any[] | null>(null);
  const [comFetch,  setComFetch]  = useState<any[] | null>(null);

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const salaoId: string | undefined = perfil?.salao_id;
  const anoMesAlvo = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}`;

  // ─── BUSCA PRÓPRIA DO MÊS SELECIONADO ────────────────────────────────────
  useEffect(() => {
    if (!salaoId) return;
    let active = true;

    const ini = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`;
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const fim = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const t = setTimeout(async () => {
      const [rFin, rDesp, rCom] = await Promise.all([
        supabase
          .from('financeiro')
          .select('tipo, categoria, descricao, valor, data_movimentacao, status')
          .eq('salao_id', salaoId)
          .gte('data_movimentacao', `${ini}T00:00:00Z`)
          .lte('data_movimentacao', `${fim}T23:59:59Z`)
          .limit(2000),
        supabase
          .from('despesas')
          .select('categoria, descricao, valor, status, data_pagamento, data_vencimento')
          .eq('salao_id', salaoId)
          // Inclui tanto despesas com data_pagamento quanto data_vencimento no mês
          .or(`and(data_pagamento.gte.${ini},data_pagamento.lte.${fim}),and(data_vencimento.gte.${ini},data_vencimento.lte.${fim})`)
          .limit(500),
        supabase
          .from('comissoes')
          .select('id, valor_comissao, created_at, data_evento, status')
          .eq('salao_id', salaoId)
          .gte('data_evento', ini)
          .lte('data_evento', fim)
          .limit(2000),
      ]);
      if (active) {
        setFinFetch(rFin.data ?? []);
        setDespFetch(rDesp.data ?? []);
        setComFetch(rCom.data ?? []);
      }
    }, 300);

    return () => { active = false; clearTimeout(t); };
  }, [salaoId, mesAtual, anoAtual]);

  // ─── FONTES DE DADOS: busca própria > fallback do pai ─────────────────────
  const srcFin   = finFetch  ?? (dados?.financeiro  || []);
  const srcDesp  = despFetch ?? (dados?.despesas     || []);
  const srcCom   = comFetch  ?? (dados?.comissoes    || []);

  // ─── NORMALIZAÇÃO ─────────────────────────────────────────────────────────
  const financeiroSeguro = (srcFin as any[]).filter((f: any) => f.status !== 'Estornado');

  const despesasNormalizadas = (srcDesp as any[])
    .filter((d: any) => d.status !== 'Estornado')
    .map((d: any) => ({
      tipo: 'saida',
      categoria: d.categoria || 'Despesas Variáveis',
      descricao: d.descricao,
      valor: d.valor,
      data_movimentacao: d.data_pagamento || d.data_vencimento,
    }))
    .filter((d: any) => d.data_movimentacao && String(d.data_movimentacao).slice(0, 7) === anoMesAlvo);

  const todosMovimentos = [...financeiroSeguro, ...despesasNormalizadas];

  const movsMes = finFetch
    ? todosMovimentos  // dados já vieram filtrados pelo Supabase
    : todosMovimentos.filter((f: any) => {
        if (!f.data_movimentacao) return false;
        return String(f.data_movimentacao).substring(0, 7) === anoMesAlvo;
      });

  // ─── RECEITAS ─────────────────────────────────────────────────────────────
  const receitasServicos = movsMes
    .filter((f: any) => f.tipo === 'entrada' && f.categoria === 'Serviços Prestados')
    .reduce((a: number, b: any) => a + Number(b.valor), 0);

  const receitasProdutos = movsMes
    .filter((f: any) => f.tipo === 'entrada' && f.categoria === 'Venda de Produtos')
    .reduce((a: number, b: any) => a + Number(b.valor), 0);

  const receitasOutras = movsMes
    .filter((f: any) => f.tipo === 'entrada' && !['Serviços Prestados', 'Venda de Produtos'].includes(f.categoria))
    .reduce((a: number, b: any) => a + Number(b.valor), 0);

  const totalReceitas = receitasServicos + receitasProdutos + receitasOutras;

  // ─── COMISSÕES ────────────────────────────────────────────────────────────
  const comissoesTabela = (srcCom as any[]);
  const mesSelecionadoStr = anoMesAlvo;
  const totalComissoesDaTabela = comissoesTabela
    .filter((c: any) => {
      const ref = c.data_evento || c.created_at;
      return ref && String(ref).slice(0, 7) === mesSelecionadoStr;
    })
    .reduce((acc: number, c: any) => acc + Number(c.valor_comissao || 0), 0);

  // ─── DESPESAS ─────────────────────────────────────────────────────────────
  const despesasComissoes = movsMes
    .filter((f: any) => f.tipo === 'saida' && f.categoria === 'Comissões Pagas')
    .reduce((a: number, b: any) => a + Number(b.valor), 0)
    + totalComissoesDaTabela;

  const despesasFixas = movsMes
    .filter((f: any) => f.tipo === 'saida' && ['Aluguel', 'Água/Luz/Internet', 'Despesas Fixas'].includes(f.categoria))
    .reduce((a: number, b: any) => a + Number(b.valor), 0);

  const despesasImpostos = movsMes
    .filter((f: any) => f.tipo === 'saida' && ['Impostos', 'Impostos / Taxas'].includes(f.categoria))
    .reduce((a: number, b: any) => a + Number(b.valor), 0);

  const despesasOutras = movsMes
    .filter((f: any) => f.tipo === 'saida' && !['Comissões Pagas', 'Comissões', 'Aluguel', 'Água/Luz/Internet', 'Despesas Fixas', 'Impostos', 'Impostos / Taxas'].includes(f.categoria))
    .reduce((a: number, b: any) => a + Number(b.valor), 0);

  const totalDespesas     = despesasComissoes + despesasFixas + despesasImpostos + despesasOutras;
  const resultadoLiquido  = totalReceitas - totalDespesas;

  // ─── EXPORTAÇÃO CSV ───────────────────────────────────────────────────────
  function exportarParaExcel() {
    if (movsMes.length === 0) {
      toast.aviso('Nenhuma movimentação encontrada neste mês.');
      return;
    }
    let csv = 'Data,Tipo,Categoria,Descricao,Valor(R$)\n';
    movsMes.forEach((mov: any) => {
      const dataFormatada  = new Date(mov.data_movimentacao).toLocaleDateString('pt-BR');
      const tipo           = mov.tipo === 'entrada' ? 'Receita' : 'Despesa';
      const valorFormatado = mov.valor.toString().replace('.', ',');
      const desc           = mov.descricao ? String(mov.descricao).replace(/,/g, ' ') : '';
      csv += `${dataFormatada},${tipo},${mov.categoria || ''},${desc},"${valorFormatado}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `DRE_${MESES[mesAtual]}_${anoAtual}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ─── ESTILOS ──────────────────────────────────────────────────────────────
  const rowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: `1px solid ${C.border}`,
    fontSize: 13,
    color: C.textMain,
    fontWeight: 500,
  };

  return (
    <div className="font-body" style={{ height: '100%', overflowY: 'auto' }}>

      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h2 className="font-title uppercase tracking-widest"
            style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg }}>
            Demonstrativo de Resultados (DRE)
          </h2>
          <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: 13, fontWeight: 500 }}>
            Análise de fluxo de caixa, receitas e custos operacionais.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Seletor de mês — controla a busca de dados */}
          <select
            value={`${anoAtual}-${mesAtual}`}
            onChange={e => {
              const [ano, mes] = e.target.value.split('-');
              setAnoAtual(Number(ano));
              setMesAtual(Number(mes));
              setFinFetch(null);
              setDespFetch(null);
              setComFetch(null);
            }}
            style={{
              padding: '8px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
              fontSize: 12, fontWeight: 600, color: C.textMain, background: C.bgCard,
            }}
          >
            {/* 24 meses para trás a partir do mês atual */}
            {Array.from({ length: 24 }, (_, offset) => {
              const d = new Date();
              d.setDate(1);
              d.setMonth(d.getMonth() - offset);
              const m = d.getMonth();
              const a = d.getFullYear();
              return (
                <option key={`${a}-${m}`} value={`${a}-${m}`}>
                  {MESES[m]} {a}
                </option>
              );
            })}
          </select>

          <button
            onClick={exportarParaExcel}
            className="font-title uppercase tracking-wider transition-all hover:scale-[1.01] shadow-sm"
            style={{
              background: C.sidebarBg, color: '#fff', border: 'none',
              padding: '12px 20px', borderRadius: RAIO_MD, fontWeight: 600,
              fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <FiDownload size={14} /> Exportar
          </button>
        </div>
      </div>

      {/* DRE */}
      <div style={{
        background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`,
        overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
      }}>

        {/* RECEITAS */}
        <div className="font-title uppercase tracking-widest"
          style={{ background: C.bg, padding: '14px 20px', borderBottom: `1px solid ${C.borderMid}`, color: C.sidebarBg, fontWeight: 700, fontSize: 11 }}>
          (+) Receitas Brutas Operacionais
        </div>
        <div style={rowStyle}><span>Serviços Prestados</span>            <strong style={{ fontWeight: 600 }}>{brl(receitasServicos)}</strong></div>
        <div style={rowStyle}><span>Venda de Produtos</span>             <strong style={{ fontWeight: 600 }}>{brl(receitasProdutos)}</strong></div>
        <div style={rowStyle}><span>Outros Lançamentos / Aportes</span>  <strong style={{ fontWeight: 600 }}>{brl(receitasOutras)}</strong></div>
        <div className="font-title" style={{ ...rowStyle, fontWeight: 700, color: '#10B981', fontSize: 12, borderBottom: `2px solid ${C.borderMid}` }}>
          <span>TOTAL DE RECEITAS</span><span>{brl(totalReceitas)}</span>
        </div>

        {/* DESPESAS */}
        <div className="font-title uppercase tracking-widest"
          style={{ background: C.bg, padding: '14px 20px', borderBottom: `1px solid ${C.borderMid}`, color: C.sidebarBg, fontWeight: 700, fontSize: 11, marginTop: 16 }}>
          (-) Custos e Despesas Operacionais
        </div>
        <div style={rowStyle}><span>Comissões / Dedução de Pessoal</span>          <strong style={{ fontWeight: 600 }}>{brl(despesasComissoes)}</strong></div>
        <div style={rowStyle}><span>Custos Fixos (Aluguel, Utilidades)</span>      <strong style={{ fontWeight: 600 }}>{brl(despesasFixas)}</strong></div>
        <div style={rowStyle}><span>Retenções Tributárias e Taxas</span>           <strong style={{ fontWeight: 600 }}>{brl(despesasImpostos)}</strong></div>
        <div style={rowStyle}><span>Insumos, Logística e Despesas Variáveis</span> <strong style={{ fontWeight: 600 }}>{brl(despesasOutras)}</strong></div>
        <div className="font-title" style={{ ...rowStyle, fontWeight: 700, color: C.danger, fontSize: 12, borderBottom: `2px solid ${C.borderMid}` }}>
          <span>TOTAL DE CUSTOS E DESPESAS</span><span>{brl(totalDespesas)}</span>
        </div>

        {/* RESULTADO */}
        <div
          className="font-title uppercase tracking-widest"
          style={{
            background: resultadoLiquido >= 0 ? C.sidebarBg : C.danger,
            padding: '24px 20px', color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 32, fontSize: 13, fontWeight: 700,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {resultadoLiquido >= 0 ? <FiTrendingUp size={18} /> : <FiTrendingDown size={18} />}
            Resultado Líquido do Exercício
          </span>
          <span style={{ fontSize: 20, fontWeight: 700 }}>{brl(resultadoLiquido)}</span>
        </div>
      </div>
    </div>
  );
}
