'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  SaldoWhatsapp, PacoteWhatsapp, ConsumoAgrupado,
  MeioPagamento, NivelSaldo, calcularNivelSaldo,
} from './tipos';

interface UseCarteiraWhatsappRetorno {
  saldo: SaldoWhatsapp | null;
  pacotes: PacoteWhatsapp[];
  consumoMes: ConsumoAgrupado[];
  nivelAtendimento: NivelSaldo | null;
  nivelCampanha: NivelSaldo | null;
  carregando: boolean;
  comprando: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  comprarPacote: (pacoteId: string, meioPagamento: MeioPagamento) => Promise<boolean>;
}

/**
 * Gerencia a carteira pré-paga de créditos WhatsApp do salão autenticado.
 * A compra só credita o saldo após confirmação do gateway de pagamento —
 * este hook assume que o pagamento já foi confirmado antes de chamar comprarPacote.
 */
export function useCarteiraWhatsapp(): UseCarteiraWhatsappRetorno {
  const [saldo, setSaldo]         = useState<SaldoWhatsapp | null>(null);
  const [pacotes, setPacotes]     = useState<PacoteWhatsapp[]>([]);
  const [consumoMes, setConsumoMes] = useState<ConsumoAgrupado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [comprando, setComprando]   = useState(false);
  const [erro, setErro]             = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const [saldoResp, pacotesResp, consumoResp] = await Promise.all([
      supabase.rpc('obter_saldo_whatsapp'),
      supabase.from('whatsapp_pacotes').select('id, tipo, quantidade, preco').eq('ativo', true).order('quantidade'),
      supabase.rpc('obter_consumo_whatsapp_mes'),
    ]);

    if (saldoResp.error) {
      setErro('Erro ao carregar saldo: ' + saldoResp.error.message);
      setCarregando(false);
      return;
    }
    if (pacotesResp.error) {
      setErro('Erro ao carregar pacotes: ' + pacotesResp.error.message);
      setCarregando(false);
      return;
    }

    const linhaSaldo = Array.isArray(saldoResp.data) ? saldoResp.data[0] : saldoResp.data;
    setSaldo(linhaSaldo
      ? { saldoAtendimento: linhaSaldo.saldo_atendimento, saldoCampanha: linhaSaldo.saldo_campanha }
      : { saldoAtendimento: 0, saldoCampanha: 0 }
    );

    setPacotes((pacotesResp.data ?? []).map((p: any) => ({
      id: p.id, tipo: p.tipo, quantidade: p.quantidade, preco: p.preco,
    })));

    setConsumoMes((consumoResp.data ?? []).map((linha: any) => ({
      categoria: linha.categoria, origem: linha.origem,
      quantidade: linha.quantidade, custoTotal: linha.custo_total,
    })));

    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const comprarPacote = useCallback(
    async (pacoteId: string, meioPagamento: MeioPagamento): Promise<boolean> => {
      setComprando(true);
      setErro(null);

      // p_salao_id não é necessário aqui porque a RPC usa auth_salao_id() internamente
      // (ver migrations/003_whatsapp_carteira_creditos.sql — assinatura sem p_salao_id)
      const { error } = await supabase.rpc('comprar_pacote_whatsapp', {
        p_pacote_id:      pacoteId,
        p_meio_pagamento: meioPagamento,
      });

      setComprando(false);

      if (error) { setErro(error.message); return false; }

      await carregar();
      return true;
    },
    [carregar],
  );

  return {
    saldo, pacotes, consumoMes,
    nivelAtendimento: saldo ? calcularNivelSaldo(saldo.saldoAtendimento) : null,
    nivelCampanha:    saldo ? calcularNivelSaldo(saldo.saldoCampanha)    : null,
    carregando, comprando, erro,
    recarregar: carregar,
    comprarPacote,
  };
}
