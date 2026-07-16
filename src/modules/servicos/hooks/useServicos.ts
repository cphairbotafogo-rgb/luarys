import { useState, useEffect, useRef } from "react";
import { toast } from '@/components/Toast';
import { supabase } from "@/lib/supabase";
import { confirmarAcaoGlobal } from "@/components/ConfirmacaoGlobal";

export function useServicos(perfil: any) {
  const [servicos, setServicos] = useState<any[]>([]);
  const [produtosEstoque, setProdutosEstoque] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  // Mostra spinner apenas no primeiro carregamento; recarregamentos pós-edição
  // são silenciosos para não resetar o scroll da tela.
  const carregadoUmaVez = useRef(false);

  // Estados para Lote
  const [tributosLote, setTributosLote] = useState<any[]>([]);
  const [setorLote, setSetorLote]       = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [salvandoTributos, setSalvandoTributos] = useState(false);
  const [salvandoSetores, setSalvandoSetores]   = useState(false);

  async function carregarDados() {
    if (!perfil?.salao_id) return;
    // Spinner apenas na abertura inicial — não ao salvar/excluir um serviço
    if (!carregadoUmaVez.current) setCarregando(true);

    const [resServicos, resProdutos] = await Promise.all([
      supabase.from('servicos').select('*').eq('salao_id', perfil.salao_id).order('nome_servico'),
      supabase.from('produtos').select('id, nome_produto, custo_medio, unidade_medida').eq('salao_id', perfil.salao_id).order('nome_produto')
    ]);

    if (resServicos.data) {
      setServicos(resServicos.data);
      setTributosLote(resServicos.data.map(s => ({
        id: s.id, nome_servico: s.nome_servico, categoria: s.categoria, setor: s.setor || '',
        nbs: s.nbs || '', codigo_municipio: s.codigo_municipio || '', aliquota_iss: s.aliquota_iss || 0
      })));
      setSetorLote(resServicos.data.map(s => ({
        id: s.id, nome_servico: s.nome_servico, categoria: s.categoria || 'Sem Categoria', setor: s.setor || '',
      })));
    }

    if (resProdutos.data) setProdutosEstoque(resProdutos.data);
    setCarregando(false);
    carregadoUmaVez.current = true;
  }

  useEffect(() => { 
    carregarDados(); 
  }, [perfil]);

  async function excluirServico(id: any) {
    const ok = await confirmarAcaoGlobal({
      titulo: 'Excluir este serviço?',
      descricao: 'Agendamentos e comissões existentes não serão apagados, mas o serviço não poderá ser usado em novos agendamentos.',
      rotuloCta: 'Excluir',
    });
    if (!ok) return;

    try {
      // Remove ficha técnica antes para evitar erro de chave estrangeira
      await supabase.from('ficha_tecnica').delete().eq('servico_id', id);

      const { error } = await supabase.from('servicos').delete().eq('id', id);
      if (error) throw error;

      toast.sucesso('Serviço excluído com sucesso.');
      // Remove da lista local imediatamente (sem spinner)
      setServicos(prev => prev.filter(s => s.id !== id));
      setTributosLote(prev => prev.filter(t => t.id !== id));
      setSetorLote(prev => prev.filter(t => t.id !== id));
    } catch (error: any) {
      toast.erro('Não foi possível excluir: ' + (error.message || 'erro desconhecido'));
    }
  }

  async function aplicarReajusteEmLote(reajusteTipo: string, reajusteValor: string) {
    const valorPercentual = parseFloat(reajusteValor.replace(',', '.'));
    if (!valorPercentual || valorPercentual <= 0) { toast.aviso('Digite um valor percentual válido maior que zero.'); return; }

    if (selecionados.length === 0) return;
    const ok = await confirmarAcaoGlobal({
      titulo: `Aplicar ${reajusteTipo} de ${valorPercentual}%?`,
      descricao: `Isso vai alterar o preço de ${selecionados.length} serviço(s) selecionado(s). A ação pode ser revertida manualmente.`,
      rotuloCta: 'Aplicar reajuste',
      perigoso: false,
    });
    if (!ok) return;

    setProcessandoLote(true);
    try {
      const promessasDeAtualizacao = selecionados.map(id => {
        const servicoOriginal = servicos.find(s => s.id === id);
        if (!servicoOriginal) return Promise.resolve();
        const fator = reajusteTipo === 'aumento' ? (1 + (valorPercentual / 100)) : (1 - (valorPercentual / 100));
        const novoPreco = servicoOriginal.preco_padrao * fator;
        return supabase.from('servicos').update({ preco_padrao: novoPreco }).eq('id', id);
      });
      await Promise.all(promessasDeAtualizacao);
      toast.sucesso('Reajuste aplicado com sucesso!');

      setSelecionados([]); 
      carregarDados(); 
    } catch (error: any) { 
      toast.erro("Erro ao processar lote: " + error.message);

    } finally { 
      setProcessandoLote(false); 
    }
  }

  async function salvarTodosTributos() {
    setSalvandoTributos(true);
    try {
      const promessas = tributosLote.map(t => 
        supabase.from('servicos').update({
          nbs: t.nbs || null, codigo_municipio: t.codigo_municipio || null, aliquota_iss: parseFloat(String(t.aliquota_iss).replace(',','.')) || 0
        }).eq('id', t.id)
      );
      await Promise.all(promessas);
      toast.sucesso('Tributação atualizada com sucesso!');

      carregarDados();
    } catch (error: any) { 
      toast.erro("Erro ao salvar tributos: " + error.message);

    } finally { 
      setSalvandoTributos(false); 
    }
  }

  async function salvarTodosSetores() {
    setSalvandoSetores(true);
    try {
      await Promise.all(setorLote.map(s =>
        supabase.from('servicos').update({ setor: s.setor || null }).eq('id', s.id)
      ));
      toast.sucesso('Setores atualizados com sucesso!');
      carregarDados();
    } catch (e: any) {
      toast.erro('Erro ao salvar setores: ' + e.message);
    } finally {
      setSalvandoSetores(false);
    }
  }

  return {
    servicos, produtosEstoque, carregando, carregarDados,
    tributosLote, setTributosLote, salvandoTributos, salvarTodosTributos,
    setorLote, setSetorLote, salvandoSetores, salvarTodosSetores,
    selecionados, setSelecionados, processandoLote, aplicarReajusteEmLote,
    excluirServico
  };
}