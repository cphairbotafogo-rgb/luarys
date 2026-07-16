'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { FiShoppingBag, FiEye, FiEyeOff, FiCheck, FiAlertTriangle } from "react-icons/fi";
import { FONTE_TITULO, RAIO_MD, botaoPrimario, inputAdmin, labelPadrao, cardAdmin } from "@/lib/estiloGlobal";
import { ModoVitrine, MODO_LABEL, MODO_DESCRICAO } from "./tipos";

interface Props { perfil: any; }

const MODOS: ModoVitrine[] = ["catalogo", "pedido", "compra"];

export function ConfigVitrine({ perfil }: Props) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [config, setConfig] = useState<{ modo: ModoVitrine; ativo: boolean }>({ modo: "catalogo", ativo: false });
  const [produtos, setProdutos] = useState<any[]>([]);
  const [buscaProd, setBuscaProd] = useState("");

  useEffect(() => { if (perfil?.salao_id) carregar(); }, [perfil]);

  async function carregar() {
    setCarregando(true);
    const [resConfig, resProdutos] = await Promise.all([
      supabase.from("vitrine_config").select("modo, ativo").eq("salao_id", perfil.salao_id).maybeSingle(),
      supabase.from("produtos").select("id, nome_produto, categoria, preco_venda, quantidade_atual, visivel_vitrine, imagem_url, descricao_vitrine").eq("salao_id", perfil.salao_id).order("nome_produto"),
    ]);
    if (resConfig.data) setConfig({ modo: resConfig.data.modo as ModoVitrine, ativo: resConfig.data.ativo });
    setProdutos(resProdutos.data || []);
    setCarregando(false);
  }

  async function salvarConfig() {
    setSalvando(true);
    const { error } = await supabase.from("vitrine_config").upsert([{ salao_id: perfil.salao_id, modo: config.modo, ativo: config.ativo }], { onConflict: "salao_id" });
    setSalvando(false);
    if (error) { toast.erro("Erro ao salvar configurações da vitrine."); return; }
    toast.sucesso("Configurações salvas!");
  }

  async function alternarVisibilidade(id: string, visivel: boolean) {
    const { error } = await supabase.from("produtos").update({ visivel_vitrine: !visivel }).eq("id", id).eq("salao_id", perfil.salao_id);
    if (error) { toast.erro("Erro ao alterar visibilidade."); return; }
    setProdutos(prev => prev.map(p => p.id === id ? { ...p, visivel_vitrine: !visivel } : p));
  }

  async function salvarDadosProduto(id: string, campo: string, valor: string) {
    const { error } = await supabase.from("produtos").update({ [campo]: valor || null }).eq("id", id).eq("salao_id", perfil.salao_id);
    if (error) { toast.erro("Erro ao salvar."); return; }
    setProdutos(prev => prev.map(p => p.id === id ? { ...p, [campo]: valor } : p));
  }

  const [editandoProduto, setEditandoProduto] = useState<string | null>(null);
  const [formProd, setFormProd] = useState({ imagem_url: "", descricao_vitrine: "" });

  function abrirEdicaoProduto(p: any) {
    setEditandoProduto(p.id);
    setFormProd({ imagem_url: p.imagem_url || "", descricao_vitrine: p.descricao_vitrine || "" });
  }

  async function salvarEdicaoProduto(id: string) {
    await Promise.all([
      salvarDadosProduto(id, "imagem_url", formProd.imagem_url),
      salvarDadosProduto(id, "descricao_vitrine", formProd.descricao_vitrine),
    ]);
    setEditandoProduto(null);
    toast.sucesso("Produto atualizado!");
  }

  const produtosFiltrados = produtos.filter(p => p.nome_produto.toLowerCase().includes(buscaProd.toLowerCase()));
  const visiveis = produtos.filter(p => p.visivel_vitrine).length;

  if (carregando) return <p style={{ textAlign: "center", fontSize: 13, color: C.textLight, padding: 32 }}>A carregar...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      <div>
        <h3 style={{ fontFamily: FONTE_TITULO, margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: C.sidebarBg }}>Vitrine de Produtos</h3>
        <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>Configure como os produtos aparecem para as suas clientes no portal.</p>
      </div>

      {/* ─── MODO DA VITRINE ─── */}
      <div style={{ ...cardAdmin, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>Modo da Vitrine</h4>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: config.ativo ? C.success : C.textMuted }}>{config.ativo ? "Ativa" : "Desativada"}</span>
            <div onClick={() => setConfig(p => ({ ...p, ativo: !p.ativo }))} style={{ width: 40, height: 22, borderRadius: 99, background: config.ativo ? C.success : C.borderMid, position: "relative", cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: C.bgCard, position: "absolute", top: 2, left: config.ativo ? 20 : 2, transition: "left 0.2s" }} />
            </div>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {MODOS.map(m => (
            <button key={m} type="button" onClick={() => setConfig(p => ({ ...p, modo: m }))} style={{ padding: "12px 14px", borderRadius: RAIO_MD, border: `2px solid ${config.modo === m ? C.sidebarBg : C.border}`, background: config.modo === m ? `${C.sidebarBg}0A` : C.bgCard, cursor: "pointer", textAlign: "left" }}>
              <p style={{ fontFamily: FONTE_TITULO, margin: "0 0 4px", fontSize: 12, fontWeight: 800, color: config.modo === m ? C.sidebarBg : C.textMain }}>{MODO_LABEL[m]}</p>
              <p style={{ margin: 0, fontSize: 11, color: C.textLight, lineHeight: 1.4 }}>{MODO_DESCRICAO[m]}</p>
            </button>
          ))}
        </div>

        {config.modo === "compra" && (
          <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderRadius: RAIO_MD, background: "#FEF3C7", border: "1px solid #FDE68A" }}>
            <FiAlertTriangle size={14} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12, color: "#92400E" }}>O modo Compra usa o gateway já configurado nas Configurações Financeiras (Mercado Pago ou InfinitePay). Certifique-se de que está configurado antes de ativar.</p>
          </div>
        )}

        <button onClick={salvarConfig} disabled={salvando} className="transition-all hover:opacity-90" style={{ ...botaoPrimario, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <FiCheck size={14} /> {salvando ? "Salvando..." : "Salvar Configurações"}
        </button>
      </div>

      {/* ─── PRODUTOS NA VITRINE ─── */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h4 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>Produtos na Vitrine</h4>
          <span style={{ fontSize: 12, color: C.textLight }}>{visiveis} de {produtos.length} visíveis</span>
        </div>

        <input type="text" value={buscaProd} onChange={e => setBuscaProd(e.target.value)} placeholder="Buscar produto..." style={{ ...inputAdmin, marginBottom: 12 }} />

        {produtos.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <FiShoppingBag size={28} color={C.borderMid} style={{ marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 13, color: C.textLight }}>Cadastre produtos no módulo de Estoque para exibi-los na vitrine.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {produtosFiltrados.map(p => (
              <div key={p.id} style={{ ...cardAdmin, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.visivel_vitrine ? C.success : C.borderMid, flexShrink: 0 }} />
                      <h4 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 13, fontWeight: 700, color: C.textMain, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome_produto}</h4>
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: C.textLight }}>{brl(p.preco_venda)} · Estoque: {p.quantidade_atual}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => abrirEdicaoProduto(p)} style={{ background: "none", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "5px 10px", cursor: "pointer", color: C.sidebarBg, fontSize: 11, fontWeight: 700 }}>Editar</button>
                    <button onClick={() => alternarVisibilidade(p.id, p.visivel_vitrine)} title={p.visivel_vitrine ? "Ocultar da vitrine" : "Mostrar na vitrine"} style={{ background: "none", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "5px 8px", cursor: "pointer", color: p.visivel_vitrine ? C.success : C.textLight, display: "flex" }}>
                      {p.visivel_vitrine ? <FiEye size={14} /> : <FiEyeOff size={14} />}
                    </button>
                  </div>
                </div>

                {editandoProduto === p.id && (
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={labelPadrao}>URL da Imagem <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
                      <input type="url" value={formProd.imagem_url} onChange={e => setFormProd(p => ({ ...p, imagem_url: e.target.value }))} placeholder="https://..." style={inputAdmin} />
                    </div>
                    <div>
                      <label style={labelPadrao}>Descrição para a Vitrine <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
                      <input type="text" value={formProd.descricao_vitrine} onChange={e => setFormProd(p => ({ ...p, descricao_vitrine: e.target.value }))} maxLength={120} placeholder="Ex: Ideal para cabelos danificados..." style={inputAdmin} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setEditandoProduto(null)} style={{ padding: "8px 14px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                      <button onClick={() => salvarEdicaoProduto(p.id)} style={{ padding: "8px 14px", borderRadius: RAIO_MD, background: C.sidebarBg, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Salvar</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
