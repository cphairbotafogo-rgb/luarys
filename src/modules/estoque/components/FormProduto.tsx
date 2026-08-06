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

/** CFOPs que a NFC-e aceita — saída de venda a consumidor final. Fora desta
 *  lista a SEFAZ devolve rejeição 725, e só no momento da venda. */
const CFOP_NFCE = ['5101', '5102', '5103', '5104', '5115', '5405', '5656', '5667', '5933', '6108', '6109', '6110'];

/**
 * Tipos de produto de salão com o NCM correspondente, no mesmo espírito da
 * "Seleção Inteligente de Tributação" dos serviços: escolher pelo que a pessoa
 * reconhece, em vez de decorar oito dígitos.
 *
 * São SUGESTÕES, não veredito. O NCM classifica a mercadoria e quem responde por
 * isso é a contabilidade — a mesma lição que a NFS-e nos deu hoje. Por isso o
 * campo continua editável depois de preencher, e a tela diz isso em voz alta.
 *
 * CEST fica de fora de propósito: depende de substituição tributária, que varia
 * por estado e por convênio. Chutar ali é pior que deixar vazio.
 */
const TIPOS_PRODUTO = [
  { ncm: '33051000', label: 'Xampu' },
  { ncm: '33059000', label: 'Condicionador, máscara, leave-in e outros capilares' },
  { ncm: '33052000', label: 'Alisamento e permanente' },
  { ncm: '33053000', label: 'Laquê e fixador de cabelo' },
  { ncm: '33049910', label: 'Creme de beleza, hidratante e loção tônica' },
  { ncm: '33043000', label: 'Esmalte, base e removedor (manicure e pedicure)' },
  { ncm: '33041000', label: 'Maquiagem para lábios' },
  { ncm: '33042000', label: 'Maquiagem para olhos' },
  { ncm: '33049100', label: 'Pó e compacto' },
  { ncm: '33071000', label: 'Produto para barbear' },
  { ncm: '33072000', label: 'Desodorante' },
  { ncm: '33030010', label: 'Perfume e água de colônia' },
  { ncm: '34011190', label: 'Sabonete' },
  { ncm: '82142000', label: 'Alicate, espátula e utensílio de manicure' },
  { ncm: '96151100', label: 'Pente e escova de cabelo' },
  { ncm: '85163100', label: 'Secador de cabelo' },
  { ncm: '85163200', label: 'Chapinha, babyliss e modelador' },
];

