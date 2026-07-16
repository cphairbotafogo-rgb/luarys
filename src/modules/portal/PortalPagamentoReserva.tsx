'use client'
import { useState, useEffect, useRef } from "react";
import { C, brl } from "@/lib/constants";
import { FONTE_CORPO, FONTE_TITULO, cardConteudo, botaoPrimario, SOMBRA_SUAVE } from "./estiloPortal";
import { RAIO_MD, RAIO_LG } from "@/lib/estiloGlobal";

// Intervalo de polling: 5 segundos
const INTERVALO_POLLING_MS = 5000;

export function PortalPagamentoReserva({ salaoSelecionado, servicoEscolhido, clienteNome, aceitouTermos, setAceitouTermos, salvando, confirmarAgendamento }: any) {
  const prazoMinutos: number = salaoSelecionado?.prazo_sinal_minutos ?? 20;
  const expiracaoMs = prazoMinutos * 60 * 1000;

  const [etapa, setEtapa] = useState<'resumo' | 'aguardando' | 'expirado'>('resumo');
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState('');
  const [carregandoPagamento, setCarregandoPagamento] = useState(false);
  const [dadosPagamento, setDadosPagamento] = useState<any>(null);
  const [agendamentoId, setAgendamentoId] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  // Countdown regressivo — inicia quando o pagamento está aguardando
  useEffect(() => {
    if (etapa !== 'aguardando') return;
    setSegundosRestantes(prazoMinutos * 60);
    const tick = setInterval(() => {
      setSegundosRestantes(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [etapa]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiracaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmadoRef = useRef(false);

  // Limpa timers ao desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (expiracaoRef.current) clearTimeout(expiracaoRef.current);
    };
  }, []);

  const cobrarSinal = salaoSelecionado?.cobrar_sinal;
  const porcentagem = salaoSelecionado?.porcentagem_sinal || 30;
  const valorTotal = servicoEscolhido?.preco_padrao || 0;
  const valorSinal = Math.round(valorTotal * (porcentagem / 100) * 100) / 100;

  // Verifica o pagamento na API e confirma o agendamento se aprovado
  async function verificarPagamento(dados: any, agId: string) {
    if (confirmadoRef.current) return;
    setVerificando(true);

    try {
      const body: any = { salao_id: salaoSelecionado.id, gateway: dados.gateway };

      if (dados.gateway === 'infinitepay') {
        body.order_nsu = dados.orderNsu;
        body.slug = dados.slug;
      } else if (dados.gateway === 'mercadopago') {
        body.id_transacao = dados.idTransacao;
      } else if (dados.gateway === 'simulador') {
        body.id_transacao = dados.idTransacao;
      }

      const res = await fetch('/api/pagamentos/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const resultado = await res.json();

      if (resultado.aprovado && !confirmadoRef.current) {
        confirmadoRef.current = true;
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (expiracaoRef.current) clearTimeout(expiracaoRef.current);
        await confirmarAgendamento('Confirmado');
      }
    } catch { /* ignora erros de rede, tenta na próxima iteração */ }

    setVerificando(false);
  }

  function iniciarPolling(dados: any, agId: string) {
    confirmadoRef.current = false;

    // Primeira verificação imediata (simulador aprova instantaneamente)
    verificarPagamento(dados, agId);

    pollingRef.current = setInterval(() => {
      verificarPagamento(dados, agId);
    }, INTERVALO_POLLING_MS);

    // Para o polling após 15 min e marca como expirado
    expiracaoRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (!confirmadoRef.current) setEtapa('expirado');
    }, expiracaoMs);
  }

  async function handleReservar() {
    if (!aceitouTermos) {
      setErro("Aceite os termos de reserva para continuar.");
      return;
    }
    setErro('');
    setCarregandoPagamento(true);

    // 1. Cria o agendamento com status 'Aguardando'
    const agId = await confirmarAgendamento(null);
    if (!agId) {
      setCarregandoPagamento(false);
      return;
    }
    setAgendamentoId(agId);

    // 2. Gera o link/QR de pagamento real
    try {
      const res = await fetch('/api/pagamentos/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salao_id: salaoSelecionado.id,
          valor: valorSinal,
          cliente_nome: clienteNome,
          servico_nome: servicoEscolhido?.nome_servico,
          agendamento_id: agId,
        }),
      });
      const dados = await res.json();

      if (res.ok && dados.sucesso) {
        setDadosPagamento(dados);
        setEtapa('aguardando');
        iniciarPolling(dados, agId);
      } else {
        setErro(dados.erro || 'Não foi possível gerar o pagamento. Tente novamente.');
        setCarregandoPagamento(false);
      }
    } catch {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.');
      setCarregandoPagamento(false);
    }

    setCarregandoPagamento(false);
  }

  async function copiarTexto(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* fallback silencioso */ }
  }

  // ─── EXPIRADO ────────────────────────────────────────────────────────────────
  if (etapa === 'expirado') {
    return (
      <div style={{ textAlign: "center", padding: "32px 20px", fontFamily: FONTE_CORPO }}>
        <p style={{ fontSize: 32, margin: "0 0 12px" }}>⏰</p>
        <h4 style={{ margin: "0 0 8px", fontFamily: FONTE_TITULO, color: C.sidebarBg }}>Tempo esgotado</h4>
        <p style={{ fontSize: 13, color: C.textLight, margin: "0 0 24px" }}>
          A reserva expirou sem confirmação de pagamento. Inicie um novo agendamento.
        </p>
      </div>
    );
  }

  // ─── AGUARDANDO PAGAMENTO ─────────────────────────────────────────────────────
  if (etapa === 'aguardando') {
    const gateway = dadosPagamento?.gateway;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONTE_CORPO }}>

        {/* ── InfinitePay ───────────────────────────────────────────────── */}
        {gateway === 'infinitepay' && dadosPagamento?.checkoutUrl && (
          <div style={{ ...cardConteudo, padding: 20 }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: C.sidebarBg, fontFamily: FONTE_TITULO }}>
              Reserva criada!
            </h4>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: C.textMain, lineHeight: 1.5 }}>
              Para confirmar o agendamento, pague o sinal de{" "}
              <strong style={{ color: C.success }}>{brl(valorSinal)}</strong> via InfinitePay.
            </p>
            <a
              href={dadosPagamento.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", textAlign: "center", padding: "14px 20px",
                background: C.sidebarBg, color: "#fff", borderRadius: RAIO_LG,
                fontWeight: 700, fontSize: 14, textDecoration: "none",
                fontFamily: FONTE_TITULO
              }}
            >
              Pagar via InfinitePay →
            </a>
          </div>
        )}

        {/* ── MercadoPago / Simulador ───────────────────────────────────── */}
        {(gateway === 'mercadopago' || gateway === 'simulador') && dadosPagamento?.copiaECola && (
          <div style={{ ...cardConteudo, padding: 20 }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: C.sidebarBg, fontFamily: FONTE_TITULO }}>
              Reserva criada!
            </h4>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: C.textMain, lineHeight: 1.5 }}>
              Pague o sinal de <strong style={{ color: C.success }}>{brl(valorSinal)}</strong> via PIX para confirmar.
            </p>
            {dadosPagamento.qrCodeBase64 && (
              <div style={{ textAlign: "center", margin: "0 0 16px" }}>
                <img
                  src={`data:image/png;base64,${dadosPagamento.qrCodeBase64}`}
                  alt="QR Code PIX"
                  style={{ width: 180, height: 180, borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}
                />
              </div>
            )}
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              PIX Copia e Cola
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1, padding: "10px 14px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, fontSize: 11, color: C.textMain, fontFamily: "monospace", wordBreak: "break-all" as const, maxHeight: 60, overflow: "hidden" }}>
                {dadosPagamento.copiaECola}
              </div>
              <button
                onClick={() => copiarTexto(dadosPagamento.copiaECola)}
                style={{ padding: "10px 16px", background: "none", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, color: C.textMain, cursor: "pointer", whiteSpace: "nowrap" as const }}
              >
                {copiado ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        {/* ── Countdown regressivo ──────────────────────────────────────── */}
        {(() => {
          const mins = Math.floor(segundosRestantes / 60);
          const segs = segundosRestantes % 60;
          const urgente = segundosRestantes <= 5 * 60;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: urgente ? "#FEF2F2" : "#FFFBEB", borderRadius: RAIO_LG, border: `1px solid ${urgente ? "#FCA5A5" : "#FCD34D"}` }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>⏱️</span>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: urgente ? "#991B1B" : "#92400E" }}>
                  Tempo restante para pagar o sinal:{" "}
                  <strong style={{ fontSize: 15 }}>{mins}:{String(segs).padStart(2, '0')}</strong>
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: urgente ? "#B91C1C" : "#78350F", opacity: 0.9 }}>
                  {urgente
                    ? "Atenção: seu horário será cancelado em breve!"
                    : "Após esse prazo, o horário é liberado automaticamente para outro cliente."}
                </p>
              </div>
            </div>
          );
        })()}

        {/* ── Status de verificação automática ─────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: C.successBg, borderRadius: RAIO_LG, border: `1px solid ${C.success}` }}>
          <span style={{ fontSize: 20 }}>{verificando ? "🔄" : "✅"}</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.successText }}>
              {verificando ? "Verificando pagamento..." : "Aguardando pagamento"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: C.successText, opacity: 0.8 }}>
              Confirmamos automaticamente assim que o pagamento for identificado.
            </p>
          </div>
        </div>

        {/* Botão de verificação manual */}
        <button
          onClick={() => agendamentoId && dadosPagamento && verificarPagamento(dadosPagamento, agendamentoId)}
          disabled={verificando}
          style={{
            width: "100%", padding: "12px 20px",
            background: "none", color: C.sidebarBg,
            border: `1px solid ${C.sidebarBg}`, borderRadius: RAIO_LG,
            fontWeight: 700, fontSize: 13,
            cursor: verificando ? "not-allowed" : "pointer",
            fontFamily: FONTE_TITULO, opacity: verificando ? 0.6 : 1
          }}
        >
          {verificando ? "Verificando..." : "Já paguei — verificar agora"}
        </button>
      </div>
    );
  }

  // ─── RESUMO (passo inicial) ───────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONTE_CORPO }}>
      <div style={{ ...cardConteudo, padding: 20 }}>
        <h4 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: C.sidebarBg, fontFamily: FONTE_TITULO }}>Resumo da Reserva</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: C.textMuted }}>Serviço</span>
            <span style={{ fontWeight: 700, color: C.textMain }}>{servicoEscolhido?.nome_servico}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: C.textMuted }}>Valor total</span>
            <span style={{ fontWeight: 700, color: C.textMain }}>{brl(valorTotal)}</span>
          </div>
          {cobrarSinal && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 8, borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
              <span style={{ color: C.textMuted }}>Sinal ({porcentagem}%)</span>
              <span style={{ fontWeight: 900, color: C.success }}>{brl(valorSinal)}</span>
            </div>
          )}
        </div>
      </div>

      {cobrarSinal && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "14px 16px", background: "#FFFBEB", borderRadius: RAIO_MD, border: "1px solid #FCD34D" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⏱️</span>
          <p style={{ margin: 0, fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>
            Após confirmar, você terá <strong>{prazoMinutos} minutos</strong> para realizar o pagamento do sinal.
            Caso contrário, o horário será liberado automaticamente para outro cliente.
          </p>
        </div>
      )}

      {cobrarSinal && (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "16px", background: C.bgCard, borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}>
          <input
            type="checkbox"
            id="termos-reserva"
            checked={aceitouTermos}
            onChange={e => setAceitouTermos(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: C.sidebarBg, cursor: "pointer", flexShrink: 0 }}
          />
          <label htmlFor="termos-reserva" style={{ fontSize: 12, color: C.textMain, lineHeight: 1.5, cursor: "pointer" }}>
            Estou ciente que ao reservar, um sinal de <strong>{brl(valorSinal)}</strong> será cobrado para garantir o horário. Em caso de cancelamento com menos de 24h, o sinal poderá ser retido (Art. 418, CC).
          </label>
        </div>
      )}

      {erro && (
        <div style={{ background: C.dangerBg, borderRadius: RAIO_MD, padding: "12px 16px" }}>
          <p style={{ margin: 0, color: C.dangerText, fontSize: 12, fontWeight: 600 }}>{erro}</p>
        </div>
      )}

      <button
        onClick={cobrarSinal ? handleReservar : () => confirmarAgendamento('Confirmado')}
        disabled={salvando || carregandoPagamento || (cobrarSinal && !aceitouTermos)}
        style={{
          width: "100%", padding: "14px 20px",
          background: (salvando || carregandoPagamento || (cobrarSinal && !aceitouTermos)) ? C.borderMid : C.sidebarBg,
          color: "#fff", border: "none", borderRadius: RAIO_MD,
          fontWeight: 700, fontSize: 14,
          cursor: (salvando || carregandoPagamento || (cobrarSinal && !aceitouTermos)) ? "not-allowed" : "pointer",
          fontFamily: FONTE_TITULO
        }}
      >
        {(salvando || carregandoPagamento) ? "A processar..." : cobrarSinal ? `Confirmar Reserva — Pagar Sinal (${brl(valorSinal)})` : "Confirmar Agendamento"}
      </button>
    </div>
  );
}
