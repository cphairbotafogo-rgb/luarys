'use client'
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import type { PlanoAssinatura } from "./tipos";

// CRUD dos planos do Clube de Assinaturas. Isolado — não toca fechamento/RLS.
export function useClubeAssinaturas(perfil: any) {
  const toast = useToast();
  const [planos, setPlanos] = useState<PlanoAssinatura[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Serviços carregados aqui com select('*') (igual ao useServicos, que funciona):
  // evita erro de coluna inexistente e traz tanto nome_servico quanto nome —
  // alguns serviços têm o nome em `nome`, não em `nome_servico`.
  useEffect(() => {
    if (!perfil?.salao_id) return;
    supabase.from('servicos')
      .select('*')
      .eq('salao_id', perfil.salao_id)
      .order('nome_servico')
      .then(({ data }) => setServicos(data || []));
  }, [perfil?.salao_id]);

  const carregar = useCallback(async () => {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const { data, error } = await supabase
      .from('planos_assinatura_cliente')
      .select('id, nome, descricao, preco_mensal, desconto_percentual, servicos_inclusos, cor, ativo')
      .eq('salao_id', perfil.salao_id)
      .order('criado_em', { ascending: false });
    if (error) toast.erro('Erro ao carregar planos: ' + error.message);
    setPlanos((data as any) || []);
    setCarregando(false);
  }, [perfil?.salao_id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvarPlano(plano: PlanoAssinatura): Promise<boolean> {
    if (!perfil?.salao_id) return false;
    if (!plano.nome.trim()) { toast.aviso('Dê um nome ao plano.'); return false; }
    setSalvando(true);
    const payload = {
      salao_id: perfil.salao_id,
      nome: plano.nome.trim(),
      descricao: plano.descricao?.trim() || null,
      preco_mensal: Number(plano.preco_mensal) || 0,
      desconto_percentual: Number(plano.desconto_percentual) || 0,
      servicos_inclusos: plano.servicos_inclusos || [],
      cor: plano.cor || '#D4AF37',
      ativo: plano.ativo !== false,
    };
    const resp = plano.id
      ? await supabase.from('planos_assinatura_cliente').update(payload).eq('id', plano.id)
      : await supabase.from('planos_assinatura_cliente').insert([payload]);
    setSalvando(false);
    if (resp.error) { toast.erro('Erro ao salvar: ' + resp.error.message); return false; }
    toast.sucesso(plano.id ? 'Plano atualizado!' : 'Plano criado!');
    await carregar();
    return true;
  }

  async function alternarAtivo(plano: PlanoAssinatura) {
    if (!plano.id) return;
    const { error } = await supabase.from('planos_assinatura_cliente')
      .update({ ativo: !plano.ativo }).eq('id', plano.id);
    if (error) { toast.erro('Erro: ' + error.message); return; }
    await carregar();
  }

  async function excluirPlano(id?: string) {
    if (!id) return;
    const { error } = await supabase.from('planos_assinatura_cliente').delete().eq('id', id);
    if (error) {
      // FK ON DELETE RESTRICT: há clientes assinando este plano
      toast.aviso('Não é possível excluir: há clientes com este plano. Desative-o em vez de excluir.');
      return;
    }
    toast.sucesso('Plano excluído.');
    await carregar();
  }

  return { planos, servicos, carregando, salvando, salvarPlano, alternarAtivo, excluirPlano };
}
