'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { FiPlus, FiTrash2, FiEdit2, FiCheck } from "react-icons/fi";
import { FONTE_TITULO, RAIO_MD, inputAdmin, labelPadrao, botaoPrimario } from "@/lib/estiloGlobal";

interface Promocao {
  id: string;
  titulo: string;
  descricao: string | null;
  imagem_url: string | null;
  preco_original: number | null;
  preco_promo: number | null;
  validade_ate: string | null;
  ativo: boolean;
}

interface Props { perfil: any; }

const FORM_VAZIO = { titulo: '', descricao: '', imagem_url: '', preco_original: '', preco_promo: '', validade_ate: '', ativo: true };

export function GavetaPromocoesVitrine({ perfil }: Props) {
  const toast = useToast();
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (perfil?.salao_id) carregar(); }, [perfil]);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('vitrine_promocoes')
      .select('id, titulo, descricao, imagem_url, preco_original, preco_promo, validade_ate, ativo')
      .eq('salao_id', perfil.salao_id)
      .order('created_at', { ascending: false });
    setPromocoes(data || []);
    setCarregando(false);
  }

  function abrirNova() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setFormAberto(true);
  }

  function abrirEdicao(p: Promocao) {
    setEditandoId(p.id);
    setForm({
      titulo: p.titulo,
      descricao: p.descricao || '',
      imagem_url: p.imagem_url || '',
      preco_original: p.preco_original != null ? String(p.preco_original) : '',
      preco_promo: p.preco_promo != null ? String(p.preco_promo) : '',
      validade_ate: p.validade_ate || '',
      ativo: p.ativo,
    });
    setFormAberto(true);
  }

  async function salvar() {
    if (!form.titulo.trim()) { toast.aviso('Informe o título da promoção.'); return; }
    setSalvando(true);
    const payload = {
      salao_id: perfil.salao_id,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      imagem_url: form.imagem_url.trim() || null,
      preco_original: form.preco_original ? parseFloat(form.preco_original.replace(',', '.')) : null,
      preco_promo: form.preco_promo ? parseFloat(form.preco_promo.replace(',', '.')) : null,
      validade_ate: form.validade_ate || null,
      ativo: form.ativo,
    };
    let error;
    if (editandoId) {
      ({ error } = await supabase.from('vitrine_promocoes').update(payload).eq('id', editandoId).eq('salao_id', perfil.salao_id));
    } else {
      ({ error } = await supabase.from('vitrine_promocoes').insert(payload));
    }
    setSalvando(false);
    if (error) { toast.erro('Erro ao salvar: ' + error.message); return; }
    toast.sucesso(editandoId ? 'Promoção atualizada!' : 'Promoção criada!');
    setFormAberto(false);
    await carregar();
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta promoção?')) return;
    const { error } = await supabase.from('vitrine_promocoes').delete().eq('id', id).eq('salao_id', perfil.salao_id);
    if (error) { toast.erro('Erro ao excluir.'); return; }
    setPromocoes(prev => prev.filter(p => p.id !== id));
  }

  async function alternarAtivo(p: Promocao) {
    const { error } = await supabase.from('vitrine_promocoes').update({ ativo: !p.ativo }).eq('id', p.id).eq('salao_id', perfil.salao_id);
    if (error) { toast.erro('Erro ao alterar.'); return; }
    setPromocoes(prev => prev.map(x => x.id === p.id ? { ...x, ativo: !x.ativo } : x));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 28, borderTop: `1px solid ${C.border}`, paddingTop: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontFamily: FONTE_TITULO, margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: C.sidebarBg }}>Promoções da Vitrine</h3>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>Crie promoções visíveis no portal das clientes.</p>
        </div>
        <button onClick={abrirNova} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: RAIO_MD, background: C.sidebarBg, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          <FiPlus size={13} /> Nova Promoção
        </button>
      </div>

      {formAberto && (
        <div style={{ background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h4 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>
            {editandoId ? 'Editar Promoção' : 'Nova Promoção'}
          </h4>

          <div>
            <label style={labelPadrao}>Título *</label>
            <input type="text" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} maxLength={80} placeholder="Ex: 40% off em coloração" style={inputAdmin} />
          </div>
          <div>
            <label style={labelPadrao}>Descrição <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
            <input type="text" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} maxLength={200} placeholder="Detalhes da promoção..." style={inputAdmin} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelPadrao}>Preço original <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
              <input type="number" min={0} step={0.01} value={form.preco_original} onChange={e => setForm(p => ({ ...p, preco_original: e.target.value }))} placeholder="0,00" style={inputAdmin} />
            </div>
            <div>
              <label style={labelPadrao}>Preço promocional <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
              <input type="number" min={0} step={0.01} value={form.preco_promo} onChange={e => setForm(p => ({ ...p, preco_promo: e.target.value }))} placeholder="0,00" style={inputAdmin} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelPadrao}>Válida até <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
              <input type="date" value={form.validade_ate} onChange={e => setForm(p => ({ ...p, validade_ate: e.target.value }))} style={inputAdmin} />
            </div>
            <div>
              <label style={labelPadrao}>URL da Imagem <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
              <input type="url" value={form.imagem_url} onChange={e => setForm(p => ({ ...p, imagem_url: e.target.value }))} placeholder="https://..." style={inputAdmin} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.textMain }}>
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} style={{ accentColor: C.sidebarBg, width: 15, height: 15 }} />
            Ativa (visível no portal das clientes)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setFormAberto(false)} style={{ padding: '9px 16px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando} style={{ ...botaoPrimario, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiCheck size={13} /> {salvando ? 'Salvando...' : editandoId ? 'Atualizar' : 'Criar Promoção'}
            </button>
          </div>
        </div>
      )}

      {carregando ? (
        <p style={{ textAlign: 'center', color: C.textLight, fontSize: 13 }}>Carregando...</p>
      ) : promocoes.length === 0 ? (
        <p style={{ textAlign: 'center', color: C.textLight, fontSize: 13, padding: 16 }}>Nenhuma promoção cadastrada ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {promocoes.map(p => (
            <div key={p.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.ativo ? C.success : C.borderMid, flexShrink: 0 }} />
                  <span style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 700, color: C.textMain }}>{p.titulo}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                  {p.preco_original != null && <span style={{ fontSize: 11, color: C.textLight, textDecoration: 'line-through' }}>{brl(p.preco_original)}</span>}
                  {p.preco_promo != null && <span style={{ fontSize: 11, color: C.success, fontWeight: 700 }}>{brl(p.preco_promo)}</span>}
                  {p.validade_ate && <span style={{ fontSize: 11, color: C.textLight }}>até {new Date(p.validade_ate + 'T12:00').toLocaleDateString('pt-BR')}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => alternarAtivo(p)} style={{ background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '5px 8px', cursor: 'pointer', color: p.ativo ? C.success : C.textLight, fontSize: 11, fontWeight: 700 }}>
                  {p.ativo ? 'Ativa' : 'Inativa'}
                </button>
                <button onClick={() => abrirEdicao(p)} style={{ background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '5px 8px', cursor: 'pointer', color: C.sidebarBg, display: 'flex' }}>
                  <FiEdit2 size={13} />
                </button>
                <button onClick={() => excluir(p.id)} style={{ background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '5px 8px', cursor: 'pointer', color: C.danger, display: 'flex' }}>
                  <FiTrash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
