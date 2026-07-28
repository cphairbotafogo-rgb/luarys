// src/lib/useAvisoFinanceiroCliente.ts
//
// Aviso leve de débito/crédito do cliente, pra recepção e caixa serem
// avisados no momento de agendar e no fechamento de conta — não é o
// relatório oficial (isso é "Clientes em Débito"/"Crédito de Cliente" em
// Relatórios), só um sinal rápido na tela onde a ação acontece.
//
// Crédito depende da tabela `creditos_clientes`, que ainda não existe no
// banco (módulo planejado, não construído) — por isso a consulta é
// tolerante a erro 42P01 e simplesmente não mostra nada até a tabela
// existir de verdade, sem quebrar o aviso de débito.
'use client'
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface AvisoFinanceiroCliente {
  temDebito: boolean;
  valorDebito: number;
  temCredito: boolean;
  valorCredito: number;
}

const STATUS_PENDENTE = ['Pendente', 'pendente', 'Em Aberto', 'em_aberto'];

export function useAvisoFinanceiroCliente(
  clienteId: string | null | undefined,
  clienteNome: string | null | undefined,
  salaoId: string | null | undefined
) {
  const [aviso, setAviso] = useState<AvisoFinanceiroCliente | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!salaoId || (!clienteId && !clienteNome)) { setAviso(null); return; }

    (async () => {
      const [resFin, resAg, resPagos, resCredito] = await Promise.all([
        clienteNome
          ? supabase.from('financeiro').select('valor').eq('salao_id', salaoId).eq('tipo', 'entrada')
              .in('status', STATUS_PENDENTE).ilike('cliente_nome', clienteNome)
          : Promise.resolve({ data: [] as any[] }),
        clienteId
          ? supabase.from('agendamentos').select('id, valor_final').eq('salao_id', salaoId).eq('cliente_id', clienteId)
              .eq('status', 'Finalizado').gt('valor_final', 0)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('financeiro').select('agendamento_ids').eq('salao_id', salaoId).eq('tipo', 'entrada')
          .neq('status', 'Estornado').not('agendamento_ids', 'is', null),
        clienteId
          ? supabase.from('creditos_clientes').select('valor').eq('salao_id', salaoId).eq('cliente_id', clienteId).eq('status', 'ativo')
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (!ativo) return;

      const idsPagos = new Set<string>();
      (resPagos.data || []).forEach((f: any) => {
        if (Array.isArray(f.agendamento_ids)) f.agendamento_ids.forEach((id: string) => idsPagos.add(id));
      });

      const valorFin = (resFin.data || []).reduce((s: number, f: any) => s + (Number(f.valor) || 0), 0);
      const valorAg = (resAg.data || [])
        .filter((ag: any) => !idsPagos.has(ag.id))
        .reduce((s: number, ag: any) => s + (Number(ag.valor_final) || 0), 0);
      const valorDebito = valorFin + valorAg;

      // Sem checagem de `error` aqui de propósito: se a tabela não existir
      // ainda (42P01), o Supabase retorna data null e o crédito fica 0 —
      // exatamente o comportamento desejado (aviso silencioso, sem crash).
      const valorCredito = (resCredito.data || []).reduce((s: number, c: any) => s + (Number(c.valor) || 0), 0);

      setAviso({ temDebito: valorDebito > 0, valorDebito, temCredito: valorCredito > 0, valorCredito });
    })();

    return () => { ativo = false; };
  }, [clienteId, clienteNome, salaoId]);

  return aviso;
}
