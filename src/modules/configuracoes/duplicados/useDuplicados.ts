'use client'
/**
 * src/modules/configuracoes/duplicados/useDuplicados.ts
 *
 * Carrega clientes/serviços/produtos, conta o histórico de uso de cada um
 * (usado só para escolher automaticamente qual registro "sobrevive" quando
 * mesclar em lote) e executa as ações de mesclagem.
 *
 * Mesclar agora é completo para os 3 tipos — clientes, serviços e produtos —
 * via função atômica no banco (ver sql/mesclar_duplicados.sql), que repontoa
 * histórico de agendamentos, ficha técnica, comissão por profissional,
 * estoque (somando quantidade física) e o que mais existir, antes de apagar
 * o registro duplicado. Nada de "protegido" — a função cobre o caso de já
 * ter histórico.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  detectarDuplicatasClientes, detectarDuplicatasServicos, detectarDuplicatasProdutos,
  type GrupoDuplicataCliente, type GrupoDuplicataServico, type GrupoDuplicataProduto,
} from './tipos';

type Entidade = 'clientes' | 'servicos' | 'produtos';

const RPC_POR_ENTIDADE: Record<Entidade, string> = {
  clientes: 'mesclar_clientes_duplicados',
  servicos: 'mesclar_servicos_duplicados',
  produtos: 'mesclar_produtos_duplicados',
};

export function useDuplicados(perfil: any) {
  const [aba, setAba] = useState<Entidade>('clientes');
  const [carregando, setCarregando] = useState(false);
  const [executando, setExecutando] = useState<string | null>(null);
  const [mesclandoTudo, setMesclandoTudo] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, nomeAtual: '' });
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [confirmacaoPendente, setConfirmacaoPendente] = useState(false);

  const [gruposClientes, setGruposClientes] = useState<GrupoDuplicataCliente[]>([]);
  const [gruposServicos, setGruposServicos] = useState<GrupoDuplicataServico[]>([]);
  const [gruposProdutos, setGruposProdutos] = useState<GrupoDuplicataProduto[]>([]);
  const [jaEscaneado, setJaEscaneado] = useState(false);

  async function escanear() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    setMensagem({ tipo: '', texto: '' });
    const salaoId = perfil.salao_id;

    // `clientes.salao_id` já é confiável (backfill + importação corrigida), então
    // filtramos DIRETO por salao_id — igual ao resto do CRM. Antes usávamos
    // crm_clientes + `.in('id', [centenas de uuids])`, que estourava o limite de
    // URL do PostgREST com muitos clientes: a query falhava, `data` vinha vazio
    // (erro não era checado) e o scan achava "0 duplicatas" mesmo havendo várias.
    const [resCli, resServ, resProd, resAgCli, resAgServ, resFicha, resHist] = await Promise.all([
      supabase.from('clientes').select('id, nome_completo, telefone_whatsapp, email, cpf, created_at').eq('salao_id', salaoId),
      supabase.from('servicos').select('id, nome_servico, categoria, preco_padrao').eq('salao_id', salaoId),
      supabase.from('produtos').select('id, nome_produto, codigo_sku, preco_venda').eq('salao_id', salaoId),
      supabase.from('agendamentos').select('cliente_id').eq('salao_id', salaoId),
      supabase.from('agendamentos').select('servico_id').eq('salao_id', salaoId),
      supabase.from('ficha_tecnica').select('servico_id, produto_id'),
      supabase.from('historico_estoque').select('produto_id').eq('salao_id', salaoId),
    ]);

    // Se o carregamento de clientes falhar, avisa em vez de mostrar "0 duplicatas"
    // (que enganaria o usuário — foi exatamente o que o `.in()` gigante causava).
    if ((resCli as any).error) {
      if (process.env.NODE_ENV === 'development') console.warn('Duplicados: falha ao carregar clientes:', (resCli as any).error.message);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível carregar os clientes para escanear. Tente novamente.' });
      setCarregando(false);
      return;
    }

    // Contagem de uso — usada para escolher automaticamente o "sobrevivente"
    // ao mesclar em lote (mantém quem tem mais histórico real).
    const usoAgendamentoPorCliente: Record<string, number> = {};
    (resAgCli.data || []).forEach(a => { if (a.cliente_id) usoAgendamentoPorCliente[a.cliente_id] = (usoAgendamentoPorCliente[a.cliente_id] || 0) + 1; });

    const usoAgendamentoPorServico: Record<string, number> = {};
    (resAgServ.data || []).forEach(a => { if (a.servico_id) usoAgendamentoPorServico[a.servico_id] = (usoAgendamentoPorServico[a.servico_id] || 0) + 1; });

    const usoFichaPorServico: Record<string, number> = {};
    const usoFichaPorProduto: Record<string, number> = {};
    (resFicha.data || []).forEach(f => {
      if (f.servico_id) usoFichaPorServico[f.servico_id] = (usoFichaPorServico[f.servico_id] || 0) + 1;
      if (f.produto_id) usoFichaPorProduto[f.produto_id] = (usoFichaPorProduto[f.produto_id] || 0) + 1;
    });

    const usoHistoricoPorProduto: Record<string, number> = {};
    (resHist.data || []).forEach(h => { if (h.produto_id) usoHistoricoPorProduto[h.produto_id] = (usoHistoricoPorProduto[h.produto_id] || 0) + 1; });

    const clientesComUso = (resCli.data || []).map(c => ({ ...c, qtdUso: usoAgendamentoPorCliente[c.id] || 0 }));
    const servicosComUso = (resServ.data || []).map(s => ({ ...s, qtdUso: (usoAgendamentoPorServico[s.id] || 0) + (usoFichaPorServico[s.id] || 0) }));
    const produtosComUso = (resProd.data || []).map(p => ({ ...p, qtdUso: (usoFichaPorProduto[p.id] || 0) + (usoHistoricoPorProduto[p.id] || 0) }));

    setGruposClientes(detectarDuplicatasClientes(clientesComUso));
    setGruposServicos(detectarDuplicatasServicos(servicosComUso));
    setGruposProdutos(detectarDuplicatasProdutos(produtosComUso));
    setJaEscaneado(true);
    setCarregando(false);
  }

  // ─── MESCLAGEM (1 par por vez, usada pelos botões manuais) ────────────────

  async function mesclarPar(entidade: Entidade, manterId: string, removerId: string): Promise<{ ok: boolean; erro: string | null }> {
    const { error } = await supabase.rpc(RPC_POR_ENTIDADE[entidade], {
      p_salao_id: perfil.salao_id,
      p_manter_id: manterId,
      p_remover_id: removerId,
    });
    return { ok: !error, erro: error?.message || null };
  }

  async function mesclarClientes(manterId: string, removerId: string) {
    setExecutando(removerId);
    const { ok, erro } = await mesclarPar('clientes', manterId, removerId);
    if (!ok) setMensagem({ tipo: 'erro', texto: `Erro ao mesclar clientes: ${erro || 'motivo desconhecido'}` });
    else {
      setMensagem({ tipo: 'sucesso', texto: 'Clientes mesclados com sucesso.' });
      setGruposClientes(prev => prev.map(g => ({ ...g, registros: g.registros.filter(r => r.id !== removerId) })).filter(g => g.registros.length >= 2));
    }
    setExecutando(null);
  }

  async function mesclarServicosPar(manterId: string, removerId: string) {
    setExecutando(removerId);
    const { ok, erro } = await mesclarPar('servicos', manterId, removerId);
    if (!ok) setMensagem({ tipo: 'erro', texto: `Erro ao mesclar serviços: ${erro || 'motivo desconhecido'}` });
    else {
      setMensagem({ tipo: 'sucesso', texto: 'Serviços mesclados com sucesso — histórico e comissões preservados.' });
      setGruposServicos(prev => prev.map(g => ({ ...g, registros: g.registros.filter(r => r.id !== removerId) })).filter(g => g.registros.length >= 2));
    }
    setExecutando(null);
  }

  async function mesclarProdutosPar(manterId: string, removerId: string) {
    setExecutando(removerId);
    const { ok, erro } = await mesclarPar('produtos', manterId, removerId);
    if (!ok) setMensagem({ tipo: 'erro', texto: `Erro ao mesclar produtos: ${erro || 'motivo desconhecido'}` });
    else {
      setMensagem({ tipo: 'sucesso', texto: 'Produtos mesclados com sucesso — estoque somado e histórico preservado.' });
      setGruposProdutos(prev => prev.map(g => ({ ...g, registros: g.registros.filter(r => r.id !== removerId) })).filter(g => g.registros.length >= 2));
    }
    setExecutando(null);
  }

  // ─── MESCLAR TODOS DE UMA VEZ ──────────────────────────────────────────────
  // Para cada grupo encontrado (nos 3 tipos), escolhe automaticamente quem
  // "sobrevive" — o registro com mais histórico de uso (mais agendamentos/
  // ficha técnica). Em empate, o cadastro mais antigo. Todos os outros do
  // grupo são mesclados nele, um a um, até não sobrar nenhum grupo.
  //
  // Progresso é acompanhado item a item (não só no final) para alimentar a
  // barra de progresso animada na tela. Grupos com falha NÃO são limpos —
  // só o que realmente mesclou some da lista, então um erro nunca esconde
  // duplicatas reais que ainda precisam de atenção.

  function escolherSobrevivente(registros: any[]): any {
    return [...registros].sort((a, b) => {
      const usoA = a.qtdUso || 0, usoB = b.qtdUso || 0;
      if (usoB !== usoA) return usoB - usoA; // mais uso primeiro
      const dataA = a.created_at || '9999', dataB = b.created_at || '9999';
      return dataA < dataB ? -1 : 1; // mais antigo primeiro em caso de empate
    })[0];
  }

  function nomeDoRegistro(entidade: Entidade, r: any): string {
    if (entidade === 'clientes') return r.nome_completo || 'Cliente';
    if (entidade === 'servicos') return r.nome_servico || 'Serviço';
    return r.nome_produto || 'Produto';
  }

  async function mesclarTodos() {
    setMesclandoTudo(true);
    setMensagem({ tipo: '', texto: '' });

    // Monta a fila inteira ANTES de começar, para a barra de progresso saber
    // o total real desde o primeiro item (em vez de ir descobrindo aos poucos).
    interface Tarefa { entidade: Entidade; manterId: string; removerId: string; nome: string }
    const fila: Tarefa[] = [];

    function empilhar(entidade: Entidade, grupos: { registros: any[] }[]) {
      grupos.forEach(grupo => {
        const sobrevivente = escolherSobrevivente(grupo.registros);
        grupo.registros
          .filter(r => r.id !== sobrevivente.id)
          .forEach(outro => fila.push({ entidade, manterId: sobrevivente.id, removerId: outro.id, nome: nomeDoRegistro(entidade, outro) }));
      });
    }
    empilhar('clientes', gruposClientes);
    empilhar('servicos', gruposServicos);
    empilhar('produtos', gruposProdutos);

    setProgresso({ atual: 0, total: fila.length, nomeAtual: '' });

    let totalMesclado = 0;
    const errosPorMensagem: Record<string, number> = {};

    for (let i = 0; i < fila.length; i++) {
      const tarefa = fila[i];
      setProgresso({ atual: i, total: fila.length, nomeAtual: tarefa.nome });

      const { ok, erro } = await mesclarPar(tarefa.entidade, tarefa.manterId, tarefa.removerId);

      if (ok) {
        totalMesclado++;
        // Remove só este registro específico do grupo — nunca o grupo inteiro
        const removerDoGrupo = <T extends { registros: any[] }>(g: T): T => ({ ...g, registros: g.registros.filter((r: any) => r.id !== tarefa.removerId) });
        if (tarefa.entidade === 'clientes') setGruposClientes(prev => prev.map(removerDoGrupo).filter(g => g.registros.length >= 2));
        if (tarefa.entidade === 'servicos') setGruposServicos(prev => prev.map(removerDoGrupo).filter(g => g.registros.length >= 2));
        if (tarefa.entidade === 'produtos') setGruposProdutos(prev => prev.map(removerDoGrupo).filter(g => g.registros.length >= 2));
      } else {
        const chave = erro || 'Erro desconhecido';
        errosPorMensagem[chave] = (errosPorMensagem[chave] || 0) + 1;
      }
    }

    setProgresso({ atual: fila.length, total: fila.length, nomeAtual: '' });
    setConfirmacaoPendente(false);
    setMesclandoTudo(false);

    const totalErros = fila.length - totalMesclado;
    if (totalErros === 0) {
      setMensagem({ tipo: 'sucesso', texto: `${totalMesclado} duplicata(s) mesclada(s) com sucesso em todos os cadastros.` });
    } else {
      const detalhe = Object.entries(errosPorMensagem)
        .map(([msg, qtd]) => `${qtd}x: ${msg}`)
        .join(' · ');
      setMensagem({
        tipo: 'erro',
        texto: totalMesclado > 0
          ? `${totalMesclado} mesclada(s), ${totalErros} falharam. Motivo(s): ${detalhe}`
          : `Nenhuma mesclagem funcionou (${totalErros} falharam). Motivo(s): ${detalhe}`,
      });
    }
  }

  const totalGruposPendentes = gruposClientes.length + gruposServicos.length + gruposProdutos.length;

  function ignorarGrupoCliente(idx: number) { setGruposClientes(prev => prev.filter((_, i) => i !== idx)); }
  function ignorarGrupoServico(idx: number) { setGruposServicos(prev => prev.filter((_, i) => i !== idx)); }
  function ignorarGrupoProduto(idx: number) { setGruposProdutos(prev => prev.filter((_, i) => i !== idx)); }

  return {
    aba, setAba,
    carregando, executando, mensagem,
    jaEscaneado, escanear,
    gruposClientes, gruposServicos, gruposProdutos,
    mesclarClientes,
    mesclarServicosPar, mesclarProdutosPar,
    ignorarGrupoCliente, ignorarGrupoServico, ignorarGrupoProduto,
    mesclarTodos, mesclandoTudo, totalGruposPendentes, progresso,
    confirmacaoPendente, setConfirmacaoPendente,
  };
}
