'use client'
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

// Próxima data de cobrança: o dia de vencimento no mês atual, ou no próximo se já passou.
export function proximaCobranca(diaVencimento: number): string {
  const hoje = new Date();
  const dia = Math.min(Math.max(1, Number(diaVencimento) || 5), 28);
  let alvo = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
  if (alvo <= hoje) alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
  return alvo.toISOString().split('T')[0];
}

// Gerencia as assinaturas de UM cliente (fatia 2 do Clube). Aditivo — não toca o caixa.
export function useAssinaturaCliente(perfil: any, clienteId: string | null) {
  const toast = useToast();
  const [planos, setPlanos] = useState<any[]>([]);
  const [assinaturas, setAssinaturas] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [servicosCat, setServicosCat] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const [resPlanos, resAssin, resProfs, resServ] = await Promise.all([
      supabase.from('planos_assinatura_cliente')
        .select('id, nome, preco_mensal, desconto_percentual, servicos_inclusos, cor')
        .eq('salao_id', perfil.salao_id).eq('ativo', true).order('nome'),
      clienteId
        ? supabase.from('assinaturas_cliente')
            .select('id, status, data_inicio, dia_vencimento, proxima_cobranca, plano_id, profissionais_area, planos_assinatura_cliente(nome, preco_mensal, cor)')
            .eq('salao_id', perfil.salao_id).eq('cliente_id', clienteId)
            .order('criado_em', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('profissionais').select('id, nome').eq('salao_id', perfil.salao_id).eq('ativo', true).order('nome'),
      supabase.from('servicos').select('id, categoria').eq('salao_id', perfil.salao_id),
    ]);
    setPlanos(resPlanos.data || []);
    setAssinaturas((resAssin as any).data || []);
    setProfissionais(resProfs.data || []);
    setServicosCat(resServ.data || []);
    setCarregando(false);
  }, [perfil?.salao_id, clienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function assinar(planoId: string, dataInicio: string, diaVencimento: number, profissionaisArea: any[]): Promise<boolean> {
    if (!perfil?.salao_id || !clienteId || !planoId) return false;
    // Evita duas assinaturas ATIVAS do mesmo plano
    if (assinaturas.some(a => a.plano_id === planoId && a.status === 'ativa')) {
      toast.aviso('Este cliente já tem uma assinatura ativa deste plano.');
      return false;
    }
    setSalvando(true);
    const { error } = await supabase.from('assinaturas_cliente').insert([{
      salao_id: perfil.salao_id,
      cliente_id: clienteId,
      plano_id: planoId,
      status: 'ativa',
      data_inicio: dataInicio,
      dia_vencimento: Number(diaVencimento) || 5,
      proxima_cobranca: proximaCobranca(diaVencimento),
      profissionais_area: profissionaisArea || [],
    }]);
    setSalvando(false);
    if (error) { toast.erro('Erro ao criar assinatura: ' + error.message); return false; }
    toast.sucesso('Assinatura criada!');
    await carregar();
    return true;
  }

  async function alterarStatus(id: string, status: 'ativa' | 'pausada' | 'cancelada') {
    const { error } = await supabase.from('assinaturas_cliente').update({ status }).eq('id', id);
    if (error) { toast.erro('Erro: ' + error.message); return; }
    toast.sucesso(status === 'cancelada' ? 'Assinatura cancelada.' : status === 'pausada' ? 'Assinatura pausada.' : 'Assinatura reativada.');
    await carregar();
  }

  return { planos, assinaturas, profissionais, servicosCat, carregando, salvando, assinar, alterarStatus };
}
