// src/lib/useTaxasConfig.ts
// Hook central de taxas operadoras.
// Quando dentro de DadosGlobaisProvider, consome do contexto (zero fetch extra).
// Quando usado fora (ex: portal), faz fetch próprio como fallback.
'use client'
import { useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from './supabase';
import { DadosGlobaisContext } from './contexto/DadosGlobaisContext';
import { resolverChaveBandeira, taxaMedia } from './taxasCartao';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface TaxasConfig {
  taxasCartoes: Record<string, any>;
  taxaPix: number;
  maxParcelas: number;
  configCarregada: boolean;
  obterTaxa: (forma: string, bandeira: string | null) => number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Fonte única de taxas operadoras.
 *
 * Lookup por ordem:
 *  1. DadosGlobaisContext (quando dentro do provider — sem query extra)
 *  2. Fetch próprio de config_taxas (fallback para uso fora do provider)
 *
 * obterTaxa(forma, bandeira):
 *  - PIX           → taxa_pix
 *  - Débito        → taxas_cartoes[bandeira].debito  (fallback: média)
 *  - Crédito       → taxas_cartoes[bandeira].cred_1  (fallback: média)
 *  - Dinheiro/Outros → 0
 *
 * O lookup de bandeira é case-insensitive; bandeiras desconhecidas usam a média.
 */
export function useTaxasConfig(perfil: any): TaxasConfig {
  const ctx = useContext(DadosGlobaisContext);
  const emContexto = ctx !== null;

  // Estado local apenas usado quando fora do DadosGlobaisProvider
  const [taxasCartoesLocal, setTaxasCartoesLocal] = useState<Record<string, any>>({});
  const [taxaPixLocal,      setTaxaPixLocal]      = useState(0);
  const [maxParcelasLocal,  setMaxParcelasLocal]  = useState(12);
  const [configCarregadaLocal, setConfigCarregadaLocal] = useState(false);

  useEffect(() => {
    if (emContexto || !perfil?.salao_id) return;
    async function carregar() {
      const { data } = await supabase
        .from('config_taxas')
        .select('taxa_pix, taxas_cartoes, max_parcelas')
        .eq('salao_id', perfil.salao_id)
        .maybeSingle();
      if (data) {
        setTaxaPixLocal(Number(data.taxa_pix) || 0);
        setTaxasCartoesLocal(data.taxas_cartoes || {});
        if (data.max_parcelas) setMaxParcelasLocal(Number(data.max_parcelas));
        setConfigCarregadaLocal(true);
      }
    }
    carregar();
  }, [perfil?.salao_id, emContexto]);

  const taxasCartoes   = emContexto ? ctx!.taxasCartoes : taxasCartoesLocal;
  const taxaPix        = emContexto ? ctx!.taxaPix      : taxaPixLocal;
  const maxParcelas    = emContexto ? ctx!.maxParcelas  : maxParcelasLocal;
  const configCarregada = emContexto ? ctx!.configTaxasCarregada : configCarregadaLocal;

  const obterTaxa = useCallback((forma: string, bandeira: string | null): number => {
    const f = String(forma || '').toUpperCase();
    if (f.includes('PIX')) return taxaPix;
    const ehDebito  = f.includes('DÉBIT') || f.includes('DEBIT');
    const ehCredito = f.includes('CRÉDIT') || f.includes('CREDIT');
    if (!ehDebito && !ehCredito) return 0;
    const campo = ehDebito ? 'debito' : 'cred_1';
    const chave = bandeira ? resolverChaveBandeira(bandeira, taxasCartoes) : null;
    if (chave) return parseFloat(taxasCartoes[chave][campo] || '0') || 0;
    return taxaMedia(campo, taxasCartoes);
  }, [taxasCartoes, taxaPix]);

  return { taxasCartoes, taxaPix, maxParcelas, configCarregada, obterTaxa };
}
