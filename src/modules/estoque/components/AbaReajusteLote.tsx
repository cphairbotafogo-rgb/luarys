'use client'
import { C, brl } from "@/lib/constants";
import { inputAdmin, RAIO_XS, RAIO_SM, RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { FiCheckSquare, FiPercent, FiArrowUpRight, FiArrowDownRight } from "react-icons/fi";

interface Props {
  produtos: any[];
  selecionados: number[];
  reajusteValor: string;
  reajusteTipo: 'aumento' | 'desconto';
  processandoLote: boolean;
  categoriaLote: string;
  categoriasUnicas: string[];
  setCategoriaLote: (v: string) => void;
  setReajusteValor: (v: string) => void;
  setReajusteTipo: (v: 'aumento' | 'desconto') => void;
  onToggleSelecao: (id: number) => void;
  onSelecionarTodos: () => void;
  onSelecionarPorCategoria: (cat: string) => void;
  onSelecionarPorSubcategoria: (cat: string, sub: string) => void;
  onAplicar: () => void;
}

export function AbaReajusteLote({ produtos, selecionados, reajusteValor, reajusteTipo, processandoLote, categoriaLote, categoriasUnicas, setCategoriaLote, setReajusteValor, setReajusteTipo, onToggleSelecao, onSelecionarTodos, onSelecionarPorCategoria, onSelecionarPorSubcategoria, onAplicar }: Props) {
  return (
    <div style={{ animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.sidebarBg}`, borderRadius: RAIO_XL, padding: "24px", marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase" }}>
            <FiCheckSquare size={16} /> {selecionados.length} Produto(s) Selecionado(s)
          </h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>Ajuste em massa o <strong>Preço de Venda</strong> dos produtos marcados.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, overflow: "hidden" }}>
            <button onClick={() => setReajusteTipo('aumento')} style={{ background: reajusteTipo === 'aumento' ? C.sidebarBg : C.bgCard, color: reajusteTipo === 'aumento' ? "#fff" : C.textMain, border: "none", padding: "12px 16px", cursor: "pointer", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
              <FiArrowUpRight size={14} className="inline mr-1" /> Aumentar
            </button>
            <button onClick={() => setReajusteTipo('desconto')} style={{ background: reajusteTipo === 'desconto' ? C.sidebarBg : C.bgCard, color: reajusteTipo === 'desconto' ? "#fff" : C.textMain, border: "none", borderLeft: `1px solid ${C.borderMid}`, padding: "12px 16px", cursor: "pointer", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
              <FiArrowDownRight size={14} className="inline mr-1" /> Descontar
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <FiPercent style={{ position: "absolute", left: 14, top: 13, color: C.textLight }} size={14} />
            <input type="number" placeholder="0.00" value={reajusteValor} onChange={e => setReajusteValor(e.target.value)} style={{ ...inputAdmin, paddingLeft: 38, width: 130 }} />
          </div>
          <button onClick={onAplicar} disabled={processandoLote || selecionados.length === 0}
            style={{ background: selecionados.length === 0 ? C.borderMid : C.success, color: "#fff", border: "none", padding: "12px 24px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: (processandoLote || selecionados.length === 0) ? "not-allowed" : "pointer", textTransform: "uppercase" }}>
            {processandoLote ? "Processando..." : "Aplicar Lote"}
          </button>
        </div>
      </div>

      <div style={{ background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_XL, padding: "16px", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", marginRight: 8 }}>1. Filtrar por Categoria:</span>
          <button onClick={onSelecionarTodos} style={{ background: selecionados.length === produtos.length && produtos.length > 0 ? C.sidebarBg : C.bg, color: selecionados.length === produtos.length && produtos.length > 0 ? "#fff" : C.textMain, border: `1px solid ${C.borderMid}`, padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {selecionados.length === produtos.length && produtos.length > 0 ? "Desmarcar Todos" : "Selecionar Todos"}
          </button>
          {categoriasUnicas.map(cat => (
            <button key={cat} onClick={() => setCategoriaLote(categoriaLote === cat ? "" : cat)}
              style={{ background: categoriaLote === cat ? C.sidebarBg : C.bgCard, color: categoriaLote === cat ? "#fff" : C.textMain, border: `1px solid ${categoriaLote === cat ? C.sidebarBg : C.borderMid}`, padding: "6px 16px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {cat}
            </button>
          ))}
        </div>
        {categoriaLote && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${C.borderMid}` }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", marginRight: 8 }}>2. Adicionar à Seleção:</span>
            <button onClick={() => onSelecionarPorCategoria(categoriaLote)} style={{ background: C.bg, color: C.sidebarBg, border: `1px solid ${C.sidebarBg}`, padding: "6px 16px", borderRadius: 20, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
              + Toda a categoria ({categoriaLote})
            </button>
            {Array.from(new Set(produtos.filter(p => p.categoria === categoriaLote).map(p => p.subcategoria).filter(Boolean))).map(sub => (
              <button key={sub} onClick={() => onSelecionarPorSubcategoria(categoriaLote, sub)} style={{ background: C.bgCard, color: C.textMain, border: `1px solid ${C.borderMid}`, padding: "6px 16px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                + {sub}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {produtos.map(p => {
          const isSelected = selecionados.includes(p.id);
          return (
            <div key={p.id} onClick={() => onToggleSelecao(p.id)}
              style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `2px solid ${isSelected ? C.sidebarBg : C.border}`, display: "flex", padding: 20, alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "all 0.15s", transform: isSelected ? "scale(1.02)" : "scale(1)" }}>
              <div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <span style={{ display: "inline-block", background: C.bg, color: C.textMuted, padding: "2px 8px", borderRadius: RAIO_XS, fontSize: 9, fontWeight: 800, textTransform: "uppercase" }}>{p.categoria}</span>
                  {p.subcategoria && <span style={{ display: "inline-block", background: "#FFFBEB", color: "#B45309", padding: "2px 8px", borderRadius: RAIO_XS, fontSize: 9, fontWeight: 800, textTransform: "uppercase" }}>{p.subcategoria}</span>}
                </div>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>{p.nome_produto}</h3>
                <span style={{ fontSize: 10, color: C.textLight, fontWeight: 700, textTransform: "uppercase", display: "block" }}>Preço de Venda:</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: isSelected ? C.sidebarBg : C.textMain }}>{brl(p.preco_venda || 0)}</span>
              </div>
              <div style={{ width: 24, height: 24, borderRadius: RAIO_SM, border: `2px solid ${isSelected ? C.sidebarBg : C.borderMid}`, background: isSelected ? C.sidebarBg : C.bgCard, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isSelected && <FiCheckSquare color="#fff" size={16} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
