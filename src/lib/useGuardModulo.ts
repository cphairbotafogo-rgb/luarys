import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Verifica se o salão tem o módulo ativo.
 * Retorna: null = carregando | true = liberado | false = bloqueado
 */
export function useGuardModulo(salaoId: string | undefined, moduloChave: string): boolean | null {
  const [liberado, setLiberado] = useState<boolean | null>(null);

  useEffect(() => {
    if (!salaoId) { setLiberado(false); return; }

    Promise.all([
      supabase.from('saloes').select('acesso_total').eq('id', salaoId).maybeSingle(),
      supabase.from('salao_modulos')
        .select('ativo')
        .eq('salao_id', salaoId)
        .eq('modulo_chave', moduloChave)
        .eq('ativo', true)
        .maybeSingle(),
      // Módulos sem preço não têm checkout — ficam liberados automaticamente,
      // sem depender de uma linha em salao_modulos (nunca é criada pra eles).
      supabase.from('modulos_catalogo').select('preco_mensal').eq('chave', moduloChave).eq('ativo', true).maybeSingle(),
    ]).then(([resSalao, resModulo, resCatalogo]) => {
      const acessoTotal = !!resSalao.data?.acesso_total;
      const moduloAtivo = !!resModulo.data;
      const precoCatalogo = resCatalogo.data?.preco_mensal;
      const moduloGratis = !!resCatalogo.data && (precoCatalogo == null || Number(precoCatalogo) <= 0);
      setLiberado(acessoTotal || moduloAtivo || moduloGratis);
    });
  }, [salaoId, moduloChave]);

  return liberado;
}
