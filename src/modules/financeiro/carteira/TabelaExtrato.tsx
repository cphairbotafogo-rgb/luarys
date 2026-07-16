'use client'
import { C, brl } from "@/lib/constants";
import { cardAdmin, RAIO_MD, RAIO_XS } from "@/lib/estiloGlobal";
import { FiArrowUp, FiArrowDown, FiChevronLeft, FiPlus, FiX } from "react-icons/fi";
import { avatar, sinalValor } from "./tipos";
import type { Entrada, ClienteCarteira } from "./tipos";

function badgeTipo(tipo: Entrada['tipo']) {
  const conf: Record<string, { label: string; bg: string; cor: string }> = {
    deposito: { label: "Depósito",  bg: "#D1FAE5", cor: "#065F46" },
    uso:      { label: "Uso",       bg: "#FEF3C7", cor: "#92400E" },
    estorno:  { label: "Estorno",   bg: "#FEE2E2", cor: "#991B1B" },
  };
  const s = conf[tipo];
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: RAIO_XS, background: s.bg, color: s.cor }}>
      {s.label}
    </span>
  );
}

interface Props {
  clienteSel: ClienteCarteira;
  extrato: Entrada[];
  onVoltar: () => void;
  onDepositar: () => void;
  onEstornar: (e: Entrada) => void;
}

export function TabelaExtrato({ clienteSel, extrato, onVoltar, onDepositar, onEstornar }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...cardAdmin, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20 }}>
        <button onClick={onVoltar} style={{ background: C.bg, border: `1px solid ${C.border}`, padding: "8px 12px", borderRadius: RAIO_MD, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: C.textMuted }}>
          <FiChevronLeft size={15} /> Voltar
        </button>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${C.sidebarBg}18`, color: C.sidebarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, flexShrink: 0 }}>
          {avatar(clienteSel.cliente_nome)}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.textMain }}>{clienteSel.cliente_nome}</h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>Extrato da Carteira Digital</p>
        </div>
        <div style={{ textAlign: "right", paddingRight: 8, borderRight: `1px solid ${C.border}`, marginRight: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Saldo Atual</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: clienteSel.saldo > 0 ? "#10B981" : C.danger }}>{brl(clienteSel.saldo)}</div>
        </div>
        <button onClick={onDepositar} style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "10px 20px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase" }}>
          <FiPlus size={14} /> Depositar
        </button>
      </div>

      <div style={{ ...cardAdmin, overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.borderMid}`, background: C.bg }}>
          <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>
            Movimentações — {extrato.length} registro(s)
          </h4>
        </div>
        {extrato.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: C.textMuted, fontSize: 13 }}>Sem movimentações.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: C.bg }}>
              <tr>
                <th style={{ padding: "11px 24px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "left" }}>Data</th>
                <th style={{ padding: "11px 12px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Tipo</th>
                <th style={{ padding: "11px 12px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "left" }}>Descrição</th>
                <th style={{ padding: "11px 12px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Forma de Pagamento</th>
                <th style={{ padding: "11px 24px", fontSize: 10, fontWeight: 700, color: C.sidebarBg, textTransform: "uppercase", textAlign: "right" }}>Valor</th>
                <th style={{ padding: "11px 24px", width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {extrato.map(e => {
                const sinal = sinalValor(e.tipo);
                return (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "13px 24px", fontSize: 12, color: C.textMuted }}>{new Date(e.created_at).toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: "13px 12px", textAlign: "center" }}>{badgeTipo(e.tipo)}</td>
                    <td style={{ padding: "13px 12px", fontSize: 13, color: C.textMain }}>{e.descricao || "—"}</td>
                    <td style={{ padding: "13px 12px", fontSize: 12, color: C.textMuted, textAlign: "center" }}>{e.forma_pagamento || "—"}</td>
                    <td style={{ padding: "13px 24px", textAlign: "right", fontWeight: 800, fontSize: 14, color: sinal > 0 ? "#10B981" : C.danger }}>
                      {sinal > 0 ? <FiArrowUp size={12} style={{ marginRight: 3 }} /> : <FiArrowDown size={12} style={{ marginRight: 3 }} />}
                      {brl(e.valor)}
                    </td>
                    <td style={{ padding: "13px 24px" }}>
                      {e.tipo === 'deposito' && (
                        <button title="Estornar depósito" onClick={() => onEstornar(e)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 4, borderRadius: RAIO_XS, display: "flex" }}
                          className="hover:text-red-500">
                          <FiX size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
