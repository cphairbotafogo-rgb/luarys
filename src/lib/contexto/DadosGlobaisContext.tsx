// src/lib/contexto/DadosGlobaisContext.tsx
// Contexto global para dados que mudam raramente: servicos, profissionais e config_taxas.
// Buscados UMA VEZ no login. Qualquer aba que precise desses dados consome via hook,
// sem repetir queries ao Supabase.
'use client'
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../supabase';

export interface DadosGlobais {
  servicos: any[];
  profissionais: any[];
  taxasCartoes: Record<string, any>;
  taxaPix: number;
  maxParcelas: number;
  configTaxasCarregada: boolean;
  carregando: boolean;
  /** Força re-fetch de config_taxas após o usuário salvar Configurações → Taxas */
  recarregarTaxas: () => Promise<void>;
}

export const DadosGlobaisContext = createContext<DadosGlobais | null>(null);

export function DadosGlobaisProvider({ perfil, children }: { perfil: any; children: ReactNode }) {
  const [servicos,       setServicos]       = useState<any[]>([]);
  const [profissionais,  setProfissionais]  = useState<any[]>([]);
  const [taxasCartoes,   setTaxasCartoes]   = useState<Record<string, any>>({});
  const [taxaPix,        setTaxaPix]        = useState(0);
  const [maxParcelas,    setMaxParcelas]    = useState(12);
  const [configTaxasCarregada, setConfigTaxasCarregada] = useState(false);
  const [carregando,     setCarregando]     = useState(true);

  useEffect(() => {
    if (!perfil?.salao_id) return;

    async function carregar() {
      const [resSrv, resPro, resTax] = await Promise.all([
        // Só os campos usados em agenda, caixa, relatorios e precificacao.
        // "servicos" não tem coluna "ativo" (exclusão é hard delete, não soft
        // delete) — pedir essa coluna/filtro fazia a query INTEIRA falhar
        // (erro "column servicos.ativo does not exist") e, como o erro era
        // descartado, servicos/profissionais ficavam vazios silenciosamente
        // em toda tela que depende deste contexto.
        supabase
          .from('servicos')
          .select('id, nome_servico, preco_padrao, duracao_minutos, categoria')
          .eq('salao_id', perfil.salao_id),
        // Só os campos usados em agenda, equipe e comissoes. "cor_agenda"
        // nunca existiu de verdade na tabela — mesmo problema do "ativo" em
        // servicos, também descartado silenciosamente.
        supabase
          .from('profissionais')
          .select('id, nome, foto_url, cargo, ativo, permissoes, servicos_comissoes, cnpj_mei, tipo_parceiro, comissao_produtos')
          .eq('salao_id', perfil.salao_id)
          .eq('ativo', true),
        supabase
          .from('config_taxas')
          .select('taxa_pix, taxas_cartoes, max_parcelas')
          .eq('salao_id', perfil.salao_id)
          .maybeSingle(),
      ]);

      if (resSrv.error) console.error('[DadosGlobaisContext] Erro ao buscar servicos:', resSrv.error.message);
      if (resPro.error) console.error('[DadosGlobaisContext] Erro ao buscar profissionais:', resPro.error.message);
      setServicos(resSrv.data || []);
      setProfissionais(resPro.data || []);
      if (resTax.data) {
        setTaxaPix(Number(resTax.data.taxa_pix) || 0);
        setTaxasCartoes(resTax.data.taxas_cartoes || {});
        if (resTax.data.max_parcelas) setMaxParcelas(Number(resTax.data.max_parcelas));
        setConfigTaxasCarregada(true);
      }
      setCarregando(false);
    }

    carregar();
  }, [perfil?.salao_id]);

  // Chamado por AbaConfigTaxas após "Salvar Alterações" para atualizar sem recarregar a página
  const recarregarTaxas = useCallback(async () => {
    if (!perfil?.salao_id) return;
    const { data } = await supabase
      .from('config_taxas')
      .select('taxa_pix, taxas_cartoes, max_parcelas')
      .eq('salao_id', perfil.salao_id)
      .maybeSingle();
    if (data) {
      setTaxaPix(Number(data.taxa_pix) || 0);
      setTaxasCartoes(data.taxas_cartoes || {});
      if (data.max_parcelas) setMaxParcelas(Number(data.max_parcelas));
      setConfigTaxasCarregada(true);
    }
  }, [perfil?.salao_id]);

  return (
    <DadosGlobaisContext.Provider value={{
      servicos, profissionais,
      taxasCartoes, taxaPix, maxParcelas, configTaxasCarregada,
      carregando, recarregarTaxas,
    }}>
      {children}
    </DadosGlobaisContext.Provider>
  );
}

/** Hook para consumir dados globais dentro de qualquer componente da app. */
export function useDadosGlobais(): DadosGlobais {
  const ctx = useContext(DadosGlobaisContext);
  if (!ctx) throw new Error('useDadosGlobais precisa estar dentro de <DadosGlobaisProvider>');
  return ctx;
}
