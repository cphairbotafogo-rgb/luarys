'use client'
/**
 * src/modules/agenda/modals/fechamento/PainelPagamentoFechamento.tsx
 *
 * Lado direito do Fechamento de Caixa: total a pagar, formas de pagamento
 * (PIX, crédito com bandeiras e parcelas, débito com bandeiras, dinheiro,
 * cheque, pré-pago), resumo e checkboxes finais.
 */
import { useState } from "react";
import { C, brl } from "@/lib/constants";
import { RAIO_SM, RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import {
  FiSmartphone, FiCreditCard, FiCalendar, FiDollarSign, FiFileText, FiGift, FiGlobe, FiZap, FiCheck, FiX
} from "react-icons/fi";
import { BANDEIRAS_CREDITO, BANDEIRAS_DEBITO } from "./tipos";

export function PainelPagamentoFechamento({ dadosCaixa, setDadosCaixa, ui, fidCheckout }: any) {
  const {
    bandeiraCredito, setBandeiraCredito, bandeiraDebito, setBandeiraDebito, maxParcelas,
    handlePagamento, preencherComFalta, handleParcelasChange, handleDataParcelaChange,
    troco, totalIssRetido, imprimirAoFechar, setImprimirAoFechar, taxasCartoes,
  } = ui;

  const temBandeiras = Object.keys(taxasCartoes || {}).length > 0;
  const bandeirasCredito = temBandeiras
    ? Object.keys(taxasCartoes).filter(b => taxasCartoes[b]._ativo !== false && taxasCartoes[b]._tipo !== 'debito')
    : BANDEIRAS_CREDITO;
  const bandeirasDebito = temBandeiras
    ? Object.keys(taxasCartoes).filter(b => taxasCartoes[b]._ativo !== false && taxasCartoes[b]._tipo !== 'credito')
    : BANDEIRAS_DEBITO;

  const [pontosInput, setPontosInput] = useState('');

  // Calcula valor elegível (excluindo serviços bloqueados para desconto de fidelidade)
  const valorElegivel = fidCheckout
    ? dadosCaixa.servicos.reduce((acc: number, s: any) => {
        if (fidCheckout.idsBloqueados.includes(s.item_id)) return acc;
        return acc + ((s.preco * (s.qtd || 1)) - (s.desconto || 0));
      }, 0)
    : 0;
  const maxPontos = fidCheckout
    ? Math.min(fidCheckout.saldo, valorElegivel > 0 ? Math.floor(valorElegivel / fidCheckout.valorPorPonto) : 0)
    : 0;

  function aplicarDescontoFidelidade() {
    if (!fidCheckout) return;
    const pontos = Math.min(Math.max(0, parseInt(pontosInput, 10) || 0), maxPontos);
    const descontoReais = Math.round(pontos * fidCheckout.valorPorPonto * 100) / 100;
    setDadosCaixa((prev: any) => {
      const novosPags = { ...prev.pagamentos, pontosFidelidade: descontoReais };
      const recebido = (novosPags.pix||0) + (novosPags.credito||0) + (novosPags.debito||0)
        + (novosPags.dinheiro||0) + (novosPags.cheque||0) + (novosPags.prePago||0)
        + (novosPags.sinalOnline||0) + (novosPags.pontosFidelidade||0);
      const falta = Math.max(0, prev.total - recebido);
      return { ...prev, pagamentos: novosPags, pontosFidelidadeQtd: pontos, recebido, falta };
    });
    setPontosInput('');
  }

  function removerDescontoFidelidade() {
    setDadosCaixa((prev: any) => {
      const novosPags = { ...prev.pagamentos, pontosFidelidade: 0 };
      const recebido = (novosPags.pix||0) + (novosPags.credito||0) + (novosPags.debito||0)
        + (novosPags.dinheiro||0) + (novosPags.cheque||0) + (novosPags.prePago||0)
        + (novosPags.sinalOnline||0);
      const falta = Math.max(0, prev.total - recebido);
      return { ...prev, pagamentos: novosPags, pontosFidelidadeQtd: 0, recebido, falta };
    });
    setPontosInput('');
  }

  const inputStyle: any = { padding:"10px 12px", borderRadius:8, border:`1px solid ${C.borderMid}`, width:"100%", outlineColor: C.sidebarBg, fontSize: 14, color: C.textMain, fontWeight: 700, boxSizing: 'border-box' };
  const inputNumStyle: any = { ...inputStyle, textAlign: "right" };
  const labelStyle: any = { margin:"0 0 6px", fontSize:11, fontWeight:800, color:C.textMuted, display:"flex", alignItems: "center", gap: 6, textTransform: "uppercase" };
  const miniLabel: any = { margin:"0 0 4px", fontSize:9, fontWeight:800, color:C.textLight, textTransform: "uppercase", letterSpacing: "0.5px" };

  return (
    <div style={{ flex: 1.2, padding: 24, display: "flex", flexDirection: "column", background: C.bgCard, overflowY: "auto" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, paddingBottom: 16, borderBottom: `1px dashed ${C.borderMid}` }}>
        <span className="font-title uppercase tracking-widest" style={{ fontSize: 13, fontWeight: 800, color: C.textMuted }}>Total a Pagar</span>
        <span className="font-title" style={{ fontSize: 32, fontWeight: 900, color: C.sidebarBg }}>{brl(dadosCaixa.total)}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {(dadosCaixa.pagamentos?.sinalOnline > 0) && (
          <div style={{ background: C.successBg, padding: 16, borderRadius: RAIO_MD, border: `1px solid ${C.success}` }}>
            <label style={{...labelStyle, color: C.success}}><FiGlobe size={14} /> Reserva Online (Sinal já pago)</label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: C.successText, fontWeight: 600 }}>Valor abatido automaticamente</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: C.success }}>{brl(dadosCaixa.pagamentos.sinalOnline)}</span>
            </div>
          </div>
        )}

        {fidCheckout && valorElegivel > 0 && (
          <div style={{ background: '#FFFBEB', border: `1px solid #FCD34D`, borderRadius: RAIO_MD, padding: 16 }}>
            <label style={{ ...labelStyle, color: '#92400E' }}><FiZap size={14} color="#D4AF37" /> Pontos de Fidelidade</label>

            {(dadosCaixa.pagamentos?.pontosFidelidade > 0) ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#15803D', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FiCheck size={13} /> {brl(dadosCaixa.pagamentos.pontosFidelidade)} descontado ({dadosCaixa.pontosFidelidadeQtd} pts)
                </span>
                <button onClick={removerDescontoFidelidade} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.danger, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}>
                  <FiX size={12} /> Remover
                </button>
              </div>
            ) : (
              <>
                <p style={{ margin: '0 0 10px', fontSize: 11, color: '#92400E' }}>
                  Saldo: <strong>{fidCheckout.saldo} pts</strong> ({brl(fidCheckout.saldo * fidCheckout.valorPorPonto)}) · Máx. utilizável: <strong>{maxPontos} pts</strong> ({brl(maxPontos * fidCheckout.valorPorPonto)})
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number" min={0} max={maxPontos} placeholder={`Até ${maxPontos} pts`}
                    value={pontosInput}
                    onChange={e => setPontosInput(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: RAIO_SM, border: `1px solid #FCD34D`, fontSize: 13, fontWeight: 700, width: 130, background: '#FFFDE7', outlineColor: '#D4AF37' }}
                  />
                  {pontosInput && parseInt(pontosInput) > 0 && (
                    <span style={{ fontSize: 12, color: '#92400E', fontWeight: 700 }}>
                      = {brl(Math.min(parseInt(pontosInput), maxPontos) * fidCheckout.valorPorPonto)}
                    </span>
                  )}
                  <button
                    onClick={aplicarDescontoFidelidade}
                    disabled={!pontosInput || parseInt(pontosInput) <= 0}
                    style={{ padding: '8px 14px', borderRadius: RAIO_SM, border: 'none', background: '#D4AF37', color: '#fff', fontSize: 12, fontWeight: 800, cursor: (!pontosInput || parseInt(pontosInput) <= 0) ? 'not-allowed' : 'pointer', opacity: (!pontosInput || parseInt(pontosInput) <= 0) ? 0.5 : 1 }}
                  >
                    Aplicar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div>
          <label style={{...labelStyle, cursor: "pointer"}} onClick={() => preencherComFalta('pix')} title="Clique para preencher com o valor que falta receber"><FiSmartphone size={14} color={C.textMain} /> PIX</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: 12, color: C.textLight, fontWeight: 700 }}>R$</span>
            <input type="number" step="0.01" style={{...inputNumStyle, textAlign: "left", paddingLeft: 40}} value={dadosCaixa.pagamentos.pix || ''} onChange={e => handlePagamento('pix', e.target.value)} placeholder="0.00" />
          </div>
        </div>

        <div>
          <label style={{...labelStyle, cursor: "pointer"}} onClick={() => preencherComFalta('credito')} title="Clique para preencher com o valor que falta receber"><FiCreditCard size={14} color={C.sidebarBg} /> Cartão de Crédito</label>
          <input type="number" step="0.01" style={{...inputNumStyle, textAlign: "left"}} value={dadosCaixa.pagamentos.credito || ''} onChange={e => handlePagamento('credito', e.target.value)} placeholder="R$ 0.00" />

          {(dadosCaixa.pagamentos.credito > 0) && (
            <div style={{ background: C.bg, padding: 16, borderRadius: RAIO_MD, marginTop: 8, border: `1px solid ${C.borderMid}` }}>

              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: bandeiraCredito ? C.successText : C.danger, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {bandeiraCredito ? `✓ Bandeira: ${bandeiraCredito}` : "⚠️ Selecione a bandeira *"}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {bandeirasCredito.map(b => (
                    <button key={b} onClick={() => setBandeiraCredito(b)}
                      style={{
                        background: bandeiraCredito === b ? C.sidebarBg : C.bgCard,
                        color: bandeiraCredito === b ? C.bgCard : C.textMain,
                        border: `1.5px solid ${bandeiraCredito === b ? C.sidebarBg : C.borderMid}`,
                        padding: "7px 14px", borderRadius: RAIO_SM, fontSize: 12,
                        fontWeight: 700, cursor: "pointer", transition: "0.2s"
                      }}
                    >{b}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={miniLabel}>Nº de Parcelas:</span>
                <select
                  value={dadosCaixa.pagamentos.parcelas_credito || 1}
                  onChange={e => handleParcelasChange(Number(e.target.value))}
                  style={{ padding: "6px 12px", borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, fontSize: 12, outlineColor: C.sidebarBg, fontFamily: "var(--font-body)", fontWeight: 700, background: C.bgCard, cursor: "pointer", minWidth: 80 }}
                >
                  {Array.from({ length: maxParcelas }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>{num}x</option>
                  ))}
                </select>
              </div>

              {(dadosCaixa.pagamentos.parcelas_credito > 1 && dadosCaixa.pagamentos.detalhe_parcelas) && (
                <div style={{ marginTop: 16, borderTop: `1px dashed ${C.borderMid}`, paddingTop: 16 }}>
                  <p style={{ ...miniLabel, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <FiCalendar size={12}/> Vencimentos e Valores Projetados
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {dadosCaixa.pagamentos.detalhe_parcelas.map((p: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, background: C.bgCard, padding: "8px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}>

                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.bg, color: C.sidebarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>
                          {p.parcela}
                        </div>

                        <span className="font-title" style={{ flex: 1, fontSize: 14, fontWeight: 800, color: C.textMain }}>
                          {brl(p.valor)}
                        </span>

                        <input
                          type="date"
                          value={p.data}
                          onChange={e => handleDataParcelaChange(idx, e.target.value)}
                          style={{ border: `1px solid ${C.borderMid}`, borderRadius: RAIO_SM, padding: "6px 10px", fontSize: 11, color: C.textMuted, outlineColor: C.sidebarBg, fontFamily: "var(--font-body)", fontWeight: 700, cursor: "pointer" }}
                          title="Alterar Data de Vencimento"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label style={{...labelStyle, cursor: "pointer"}} onClick={() => preencherComFalta('debito')} title="Clique para preencher com o valor que falta receber"><FiCreditCard size={14} color={C.textMuted} /> Cartão de Débito</label>
          <input type="number" step="0.01" style={{...inputNumStyle, textAlign: "left"}} value={dadosCaixa.pagamentos.debito || ''} onChange={e => handlePagamento('debito', e.target.value)} placeholder="R$ 0.00" />
          {(dadosCaixa.pagamentos.debito > 0) && (
            <div style={{ background: C.bg, padding: 12, borderRadius: RAIO_MD, marginTop: 8, border: `1px solid ${C.borderMid}` }}>
              <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: bandeiraDebito ? C.successText : C.danger, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {bandeiraDebito ? `✓ Bandeira: ${bandeiraDebito}` : "⚠️ Selecione a bandeira *"}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {bandeirasDebito.map(b => (
                  <button key={b} onClick={() => setBandeiraDebito(b)}
                    style={{
                      background: bandeiraDebito === b ? C.douradoLuarys : C.bgCard,
                      color: bandeiraDebito === b ? C.bgCard : C.textMain,
                      border: `1.5px solid ${bandeiraDebito === b ? C.douradoLuarys : C.borderMid}`,
                      padding: "7px 14px", borderRadius: RAIO_SM, fontSize: 12,
                      fontWeight: 700, cursor: "pointer", transition: "0.2s"
                    }}
                  >{b}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{...labelStyle, cursor: "pointer"}} onClick={() => preencherComFalta('dinheiro')} title="Clique para preencher com o valor que falta receber"><FiDollarSign size={14} color={C.textMain} /> Dinheiro</label>
            <input type="number" step="0.01" style={{...inputNumStyle, textAlign: "left"}} value={dadosCaixa.pagamentos.dinheiro || ''} onChange={e => handlePagamento('dinheiro', e.target.value)} placeholder="R$ 0.00" />
          </div>
          <div>
            <label style={{...labelStyle, cursor: "pointer"}} onClick={() => preencherComFalta('cheque')} title="Clique para preencher com o valor que falta receber"><FiFileText size={14} color={C.textMuted} /> Cheque</label>
            <input type="number" step="0.01" style={{...inputNumStyle, textAlign: "left"}} value={dadosCaixa.pagamentos.cheque || ''} onChange={e => handlePagamento('cheque', e.target.value)} placeholder="R$ 0.00" />
          </div>
        </div>

        <div>
          <label style={{...labelStyle, cursor: "pointer"}} onClick={() => preencherComFalta('prePago')} title="Clique para preencher com o valor que falta receber"><FiGift size={14} color={C.textMuted} /> Pré-Pago (Crédito)</label>
          <input type="number" step="0.01" style={{...inputNumStyle, textAlign: "left"}} value={dadosCaixa.pagamentos.prePago || ''} onChange={e => handlePagamento('prePago', e.target.value)} placeholder="R$ 0.00" />
        </div>
      </div>

      {/* RESUMO */}
      <div style={{ background: dadosCaixa.falta > 0 ? C.bg : C.bgCard, border: `1px solid ${dadosCaixa.falta > 0 ? C.borderMid : C.border}`, borderRadius: RAIO_XL, padding: 16, marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="font-title uppercase tracking-widest" style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>Valor Recebido:</span>
          <span className="font-title" style={{ fontSize: 14, fontWeight: 800, color: C.textMain }}>{brl(dadosCaixa.recebido)}</span>
        </div>

        {totalIssRetido > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="font-title uppercase tracking-widest" style={{ fontSize: 11, fontWeight: 700, color: C.textLight }}>Previsão de ISS (NFS-e):</span>
            <span className="font-title" style={{ fontSize: 12, fontWeight: 700, color: C.textLight }}>{brl(totalIssRetido)}</span>
          </div>
        )}

        {dadosCaixa.falta > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px dashed ${C.borderMid}`, paddingTop: 8 }}>
            <span className="font-title uppercase tracking-widest" style={{ fontSize: 11, fontWeight: 700, color: C.danger }}>Falta Receber:</span>
            <span className="font-title" style={{ fontSize: 16, fontWeight: 800, color: C.danger }}>{brl(dadosCaixa.falta)}</span>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px dashed ${C.borderMid}`, paddingTop: 8 }}>
            <span className="font-title uppercase tracking-widest" style={{ fontSize: 11, fontWeight: 700, color: C.warningText }}>Troco:</span>
            <span className="font-title" style={{ fontSize: 16, fontWeight: 800, color: C.warningText }}>{brl(troco)}</span>
          </div>
        )}
      </div>

      {/* CHECKBOXES */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16, marginBottom: 24 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.textMain }}>
          <input type="checkbox" checked={dadosCaixa.deixarComoDivida} onChange={e => setDadosCaixa({...dadosCaixa, deixarComoDivida: e.target.checked})} style={{ accentColor: C.sidebarBg, width: 16, height: 16 }} />
          Deixar saldo devedor (Fiado)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.textMain }}>
          <input type="checkbox" checked={dadosCaixa.deixarComoGorjeta} onChange={e => setDadosCaixa({...dadosCaixa, deixarComoGorjeta: e.target.checked})} style={{ accentColor: C.sidebarBg, width: 16, height: 16 }} />
          Deixar troco como gorjeta
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.textMain }}>
          <input type="checkbox" checked={imprimirAoFechar} onChange={e => setImprimirAoFechar(e.target.checked)} style={{ accentColor: C.sidebarBg, width: 16, height: 16 }} />
          Imprimir fechamento após salvar
        </label>
      </div>

      <div style={{ marginBottom: 24 }}>
        <p style={miniLabel}>COMENTÁRIO DO FECHAMENTO</p>
        <textarea
          value={dadosCaixa.comentario}
          onChange={e => setDadosCaixa({...dadosCaixa, comentario: e.target.value})}
          style={{ width: "100%", padding: 10, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 12, outlineColor: C.sidebarBg, resize: "none", height: 60, fontFamily: "var(--font-body)", boxSizing: 'border-box' }}
        />
      </div>
    </div>
  );
}
