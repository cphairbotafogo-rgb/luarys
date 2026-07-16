/**
 * Carrega/salva a preferência de ordem e itens ocultos da Sidebar para o
 * login atual. Nunca decide permissão — isso continua 100% em
 * lib/permissoes.ts e em ItemSidebar.condicao(). Esta camada só decora o
 * que o login já pode ver.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface PreferenciasSidebar {
  ordem: string[];
  ocultos: string[];
}

const PREFERENCIAS_VAZIAS: PreferenciasSidebar = { ordem: [], ocultos: [] };

export function usePreferenciasSidebar(usuarioId: string | undefined) {
  const [preferencias, setPreferencias] = useState<PreferenciasSidebar>(PREFERENCIAS_VAZIAS);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!usuarioId) return;
    let cancelado = false;

    supabase
      .from('preferencias_sidebar')
      .select('ordem, ocultos')
      .eq('usuario_id', usuarioId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error && process.env.NODE_ENV === 'development') console.error('[usePreferenciasSidebar] Falha ao carregar:', error);
        else if (data) setPreferencias({ ordem: data.ordem || [], ocultos: data.ocultos || [] });
      });

    return () => { cancelado = true; };
  }, [usuarioId]);

  const salvar = useCallback(async (novas: PreferenciasSidebar) => {
    if (!usuarioId) return;
    setSalvando(true);
    setPreferencias(novas); // atualização otimista

    const { error } = await supabase
      .from('preferencias_sidebar')
      .upsert({
        usuario_id: usuarioId,
        ordem: novas.ordem,
        ocultos: novas.ocultos,
        atualizado_em: new Date().toISOString(),
      });

    if (error && process.env.NODE_ENV === 'development') console.error('[usePreferenciasSidebar] Falha ao salvar:', error);
    setSalvando(false);
  }, [usuarioId]);

  function alternarOculto(itemId: string) {
    const jaOculto = preferencias.ocultos.includes(itemId);
    const novos: PreferenciasSidebar = {
      ...preferencias,
      ocultos: jaOculto ? preferencias.ocultos.filter(id => id !== itemId) : [...preferencias.ocultos, itemId],
    };
    salvar(novos);
  }

  function reordenar(novaOrdem: string[]) {
    salvar({ ...preferencias, ordem: novaOrdem });
  }

  function restaurar() {
    // Um único save — sem risco de closure stale
    salvar(PREFERENCIAS_VAZIAS);
  }

  return { preferencias, salvando, alternarOculto, reordenar, restaurar };
}
