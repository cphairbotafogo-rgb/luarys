'use client'
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { inputAdmin, RAIO_SM, RAIO_MD, RAIO_XL, RAIO_2XL, overlayModal, SOMBRA_MODAL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { FiClock, FiUsers, FiPhone, FiScissors, FiCalendar, FiSun, FiMessageCircle, FiCheck, FiPlus, FiX, FiSearch } from "react-icons/fi";

const formVazio = { cliente_nome: "", telefone: "", servico_desejado: "", data_desejada: "", periodo: "Qualquer" };

export function AbaListaEspera({ perfil }: any) {
  const toast = useToast();
  const [lista, setLista] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(formVazio);

  // Autocomplete de cliente
  const [clientesBusca, setClientesBusca] = useState<any[]>([]);
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function buscarClientes(termo: string) {
    if (!termo || termo.length < 2) { setClientesBusca([]); setMostrarBusca(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome_completo, telefone_whatsapp')
        .eq('salao_id', perfil.salao_id)
        .or(`nome_completo.ilike.%${termo}%,telefone_whatsapp.ilike.%${termo}%`)
        .limit(6);
      setClientesBusca(data || []);
      setMostrarBusca((data?.length || 0) > 0);
    }, 250);
  }

  function selecionarCliente(c: any) {
    setForm(f => ({ ...f, cliente_nome: c.nome_completo || '', telefone: c.telefone_whatsapp || '' }));
    setMostrarBusca(false);
    setClientesBusca([]);
  }

  async function carregarLista() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const { data } = await supabase
      .from('lista_espera').select('*')
      .eq('salao_id', perfil.salao_id).eq('status', 'Aguardando')
      .order('created_at', { ascending: true });
    if (data) setLista(data);
    setCarregando(false);
  }

  useEffect(() => { carregarLista(); }, [perfil]);

  async function adicionarFila(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_nome || !form.telefone) { toast.aviso('Nome e telefone são obrigatórios.'); return; }
    setSalvando(true);
    const { error } = await supabase.from('lista_espera').insert([{ salao_id: perfil.salao_id, ...form }]);
    setSalvando(false);
    if (error) { toast.erro("Erro ao adicionar: " + error.message); return; }
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
    const msg = encodeURIComponent(`Olá ${cliente.cliente_nome}! Boas notícias do salão. Acabou de abrir uma vaga para ${cliente.servico_desejado || 'o seu serviço'} no dia ${dataFormatada}. Gostaria de garantir este horário?`);
    window.open(`https://wa.me/55${numeroLimpo}?text=${msg}`, '_blank');
  }

  const inputStyle = { ...inputAdmin, marginBottom: 16 };
  const label = (txt: string) => (
    <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 6, display: "block", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>{txt}</label>
  );

  if (carregando) return (
    <div className="flex h-full items-center justify-center font-title uppercase tracking-widest font-bold text-sm" style={{ color: C.textLight }}>
      Carregando fila de espera...
    </div>
  );

  return (
    <div className="font-body" style={{ padding: 32, flex: 1, overflowY: "auto", background: C.bg }}>

      {/* Cabeçalho */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h2 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 10 }}>
            <FiClock size={20} /> Fila de Espera
          </h2>
          <p style={{ margin: "6px 0 0", color: C.textMuted, fontSize: 13, fontWeight: 500 }}>
            Gerencie os clientes em espera e preencha lacunas de cancelamentos.
          </p>
        </div>
        <button onClick={() => { setModalAberto(true); setForm(formVazio); setClientesBusca([]); setMostrarBusca(false); }}
          style={{ display: "flex", alignItems: "center", gap: 8, background: C.sidebarBg, color: "#fff", border: "none", padding: "12px 20px", borderRadius: RAIO_MD, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>
          <FiPlus size={16} /> Adicionar à Fila
        </button>
      </div>

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {lista.length === 0 && (
          <div style={{ padding: 60, textAlign: "center", background: C.bgCard, borderRadius: RAIO_XL, border: `1px dashed ${C.borderMid}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <FiUsers size={40} color={C.borderMid} />
            <h3 style={{ color: C.textMain, margin: 0, fontSize: 14, fontWeight: 700 }}>A fila de espera está vazia</h3>
            <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>Nenhum cliente aguardando horário no momento.</p>
          </div>
        )}
        {lista.map((item, index) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bgCard, padding: "20px 24px", borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.sidebarBg}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 44, height: 44, background: C.bg, color: C.textMain, borderRadius: RAIO_MD, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
                {index + 1}º
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.sidebarBg }}>{item.cliente_nome}</h4>
                <div style={{ margin: "6px 0 0", fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 12 }}>
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
              <button onClick={() => notificarWhatsApp(item)}
                style={{ background: C.success, color: "#fff", border: "none", padding: "10px 16px", borderRadius: RAIO_MD, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <FiMessageCircle size={16} /> Avisar
              </button>
              <button onClick={() => marcarComoAtendido(item.id)}
                style={{ background: "transparent", color: C.sidebarBg, border: `1px solid ${C.borderMid}`, padding: "10px 16px", borderRadius: RAIO_MD, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <FiCheck size={16} /> Concluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de adição */}
      {modalAberto && (
        <div style={{ ...overlayModal, zIndex: 9999 }}>
          <div style={{ background: C.bgCard, padding: 32, borderRadius: RAIO_2XL, width: 440, boxShadow: SOMBRA_MODAL }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: C.sidebarBg, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Nova Fila de Espera</h3>
              <button onClick={() => setModalAberto(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight }}>
                <FiX size={22} />
              </button>
            </div>

            <form onSubmit={adicionarFila}>

              {/* Campo nome com autocomplete */}
              {label('Buscar cliente (nome ou telefone) *')}
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <div style={{ position: 'relative' }}>
                  <FiSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, pointerEvents: 'none' }} />
                  <input
                    style={{ ...inputAdmin, paddingLeft: 34, marginBottom: 0 }}
                    placeholder="Digite o nome ou telefone do cliente..."
                    value={form.cliente_nome}
                    onChange={e => { setForm(f => ({ ...f, cliente_nome: e.target.value })); buscarClientes(e.target.value); }}
                    onFocus={() => form.cliente_nome.length >= 2 && clientesBusca.length > 0 && setMostrarBusca(true)}
                    onBlur={() => setTimeout(() => setMostrarBusca(false), 180)}
                    required autoFocus
                  />
                </div>
                {mostrarBusca && clientesBusca.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden' }}>
                    {clientesBusca.map(c => (
                      <button key={c.id} type="button" onClick={() => selecionarCliente(c)}
                        style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseOver={e => (e.currentTarget.style.background = C.bg)}
                        onMouseOut={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{c.nome_completo}</span>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{c.telefone_whatsapp || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {label('WhatsApp *')}
              <input style={inputStyle} placeholder="(11) 99999-9999" value={form.telefone}
                onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} required />

              {label('Serviço desejado')}
              <input style={inputStyle} placeholder="Qual serviço a cliente deseja?" value={form.servico_desejado}
                onChange={e => setForm(f => ({ ...f, servico_desejado: e.target.value }))} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  {label('Data desejada')}
                  <input type="date" style={{ ...inputStyle, marginBottom: 0 }} value={form.data_desejada}
                    onChange={e => setForm(f => ({ ...f, data_desejada: e.target.value }))} />
                </div>
                <div>
                  {label('Período')}
                  <select style={{ ...inputStyle, marginBottom: 0 }} value={form.periodo}
                    onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))}>
                    <option value="Qualquer">Qualquer</option>
                    <option value="Manhã">Manhã</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Noite">Noite</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
                <button type="button" onClick={() => setModalAberto(false)}
                  style={{ flex: 1, background: "transparent", color: C.textMuted, border: `1px solid ${C.borderMid}`, padding: 14, borderRadius: RAIO_MD, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: C.sidebarBg, color: "#fff", border: "none", padding: 14, borderRadius: RAIO_MD, fontWeight: 600, cursor: salvando ? "not-allowed" : "pointer", fontSize: 13 }}>
                  {salvando ? "Salvando..." : <><FiPlus size={16} /> Adicionar à Fila</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
