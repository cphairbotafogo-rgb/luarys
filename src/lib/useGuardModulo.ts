import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Situacao do modulo para o salao.
 *
 * 'suspenso' e diferente de 'nao_contratado' de proposito: quem pagou e teve o
 * modulo cortado por falta de pagamento precisa ler isso, nao um convite para
 * contratar. Sao acoes diferentes — regularizar contra assinar.
 */
export type StatusModulo = 'carregando' | 'liberado' | 'suspenso' | 'nao_contratado';

export function useStatusModulo(salaoId: string | undefined, moduloChave: string): StatusModulo {
  const [status, setStatus] = useState<StatusModulo>('carregando');

  useEffect(() => {
    if (!salaoId) { setStatus('nao_contratado'); return; }

    Promise.all([
      supabase.from('saloes').select('acesso_total').eq('id', salaoId).maybeSingle(),
      // Sem filtro de ativo aqui — precisa diferenciar "nunca teve registro"
      // de "registro explícito ativo=false" (bloqueio do admin, que sempre
      // vence, mesmo pra módulo normalmente grátis).
      supabase.from('salao_modulos')
        .select('ativo, renovacao_em, aviso_enviado_em, segundo_aviso_enviado_em, cancelamento_agendado')
        .eq('salao_id', salaoId)
        .eq('modulo_chave', moduloChave)
        .maybeSingle(),
      // Módulos sem preço não têm checkout — ficam liberados automaticamente
      // quando não há nenhum registro em salao_modulos pra essa chave.
      supabase.from('modulos_catalogo').select('preco_mensal').eq('chave', moduloChave).eq('ativo', true).maybeSingle(),
    ]).then(([resSalao, resModulo, resCatalogo]) => {
      const acessoTotal = !!resSalao.data?.acesso_total;
      const precoCatalogo = resCatalogo.data?.preco_mensal;
      const moduloGratis = !!resCatalogo.data && (precoCatalogo == null || Number(precoCatalogo) <= 0);
      const reg = resModulo.data as any;
      const liberado = acessoTotal || (reg ? !!reg.ativo : moduloGratis);

      if (liberado) { setStatus('liberado'); return; }

      // Houve contrato e o modulo caiu: so e "suspenso" se o cortе veio da
      // regua de inadimplencia. Cancelamento pedido pelo salao nao e suspensao
      // — ele sabe por que perdeu o acesso, e a mensagem correta e a de
      // contratar de novo.
      const cortadoPorAtraso = !!reg && !reg.ativo && !reg.cancelamento_agendado
        && (!!reg.aviso_enviado_em || !!reg.segundo_aviso_enviado_em);

      setStatus(cortadoPorAtraso ? 'suspenso' : 'nao_contratado');
    });
  }, [salaoId, moduloChave]);

  return status;
}

/**
 * Versao booleana, mantida porque e o que as telas ja consomem.
 * null = carregando | true = liberado | false = bloqueado.
 */
export function useGuardModulo(salaoId: string | undefined, moduloChave: string): boolean | null {
  const status = useStatusModulo(salaoId, moduloChave);
  if (status === 'carregando') return null;
  return status === 'liberado';
}
