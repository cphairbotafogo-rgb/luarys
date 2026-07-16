'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { inputAdmin, labelPadrao, RAIO_XS, RAIO_SM, RAIO_MD, RAIO_XL, RAIO_3XL, overlayModal, SOMBRA_MODAL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { Btn, Card } from "@/components/ui";
import { FiMessageCircle, FiEdit2, FiTrash2, FiSave, FiX, FiPhone, FiMail, FiFileText, FiMapPin, FiBriefcase } from "react-icons/fi";

export function GavetaParceiros({ perfil }: any) {
  const toast = useToast();
    const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const formVazio = { 
    nome_empresa: "", razao_social: "", is_fabricante: false,
    nome_contato: "", telefone: "", email: "", chave_pix: "", 
    cep: "", tipo_logradouro: "Rua", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
    cnpj: "", inscricao_estadual: "", inscricao_municipal: "", observacoes: "" 
  };
  const [form, setForm] = useState(formVazio);

  async function carregarFornecedores() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const { data } = await supabase.from('fornecedores').select('*').eq('salao_id', perfil.salao_id).order('nome_empresa');
    if (data) setFornecedores(data);
    setCarregando(false);
  }

  useEffect(() => { carregarFornecedores(); }, [perfil]);

  // 🚀 BUSCA DE CEP AUTOMÁTICA
  async function buscarCep(cepDigitado: string) {
    setForm({ ...form, cep: cepDigitado });
    const cepLimpo = cepDigitado.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setForm(prev => ({
            ...prev, logradouro: data.logradouro || prev.logradouro, bairro: data.bairro || prev.bairro,
            cidade: data.localidade || prev.cidade, estado: data.uf || prev.estado
          }));
        }
      } catch (error) { if (process.env.NODE_ENV === 'development') console.error("Erro no CEP", error); }
    }
  }

  function abrirNovo() { setForm(formVazio); setEditandoId(null); setModalAberto(true); }

  function abrirEdicao(f: any) {
    setForm({
      nome_empresa: f.nome_empresa || "", razao_social: f.razao_social || "", is_fabricante: f.is_fabricante || false,
      nome_contato: f.nome_contato || "", telefone: f.telefone || "", email: f.email || "", chave_pix: f.chave_pix || "", 
      cep: f.cep || "", tipo_logradouro: f.tipo_logradouro || "Rua", logradouro: f.logradouro || "", numero: f.numero || "", 
      complemento: f.complemento || "", bairro: f.bairro || "", cidade: f.cidade || "", estado: f.estado || "",
      cnpj: f.cnpj || "", inscricao_estadual: f.inscricao_estadual || "", inscricao_municipal: f.inscricao_municipal || "",
      observacoes: f.observacoes || ""
    });
    setEditandoId(f.id); setModalAberto(true);
  }

  async function salvarFornecedor(e: any) {
    e.preventDefault();

    if (!form.nome_empresa) {
      toast.aviso('O Nome Fantasia / Marca é obrigatório.');
      return;
    }

    const dados = { salao_id: perfil.salao_id, ...form };
    const { error } = editandoId
      ? await supabase.from('fornecedores').update(dados).eq('id', editandoId)
      : await supabase.from('fornecedores').insert([dados]);

    if (error) {
      toast.erro("Erro ao salvar parceiro: " + error.message);
      return;
    }

    toast.sucesso('Parceiro salvo com sucesso!');
    setModalAberto(false);
    carregarFornecedores();
  }

  async function excluirFornecedor(id: string) {
    if (!await confirmarAcaoGlobal({ titulo: 'Remover parceiro?', descricao: 'O parceiro será removido da sua rede permanentemente.', perigoso: true })) return;
    await supabase.from('fornecedores').delete().eq('id', id);
    carregarFornecedores();
  }

  function chamarWhatsApp(telefone: string) {
    if (!telefone) return;
    window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}`, '_blank');
  }

  const inputStyle = inputAdmin;
  const labelStyle = labelPadrao;

  if (carregando) return <div style={{padding: 20, color: C.textMuted}}>A carregar a sua rede de parceiros...</div>;

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20}}>
        <h3 style={{margin: 0, fontSize: 18, color: C.sidebarBg, fontWeight: 800}}>Rede de Parceiros (Fornecedores)</h3>
        <Btn onClick={abrirNovo} style={{ background: C.sidebarBg, color: "#fff", border: "none" }}>+ Novo Parceiro</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {fornecedores.length === 0 && <p style={{color: C.textMuted, gridColumn: "1 / -1"}}>Nenhum fornecedor cadastrado. Comece a montar a sua rede!</p>}

        {fornecedores.map(f => (
          <Card key={f.id} style={{ padding: 20, borderTop: f.is_fabricante ? `4px solid ${C.douradoEleva}` : `4px solid ${C.sidebarBg}` }}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8}}>
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.sidebarBg }}>{f.nome_empresa}</h4>
                <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>👤 {f.nome_contato || 'S/ Contato direto'}</p>
              </div>
              {f.is_fabricante && <span style={{background: "#FFFBEB", color: "#92400E", padding: "4px 8px", borderRadius: RAIO_SM, fontSize: 10, fontWeight: 800}}>Fabricante</span>}
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: C.textMain, marginBottom: 20, marginTop: 12, background: C.bg, padding: 12, borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}` }}>
              {f.telefone && <div style={{display: "flex", alignItems: "center", gap: 6}}><FiPhone color={C.textMuted}/> <strong>Tel:</strong> {f.telefone}</div>}
              {f.email && <div style={{display: "flex", alignItems: "center", gap: 6}}><FiMail color={C.textMuted}/> <strong>E-mail:</strong> {f.email}</div>}
              {f.cnpj && <div style={{display: "flex", alignItems: "center", gap: 6}}><FiFileText color={C.textMuted}/> <strong>CNPJ:</strong> {f.cnpj}</div>}
              {f.cidade && <div style={{display: "flex", alignItems: "center", gap: 6}}><FiMapPin color={C.textMuted}/> <strong>Local:</strong> {f.cidade} - {f.estado}</div>}
              {f.chave_pix && <div style={{marginTop: 4}}><strong>PIX:</strong> <span style={{background: C.successBg, color: C.successText, padding: "2px 6px", borderRadius: RAIO_XS, fontWeight: 800}}>{f.chave_pix}</span></div>}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {f.telefone && (
                <button onClick={() => chamarWhatsApp(f.telefone)} style={{ flex: 1, background: "#25D366", color: "#fff", border: "none", padding: "8px", borderRadius: RAIO_MD, fontWeight: 800, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
                  <FiMessageCircle size={14}/> Mensagem
                </button>
              )}
              <Btn onClick={() => abrirEdicao(f)} style={{ flex: 1, background: C.bg, color: C.textMain, border: `1px solid ${C.borderMid}`, padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <FiEdit2 size={14}/> Editar Ficha
              </Btn>
            </div>
          </Card>
        ))}
      </div>

      {/* MODAL DE CADASTRO GIGANTE */}
      {modalAberto && (
        <div style={{ ...overlayModal, zIndex: 999 }}>
          <div style={{ background: C.bgCard, borderRadius: RAIO_3XL, padding: 32, width: 700, maxHeight: "90vh", overflowY: "auto", boxShadow: SOMBRA_MODAL }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{margin:0, fontSize:20, fontWeight:800, color:C.sidebarBg, display: "flex", alignItems: "center", gap: 8}}>
                <FiBriefcase size={22}/> {editandoId ? "Editar Parceiro" : "Novo Parceiro / Fornecedor"}
              </h3>
              <button onClick={() => setModalAberto(false)} style={{background:"none", border:"none", cursor:"pointer", color: C.textMuted}}><FiX size={24}/></button>
            </div>
            
            <form onSubmit={salvarFornecedor} style={{display: "flex", flexDirection: "column", gap: 24}}>
              
              {/* BLOCO 1: DADOS PRINCIPAIS */}
              <div>
                <h4 style={{margin: "0 0 12px", fontSize: 14, color: C.sidebarBg, borderBottom: `1px solid ${C.borderMid}`, paddingBottom: 6}}>Informações Básicas</h4>
                <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                  <div style={{display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12}}>
                    <div><label style={labelStyle}>Nome Fantasia / Marca *</label><input style={inputStyle} required value={form.nome_empresa} onChange={e=>setForm({...form, nome_empresa: e.target.value})} placeholder="Ex: L'Oréal Brasil" /></div>
                    <div style={{display: "flex", alignItems: "flex-end", paddingBottom: 8}}>
                      <label style={{display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: C.textMain}}>
                        <input type="checkbox" checked={form.is_fabricante} onChange={e=>setForm({...form, is_fabricante: e.target.checked})} style={{accentColor: C.sidebarBg, width: 18, height: 18}}/>
                        É Fabricante Direto?
                      </label>
                    </div>
                  </div>
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
                    <div><label style={labelStyle}>Nome do Contato/Vendedor</label><input style={inputStyle} value={form.nome_contato} onChange={e=>setForm({...form, nome_contato: e.target.value})} placeholder="Ex: João Silva" /></div>
                    <div><label style={labelStyle}>WhatsApp / Telefone</label><input style={inputStyle} value={form.telefone} onChange={e=>setForm({...form, telefone: e.target.value})} placeholder="(11) 99999-9999" /></div>
                    <div><label style={labelStyle}>E-mail</label><input type="email" style={inputStyle} value={form.email} onChange={e=>setForm({...form, email: e.target.value})} placeholder="vendas@empresa.com" /></div>
                  </div>
                </div>
              </div>

              {/* BLOCO 2: DADOS FISCAIS */}
              <div>
                <h4 style={{margin: "0 0 12px", fontSize: 14, color: C.sidebarBg, borderBottom: `1px solid ${C.borderMid}`, paddingBottom: 6}}>Dados Fiscais & Financeiros</h4>
                <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                  <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:12}}>
                    <div><label style={labelStyle}>Razão Social</label><input style={inputStyle} value={form.razao_social} onChange={e=>setForm({...form, razao_social: e.target.value})} /></div>
                    <div><label style={labelStyle}>CNPJ</label><input style={inputStyle} value={form.cnpj} onChange={e=>setForm({...form, cnpj: e.target.value})} placeholder="00.000.000/0000-00" /></div>
                  </div>
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1.5fr", gap:12}}>
                    <div><label style={labelStyle}>Inscrição Estadual</label><input style={inputStyle} value={form.inscricao_estadual} onChange={e=>setForm({...form, inscricao_estadual: e.target.value})} /></div>
                    <div><label style={labelStyle}>Inscrição Municipal</label><input style={inputStyle} value={form.inscricao_municipal} onChange={e=>setForm({...form, inscricao_municipal: e.target.value})} /></div>
                    <div><label style={{...labelStyle, color: "#059669"}}>Chave PIX (P/ Pagar Faturas)</label><input style={{...inputStyle, borderColor: "#34D399", background: "#ECFDF5"}} value={form.chave_pix} onChange={e=>setForm({...form, chave_pix: e.target.value})} placeholder="CNPJ, E-mail, Celular..." /></div>
                  </div>
                </div>
              </div>

              {/* BLOCO 3: ENDEREÇO */}
              <div>
                <h4 style={{margin: "0 0 12px", fontSize: 14, color: C.sidebarBg, borderBottom: `1px solid ${C.borderMid}`, paddingBottom: 6}}>Endereço Físico</h4>
                <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                  <div style={{display: "grid", gridTemplateColumns: "1fr 1.5fr 3fr 1fr", gap: 12}}>
                    <div><label style={labelStyle}>CEP</label><input style={inputStyle} value={form.cep} onChange={e => buscarCep(e.target.value)} maxLength={9} placeholder="00000-000" /></div>
                    <div><label style={labelStyle}>Tipo</label><select style={inputStyle} value={form.tipo_logradouro} onChange={e=>setForm({...form, tipo_logradouro: e.target.value})}><option value="Rua">Rua</option><option value="Avenida">Avenida</option><option value="Rodovia">Rodovia</option></select></div>
                    <div><label style={labelStyle}>Logradouro</label><input style={inputStyle} value={form.logradouro} onChange={e=>setForm({...form, logradouro: e.target.value})} /></div>
                    <div><label style={labelStyle}>Número</label><input style={inputStyle} value={form.numero} onChange={e=>setForm({...form, numero: e.target.value})} /></div>
                  </div>
                  <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr 1fr", gap: 12}}>
                    <div><label style={labelStyle}>Complemento</label><input style={inputStyle} value={form.complemento} onChange={e=>setForm({...form, complemento: e.target.value})} /></div>
                    <div><label style={labelStyle}>Bairro</label><input style={inputStyle} value={form.bairro} onChange={e=>setForm({...form, bairro: e.target.value})} /></div>
                    <div><label style={labelStyle}>Cidade</label><input style={inputStyle} value={form.cidade} onChange={e=>setForm({...form, cidade: e.target.value})} /></div>
                    <div><label style={labelStyle}>Estado</label><input style={inputStyle} value={form.estado} onChange={e=>setForm({...form, estado: e.target.value})} maxLength={2} /></div>
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Observações Adicionais</label>
                <textarea style={{...inputStyle, height: 60, resize: "none"}} value={form.observacoes} onChange={e=>setForm({...form, observacoes: e.target.value})} placeholder="Prazos de entrega, limites de crédito..." />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12, borderTop: `1px solid ${C.borderMid}`, paddingTop: 20 }}>
                <Btn type="submit" variant="primary" style={{flex:2, padding: "14px 0", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8}}><FiSave size={16}/> Salvar Ficha do Parceiro</Btn>
                {editandoId ? (
                  <Btn type="button" onClick={() => excluirFornecedor(editandoId)} variant="danger" style={{flex:1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8}}><FiTrash2 size={16}/> Excluir</Btn>
                ) : (
                  <Btn type="button" onClick={() => setModalAberto(false)} style={{flex:1, background: C.bg, color: C.textMuted, border: "none"}}>Cancelar</Btn>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}