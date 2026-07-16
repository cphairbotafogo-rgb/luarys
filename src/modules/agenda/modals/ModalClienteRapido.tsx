'use client'
import { useState } from "react";
import { C } from "@/lib/constants";
import { inputAdmin, containerModal, overlayModal, RAIO_MD } from "@/lib/estiloGlobal";
import { FiX, FiUser, FiPhone, FiSave, FiAlertCircle, FiLink } from "react-icons/fi";
import { supabase } from "@/lib/supabase";

export function ModalClienteRapido({ formClienteRapido, setFormClienteRapido, salvarClienteRapido, onClose }: any) {
  const [verificando, setVerificando] = useState(false);
  const [duplicidadeEncontrada, setDuplicidadeEncontrada] = useState<{ id: string; nome: string } | null>(null);

  const inputStyle = { ...inputAdmin };

  // Antes de salvar de fato, verifica se já existe alguém com esse telefone
  // na conta global do cliente (usuarios_portal) — se sim, mostra quem é
  // para conferência, em vez de criar um cliente solto sem vínculo.
  async function verificarDuplicidadeEsalvar() {
    const telefoneLimpo = (formClienteRapido.telefone || '').replace(/\D/g, '');
    if (!telefoneLimpo) {
      // Sem telefone informado, não há o que checar — salva direto.
      salvarClienteRapido(null);
      return;
    }

    setVerificando(true);
    const { data } = await supabase
      .from('usuarios_portal')
      .select('id, nome_completo')
      .eq('telefone_whatsapp', telefoneLimpo)
      .maybeSingle();
    setVerificando(false);

    if (data) {
      setDuplicidadeEncontrada({ id: data.id, nome: data.nome_completo });
    } else {
      salvarClienteRapido(null);
    }
  }

  return (
    <div className="font-body" style={{ ...overlayModal, zIndex: 9999 }}>
      <div style={{ ...containerModal, padding: 32, width: "100%", maxWidth: 420 }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg }}>Novo Cliente Rápido</h3>
          <button onClick={onClose} className="transition-all hover:opacity-100" style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: C.textLight, opacity: 0.8, display: "flex" }}><FiX size={24} /></button>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="font-title uppercase tracking-widest" style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: C.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <FiUser size={14}/> Nome Completo *
            </label>
            <input style={inputStyle} autoFocus required value={formClienteRapido.nome} onChange={e => setFormClienteRapido({...formClienteRapido, nome: e.target.value})} placeholder="Ex: Maria Silva" />
          </div>
          <div>
            <label className="font-title uppercase tracking-widest" style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: C.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <FiPhone size={14}/> WhatsApp
            </label>
            <input style={inputStyle} value={formClienteRapido.telefone} onChange={e => { setFormClienteRapido({...formClienteRapido, telefone: e.target.value}); setDuplicidadeEncontrada(null); }} placeholder="(00) 00000-0000" />
          </div>

          {duplicidadeEncontrada && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: RAIO_MD, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <FiAlertCircle size={16} color="#92400E" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: '#92400E' }}>
                <strong>Já existe um cadastro com esse telefone: {duplicidadeEncontrada.nome}.</strong>
                <br />Deseja vincular esse cliente a este salão, em vez de criar um cadastro novo?
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
          <button onClick={onClose} className="transition-all hover:bg-slate-50" style={{ flex: 1, padding: "12px 0", background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          {duplicidadeEncontrada ? (
            <button onClick={() => salvarClienteRapido(duplicidadeEncontrada.id)} className="transition-all hover:opacity-90" style={{ flex: 2, padding: "12px 0", background: '#D97706', color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}><FiLink size={16}/> Vincular Cliente Existente</button>
          ) : (
            <button onClick={verificarDuplicidadeEsalvar} disabled={verificando} className="transition-all hover:opacity-90" style={{ flex: 2, padding: "12px 0", background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: verificando ? "wait" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, opacity: verificando ? 0.7 : 1 }}><FiSave size={16}/> {verificando ? 'Verificando...' : 'Salvar Rápido'}</button>
          )}
        </div>

      </div>
    </div>
  );
}