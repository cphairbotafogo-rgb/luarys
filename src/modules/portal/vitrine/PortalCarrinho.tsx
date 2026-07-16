'use client'
import { useState } from "react";
import { C, brl } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { FiX, FiTrash, FiCheckCircle, FiShoppingCart } from "react-icons/fi";
import { FONTE_TITULO, FONTE_CORPO, RAIO_MD, RAIO_LG, botaoPrimario } from "@/lib/estiloGlobal";
import { cardConteudo } from "../estiloPortal";
import { ItemCarrinho, ModoVitrine, totalCarrinho } from "./tipos";

interface Props {
  carrinho: ItemCarrinho[];
  modo: ModoVitrine;
  salaoId: string;
  clienteId: string;
  clienteNome: string;
  telefoneWhatsAppSalao?: string;
  onFechar: () => void;
  onPedidoConcluido: () => void;
}

type Fase = "carrinho" | "pix" | "verificando" | "concluido";

export function PortalCarrinho({ carrinho, modo, salaoId, clienteId, clienteNome, telefoneWhatsAppSalao, onFechar, onPedidoConcluido }: Props) {
  const toast = useToast();
  const [fase, setFase] = useState<Fase>("carrinho");
  const [processando, setProcessando] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [pedidoId, setPedidoId] = useState<string | null>(null);

  const total = totalCarrinho(carrinho);

  async function confirmarPedido() {
    setProcessando(true);
    const itens = carrinho.map(i => ({
      produto_id: i.produto.id,
      nome: i.produto.nome_produto,
      quantidade: i.quantidade,
      preco_unitario: i.produto.preco_venda,
    }));

    if (modo === "pedido") {
      // Envia para o WhatsApp do salão
      const texto = encodeURIComponent(
        `Olá! Sou ${clienteNome} e gostaria de fazer um pedido:\n\n` +
        carrinho.map(i => `• ${i.quantidade}x ${i.produto.nome_produto} — ${brl(i.produto.preco_venda * i.quantidade)}`).join("\n") +
        `\n\nTotal: ${brl(total)}\n\nAguardo confirmação!`
      );
      const tel = (telefoneWhatsAppSalao || "").replace(/\D/g, "");
      window.open(`https://wa.me/${tel}?text=${texto}`, "_blank");
      setFase("concluido");
      setProcessando(false);
      return;
    }

    // modo === "compra" → gera PIX
    try {
      const res = await fetch("/api/pagamentos/vitrine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salao_id: salaoId, cliente_id: clienteId, itens, total, cliente_nome: clienteNome }),
      });
      const data = await res.json();
      if (!data.sucesso) { toast.erro(data.erro || "Erro ao gerar pagamento."); setProcessando(false); return; }
      setPixData(data);
      setPedidoId(data.pedido_id);
      setFase("pix");
    } catch {
      toast.erro("Erro ao conectar com o servidor.");
    }
    setProcessando(false);
  }

  async function verificarPagamento() {
    if (!pedidoId || !pixData) return;
    setFase("verificando");
    try {
      const res = await fetch("/api/pagamentos/vitrine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id: pedidoId,
          gateway: pixData.gateway,
          id_transacao: pixData.idTransacao,
          order_nsu: pixData.orderNsu,
          transaction_nsu: pixData.transactionNsu,
          slug: pixData.slug,
        }),
      });
      const data = await res.json();
      if (data.aprovado) { setFase("concluido"); onPedidoConcluido(); }
      else { setFase("pix"); toast.aviso("Pagamento ainda não identificado. Aguarde alguns segundos e tente novamente."); }
    } catch {
      setFase("pix");
      toast.erro("Erro ao verificar pagamento.");
    }
  }

  async function copiarPix() {
    try { await navigator.clipboard.writeText(pixData?.copiaECola || ""); toast.sucesso("Código PIX copiado!"); }
    catch { toast.aviso("Não foi possível copiar. Copie manualmente."); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ ...cardConteudo, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", borderRadius: 20, padding: "24px 20px 32px", fontFamily: FONTE_CORPO }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 17, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8 }}>
            <FiShoppingCart size={17} />
            {fase === "pix" ? "Pagar com PIX" : fase === "verificando" ? "Verificando..." : fase === "concluido" ? "Pedido Enviado!" : "Meu Carrinho"}
          </h2>
          <button onClick={onFechar} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight }}><FiX size={20} /></button>
        </div>

        {fase === "carrinho" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {carrinho.map(item => (
                <div key={item.produto.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.bg, borderRadius: RAIO_MD }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.textMain }}>{item.produto.nome_produto}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textLight }}>{item.quantidade}x · {brl(item.produto.preco_venda)} cada</p>
                  </div>
                  <p style={{ margin: 0, fontFamily: FONTE_TITULO, fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>{brl(item.produto.preco_venda * item.quantidade)}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: `1px solid ${C.border}`, marginBottom: 20 }}>
              <span style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 700, color: C.textMuted }}>Total</span>
              <span style={{ fontFamily: FONTE_TITULO, fontSize: 20, fontWeight: 800, color: C.sidebarBg }}>{brl(total)}</span>
            </div>
            <button onClick={confirmarPedido} disabled={processando} className="transition-all hover:opacity-95" style={{ ...botaoPrimario, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {processando ? "Processando..." : modo === "pedido" ? "Enviar Pedido pelo WhatsApp" : "Pagar com PIX"}
            </button>
          </>
        )}

        {fase === "pix" && pixData && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {pixData.qrCodeBase64 ? (
              <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" style={{ width: 200, height: 200, borderRadius: RAIO_MD }} />
            ) : pixData.checkoutUrl ? (
              <a href={pixData.checkoutUrl} target="_blank" rel="noopener noreferrer" style={{ ...botaoPrimario, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", padding: "12px 24px", borderRadius: RAIO_MD }}>
                Abrir página de pagamento
              </a>
            ) : null}
            {pixData.copiaECola && (
              <div style={{ width: "100%", textAlign: "center" }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: C.textLight }}>Ou copie o código PIX:</p>
                <div style={{ background: C.bg, borderRadius: RAIO_MD, padding: "10px 12px", fontSize: 11, color: C.textMuted, wordBreak: "break-all", marginBottom: 8 }}>{pixData.copiaECola}</div>
                <button onClick={copiarPix} style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "8px 20px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Copiar código</button>
              </div>
            )}
            <p style={{ margin: 0, fontSize: 12, color: C.textLight, textAlign: "center" }}>Total: <strong>{brl(total)}</strong></p>
            <button onClick={verificarPagamento} className="transition-all hover:opacity-90" style={{ width: "100%", padding: "12px", borderRadius: RAIO_MD, background: C.success, color: "#fff", border: "none", cursor: "pointer", fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 700 }}>
              Já paguei — confirmar pagamento
            </button>
          </div>
        )}

        {fase === "verificando" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <p style={{ fontSize: 14, color: C.textMain, fontWeight: 700 }}>Verificando pagamento...</p>
            <p style={{ fontSize: 12, color: C.textLight }}>Consultando o gateway, aguarde.</p>
          </div>
        )}

        {fase === "concluido" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "20px 0" }}>
            <FiCheckCircle size={52} color={C.success} />
            <h3 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 18, fontWeight: 800, color: C.textMain }}>
              {modo === "pedido" ? "Pedido enviado!" : "Pagamento confirmado!"}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: C.textLight, textAlign: "center", lineHeight: 1.6 }}>
              {modo === "pedido"
                ? "O salão recebeu a sua lista pelo WhatsApp e vai confirmar em breve."
                : "Seu pagamento foi confirmado e o pedido foi registrado. O salão vai preparar os produtos para você."}
            </p>
            <button onClick={onFechar} style={{ ...botaoPrimario, display: "flex", alignItems: "center", justifyContent: "center" }}>Fechar</button>
          </div>
        )}

      </div>
    </div>
  );
}
