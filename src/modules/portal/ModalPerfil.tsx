'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { FONTE_CORPO, FONTE_TITULO } from "./estiloPortal";
import { RAIO_MD, RAIO_XL, RAIO_2XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { FiX, FiUser, FiCheck, FiEye, FiEyeOff, FiLock } from "react-icons/fi";

function mascaraTel(v: string): string {
  const comPlus = v.trimStart().startsWith('+');
  let d = v.replace(/\D/g, '');
  let prefix = '';
  // Preserva +55 se o número foi salvo com DDI (>11 dígitos começando com 55)
  // ou se o usuário digitou explicitamente o "+"
  if (d.startsWith('55') && (comPlus || d.length > 11)) {
    prefix = '+55 ';
    d = d.slice(2);
  }
  d = d.slice(0, 11);
  if (!d) return prefix ? '+55' : '';
  if (d.length <= 10) {
    const ddd = d.slice(0, 2);
    const p1  = d.slice(2, 6);
    const p2  = d.slice(6, 10);
    if (!ddd) return prefix ? '+55' : '';
    return prefix + '(' + ddd + (p1 ? ') ' + p1 : '') + (p2 ? '-' + p2 : '');
  }
  return prefix + d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
}

function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function ModalPerfil({ clienteFresh, setClienteFresh, modalAberto, fecharModal }: any) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");

  const [dados, setDados] = useState({
    nome_completo: clienteFresh?.nome_completo || '',
    telefone_whatsapp: mascaraTel(clienteFresh?.telefone_whatsapp || ''),
    cpf: clienteFresh?.cpf || '',
    email: clienteFresh?.email || '',
    endereco: clienteFresh?.endereco || '',
    bairro: clienteFresh?.bairro || '',
    cidade: clienteFresh?.cidade || ''
  });
  const [aceitaMarketing, setAceitaMarketing] = useState<boolean>(
    clienteFresh?.aceita_marketing !== false
  );

  // Sincroniza os campos sempre que o modal abre ou clienteFresh muda
  useEffect(() => {
    if (modalAberto) {
      setDados({
        nome_completo: clienteFresh?.nome_completo || '',
        telefone_whatsapp: mascaraTel(clienteFresh?.telefone_whatsapp || ''),
        cpf: clienteFresh?.cpf || '',
        email: clienteFresh?.email || '',
        endereco: clienteFresh?.endereco || '',
        bairro: clienteFresh?.bairro || '',
        cidade: clienteFresh?.cidade || ''
      });
      setAceitaMarketing(clienteFresh?.aceita_marketing !== false);
      setNovaSenha("");
    }
  }, [modalAberto, clienteFresh]);

  if (!modalAberto) return null;

  async function salvarPerfil(e: any) {
    e.preventDefault();
    if (!clienteFresh?.id) return;

    setSalvando(true);

    // Atualiza dados de perfil na tabela clientes (sem senha)
    const { error } = await supabase
      .from('clientes')
      .update({ ...dados, aceita_marketing: aceitaMarketing })
      .eq('id', clienteFresh.id);

    if (error) {
      toast.erro("Erro ao salvar: " + error.message);
      setSalvando(false);
      return;
    }

    // Atualiza senha via Supabase Auth (hash automático, nunca salva em texto plano)
    if (novaSenha.trim().length >= 6) {
      const { error: erroSenha } = await supabase.auth.updateUser({ password: novaSenha.trim() });
      if (erroSenha) {
        toast.erro("Perfil salvo, mas erro ao alterar senha: " + erroSenha.message);
        setSalvando(false);
        return;
      }
    }

    const clienteAtualizado = { ...clienteFresh, ...dados, aceita_marketing: aceitaMarketing };
    setClienteFresh(clienteAtualizado);
    toast.sucesso('Perfil atualizado com sucesso!');
    fecharModal();
    setSalvando(false);
  }

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
    boxSizing: "border-box" as const, fontSize: 13, color: C.textMain,
    outlineColor: C.sidebarBg, fontFamily: FONTE_CORPO, fontWeight: 500
  };

  const labelStyle = {
    fontFamily: FONTE_TITULO,
    fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block",
    marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.5px"
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24, fontFamily: FONTE_CORPO }}>
      <div style={{ background: C.bgCard, width: "100%", maxWidth: 500, maxHeight: "90vh", borderRadius: RAIO_2XL, padding: 32, display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden", border: `1px solid ${C.border}`, borderTop: `4px solid ${C.douradoEleva}` }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h3 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 16, fontWeight: 700, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              <FiUser size={18} /> Meu Perfil
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Mantenha os seus dados atualizados.</p>
          </div>
          <button type="button" onClick={fecharModal} className="transition-all hover:opacity-100" style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, opacity: 0.8, display: "flex", padding: 4 }}><FiX size={24} /></button>
        </div>

        {/* Formulário */}
        <form onSubmit={salvarPerfil} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingRight: 4 }}>

          <div>
            <label style={labelStyle}>Nome Completo</label>
            <input type="text" value={dados.nome_completo} onChange={e => setDados({...dados, nome_completo: e.target.value})} required style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>WhatsApp</label>
              <input
                type="tel"
                value={dados.telefone_whatsapp}
                onChange={e => setDados({ ...dados, telefone_whatsapp: mascaraTel(e.target.value) })}
                required
                placeholder="(11) 99999-9999"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input type="email" value={dados.email} onChange={e => setDados({...dados, email: e.target.value})} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>CPF</label>
            <input
              type="text"
              value={dados.cpf}
              onChange={e => setDados({ ...dados, cpf: mascaraCpf(e.target.value) })}
              placeholder="000.000.000-00 (opcional)"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Endereço (Rua, Nº, Apt)</label>
            <input type="text" value={dados.endereco} onChange={e => setDados({...dados, endereco: e.target.value})} style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Bairro</label>
              <input type="text" value={dados.bairro} onChange={e => setDados({...dados, bairro: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cidade</label>
              <input type="text" value={dados.cidade} onChange={e => setDados({...dados, cidade: e.target.value})} style={inputStyle} />
            </div>
          </div>

          {/* Preferência de Marketing */}
          <div style={{ padding: 16, background: C.bg, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.textMain, fontFamily: FONTE_TITULO }}>Promoções e novidades</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textLight }}>Lembretes de agendamento são sempre enviados independentemente desta opção.</p>
            </div>
            <div onClick={() => setAceitaMarketing(v => !v)} style={{ width: 40, height: 22, borderRadius: 99, background: aceitaMarketing ? "#16A34A" : C.borderMid, position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: aceitaMarketing ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </div>
          </div>

          {/* Container de Senha */}
          <div style={{ padding: 20, background: C.bg, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, marginTop: 8 }}>
            <label style={{ ...labelStyle, fontFamily: FONTE_TITULO, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 6, margin: "0 0 4px" }}>
              <FiLock size={14} /> Alterar Senha de Acesso
            </label>
            <p style={{ margin: "0 0 12px", fontSize: 11, color: C.textLight, fontWeight: 500 }}>Deixe em branco se não quiser alterar.</p>
            <div style={{ position: "relative" }}>
              <input
                type={mostrarSenha ? "text" : "password"}
                placeholder="Nova senha (mínimo 6 caracteres)"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex" }}
              >
                {mostrarSenha ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="uppercase tracking-wider transition-all hover:opacity-95 shadow-sm"
            style={{ fontFamily: FONTE_TITULO, width: "100%", padding: 14, background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: salvando ? "not-allowed" : "pointer", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {salvando ? "A guardar..." : <><FiCheck size={16} /> Guardar Alterações</>}
          </button>
        </form>
      </div>
    </div>
  );
}
