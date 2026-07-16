'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { FiShoppingBag, FiSearch, FiPlus, FiMinus, FiShoppingCart } from "react-icons/fi";
import { FONTE_TITULO, FONTE_CORPO, RAIO_MD, RAIO_LG, RAIO_2XL } from "@/lib/estiloGlobal";
import { cardConteudo, eyebrow } from "../estiloPortal";
import { ProdutoVitrine, ItemCarrinho, ModoVitrine, totalCarrinho } from "./tipos";

interface Props {
  salaoId: string;
  clienteId: string;
  clienteNome: string;
  modo: ModoVitrine;
  onAbrirCarrinho: (carrinho: ItemCarrinho[]) => void;
}

export function PortalVitrine({ salaoId, clienteId, clienteNome, modo, onAbrirCarrinho }: Props) {
  const [produtos, setProdutos] = useState<ProdutoVitrine[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { if (salaoId) carregar(); }, [salaoId]);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from("produtos")
      .select("id, nome_produto, categoria, subcategoria, preco_venda, quantidade_atual, unidade_medida, imagem_url, descricao_vitrine")
      .eq("salao_id", salaoId)
      .eq("visivel_vitrine", true)
      .gt("quantidade_atual", 0)
      .gt("preco_venda", 0)
      .order("nome_produto");
    setProdutos((data as ProdutoVitrine[]) || []);
    setCarregando(false);
  }

  function qtdNoCarrinho(id: string) {
    return carrinho.find(i => i.produto.id === id)?.quantidade || 0;
  }

  function adicionar(produto: ProdutoVitrine) {
    const qtdAtual = qtdNoCarrinho(produto.id);
    if (qtdAtual >= produto.quantidade_atual) return;
    setCarrinho(prev => {
      const existe = prev.find(i => i.produto.id === produto.id);
      if (existe) return prev.map(i => i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, { produto, quantidade: 1 }];
    });
  }

  function remover(id: string) {
    setCarrinho(prev => {
      const item = prev.find(i => i.produto.id === id);
      if (!item) return prev;
      if (item.quantidade <= 1) return prev.filter(i => i.produto.id !== id);
      return prev.map(i => i.produto.id === id ? { ...i, quantidade: i.quantidade - 1 } : i);
    });
  }

  const categorias = [...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort();
  const filtrados = produtos.filter(p => p.nome_produto.toLowerCase().includes(busca.toLowerCase()) || (p.categoria || "").toLowerCase().includes(busca.toLowerCase()));
  const totalItens = carrinho.reduce((s, i) => s + i.quantidade, 0);
  const modoCompra = modo === "compra" || modo === "pedido";

  if (carregando) return null;
  if (produtos.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FiShoppingBag size={14} color={C.sidebarBg} />
          <p style={{ ...eyebrow, margin: 0, color: C.sidebarBg }}>Produtos do Salão</p>
        </div>
        {modoCompra && totalItens > 0 && (
          <button onClick={() => onAbrirCarrinho(carrinho)} className="transition-all hover:opacity-90" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 99, background: C.sidebarBg, color: "#fff", border: "none", cursor: "pointer", fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 700 }}>
            <FiShoppingCart size={14} /> {totalItens} {totalItens === 1 ? "item" : "itens"} · {brl(totalCarrinho(carrinho))}
          </button>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <FiSearch size={14} color={C.textLight} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..." style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: RAIO_LG, border: `1px solid ${C.borderMid}`, fontSize: 13, fontFamily: FONTE_CORPO, boxSizing: "border-box", outline: "none", color: C.textMain }} />
      </div>

      {modo === "catalogo" && (
        <div style={{ background: "#E6F1FB", borderRadius: RAIO_MD, padding: "8px 14px", fontSize: 12, color: "#185FA5", fontWeight: 600 }}>
          Catálogo de produtos — para adquirir, fale com o salão pelo WhatsApp.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {filtrados.map(p => {
          const qtd = qtdNoCarrinho(p.id);
          return (
            <div key={p.id} style={{ ...cardConteudo, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {p.imagem_url ? (
                <div style={{ height: 120, overflow: "hidden", background: C.bg }}>
                  <img src={p.imagem_url} alt={p.nome_produto} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                </div>
              ) : (
                <div style={{ height: 80, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FiShoppingBag size={24} color={C.borderMid} />
                </div>
              )}
              <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <h4 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 12, fontWeight: 800, color: C.sidebarBg, lineHeight: 1.3 }}>{p.nome_produto}</h4>
                {p.descricao_vitrine && <p style={{ margin: 0, fontSize: 11, color: C.textLight, lineHeight: 1.4 }}>{p.descricao_vitrine}</p>}
                <p style={{ fontFamily: FONTE_TITULO, margin: "4px 0 0", fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>{brl(p.preco_venda)}</p>
                {modoCompra && (
                  qtd === 0 ? (
                    <button onClick={() => adicionar(p)} className="transition-all hover:opacity-90" style={{ marginTop: 6, width: "100%", padding: "7px 0", borderRadius: RAIO_MD, background: C.sidebarBg, color: "#fff", border: "none", cursor: "pointer", fontFamily: FONTE_TITULO, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <FiPlus size={11} /> Adicionar
                    </button>
                  ) : (
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.bg, borderRadius: RAIO_MD, padding: "4px 8px" }}>
                      <button onClick={() => remover(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.sidebarBg, display: "flex", padding: 2 }}><FiMinus size={14} /></button>
                      <span style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 800, color: C.sidebarBg }}>{qtd}</span>
                      <button onClick={() => adicionar(p)} disabled={qtd >= p.quantidade_atual} style={{ background: "none", border: "none", cursor: qtd >= p.quantidade_atual ? "not-allowed" : "pointer", color: C.sidebarBg, display: "flex", padding: 2, opacity: qtd >= p.quantidade_atual ? 0.3 : 1 }}><FiPlus size={14} /></button>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtrados.length === 0 && busca && (
        <p style={{ textAlign: "center", fontSize: 13, color: C.textLight, padding: 16 }}>Nenhum produto encontrado para "{busca}".</p>
      )}
    </div>
  );
}
