import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useAgendaDados(perfil: any, dataAtual: Date) {
  // ─── ESTADOS DO BANCO DE DADOS ───
  const [clientesDb, setClientesDb] = useState<any[]>([]);
  const [servicosDb, setServicosDb] = useState<any[]>([]);
  const [profissionaisDb, setProfissionaisDb] = useState<any[]>([]);
  const [produtosDb, setProdutosDb] = useState<any[]>([]);
  const [dadosSalao, setDadosSalao] = useState<any>(null);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // ─── ETIQUETAS (TAGS) — carregadas do banco (globais por salão) ───
  const [etiquetasDb, setEtiquetasDb] = useState<any[]>([]);

  // ─── DADOS DO SALÃO — independente do fluxo principal ───
  // Dividido em duas queries: campos fundamentais (sempre carrega) + campos de mensagem
  // (podem falhar se a migration ainda não foi aplicada, sem travar o resto)
  useEffect(() => {
    if (!perfil?.salao_id) return;

    // Query 1 — campos confirmados na tabela saloes (nunca falha por coluna inexistente)
    supabase.from('saloes')
      .select('id,nome_fantasia,razao_social,cnpj,telefone,msg_whatsapp,msg_email')
      .eq('id', perfil.salao_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error && process.env.NODE_ENV === 'development') console.error('[dadosSalao core]', error.message);
        if (data) setDadosSalao((prev: any) => ({ ...(prev || {}), ...data }));
      });

    // Query 2 — campos de pagamento (podem não existir se a migration não foi aplicada)
    supabase.from('saloes')
      .select('cobrar_sinal,porcentagem_sinal,gateway_pagamento,token_pagamento')
      .eq('id', perfil.salao_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDadosSalao((prev: any) => ({ ...(prev || {}), ...data }));
      });
  }, [perfil?.salao_id]);

  // ─── FUNÇÃO CENTRAL DE BUSCA ───
  async function carregarDadosParaAgenda() {
    if (!perfil?.salao_id) return;
    try {
      // Promise.allSettled em vez de Promise.all — se uma query falhar
      // (ex: tabela crm_clientes com RLS bloqueando, ou tabela inexistente),
      // as outras continuam e os serviços/profissionais carregam normalmente.
      const [resC, resS, resP, resProd, resEtiq, resCrmEtiq, resSalao] = await Promise.allSettled([
        supabase.from('clientes').select('*').eq('salao_id', perfil.salao_id),
        supabase.from('servicos').select('*').eq('salao_id', perfil.salao_id),
        supabase.from('profissionais').select('*').eq('salao_id', perfil.salao_id),
        supabase.from('produtos').select('*').eq('salao_id', perfil.salao_id),
        supabase.from('etiquetas').select('*').eq('salao_id', perfil.salao_id).order('nome'),
        supabase.from('crm_clientes').select('cliente_id, etiquetas, observacoes').eq('salao_id', perfil.salao_id),
        supabase.from('saloes').select('id,nome_fantasia,razao_social,cnpj,telefone,msg_whatsapp,msg_email').eq('id', perfil.salao_id).maybeSingle(),
      ]);

      const getData = (res: PromiseSettledResult<any>) =>
        res.status === 'fulfilled' ? res.value?.data : null;

      const dadosClientes  = getData(resC);
      const dadosServicos  = getData(resS);
      const dadosProfis    = getData(resP);
      const dadosProdutos  = getData(resProd);
      const dadosEtiquetas = getData(resEtiq);
      const dadosCrmEtiq   = getData(resCrmEtiq);
      const dadosSalaoCore = getData(resSalao);
      if (dadosSalaoCore) setDadosSalao((prev: any) => ({ ...(prev || {}), ...dadosSalaoCore }));

      if (dadosEtiquetas && dadosEtiquetas.length > 0) setEtiquetasDb(dadosEtiquetas);

      const etiqPorCliente: Record<string, any[]> = {};
      const obsPorCliente: Record<string, string> = {};
      (dadosCrmEtiq || []).forEach((crm: any) => {
        etiqPorCliente[crm.cliente_id] = crm.etiquetas || [];
        if (crm.observacoes) obsPorCliente[crm.cliente_id] = crm.observacoes;
      });
      if (dadosClientes) setClientesDb(
        dadosClientes
          .sort((a: any, b: any) => (a.nome_completo || '').localeCompare(b.nome_completo || ''))
          .map((c: any) => ({ ...c, obs_fixa: obsPorCliente[c.id] || null }))
      );
      if (dadosServicos) setServicosDb(dadosServicos.sort((a: any, b: any) => (a.nome_servico || '').localeCompare(b.nome_servico || '')));
      if (dadosProdutos) setProdutosDb(dadosProdutos);

      if (dadosProfis) {
        const profs = dadosProfis.sort((a: any, b: any) => (a.nome || '').localeCompare(b.nome || ''));
        setProfissionaisDb(profs);

        // Busca apenas após garantir que temos os serviços para fazer o match do preço/nome
        //
        // FIX [PERF-1] — antes buscava TODOS os agendamentos do salão (histórico completo,
        // sem filtro de data). Em salões com 1-2+ anos de uso isso vira uma query cada vez
        // mais pesada toda vez que a agenda abre, mesmo a tela mostrando só um mês.
        //
        // Agora filtramos por uma janela ao redor do mês visível (1 dia de margem em cada
        // ponta, para cobrir visualizações de semana que cruzam virada de mês). A agenda só
        // renderiza o mês corrente, então não há perda de funcionalidade — ver AbaAgenda.tsx.
        const inicioMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1);
        const fimMes = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 0);
        inicioMes.setDate(inicioMes.getDate() - 1);
        fimMes.setDate(fimMes.getDate() + 1);

        const paraISO = (d: Date) => {
          const ano = d.getFullYear();
          const mes = String(d.getMonth() + 1).padStart(2, '0');
          const dia = String(d.getDate()).padStart(2, '0');
          return `${ano}-${mes}-${dia}`;
        };

        const [{ data: ags }, { data: finPagos }] = await Promise.all([
          supabase
            .from('agendamentos')
            .select('*')
            .eq('salao_id', perfil.salao_id)
            .gte('data', paraISO(inicioMes))
            .lte('data', paraISO(fimMes))
            .not('status', 'in', '("Cancelado","Faltou")'),
          // IDs de agendamentos que já têm pagamento registrado no financeiro
          supabase
            .from('financeiro')
            .select('agendamento_ids')
            .eq('salao_id', perfil.salao_id)
            .eq('tipo', 'entrada')
            .neq('status', 'Estornado')
            .not('agendamento_ids', 'is', null),
        ]);

        const idsPagos = new Set<string>();
        (finPagos || []).forEach((f: any) => {
          if (Array.isArray(f.agendamento_ids)) f.agendamento_ids.forEach((id: string) => idsPagos.add(id));
        });

        if (ags) {
          setAgendamentos(ags.map(ag => {
            const servicoEncontrado = dadosServicos?.find((s: any) => s.id === ag.servico_id);
            const nomeServico = servicoEncontrado
              ? servicoEncontrado.nome_servico
              : ag.status === 'Bloqueado' ? '—' : 'Serviço Excluído';
            const horaLimpa = ag.inicio ? ag.inicio.substring(0, 5) : "";
            const semPagamento = ag.status === 'Finalizado'
              && (ag.valor_final ?? 0) > 0
              && !idsPagos.has(ag.id);

            return {
              id: ag.id, id_prof: ag.profissional_id, cliente: ag.cliente_nome,
              servico: nomeServico, data: ag.data, inicio: horaLimpa,
              duracaoMin: ag.duracao_min || 60, status: ag.status || 'Agendado',
              cor: ag.cor || '#1E293B', observacao: ag.observacao || '',
              eh_encaixe: ag.eh_encaixe || false,
              etiquetas: etiqPorCliente[ag.cliente_id] || ag.etiquetas || [],
              cliente_id: ag.cliente_id,
              valor_sinal: ag.valor_sinal || 0,
              valor_final: ag.valor_final ?? null,
              semPagamento,
              servico_id: ag.servico_id || null,
              recorrencia: ag.recorrencia || 'nao',
              criado_por: ag.criado_por || null,
              created_at: ag.created_at || null,
              totalBruto: ag.valor_final ?? servicoEncontrado?.preco_padrao ?? 0
            };
          }));
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  // ─── EFFEITO DE ATUALIZAÇÃO EM TEMPO REAL ───
  useEffect(() => {
    setCarregando(true);
    carregarDadosParaAgenda();

    const canalAoVivo = supabase.channel('agenda-ao-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        carregarDadosParaAgenda(); // Atualiza a tela sozinho se a recepcionista ou cliente mexer em outro PC
      })
      .subscribe();

    return () => { supabase.removeChannel(canalAoVivo); };
  }, [perfil, dataAtual]);

  return {
    clientesDb, setClientesDb,
    servicosDb, setServicosDb,
    profissionaisDb, setProfissionaisDb,
    produtosDb, setProdutosDb,
    dadosSalao, setDadosSalao,
    agendamentos, setAgendamentos,
    etiquetasDb, setEtiquetasDb,
    carregando, setCarregando,
    carregarDadosParaAgenda
  };
}
