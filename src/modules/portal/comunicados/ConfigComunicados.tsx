'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { FiPlus, FiTrash, FiEdit2, FiEye, FiEyeOff, FiSpeaker, FiX, FiCheck } from "react-icons/fi";
import {
  FONTE_TITULO, FONTE_CORPO, RAIO_MD, RAIO_LG,
  botaoPrimario, inputAdmin, labelPadrao, cardAdmin,
} from "@/lib/estiloGlobal";

interface Props { perfil: any; }

const TIPOS = [
  { valor: "promocao",   rotulo: "Promoção",   descricao: "Desconto, oferta por tempo limitado" },
  { valor: "lancamento", rotulo: "Novidade",   descricao: "Novo serviço, produto ou profissional" },
  { valor: "comunicado", rotulo: "Comunicado", descricao: "Aviso geral, horário especial, férias" },
];

const VAZIO = { tipo: "comunicado", titulo: "", descricao: "", imagem_url: "", link_acao: "", texto_botao: "", valido_ate: "", ordem: 0 };

export function ConfigComunicados({ perfil }: Props) {
  const toast = useToast();
  const [comunicados, setComunicados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState({ ...VAZIO });

  useEffect(() => { if (perfil?.salao_id) carregar(); }, [perfil]);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from("comunicados_salao")
      .select("*")
      .eq("salao_id", perfil.salao_id)
      .order("ordem", { ascending: true })
      .order("criado_em", { ascending: false });
    setComunicados(data || []);
    setCarregando(false);
  }

  function abrirNovo() { setEditando("novo"); setForm({ ...VAZIO }); }
  function abrirEditar(c: any) { setEditando(c.id); setForm({ tipo: c.tipo, titulo: c.titulo, descricao: c.descricao || "", imagem_url: c.imagem_url || "", link_acao: c.link_acao || "", texto_botao: c.texto_botao || "", valido_ate: c.valido_ate || "", ordem: c.ordem || 0 }); }
  function fecharForm() { setEditando(null); setForm({ ...VAZIO }); }

  async function salvar() {
    if (!form.titulo.trim()) { toast.aviso("O título é obrigatório."); return; }
    setSalvando(true);
    const payload = {
      salao_id: perfil.salao_id,
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      imagem_url: form.imagem_url.trim() || null,
      link_acao: form.link_acao.trim() || null,
      texto_botao: form.texto_botao.trim() || null,
      valido_ate: form.valido_ate || null,
      ordem: Number(form.ordem) || 0,
    };
    const { error } = editando === "novo"
      ? await supabase.from("comunicados_salao").insert([payload])
      : await supabase.from("comunicados_salao").update(payload).eq("id", editando).eq("salao_id", perfil.salao_id);
    setSalvando(false);
    if (error) { toast.erro("Erro ao salvar comunicado."); return; }
    toast.sucesso(editando === "novo" ? "Comunicado criado!" : "Comunicado atualizado!");
    fecharForm(); carregar();
  }

  async function alternarAtivo(c: any) {
    const { error } = await supabase.from("comunicados_salao").update({ ativo: !c.ativo }).eq("id", c.id).eq("salao_id", perfil.salao_id);
    if (error) { toast.erro("Erro ao alterar status."); return; }
    carregar();
  }

  async function excluir(id: string) {
    if (!await confirmarAcaoGlobal({ titulo: 'Excluir comunicado?', descricao: 'O comunicado será removido permanentemente do portal.', perigoso: true })) return;
    await supabase.from("comunicados_salao").delete().eq("id", id).eq("salao_id", perfil.salao_id);
    toast.sucesso("Comunicado excluído.");
    carregar();
  }

  const f = (campo: string) => (e: any) => setForm(prev => ({ ...prev, [campo]: e.target.value }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ fontFamily: FONTE_TITULO, margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: C.sidebarBg }}>Comunicados e Destaques</h3>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>Publique promoções, lançamentos e avisos que aparecem no portal das suas clientes.</p>
        </div>
        <button onClick={abrirNovo} className="transition-all hover:opacity-90" style={{ ...botaoPrimario, width: "auto", padding: "10px 18px", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <FiPlus size={14} /> Novo Comunicado
        </button>
      </div>

      {/* FORMULÁRIO */}
      {editando && (
        <div style={{ ...cardAdmin, borderLeft: `3px solid ${C.sidebarBg}`, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>
              {editando === "novo" ? "Novo comunicado" : "Editar comunicado"}
            </h4>
            <button onClick={fecharForm} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight }}><FiX size={18} /></button>
          </div>

          <div>
            <label style={labelPadrao}>Tipo</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TIPOS.map(t => (
                <button key={t.valor} type="button" onClick={() => setForm(p => ({ ...p, tipo: t.valor }))}
                  style={{ padding: "8px 14px", borderRadius: RAIO_MD, border: `1px solid ${form.tipo === t.valor ? C.sidebarBg : C.borderMid}`, background: form.tipo === t.valor ? C.sidebarBg : C.bgCard, color: form.tipo === t.valor ? "#fff" : C.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {t.rotulo}
                </button>
              ))}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: C.textLight }}>
              {TIPOS.find(t => t.valor === form.tipo)?.descricao}
            </p>
          </div>

          <div>
            <label style={labelPadrao}>Título *</label>
            <input type="text" value={form.titulo} onChange={f("titulo")} maxLength={80} placeholder="Ex: 20% de desconto em coloração este mês!" style={inputAdmin} />
          </div>

          <div>
            <label style={labelPadrao}>Descrição <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
            <textarea value={form.descricao} onChange={f("descricao")} maxLength={400} rows={3} placeholder="Detalhes adicionais da promoção ou comunicado..." style={{ ...inputAdmin, height: "auto", resize: "none", paddingTop: 10, paddingBottom: 10 }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelPadrao}>URL da Imagem <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
              <input type="url" value={form.imagem_url} onChange={f("imagem_url")} placeholder="https://..." style={inputAdmin} />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: C.textLight }}>Link direto de uma imagem (Instagram, Drive público, etc.)</p>
            </div>
            <div>
              <label style={labelPadrao}>Válido até <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
              <input type="date" value={form.valido_ate} onChange={f("valido_ate")} style={inputAdmin} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div>
              <label style={labelPadrao}>Link do Botão <span style={{ fontWeight: 400, color: C.textLight }}>(opcional)</span></label>
              <input type="url" value={form.link_acao} onChange={f("link_acao")} placeholder="https://wa.me/..." style={inputAdmin} />
            </div>
            <div>
              <label style={labelPadrao}>Texto do Botão</label>
              <input type="text" value={form.texto_botao} onChange={f("texto_botao")} placeholder="Saiba mais" maxLength={30} style={inputAdmin} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={fecharForm} style={{ padding: "10px 18px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="transition-all hover:opacity-90" style={{ ...botaoPrimario, width: "auto", padding: "10px 22px", display: "flex", alignItems: "center", gap: 8 }}>
              <FiCheck size={14} /> {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* LISTA */}
      {carregando ? (
        <p style={{ textAlign: "center", fontSize: 13, color: C.textLight, padding: 20 }}>A carregar comunicados...</p>
      ) : comunicados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <FiSpeaker size={32} color={C.borderMid} style={{ marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textMain }}>Nenhum comunicado ainda</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.textLight }}>Crie o primeiro usando o botão acima.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {comunicados.map(c => (
            <div key={c.id} style={{ ...cardAdmin, display: "flex", alignItems: "center", gap: 14, opacity: c.ativo ? 1 : 0.55 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.ativo ? C.success : C.borderMid, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: C.bg, color: C.textMuted, border: `1px solid ${C.border}`, textTransform: "uppercase" }}>{TIPOS.find(t => t.valor === c.tipo)?.rotulo}</span>
                  <h4 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 13, fontWeight: 700, color: C.textMain }}>{c.titulo}</h4>
                </div>
                {c.valido_ate && <p style={{ margin: "3px 0 0", fontSize: 11, color: C.textLight }}>Válido até {new Date(c.valido_ate + "T12:00:00").toLocaleDateString("pt-BR")}</p>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => alternarAtivo(c)} title={c.ativo ? "Desativar" : "Ativar"} style={{ background: "none", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "6px 8px", cursor: "pointer", color: c.ativo ? C.success : C.textLight, display: "flex" }}>
                  {c.ativo ? <FiEye size={14} /> : <FiEyeOff size={14} />}
                </button>
                <button onClick={() => abrirEditar(c)} title="Editar" style={{ background: "none", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "6px 8px", cursor: "pointer", color: C.sidebarBg, display: "flex" }}>
                  <FiEdit2 size={14} />
                </button>
                <button onClick={() => excluir(c.id)} title="Excluir" style={{ background: "none", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "6px 8px", cursor: "pointer", color: C.danger, display: "flex" }}>
                  <FiTrash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