export function FormProduto({ form, setForm, editandoId, subcategoriasUnicas, onSubmit, onClose, onExcluir }: Props) {
  const exigeFiscal   = form.categoria !== 'Uso Interno';
  const ncmInvalido   = exigeFiscal && form.ncm.length > 0 && form.ncm.length < 8;
  const cfopForaDaLista = form.cfop_padrao.length === 4 && !CFOP_NFCE.includes(form.cfop_padrao);
  return (
    <div style={{ ...overlayModal, zIndex: 999 }}>
      <div className="p-4 sm:p-8" style={{ background: C.bgCard, borderRadius: RAIO_3XL, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto", boxShadow: SOMBRA_MODAL }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.sidebarBg }}>{editandoId ? "Editar Produto" : "Novo Produto"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}><FiX size={24} /></button>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelPadrao}>Nome do Produto / Cabelo *</label>
            <input style={inputAdmin} required value={form.nome_produto} onChange={e => setForm({ ...form, nome_produto: e.target.value })} placeholder="Ex: Cabelo Humano Loiro 60cm" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
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

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            <div><label style={labelPadrao}>Quantidade Atual</label><input type="number" step="0.01" style={inputAdmin} value={form.quantidade_atual} onChange={e => setForm({ ...form, quantidade_atual: e.target.value })} /></div>
            <div><label style={labelPadrao}>Aviso de Estoque Mínimo</label><input type="number" step="0.01" style={inputAdmin} value={form.estoque_minimo} onChange={e => setForm({ ...form, estoque_minimo: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, background: C.bg, padding: 12, borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}` }}>
            <div><label style={labelPadrao}>Custo de Compra (R$)</label><input type="number" step="0.01" style={inputAdmin} value={form.custo_medio} onChange={e => setForm({ ...form, custo_medio: e.target.value })} /></div>
            <div><label style={labelPadrao}>Preço de Venda (R$)</label><input type="number" step="0.01" style={inputAdmin} value={form.preco_venda} onChange={e => setForm({ ...form, preco_venda: e.target.value })} disabled={form.categoria === 'Uso Interno'} /></div>
          </div>

          <div style={{ background: C.bg, padding: 16, borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}` }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: C.sidebarBg, textTransform: "uppercase" }}>Parâmetros Fiscais (NFC-e)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12, marginBottom: 12 }}>
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
            {/* Escolha pelo que a pessoa reconhece — o codigo vem junto. Mesmo
                padrao da selecao de tributacao dos servicos. */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelPadrao}>Tipo do produto</label>
              <select
                style={inputAdmin}
                value={TIPOS_PRODUTO.some(t => t.ncm === form.ncm) ? form.ncm : ''}
                onChange={e => { if (e.target.value) setForm({ ...form, ncm: e.target.value }); }}
              >
                <option value="">— Selecione para preencher o NCM —</option>
                {TIPOS_PRODUTO.map(t => (
                  <option key={t.ncm} value={t.ncm}>{t.label} · NCM {t.ncm}</option>
                ))}
              </select>
              <p style={{ margin: '5px 0 0', fontSize: 10.5, color: C.textLight, lineHeight: 1.5 }}>
                Sugestão para agilizar o cadastro — o NCM classifica a mercadoria e quem
                responde por ele é a sua contabilidade. Dá para editar o campo depois de preencher.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12 }}>
              {/* NCM: 8 digitos, sem excecao. `required` sozinho so garante que o
                  campo nao esta vazio — "123" passava e a SEFAZ recusava o item
                  na hora da venda. A validacao de formato tem que ser aqui, nao
                  na primeira NFC-e. */}
              <div>
                <label style={labelPadrao}>NCM *</label>
                <input style={{ ...inputAdmin, borderColor: ncmInvalido ? C.danger : undefined }}
                  required={form.categoria !== 'Uso Interno'}
                  value={form.ncm}
                  onChange={e => setForm({ ...form, ncm: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                  inputMode="numeric" maxLength={8} placeholder="8 dígitos" />
                {ncmInvalido && <p style={{ margin: '3px 0 0', fontSize: 10, color: C.danger }}>Faltam {8 - form.ncm.length} dígito(s).</p>}
              </div>
              <div><label style={labelPadrao}>CEST</label><input style={inputAdmin} value={form.cest} onChange={e => setForm({ ...form, cest: e.target.value.replace(/\D/g, '').slice(0, 7) })} inputMode="numeric" maxLength={7} /></div>
              {/* CFOP: so os de venda a consumidor final valem em NFC-e. Fora da
                  lista, a SEFAZ devolve rejeicao 725 — e so na hora da venda. */}
              <div>
                <label style={labelPadrao}>CFOP *</label>
                <input style={{ ...inputAdmin, borderColor: cfopForaDaLista ? '#B45309' : undefined }}
                  required value={form.cfop_padrao}
                  onChange={e => setForm({ ...form, cfop_padrao: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  inputMode="numeric" maxLength={4} list="cfops-nfce" />
                <datalist id="cfops-nfce">{CFOP_NFCE.map(c => <option key={c} value={c} />)}</datalist>
                {cfopForaDaLista && <p style={{ margin: '3px 0 0', fontSize: 10, color: '#B45309' }}>Não é CFOP de venda a consumidor final — a NFC-e será recusada.</p>}
              </div>
              <div><label style={labelPadrao}>CSOSN *</label><input style={inputAdmin} required value={form.csosn_padrao} onChange={e => setForm({ ...form, csosn_padrao: e.target.value.replace(/\D/g, '').slice(0, 3) })} inputMode="numeric" maxLength={3} /></div>
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
