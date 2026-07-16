'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { overlayModal, containerModal, inputAdmin, labelPadrao, RAIO_MD } from "@/lib/estiloGlobal";
import { FiSearch, FiX, FiPocket, FiRefreshCw, FiAlertCircle } from "react-icons/fi";
import { FORMAS, avatar } from "./tipos";

interface Props {
  perfil: any;
  initialClienteNome?: string;
  initialClienteId?: string;
  onClose: () => void;
  onSalvo: (valor: number, clienteNome: string) => void;
}

export function ModalDeposito({ perfil, initialClienteNome = "", initialClienteId = "", onClose, onSalvo }: Props) {
  const toast = useToast();
  const [buscaCli, setBuscaCli]           = useState(initialClienteNome);
  const [resultados, setResultados]       = useState<any[]>([]);
  const [buscando, setBuscando]           = useState(false);
  const [salvando, setSalvando]           = useState(false);
  const [form, setForm] = useState({
    cliente_nome: initialClienteNome,
    cliente_id:   initialClienteId,
    valor:        "",
    forma_pagamento: "PIX",
    descricao:    "",
  });

  useEffect(() => {
    if (!buscaCli.trim() || buscaCli.length < 2) { setResultados([]); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      const { data } = await supabase.from('clientes').select('id, nome_completo').ilike('nome_completo', `%${buscaCli}%`).limit(8);
      setResultados(data || []);
      setBuscando(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaCli]);

  async function salvar() {
    if (!form.cliente_nome.trim()) return toast.erro("Selecione um cliente.");
    const valor = parseFloat(form.valor.replace(',', '.'));
    if (!valor || valor <= 0) return toast.erro("Informe um valor válido.");
    setSalvando(true);
    const { error } = await supabase.from('carteira_clientes').insert({
      salao_id:        perfil.salao_id,
      cliente_id:      form.cliente_id || null,
      cliente_nome:    form.cliente_nome,
      tipo:            'deposito',
      valor,
      forma_pagamento: form.forma_pagamento,
      descricao:       form.descricao || null,
      criado_por:      perfil.nome || null,
    });
    setSalvando(false);
    if (error) return toast.erro("Erro ao registrar: " + error.message);
    toast.sucesso(`Saldo de ${brl(valor)} adicionado para ${form.cliente_nome}.`);
    onSalvo(valor, form.cliente_nome);
  }

  function fechar() { setResultados([]); onClose(); }

  return (
    <div style={{ ...overlayModal, zIndex: 999 }}>
      <div style={{ ...containerModal, width: 460, padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8 }}>
            <FiPocket size={18} /> Depositar na Carteira
          </h3>
          <button onClick={fechar} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight }}><FiX size={22} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelPadrao}>Cliente</label>
            <div style={{ position: "relative" }}>
              <FiSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
              <input placeholder="Digite o nome do cliente..." value={buscaCli}
                onChange={e => { setBuscaCli(e.target.value); setForm(f => ({ ...f, cliente_nome: e.target.value, cliente_id: "" })); }}
                style={{ ...inputAdmin, paddingLeft: 36 }} />
              {buscando && <FiRefreshCw size={13} className="animate-spin" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted }} />}
            </div>
            {resultados.length > 0 && (
              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, marginTop: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                {resultados.map(r => (
                  <div key={r.id} onClick={() => { setForm(f => ({ ...f, cliente_nome: r.nome_completo, cliente_id: r.id })); setBuscaCli(r.nome_completo); setResultados([]); }}
                    style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, borderBottom: `1px solid ${C.border}`, color: C.textMain, display: "flex", alignItems: "center", gap: 10 }}
                    className="hover:bg-slate-50">
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${C.sidebarBg}18`, color: C.sidebarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                      {avatar(r.nome_completo)}
                    </div>
                    {r.nome_completo}
                  </div>
                ))}
              </div>
            )}
            {form.cliente_id && <div style={{ marginTop: 6, fontSize: 11, color: "#10B981", fontWeight: 700 }}>✓ Cliente vinculado ao cadastro</div>}
          </div>

          <div>
            <label style={labelPadrao}>Valor (R$)</label>
            <input type="number" min="0.01" step="0.01" placeholder="0,00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} style={inputAdmin} />
          </div>

          <div>
            <label style={labelPadrao}>Forma de pagamento recebida</label>
            <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))} style={{ ...inputAdmin, cursor: "pointer" }}>
              {FORMAS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label style={labelPadrao}>Observação (opcional)</label>
            <input placeholder="Ex.: Pré-pago para tratamento de verão" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={inputAdmin} />
          </div>

          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: RAIO_MD, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <FiAlertCircle size={16} color="#3B82F6" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12, color: "#1D4ED8", lineHeight: 1.5 }}>
              O saldo ficará disponível para abatimento no fechamento de atendimentos futuros deste cliente.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button onClick={fechar} style={{ flex: 1, padding: "12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando}
            style={{ flex: 2, padding: "12px", borderRadius: RAIO_MD, border: "none", background: salvando ? C.borderMid : C.sidebarBg, color: "#fff", fontWeight: 700, fontSize: 13, cursor: salvando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <FiPocket size={15} /> {salvando ? "Registrando..." : "Confirmar Depósito"}
          </button>
        </div>
      </div>
    </div>
  );
}
