'use client'
import { C } from "@/lib/constants";
import { inputAdmin, labelPadrao, RAIO_MD, RAIO_3XL, overlayModal, SOMBRA_MODAL } from "@/lib/estiloGlobal";
import { Btn } from "@/components/ui";
import { FiX } from "react-icons/fi";

interface Props {
  form: any;
  setForm: (f: any) => void;
  editandoId: any;
  subcategoriasUnicas: string[];
  onSubmit: (e: any) => void;
  onClose: () => void;
  onExcluir: (id: any) => void;
}

export function FormProduto({ form, setForm, editandoId, subcategoriasUnicas, onSubmit, onClose, onExcluir }: Props) {
  return (
    <div style={{ ...overlayModal, zIndex: 999 }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_3XL, padding: 32, width: 700, maxHeight: "90vh", overflowY: "auto", boxShadow: SOMBRA_MODAL }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.sidebarBg }}>{editandoId ? "Editar Produto" : "Novo Produto"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}><FiX size={24} /></button>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelPadrao}>Nome do Produto / Cabelo *</label>
            <input style={inputAdmin} required value={form.nome_produto} onChange={e => setForm({ ...form, nome_produto: e.target.value })} placeholder="Ex: Cabelo Humano Loiro 60cm" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelPadrao}>Categoria</label>
              <select style={inputAdmin} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                <option value="Mega Hair">Mega Hair</option>
                <option value="Revenda">Revenda (Venda p/ Cliente)</option>
                <option value="Uso Interno">Uso Interno (Lavatório)</option>
              </select>
            </div>
            <div>
              <label style={labelPadrao}>Subcategoria</label>
              <input style={inputAdmin} value={form.subcategoria} onChange={e => setForm({ ...form, subcategoria: e.target.value })} placeholder="Ex: Shampoo" list="lista-subcat" />
              <datalist id="lista-subcat">{subcategoriasUnicas.map(sub => <option key={sub} value={sub} />)}</datalist>
            </div>
            <div>
              <label style={labelPadrao}>Unidade</label>
              <select style={inputAdmin} value={form.unidade_medida} onChange={e => setForm({ ...form, unidade_medida: e.target.value })}>
                <option value="Gramas">Gramas (g)</option>
                <option value="Unidades">Unidades (un)</option>
                <option value="Mililitros">Mililitros (ml)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelPadrao}>Quantidade Atual</label><input type="number" step="0.01" style={inputAdmin} value={form.quantidade_atual} onChange={e => setForm({ ...form, quantidade_atual: e.target.value })} /></div>
            <div><label style={labelPadrao}>Aviso de Estoque Mínimo</label><input type="number" step="0.01" style={inputAdmin} value={form.estoque_minimo} onChange={e => setForm({ ...form, estoque_minimo: e.target.value })} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: C.bg, padding: 12, borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}` }}>
            <div><label style={labelPadrao}>Custo de Compra (R$)</label><input type="number" step="0.01" style={inputAdmin} value={form.custo_medio} onChange={e => setForm({ ...form, custo_medio: e.target.value })} /></div>
            <div><label style={labelPadrao}>Preço de Venda (R$)</label><input type="number" step="0.01" style={inputAdmin} value={form.preco_venda} onChange={e => setForm({ ...form, preco_venda: e.target.value })} disabled={form.categoria === 'Uso Interno'} /></div>
          </div>

          <div style={{ background: C.bg, padding: 16, borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}` }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: C.sidebarBg, textTransform: "uppercase" }}>Parâmetros Fiscais (NFC-e)</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={labelPadrao}>SKU</label><input style={inputAdmin} value={form.codigo_sku} onChange={e => setForm({ ...form, codigo_sku: e.target.value })} placeholder="Cód. Interno" /></div>
              <div><label style={labelPadrao}>GTIN (Cód. Barras)</label><input style={inputAdmin} value={form.codigo_barras} onChange={e => setForm({ ...form, codigo_barras: e.target.value })} /></div>
              <div>
                <label style={labelPadrao}>Origem</label>
                <select style={inputAdmin} value={form.origem} onChange={e => setForm({ ...form, origem: e.target.value })}>
                  <option value="0">0 – Nacional</option>
                  <option value="1">1 – Estrangeira (Importação)</option>
                  <option value="2">2 – Estrangeira (Merc. Interno)</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              <div><label style={labelPadrao}>NCM *</label><input style={inputAdmin} required={form.categoria !== 'Uso Interno'} value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} maxLength={8} /></div>
              <div><label style={labelPadrao}>CEST</label><input style={inputAdmin} value={form.cest} onChange={e => setForm({ ...form, cest: e.target.value })} maxLength={7} /></div>
              <div><label style={labelPadrao}>CFOP *</label><input style={inputAdmin} required value={form.cfop_padrao} onChange={e => setForm({ ...form, cfop_padrao: e.target.value })} maxLength={4} /></div>
              <div><label style={labelPadrao}>CSOSN *</label><input style={inputAdmin} required value={form.csosn_padrao} onChange={e => setForm({ ...form, csosn_padrao: e.target.value })} maxLength={3} /></div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Btn type="submit" style={{ flex: 2, padding: "14px 0", fontSize: 14, background: C.sidebarBg, color: "#fff", border: "none" }}>Salvar Produto</Btn>
            {editandoId && <Btn type="button" onClick={() => onExcluir(editandoId)} style={{ flex: 1, padding: "14px 0", fontSize: 14, background: C.dangerBg, color: C.danger, border: "none" }}>Excluir</Btn>}
          </div>
        </form>
      </div>
    </div>
  );
}
