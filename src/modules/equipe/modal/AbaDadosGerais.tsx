'use client'
/**
 * src/modules/equipe/modal/AbaDadosGerais.tsx
 * Primeira aba do Modal de Colaborador: dados pessoais e credenciais de acesso.
 */
import { useState } from "react";
import { C } from "@/lib/constants";
import { RAIO_XL, RAIO_MD } from "@/lib/estiloGlobal";
import { FiInfo, FiEye, FiEyeOff, FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import { inputStyle, labelStyle, switchStyle, switchCircleStyle } from "./estilosCompartilhados";
import { IconeAjuda } from "@/components/IconeAjuda";

// Asterisco vermelho para campos obrigatórios
const Obrig = () => <span style={{ color: '#EF4444', fontWeight: 900, fontSize: 11 }}>*</span>;
// Label com suporte a ícones inline (flex)
const lbFlex: React.CSSProperties = { ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 };

export function AbaDadosGerais({ form, setForm, editandoId }: any) {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [confirmSenha, setConfirmSenha] = useState("");
  // Sincroniza confirmSenha com o form para validação no salvar
  function atualizarConfirmSenha(v: string) {
    setConfirmSenha(v);
    setForm({ ...form, confirmSenha: v });
  }

  const senhaValida = !form.senhaAcesso || form.senhaAcesso.length >= 6;
  const senhasBatem = !form.senhaAcesso || form.senhaAcesso === confirmSenha;
  const temEmailAuth = !!editandoId && form.temEmailAuth; // flag passada pelo pai

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      <div style={{ background: "#F4F8F5", border: "1px solid #E8F0EA", padding: "16px", borderRadius: RAIO_XL, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 12, color: "#3B4A3F", fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            Visível na Agenda Geral?
            <span title="A faixa do seu plano é determinada apenas por profissionais que realizam serviços, como cabeleireiros, manicures, massagistas etc. Profissionais administrativos (recepção, gerência) não consomem vagas do plano."><FiInfo size={13} color={C.textLight} /></span>
          </h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Desative caso o profissional seja da ala corporativa/administrativa e não receba marcações diretas. Isso também o isenta do limite de profissionais do seu plano.</p>
        </div>
        <div style={switchStyle(form.exibir_na_agenda)} onClick={() => setForm({ ...form, exibir_na_agenda: !form.exibir_na_agenda })}>
          <span style={switchCircleStyle(form.exibir_na_agenda)}></span>
        </div>
      </div>

      <div style={{ background: form.ativo ? C.bg : C.dangerBg, border: `1px solid ${form.ativo ? C.border : C.danger}`, padding: "16px", borderRadius: RAIO_XL, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 12, color: form.ativo ? C.textMain : C.danger, fontWeight: 700, textTransform: "uppercase" }}>Profissional Ativo?</h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Inativos somem da agenda, relatórios e comissões, mas o cadastro e o histórico ficam preservados. Se for produtivo, libera 1 vaga do plano.</p>
        </div>
        <div style={switchStyle(form.ativo)} onClick={() => setForm({ ...form, ativo: !form.ativo })}>
          <span style={switchCircleStyle(form.ativo)}></span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <div>
          <label style={lbFlex}>Nome Completo <Obrig /></label>
          <input style={inputStyle} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div><label style={labelStyle}>Apelido / Nome Social</label><input style={inputStyle} value={form.apelido} onChange={e => setForm({ ...form, apelido: e.target.value })} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div>
          <label style={lbFlex}>
            CPF <Obrig />
            <IconeAjuda texto={"Cadastro de Pessoa Física — necessário para o eSocial e emissão de holerites.\nDigite apenas os números."} posicao="direita" />
          </label>
          <input style={inputStyle} value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />
        </div>
        <div><label style={labelStyle}>RG / Órgão Expedidor</label><input style={inputStyle} placeholder="Ex: 123456-7 SSP/SP" value={form.rg} onChange={e => setForm({ ...form, rg: e.target.value })} /></div>
        <div><label style={labelStyle}>Estado Civil</label><select style={inputStyle} value={form.estadoCivil} onChange={e => setForm({ ...form, estadoCivil: e.target.value })}><option value="">Selecione...</option><option value="Solteiro(a)">Solteiro(a)</option><option value="Casado(a)">Casado(a)</option><option value="Divorciado(a)">Divorciado(a)</option><option value="Viúvo(a)">Viúvo(a)</option><option value="União Estável">União Estável</option></select></div>
      </div>

      {/* ── CREDENCIAIS DE ACESSO ──────────────────────────────────────── */}
      <div style={{ background: C.bg, padding: 20, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: C.sidebarBg, letterSpacing: "0.5px" }}>
              Credenciais de Acesso ao Sistema
            </h4>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: C.textMuted }}>
              {editandoId
                ? "E-mail não pode ser alterado após o cadastro. Para trocar, delete e recadastre o profissional."
                : "O profissional usará e-mail e senha para entrar no sistema."}
            </p>
          </div>
          {editandoId && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700,
              color: form.emailAuth ? "#10B981" : "#EF4444",
              background: form.emailAuth ? "#D1FAE5" : "#FEE2E2",
              padding: "4px 10px", borderRadius: 99 }}>
              {form.emailAuth
                ? <><FiCheckCircle size={11} /> Acesso ativo</>
                : <><FiAlertCircle size={11} /> Sem acesso cadastrado</>}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* E-mail */}
          <div>
            <label style={{ ...lbFlex, color: C.sidebarBg }}>
              E-mail {!editandoId && <Obrig />}
              <IconeAjuda
                texto={editandoId
                  ? "O e-mail é o login do profissional e não pode ser alterado após o cadastro."
                  : "Será usado como login no sistema.\nEnvie ao profissional para que ele possa acessar."}
                posicao="direita"
              />
            </label>
            <input
              type="email"
              style={{ ...inputStyle, background: editandoId ? "#F1F5F9" : undefined, color: editandoId ? C.textMuted : undefined }}
              value={form.emailAuth || form.email || ""}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="exemplo@empresa.com"
              disabled={!!editandoId}
            />
            {!!editandoId && form.emailAuth && (
              <p style={{ margin: "4px 0 0", fontSize: 10, color: C.textMuted }}>E-mail vinculado ao login — não editável.</p>
            )}
            {!!editandoId && !form.emailAuth && (
              <p style={{ margin: "4px 0 0", fontSize: 10, color: "#EF4444", fontWeight: 600 }}>
                Este profissional ainda não tem acesso ao sistema. Cadastre um novo usuário ou entre em contato com o suporte.
              </p>
            )}
          </div>

          {/* Senha */}
          <div>
            <label style={{ ...lbFlex, color: C.sidebarBg }}>
              {editandoId ? "Nova Senha (opcional)" : <><span>Senha Provisória</span> <Obrig /></>}
              <IconeAjuda
                texto={editandoId
                  ? "Deixe em branco para manter a senha atual.\nSó preencha se quiser redefinir o acesso."
                  : "Mínimo 6 caracteres.\nO profissional poderá alterar depois do primeiro acesso."}
                posicao="esquerda"
              />
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={mostrarSenha ? "text" : "password"}
                style={{ ...inputStyle, paddingRight: 40,
                  borderColor: form.senhaAcesso && !senhaValida ? "#EF4444" : undefined }}
                value={form.senhaAcesso || ""}
                onChange={e => setForm({ ...form, senhaAcesso: e.target.value })}
                placeholder={editandoId ? "Deixe vazio para não alterar" : "Mínimo 6 caracteres"}
              />
              <button type="button"
                onClick={() => setMostrarSenha(v => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: "none", cursor: "pointer", color: C.textMuted, padding: 0 }}>
                {mostrarSenha ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
            {form.senhaAcesso && !senhaValida && (
              <p style={{ margin: "4px 0 0", fontSize: 10, color: "#EF4444", fontWeight: 600 }}>Mínimo 6 caracteres.</p>
            )}
          </div>
        </div>

        {/* Confirmar senha — só aparece quando está digitando uma senha nova */}
        {form.senhaAcesso && form.senhaAcesso.length > 0 && (
          <div>
            <label style={{ ...labelStyle, color: C.sidebarBg }}>Confirmar Nova Senha *</label>
            <div style={{ position: "relative" }}>
              <input
                type={mostrarConfirm ? "text" : "password"}
                style={{ ...inputStyle, paddingRight: 40,
                  borderColor: confirmSenha && !senhasBatem ? "#EF4444" : senhasBatem && confirmSenha ? "#10B981" : undefined }}
                value={confirmSenha}
                onChange={e => atualizarConfirmSenha(e.target.value)}
                placeholder="Repita a senha"
              />
              <button type="button"
                onClick={() => setMostrarConfirm(v => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: "none", cursor: "pointer", color: C.textMuted, padding: 0 }}>
                {mostrarConfirm ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
            {confirmSenha && !senhasBatem && (
              <p style={{ margin: "4px 0 0", fontSize: 10, color: "#EF4444", fontWeight: 600 }}>As senhas não coincidem.</p>
            )}
            {confirmSenha && senhasBatem && senhaValida && (
              <p style={{ margin: "4px 0 0", fontSize: 10, color: "#10B981", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <FiCheckCircle size={10} /> Senhas conferem.
              </p>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div><label style={labelStyle}>Telefone / WhatsApp</label><input style={inputStyle} value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
        <div><label style={labelStyle}>Data de Nascimento</label><input type="date" style={inputStyle} value={form.nascimento} onChange={e => setForm({ ...form, nascimento: e.target.value })} /></div>
      </div>
    </div>
  );
}
