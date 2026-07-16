'use client'
/**
 * src/modules/equipe/modal/AbaPermissoesColaborador.tsx
 * Aba de permissões: perfil-base + switches legados + catálogo granular novo.
 *
 * Permissões CONFIDENCIAIS (financeiro, relatórios, precificação, configurações,
 * auditoria, exportar clientes) ficam TRAVADAS e só podem ser ligadas depois de
 * liberar a seção com a senha do dono (pinDono = saloes.pin_gerente). Desligar
 * uma confidencial é sempre permitido (reduz acesso).
 */
import { useState, useEffect } from "react";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_LG, RAIO_XL, overlayModal } from "@/lib/estiloGlobal";
import { FiLock, FiUnlock, FiX } from "react-icons/fi";
import { labelStyle, inputStyle, switchStyle, switchCircleStyle } from "./estilosCompartilhados";
import { PainelPermissoesGranulares } from "./PainelPermissoesGranulares";
import { ehPermissaoConfidencial } from "@/lib/permissoes";

export function AbaPermissoesColaborador({
  form, alterarPerfilAcessoGeral, togglePermissaoIndividual,
  profissionaisReais, editandoId, copiarPermissoesDe, pinDono,
}: any) {
  const [liberadas, setLiberadas] = useState(false);
  const [pinModalAberto, setPinModalAberto] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinErro, setPinErro] = useState("");

  // Reseta o desbloqueio ao trocar de profissional
  useEffect(() => { setLiberadas(false); }, [editandoId]);

  const bloqueado = (chave: string) => ehPermissaoConfidencial(chave) && !liberadas;

  function abrirPin() { setPinErro(""); setPinInput(""); setPinModalAberto(true); }

  // Só bloqueia LIGAR uma confidencial travada; desligar é sempre permitido.
  function toggleGated(chave: string) {
    if (ehPermissaoConfidencial(chave) && !form.permissoes[chave] && !liberadas) { abrirPin(); return; }
    togglePermissaoIndividual(chave);
  }

  function confirmarPin() {
    if (!pinDono) { setPinErro("Nenhuma senha configurada. Cadastre em Configurações → Segurança."); return; }
    if (pinInput.trim() !== String(pinDono)) { setPinErro("Senha incorreta."); return; }
    setLiberadas(true);
    setPinModalAberto(false);
    setPinInput("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* TRAVA DE CONFIDENCIAIS */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: liberadas ? "#F0FDF4" : "#FFFBEB", border: `1px solid ${liberadas ? "#A7F3D0" : "#FDE68A"}`, borderRadius: RAIO_LG, padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {liberadas ? <FiUnlock size={16} color="#059669" style={{ marginTop: 2, flexShrink: 0 }} /> : <FiLock size={16} color="#B45309" style={{ marginTop: 2, flexShrink: 0 }} />}
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: liberadas ? "#065F46" : "#92400E" }}>
              {liberadas ? "Configurações confidenciais liberadas nesta edição" : "Itens confidenciais estão bloqueados"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: liberadas ? "#047857" : "#B45309", lineHeight: 1.5 }}>
              Financeiro, Relatórios, Precificação, Configurações, Dashboard, Luarys Cresce, Auditoria e Exportar clientes exigem a senha do dono.
            </p>
          </div>
        </div>
        {!liberadas && (
          <button onClick={abrirPin}
            style={{ flexShrink: 0, padding: "8px 14px", background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <FiLock size={12} /> Liberar com senha
          </button>
        )}
      </div>

      <div style={{ background: C.bg, padding: 20, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
        <label style={{ ...labelStyle, fontSize: 11, color: C.sidebarBg, marginBottom: 8 }}>Perfil de Acesso do Sistema</label>
        <select style={{ ...inputStyle, padding: "12px", fontWeight: 700, color: C.sidebarBg, borderColor: C.borderMid }} value={form.permissoes.perfil_acesso} onChange={e => alterarPerfilAcessoGeral(e.target.value)}>
          <option value="Sem Acesso">Bloqueado / Sem acesso ao app</option>
          <option value="Administrador">Administrador (Controle Irrestrito)</option>
          <option value="Recepcionista">Recepcionista / Frente de Balcão</option>
          <option value="Profissional Parceiro">Profissional Técnico (Apenas Própria Agenda)</option>
          <option value="Personalizado">Personalizado (Configuração Avançada)</option>
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20, borderLeft: `4px solid ${C.sidebarBg}` }}>
          <h4 style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 700, color: C.sidebarBg, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, textTransform: "uppercase" }}>Autonomia Técnica (Própria Agenda)</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain }}>Visualizar própria agenda</h5></div><div style={switchStyle(form.permissoes.ver_propria_agenda)} onClick={() => togglePermissaoIndividual('ver_propria_agenda')}><span style={switchCircleStyle(form.permissoes.ver_propria_agenda)}></span></div></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${C.border}` }}><div><h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain }}>Inserir ou cancelar agendamentos próprios</h5></div><div style={switchStyle(form.permissoes.criar_proprio_agendamento)} onClick={() => togglePermissaoIndividual('criar_proprio_agendamento')}><span style={switchCircleStyle(form.permissoes.criar_proprio_agendamento)}></span></div></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${C.border}` }}><div><h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain }}>Editar valores e procedimentos de suas comandas</h5></div><div style={switchStyle(form.permissoes.editar_valores_proprio_agendamento)} onClick={() => togglePermissaoIndividual('editar_valores_proprio_agendamento')}><span style={switchCircleStyle(form.permissoes.editar_valores_proprio_agendamento)}></span></div></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${C.border}` }}><div><h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain }}>Consultar relatórios de seu próprio faturamento</h5></div><div style={switchStyle(form.permissoes.ver_proprio_faturamento)} onClick={() => togglePermissaoIndividual('ver_proprio_faturamento')}><span style={switchCircleStyle(form.permissoes.ver_proprio_faturamento)}></span></div></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${C.border}` }}><div><h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain }}>Bloquear horários de sua grade (Ausências)</h5></div><div style={switchStyle(form.permissoes.bloquear_proprio_horario)} onClick={() => togglePermissaoIndividual('bloquear_proprio_horario')}><span style={switchCircleStyle(form.permissoes.bloquear_proprio_horario)}></span></div></div>
          </div>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20 }}><h4 style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: C.textMain, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, textTransform: "uppercase" }}>Métricas Globais da Unidade</h4><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain }}>Acesso aos Gráficos Consolidados (Dashboard)</h5></div><div style={{ display: "flex", alignItems: "center", gap: 8 }}>{bloqueado('ver_dashboard') && <FiLock size={13} color="#B45309" />}<div style={switchStyle(form.permissoes.ver_dashboard)} onClick={() => toggleGated('ver_dashboard')}><span style={switchCircleStyle(form.permissoes.ver_dashboard)}></span></div></div></div></div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20 }}>
          <h4 style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: C.textMain, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, textTransform: "uppercase" }}>Módulo de Caixa & Fluxo Financeiro</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain }}>Acesso completo ao Fluxo de Caixa Global</h5></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {bloqueado('ver_financeiro') && <FiLock size={13} color="#B45309" />}
                <div style={switchStyle(form.permissoes.ver_financeiro)} onClick={() => toggleGated('ver_financeiro')}><span style={switchCircleStyle(form.permissoes.ver_financeiro)}></span></div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <div><h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain }}>Processar e autorizar estornos financeiros</h5></div>
              <div style={switchStyle(form.permissoes.fazer_estorno)} onClick={() => togglePermissaoIndividual('fazer_estorno')}><span style={switchCircleStyle(form.permissoes.fazer_estorno)}></span></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <div><h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain }}>Conceder descontos em comandas gerais</h5></div>
              <div style={switchStyle(form.permissoes.aplicar_desconto)} onClick={() => togglePermissaoIndividual('aplicar_desconto')}><span style={switchCircleStyle(form.permissoes.aplicar_desconto)}></span></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <div>
                <h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain }}>Alterar preço de itens no fechamento de conta</h5>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textMuted }}>Permite editar o valor cobrado por um serviço ou produto na hora do fechamento.</p>
              </div>
              <div style={switchStyle(form.permissoes['caixa.alterar_preco'])} onClick={() => togglePermissaoIndividual('caixa.alterar_preco')}><span style={switchCircleStyle(form.permissoes['caixa.alterar_preco'])}></span></div>
            </div>
          </div>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20 }}><h4 style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, color: C.textMain, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, textTransform: "uppercase" }}>Diretoria & Administrativo</h4><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><h5 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.textMain }}>Cadastrar, editar ou remover colaboradores</h5></div><div style={switchStyle(form.permissoes.editar_equipe)} onClick={() => togglePermissaoIndividual('editar_equipe')}><span style={switchCircleStyle(form.permissoes.editar_equipe)}></span></div></div></div>
      </div>

      {/* PERMISSÕES GRANULARES (catálogo novo) — complementa os switches
          legados acima, sem substituí-los. Ver src/lib/permissoes.ts */}
      <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: 20, marginTop: 4 }}>
        <h4 style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Permissões Detalhadas
        </h4>
        <PainelPermissoesGranulares
          permissoes={form.permissoes}
          onToggle={toggleGated}
          ehBloqueada={bloqueado}
          outrosProfissionais={profissionaisReais.filter((p: any) => p.id !== editandoId)}
          onCopiarDe={copiarPermissoesDe}
        />
      </div>

      {/* MODAL: senha do dono para liberar confidenciais */}
      {pinModalAberto && (
        <div style={{ ...overlayModal, zIndex: 1200, alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: RAIO_XL, width: "100%", maxWidth: 380, padding: "26px 28px", position: "relative", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>
            <button onClick={() => setPinModalAberto(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: C.textLight }}><FiX size={18} /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <FiLock size={18} color={C.sidebarBg} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.textMain }}>Senha do dono</h3>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              Digite a senha do dono para liberar as configurações confidenciais deste profissional.
            </p>
            <input
              type="password" autoFocus
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinErro(""); }}
              onKeyDown={e => { if (e.key === 'Enter') confirmarPin(); }}
              placeholder="••••"
              style={{ ...inputStyle, width: "100%", textAlign: "center", letterSpacing: 4, fontSize: 18, fontWeight: 700 }}
            />
            {pinErro && <p style={{ margin: "8px 0 0", fontSize: 12, color: C.danger, fontWeight: 600 }}>{pinErro}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setPinModalAberto(false)} style={{ padding: "10px 18px", background: "transparent", color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmarPin} style={{ padding: "10px 18px", border: "none", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff", background: C.sidebarBg }}>Liberar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
