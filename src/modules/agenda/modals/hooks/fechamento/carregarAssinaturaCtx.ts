import { supabase } from "@/lib/supabase";
import type { AssinaturaCtx } from "./calcularItensFechamento";

// Monta o contexto de assinaturas ativas do cliente para o fechamento aplicar
// os serviços inclusos (Clube). Retorna null quando não há assinatura.
export async function carregarAssinaturaCtx(salaoId: string, clienteId: string | null): Promise<AssinaturaCtx | null> {
  if (!clienteId) return null;
  const d = new Date();
  const mesRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const [rSubs, rCons, rServCat] = await Promise.all([
    supabase.from('assinaturas_cliente')
      .select('id, profissionais_area, planos_assinatura_cliente(preco_mensal, servicos_inclusos)')
      .eq('salao_id', salaoId).eq('cliente_id', clienteId).eq('status', 'ativa'),
    supabase.from('consumos_assinatura').select('assinatura_id, servico_id')
      .eq('salao_id', salaoId).eq('mes_referencia', mesRef),
    supabase.from('servicos').select('id, categoria').eq('salao_id', salaoId),
  ]);
  const subs = rSubs.data || [];
  if (subs.length === 0) return null;

  const categoriaPorServico: Record<string, string> = {};
  (rServCat.data || []).forEach((s: any) => { categoriaPorServico[s.id] = s.categoria || 'Geral'; });

  const consumoInicial: Record<string, number> = {};
  (rCons.data || []).forEach((c: any) => {
    const k = `${c.assinatura_id}|${c.servico_id}`;
    consumoInicial[k] = (consumoInicial[k] || 0) + 1;
  });

  const subscriptions = subs.map((sub: any) => {
    const plano = sub.planos_assinatura_cliente || {};
    const inclusos: Record<string, number> = {};
    let valorCheio = 0;
    (plano.servicos_inclusos || []).forEach((si: any) => {
      inclusos[si.servico_id] = Number(si.qtd_mes) || 1;
      valorCheio += (Number(si.preco) || 0) * (Number(si.qtd_mes) || 1);
    });
    const profArea: Record<string, string> = {};
    (sub.profissionais_area || []).forEach((pa: any) => { profArea[pa.categoria] = pa.profissional_id; });
    return { assinatura_id: sub.id, preco_mensal: Number(plano.preco_mensal) || 0, valor_cheio: valorCheio, inclusos, profArea };
  });

  return { subscriptions, consumoInicial, categoriaPorServico };
}
