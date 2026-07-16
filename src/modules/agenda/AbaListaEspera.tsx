'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { inputAdmin, RAIO_SM, RAIO_MD, RAIO_XL, RAIO_2XL, overlayModal, SOMBRA_MODAL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { FiClock, FiUsers, FiPhone, FiScissors, FiCalendar, FiSun, FiMessageCircle, FiCheck, FiPlus, FiX } from "react-icons/fi";

export function AbaListaEspera({ perfil }: any) {
  // ─── LÓGICA INTACTA ──────────────────────────────────────────────────────────
  const toast = useToast();
    const [lista, setLista] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const formVazio = { cliente_nome: "", telefone: "", servico_desejado: "", data_desejada: "", periodo: "Qualquer" };
  const [form, setForm] = useState(formVazio);

  async function carregarLista() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const { data, error } = await supabase
      .from('lista_espera')
      .select('*')
      .eq('salao_id', perfil.salao_id)
      .eq('status', 'Aguardando')
      .order('created_at', { ascending: true });
    
    if (data) setLista(data);
    setCarregando(false);
  }

  useEffect(() => { carregarLista(); }, [perfil]);

  async function adicionarFila(e: any) {
    e.preventDefault();

    if (!form.cliente_nome || !form.telefone) {
      toast.aviso('Nome e telefone são obrigatórios.');
      return;
    }

    setSalvando(true);
    const { error } = await supabase.from('lista_espera').insert([{
      salao_id: perfil.salao_id,
      ...form
    }]);

    setSalvando(false);

    if (error) {
      toast.erro("Erro ao adicionar: " + error.message);
      return;
    }

    setModalAberto(false);
    setForm(formVazio);
    carregarLista();
  }

  async function marcarComoAtendido(id: number) {
    const { error } = await supabase.from('lista_espera').update({ status: 'Atendido' }).eq('id', id);
    if (!error) carregarLista();
  }

  function notificarWhatsApp(cliente: any) {
    const numeroLimpo = cliente.telefone.replace(/\D/g, '');
    const dataFormatada = cliente.data_desejada ? new Date(cliente.data_desejada + "T12:00:00").toLocaleDateString('pt-BR') : 'hoje';
    const msg = encodeURIComponent(`Olá ${cliente.cliente_nome}! Boas notícias da clínica. Acabou de abrir uma vaga para ${cliente.servico_desejado || 'o seu serviço'} no dia ${dataFormatada}. Gostaria de garantir este horário?`);
    window.open(`https://wa.me/55${numeroLimpo}?text=${msg}`, '_blank');
  }

  // ─── ESTILOS REFINADOS (Clean & Clinical) ──────────────────────────────────
  const inputStyle = { ...inputAdmin, marginBottom: 16 };

  if (carregando) return (
    <div className="flex h-full items-center justify-center font-title uppercase tracking-widest font-bold text-sm" style={{ color: C.textLight }}>
      A carregar fila de espera... ⏳
    </div>
  );

  return (
    <div className="font-body" style={{ padding: 32, flex: 1, overflowY: "auto", background: C.bg }}>
      
      {/* ─── CABEÇALHO ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h2 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 10 }}>
            <FiClock size={20} /> Fila de Espera
          </h2>
          <p style={{ margin: "6px 0 0", color: C.textMuted, fontSize: 13, fontWeight: 500 }}>
            Gerencie os clientes em espera e preencha as lacunas de cancelamentos na agenda.
          </p>
        </div>
        <button 
          onClick={() => setModalAberto(true)} 
          className="font-title uppercase tracking-wider transition-all hover:scale-[1.02] shadow-sm"
          style={{ display: "flex", alignItems: "center", gap: 8, background: C.sidebarBg, color: "#fff", border: "none", padding: "12px 20px", borderRadius: RAIO_MD, fontWeight: 700, cursor: "pointer", fontSize: 11 }}
        >
          <FiPlus size={16} /> Adicionar à Fila
        </button>
      </div>

      {/* ─── LISTA ─── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {lista.length === 0 && (
          <div style={{ padding: 60, textAlign: "center", background: C.bgCard, borderRadius: RAIO_XL, border: `1px dashed ${C.borderMid}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <FiUsers size={40} color={C.borderMid} />
            <h3 className="font-title uppercase tracking-wider" style={{ color: C.textMain, margin: 0, fontSize: 14, fontWeight: 700 }}>A fila de espera está vazia</h3>
            <p style={{margin: 0, fontSize: 13, color: C.textMuted}}>Não há clientes aguardando por horários no momento.</p>
          </div>
        )}

        {lista.map((item, index) => (
          <div key={item.id} className="transition-all hover:shadow-sm" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bgCard, padding: "20px 24px", borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.sidebarBg}` }}>
            
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* Indicador de Posição Neutro */}
              <div className="font-title" style={{ width: 44, height: 44, background: C.bg, color: C.textMain, borderRadius: RAIO_MD, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
                {index + 1}º
              </div>
              
              <div>
                <h4 className="font-title tracking-wide" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.sidebarBg }}>
                  {item.cliente_nome}
                </h4>
                
                <div style={{ margin: "6px 0 0", fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 12, fontWeight: 500 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><FiPhone size={14} color={C.textLight} /> {item.telefone}</span>
                  {item.servico_desejado && <span style={{ display: "flex", alignItems: "center", gap: 6 }}>• <FiScissors size={14} color={C.textLight} /> {item.servico_desejado}</span>}
                </div>
                
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {item.data_desejada && (
                    <span style={{ display: "flex", alignItems: "center", gap: 6, background: C.bg, border: `1px solid ${C.border}`, color: C.textMain, padding: "4px 10px", borderRadius: RAIO_SM, fontSize: 11, fontWeight: 600 }}>
                      <FiCalendar size={12} color={C.textLight} /> {new Date(item.data_desejada + "T12:00:00").toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  <span style={{ display: "flex", alignItems: "center", gap: 6, background: "#FDF8E7", border: "1px solid #FDE68A", color: "#9A7B2C", padding: "4px 10px", borderRadius: RAIO_SM, fontSize: 11, fontWeight: 600 }}>
                    <FiSun size={12} /> {item.periodo}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => notificarWhatsApp(item)}
                className="transition-all hover:opacity-90"
                style={{ background: C.success, color: "#fff", border: "none", padding: "10px 16px", borderRadius: RAIO_MD, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
              >
                <FiMessageCircle size={16} /> Avisar Cliente
              </button>
              <button
                onClick={() => marcarComoAtendido(item.id)}
                className="transition-all hover:bg-slate-50"
                style={{ background: "transparent", color: C.sidebarBg, border: `1px solid ${C.borderMid}`, padding: "10px 16px", borderRadius: RAIO_MD, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
              >
                <FiCheck size={16} /> Concluir
              </button>
            </div>
            
          </div>
        ))}
      </div>

      {/* ─── MODAL DE ADIÇÃO ─── */}
      {modalAberto && (
        <div style={{ ...overlayModal, zIndex: 9999 }}>
          <div style={{ background: C.bgCard, padding: 32, borderRadius: RAIO_2XL, width: 420, boxShadow: SOMBRA_MODAL }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 14, color: C.sidebarBg, fontWeight: 700 }}>Nova Fila de Espera</h3>
              <button onClick={() => setModalAberto(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex" }}>
                <FiX size={24} />
              </button>
            </div>
            
            <form onSubmit={adicionarFila}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Nome do Cliente *</label>
              <input style={inputStyle} placeholder="Nome completo" value={form.cliente_nome} onChange={e => setForm({...form, cliente_nome: e.target.value})} required autoFocus />
              
              <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>WhatsApp *</label>
              <input style={inputStyle} placeholder="(11) 99999-9999" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} required />
              
              <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Serviço (Opcional)</label>
              <input style={inputStyle} placeholder="Qual serviço ela deseja?" value={form.servico_desejado} onChange={e => setForm({...form, servico_desejado: e.target.value})} />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Data Desejada</label>
                  <input type="date" style={{...inputStyle, marginBottom: 0}} value={form.data_desejada} onChange={e => setForm({...form, data_desejada: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>Período</label>
                  <select style={{...inputStyle, marginBottom: 0}} value={form.periodo} onChange={e => setForm({...form, periodo: e.target.value})}>
                    <option value="Qualquer">Qualquer</option>
                    <option value="Manhã">Manhã</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Noite">Noite</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
                <button type="button" onClick={() => setModalAberto(false)} style={{ flex: 1, background: "transparent", color: C.textMuted, border: `1px solid ${C.borderMid}`, padding: "14px", borderRadius: RAIO_MD, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                <button type="submit" disabled={salvando} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.sidebarBg, color: "#fff", border: "none", padding: "14px", borderRadius: RAIO_MD, fontWeight: 600, cursor: salvando ? "not-allowed" : "pointer", fontSize: 13 }}>
                  {salvando ? "A guardar..." : <><FiPlus size={16} /> Adicionar à Fila</>}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}