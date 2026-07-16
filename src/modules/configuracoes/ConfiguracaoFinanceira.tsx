'use client'
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";

export function ConfiguracaoFinanceira({
  cobrarSinal, setCobrarSinal,
  porcentagemSinal, setPorcentagemSinal,
  prazoSinalMinutos, setPrazoSinalMinutos,
  gatewayPagamento, setGatewayPagamento,
  tokenPagamento, setTokenPagamento
}: any) {

  // ─── REFINAMENTO DOS ESTILOS (Clean & Clinical) ───
  const inputStyle = { 
    padding: "12px 14px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, 
    width: "100%", boxSizing: "border-box" as const, outlineColor: C.sidebarBg, 
    fontSize: 13, color: C.textMain, backgroundColor: C.bgCard, fontFamily: "var(--font-body)", fontWeight: 500 
  };
  
  const labelStyle = { 
    margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: C.textMuted, 
    display: "block", textTransform: "uppercase" as const, letterSpacing: "0.5px", fontFamily: "var(--font-title)" 
  };

  return (
    <Card className="shadow-sm" style={{ padding: 32, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.sidebarBg}` }}>
      <div className="font-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: cobrarSinal ? 24 : 0 }}>
        <div>
          <h3 className="font-title uppercase tracking-widest" style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: C.sidebarBg }}>
            Garantia de Reserva Automática (No-Show)
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted, fontWeight: 500 }}>
            Exija um adiantamento via PIX no portal da cliente e confirme o agendamento de forma automática.
          </p>
        </div>
        
        {/* INTERRUPTOR (TOGGLE) PREMIUM */}
        <label style={{ display: "flex", alignItems: "center", cursor: "pointer", position: "relative" }}>
          <input 
            type="checkbox" 
            checked={cobrarSinal} 
            onChange={(e) => setCobrarSinal(e.target.checked)}
            style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
          />
          <div style={{ width: 44, height: 22, background: cobrarSinal ? C.sidebarBg : C.borderMid, borderRadius: 24, position: "relative", transition: "0.3s" }}>
            <div style={{ width: 16, height: 16, background: C.bgCard, borderRadius: "50%", position: "absolute", top: 3, left: cobrarSinal ? 25 : 3, transition: "0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.15)" }} />
          </div>
        </label>
      </div>

      {cobrarSinal && (
        <div className="font-body" style={{ background: C.bg, padding: 24, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 20, marginTop: 16 }}>
          
          {/* SELEÇÃO DA PORCENTAGEM */}
          <div>
            <label className="font-title" style={labelStyle}>Qual a porcentagem a cobrar antecipadamente?</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              {[10, 15, 20, 25, 30].map(valor => (
                <button
                  key={valor} type="button" onClick={() => setPorcentagemSinal(valor)}
                  className="transition-all hover:bg-slate-100"
                  style={{
                    padding: "10px 20px", borderRadius: RAIO_MD,
                    border: porcentagemSinal === valor ? `2px solid ${C.sidebarBg}` : `1px solid ${C.borderMid}`,
                    background: porcentagemSinal === valor ? C.bg : C.bgCard,
                    color: porcentagemSinal === valor ? C.sidebarBg : C.textLight,
                    fontWeight: 700, cursor: "pointer", transition: "0.2s",
                    fontSize: 12, fontFamily: "var(--font-title)"
                  }}
                >
                  {valor}%
                </button>
              ))}
            </div>
          </div>

          {/* PRAZO DE PAGAMENTO */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
            <label className="font-title" style={labelStyle}>Prazo para o cliente pagar o sinal</label>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: C.textLight }}>
              Após confirmar, o horário fica reservado por esse tempo. Se não houver pagamento, o slot é liberado automaticamente.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[10, 15, 20, 30, 45, 60].map(min => (
                <button
                  key={min} type="button" onClick={() => setPrazoSinalMinutos(min)}
                  className="transition-all hover:bg-slate-100"
                  style={{
                    padding: "10px 20px", borderRadius: RAIO_MD,
                    border: prazoSinalMinutos === min ? `2px solid ${C.sidebarBg}` : `1px solid ${C.borderMid}`,
                    background: prazoSinalMinutos === min ? C.bg : C.bgCard,
                    color: prazoSinalMinutos === min ? C.sidebarBg : C.textLight,
                    fontWeight: 700, cursor: "pointer", transition: "0.2s",
                    fontSize: 12, fontFamily: "var(--font-title)"
                  }}
                >
                  {min} min
                </button>
              ))}
            </div>
          </div>

          {/* SELEÇÃO DO BANCO/GATEWAY E TOKEN */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
            <div>
              <label className="font-title" style={labelStyle}>Processador de Pagamento</label>
              <select 
                value={gatewayPagamento} 
                onChange={e => setGatewayPagamento(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="mercadopago">Mercado Pago</option>
                <option value="infinitepay">InfinitePay</option>
              </select>
            </div>
            <div>
              <label className="font-title" style={{...labelStyle, color: C.danger}}>Token de Integração (API Key) *</label>
              <input 
                type="password" 
                placeholder={`Cole aqui o seu Access Token do ${gatewayPagamento === 'mercadopago' ? 'Mercado Pago' : 'InfinitePay'}`}
                value={tokenPagamento} 
                onChange={e => setTokenPagamento(e.target.value)}
                style={{ ...inputStyle, borderColor: tokenPagamento ? C.borderMid : "#FECACA" }} 
              />
              <p style={{ margin: "6px 0 0", fontSize: 12, color: C.textLight, fontWeight: 500 }}>
                O valor transacionado será depositado diretamente na sua conta vinculada do {gatewayPagamento === 'mercadopago' ? 'Mercado Pago' : 'InfinitePay'}.
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}