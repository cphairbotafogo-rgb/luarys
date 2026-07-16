import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { MESES, fmtData, fmtNum } from './tipos';

export function useDadosFechamento(perfil: any) {
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth());
  const [ano, setAno] = useState(agora.getFullYear());
  const [carregando, setCarregando] = useState(true);
  const [nomeSalao, setNomeSalao] = useState('');

  const [financeiro, setFinanceiro] = useState<any[]>([]);
  const [despesas,   setDespesas]   = useState<any[]>([]);
  const [comissoes,  setComissoes]  = useState<any[]>([]);

  useEffect(() => {
    async function carregar() {
      if (!perfil?.salao_id) return;
      setCarregando(true);

      const inicioMes = new Date(ano, mes, 1).toISOString().split('T')[0];
      const fimMes    = new Date(ano, mes + 1, 0).toISOString().split('T')[0];

      const [resSalao, resFin, resDesp, resCom] = await Promise.all([
        supabase.from('saloes').select('nome_fantasia, razao_social').eq('id', perfil.salao_id).maybeSingle(),
        supabase.from('financeiro').select('*').eq('salao_id', perfil.salao_id)
          .gte('data_movimentacao', `${inicioMes}T00:00:00Z`)
          .lte('data_movimentacao', `${fimMes}T23:59:59Z`),
        supabase.from('despesas').select('*').eq('salao_id', perfil.salao_id)
          .gte('data_vencimento', inicioMes)
          .lte('data_vencimento', fimMes),
        supabase.from('comissoes').select(`
          id, created_at, data_evento, servico_nome,
          valor_servico, porcentagem_comissao, valor_comissao,
          valor_cota_salao, status,
          profissional_id, profissionais!profissional_id(nome)
        `).eq('salao_id', perfil.salao_id)
          .gte('data_evento', inicioMes)
          .lte('data_evento', fimMes),
      ]);

      setNomeSalao(resSalao.data?.nome_fantasia || resSalao.data?.razao_social || 'Salão');
      setFinanceiro(resFin.data  || []);
      setDespesas(resDesp.data   || []);
      setComissoes(resCom.data   || []);
      setCarregando(false);
    }
    carregar();
  }, [perfil, mes, ano]);

  const mesAnoLabel = `${MESES[mes]} / ${ano}`;

  const dadosFaturamento = useMemo(() => {
    const entradas = financeiro.filter(f =>
      f.tipo === 'entrada' && f.status !== 'Estornado' && f.status !== 'Cancelado'
    );
    const servicos = entradas.filter(f => f.categoria === 'Serviços Prestados');
    const produtos  = entradas.filter(f => f.categoria === 'Venda de Produtos');
    const outros    = entradas.filter(f => !['Serviços Prestados','Venda de Produtos'].includes(f.categoria));

    const totalServicos = servicos.reduce((a, f) => a + Number(f.valor), 0);
    const totalProdutos = produtos.reduce((a, f) => a + Number(f.valor), 0);
    const totalOutros   = outros.reduce((a, f) => a + Number(f.valor), 0);
    const total         = totalServicos + totalProdutos + totalOutros;

    const linhasDetalhadas = entradas.map(f => [
      fmtData(f.data_movimentacao),
      f.descricao || '',
      f.categoria || '',
      f.forma_pagamento || f.metodo_pagamento || '',
      f.categoria === 'Serviços Prestados' ? 'ISS (Municipal)' : f.categoria === 'Venda de Produtos' ? 'ICMS (Estadual)' : 'Verificar',
      fmtNum(Number(f.valor)),
    ]);

    return { servicos, produtos, outros, totalServicos, totalProdutos, totalOutros, total, linhasDetalhadas };
  }, [financeiro]);

  const dadosComissoes = useMemo(() => {
    const validas = comissoes.filter(c => c.status !== 'Cancelado' && c.status !== 'Estornado');

    const porProf: Record<string, any> = {};
    validas.forEach(c => {
      const nome = (c.profissionais as any)?.nome || 'Não Alocado';
      if (!porProf[nome]) porProf[nome] = { nome, atendimentos: 0, receita: 0, comissao: 0, cotaSalao: 0 };
      porProf[nome].atendimentos += 1;
      porProf[nome].receita      += Number(c.valor_servico) || 0;
      porProf[nome].comissao     += Number(c.valor_comissao) || 0;
      porProf[nome].cotaSalao    += Number(c.valor_cota_salao) || 0;
    });

    const agrupado = Object.values(porProf).sort((a: any, b: any) => b.receita - a.receita);
    const totalReceita  = agrupado.reduce((a: number, p: any) => a + p.receita, 0);
    const totalComissao = agrupado.reduce((a: number, p: any) => a + p.comissao, 0);
    const totalSalao    = agrupado.reduce((a: number, p: any) => a + p.cotaSalao, 0);

    const linhasAgrupadas = agrupado.map((p: any) => [
      p.nome, p.atendimentos, fmtNum(p.receita),
      `${((p.comissao / (p.receita || 1)) * 100).toFixed(1)}%`,
      fmtNum(p.comissao), fmtNum(p.cotaSalao),
    ]);

    const linhasDetalhadas = validas.map(c => [
      fmtData(c.data_evento || c.created_at),
      (c.profissionais as any)?.nome || 'Não Alocado',
      c.servico_nome || '',
      fmtNum(Number(c.valor_servico)),
      `${c.porcentagem_comissao || 0}%`,
      fmtNum(Number(c.valor_comissao)),
      fmtNum(Number(c.valor_cota_salao)),
      c.status || 'Pendente',
    ]);

    return { agrupado, validas, totalReceita, totalComissao, totalSalao, linhasAgrupadas, linhasDetalhadas };
  }, [comissoes]);

  const dadosLivroCaixa = useMemo(() => {
    const saidas = financeiro.filter(f => f.tipo === 'saida' && f.status !== 'Estornado');
    const despesasFormatadas = despesas
      .filter(d => d.status === 'Pago' || d.status === 'pago')
      .map(d => ({
        data_movimentacao: d.data_pagamento || d.data_vencimento,
        descricao: d.descricao, categoria: d.categoria,
        valor: d.valor, forma_pagamento: d.forma_pagamento, status: d.status,
      }));
    const todasSaidas = [...saidas, ...despesasFormatadas]
      .sort((a, b) => new Date(a.data_movimentacao).getTime() - new Date(b.data_movimentacao).getTime());

    const porCategoria: Record<string, number> = {};
    todasSaidas.forEach(s => {
      const cat = s.categoria || 'Outros';
      porCategoria[cat] = (porCategoria[cat] || 0) + Number(s.valor);
    });

    const totalDespesas = todasSaidas.reduce((a, s) => a + Number(s.valor), 0);
    const totalReceitas = financeiro
      .filter(f => f.tipo === 'entrada' && f.status !== 'Estornado')
      .reduce((a, f) => a + Number(f.valor), 0);
    const resultado = totalReceitas - totalDespesas;

    const linhasDetalhadas = todasSaidas.map(s => [
      fmtData(s.data_movimentacao), s.descricao || '', s.categoria || '',
      s.forma_pagamento || '', s.status || '', fmtNum(Number(s.valor)),
    ]);

    const linhasCategoria = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => [cat, fmtNum(val), `${((val / (totalDespesas || 1)) * 100).toFixed(1)}%`]);

    return { todasSaidas, totalDespesas, totalReceitas, resultado, linhasDetalhadas, linhasCategoria, porCategoria };
  }, [financeiro, despesas]);

  const dadosConciliacao = useMemo(() => {
    const entradas = financeiro.filter(f => f.tipo === 'entrada' && f.status !== 'Estornado');
    const grupos: Record<string, { tipo: string; bruto: number; transacoes: number }> = {};

    entradas.forEach(f => {
      let forma = (f.forma_pagamento || f.metodo_pagamento || 'Não Informado').toUpperCase();
      if (forma.includes('CREDITO') || forma.includes('CRÉDITO')) forma = 'Cartão de Crédito';
      else if (forma.includes('DEBITO') || forma.includes('DÉBITO')) forma = 'Cartão de Débito';
      else if (forma.includes('PIX')) forma = 'PIX';
      else if (forma.includes('DINHEIRO') || forma.includes('CASH')) forma = 'Dinheiro';
      else forma = f.forma_pagamento || f.metodo_pagamento || 'Outros';

      if (!grupos[forma]) grupos[forma] = { tipo: forma, bruto: 0, transacoes: 0 };
      grupos[forma].bruto      += Number(f.valor);
      grupos[forma].transacoes += 1;
    });

    const lista = Object.values(grupos).sort((a, b) => b.bruto - a.bruto);
    const totalBruto = lista.reduce((a, g) => a + g.bruto, 0);
    const linhas = lista.map(g => [
      g.tipo, g.transacoes, fmtNum(g.bruto),
      `${((g.bruto / (totalBruto || 1)) * 100).toFixed(1)}%`,
    ]);

    return { lista, totalBruto, linhas };
  }, [financeiro]);

  return {
    carregando, nomeSalao,
    mes, setMes, ano, setAno, mesAnoLabel,
    dadosFaturamento, dadosComissoes, dadosLivroCaixa, dadosConciliacao,
  };
}
