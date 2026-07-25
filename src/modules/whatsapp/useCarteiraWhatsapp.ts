'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

  // Pagamento acontece em outra aba (checkout abre com window.open) — ao
  // voltar para esta, recarrega o saldo pra refletir a ativação feita pelo
  // webhook do Asaas.
  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;
  useEffect(() => {
    function aoFocar() { carregarRef.current(); }
    window.addEventListener('focus', aoFocar);
    return () => window.removeEventListener('focus', aoFocar);
  }, []);

  const comprarPacote = useCallback(
    async (pacoteId: string, meioPagamento: MeioPagamento): Promise<boolean> => {
      setComprando(true);
      setErro(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setComprando(false);
        setErro('Sessão expirada. Faça login novamente.');
        return false;
      }

      // O saldo só é creditado quando o webhook do Asaas confirmar o
      // pagamento — ver /api/whatsapp/comprar-creditos e
      // src/lib/whatsappCreditos.ts.
      const res = await fetch('/api/whatsapp/comprar-creditos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pacoteId, meioPagamento }),
      });
      const json = await res.json().catch(() => ({}));

      setComprando(false);

      if (!res.ok || !json.checkoutUrl) { setErro(json.erro || 'Não foi possível processar a compra.'); return false; }

      window.open(json.checkoutUrl, '_blank');
      return true;
    },
    [],
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
