'use client'
/**
 * src/modules/agenda/modals/ModalFechamentoCaixa.tsx
 *
 * Shell do modal de Fechamento de Caixa. Mantém o layout (header + dois
 * painéis lado a lado) e os botões finais; toda a lógica de estado vive em
 * fechamento/useFechamentoUI.ts, e cada painel é um arquivo próprio em
 * fechamento/. Dividido a partir de um arquivo único de ~900 linhas,
 * seguindo o padrão de divisão de arquivos do Luarys.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { RAIO_MD, RAIO_2XL } from "@/lib/estiloGlobal";
import { FiX, FiDollarSign, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";
import { useFechamentoUI } from "./fechamento/useFechamentoUI";
import { PainelItensFechamento } from "./fechamento/PainelItensFechamento";
import { PainelPagamentoFechamento } from "./fechamento/PainelPagamentoFechamento";

export function ModalFechamentoCaixa({
  perfil,
  dadosCaixa,
  setDadosCaixa,
  servicosDb = [],
  profissionaisDb = [],
  produtosDb = [],
  clientesDb = [],
  onClose,
  onFinalizar,
  adicionarItemAvulsoCaixa
}: any) {
  const ui = useFechamentoUI({ perfil, dadosCaixa, setDadosCaixa, clientesDb, servicosDb, produtosDb, onFinalizar });

  const [maxParcelas, setMaxParcelas] = useState<number>(12);
  useEffect(() => {
    if (!perfil?.salao_id) return;
    supabase.from('config_taxas').select('max_parcelas')
      .eq('salao_id', perfil.salao_id).maybeSingle()
      .then(({ data }) => { if (data?.max_parcelas) setMaxParcelas(Number(data.max_parcelas)); });
  }, [perfil?.salao_id]);

  const [dividaCliente, setDividaCliente] = useState<number>(0);
  useEffect(() => {
    if (!perfil?.salao_id || !dadosCaixa.clienteNome) { setDividaCliente(0); return; }
    supabase
      .from('financeiro')
      .select('valor')
      .eq('salao_id', perfil.salao_id)
      .eq('cliente_nome', dadosCaixa.clienteNome)
      .in('status', ['Pendente', 'pendente', 'Em Aberto', 'em_aberto'])
      .eq('tipo', 'entrada')
      .then(({ data }) => {
        const total = (data || []).reduce((acc: number, r: any) => acc + Number(r.valor || 0), 0);
        setDividaCliente(total);
      });
  }, [perfil?.salao_id, dadosCaixa.clienteNome]);

  const [fidCheckout, setFidCheckout] = useState<any>(null);
  useEffect(() => {
    if (!perfil?.salao_id || !dadosCaixa.clienteId) { setFidCheckout(null); return; }
    async function carregar() {
      const [{ data: cfg }, { data: saldoRows }, { data: bloqueados }] = await Promise.all([
        supabase.from('fidelidade_config')
          .select('ativo, permite_desconto_valor, valor_por_ponto')
          .eq('salao_id', perfil.salao_id).maybeSingle(),
        supabase.from('fidelidade_transacoes')
          .select('pontos').eq('salao_id', perfil.salao_id).eq('cliente_id', dadosCaixa.clienteId),
        supabase.from('fidelidade_servicos_bloqueados')
          .select('servico_id').eq('salao_id', perfil.salao_id),
      ]);
      if (!cfg?.ativo || !cfg?.permite_desconto_valor) { setFidCheckout(null); return; }
      const saldo = Math.max(0, (saldoRows || []).reduce((acc: number, t: any) => acc + t.pontos, 0));
      setFidCheckout({
        valorPorPonto: Number(cfg.valor_por_ponto),
        saldo,
        idsBloqueados: (bloqueados || []).map((b: any) => b.servico_id),
      });
    }
    carregar();
  }, [perfil?.salao_id, dadosCaixa.clienteId]);

  const { salvando, podeFinalizar, processarFechamento, dropdownRef } = ui;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 24 }} className="font-body">
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, width: "100%", maxWidth: 1050, maxHeight: "95vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", overflow: "hidden" }}>

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
          <h2 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8 }}>
            <FiDollarSign size={20} /> Fechamento de Conta
          </h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.textLight, cursor: "pointer" }} className="transition-all hover:opacity-70"><FiX size={24} /></button>
        </div>

        {dividaCliente > 0 && (
          <div style={{ background: "#FEF2F2", borderBottom: `2px solid #EF4444`, padding: "12px 24px", display: "flex", alignItems: "center", gap: 10 }}>
            <FiAlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0 }} />
            <span style={{ color: "#991B1B", fontWeight: 700, fontSize: 13 }}>
              Saldo devedor em aberto:
            </span>
            <span style={{ color: "#EF4444", fontWeight: 800, fontSize: 14 }}>
              {brl(dividaCliente)}
            </span>
            <span style={{ color: "#B91C1C", fontSize: 12, marginLeft: 4 }}>
              — Cobrar neste atendimento ou registrar novo pagamento parcial.
            </span>
          </div>
        )}

        <div ref={dropdownRef} style={{ display: "flex", flex: 1, overflowY: "hidden" }}>
          <PainelItensFechamento
            dadosCaixa={dadosCaixa}
            servicosDb={servicosDb}
            produtosDb={produtosDb}
            profissionaisDb={profissionaisDb}
            adicionarItemAvulsoCaixa={adicionarItemAvulsoCaixa}
            ui={ui}
          />
          <PainelPagamentoFechamento
            dadosCaixa={dadosCaixa}
            setDadosCaixa={setDadosCaixa}
            ui={ui}
            maxParcelas={maxParcelas}
            fidCheckout={fidCheckout}
          />
        </div>

        {/* BOTÕES FINAIS */}
        <div style={{ padding: "20px 24px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 12, background: C.bgCard }}>
          <button onClick={onClose} disabled={salvando} className="transition-all hover:bg-slate-50" style={{ flex: 1, padding: "14px", background: C.bgCard, border: `1px solid ${C.borderMid}`, color: C.textMain, borderRadius: RAIO_MD, fontWeight: 700, fontSize: 13, cursor: salvando ? "not-allowed" : "pointer" }}>Cancelar</button>
          <button
            disabled={!podeFinalizar || salvando}
            onClick={processarFechamento}
            style={{ flex: 1.5, padding: "14px", background: (podeFinalizar && !salvando) ? C.sidebarBg : C.borderMid, color: C.bgCard, border: "none", borderRadius: RAIO_MD, fontWeight: 800, fontSize: 13, cursor: (podeFinalizar && !salvando) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "0.2s" }}
            className="hover:opacity-90"
          >
            {salvando ? "A processar..." : <><FiCheckCircle size={18}/> Fechar Conta</>}
          </button>
        </div>
      </div>
    </div>
  );
}
