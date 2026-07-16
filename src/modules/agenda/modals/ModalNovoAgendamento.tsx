'use client'
import { C, brl } from "@/lib/constants";
import { FiCalendar, FiX, FiSearch, FiChevronDown, FiPlus, FiCheck, FiUserPlus, FiDollarSign, FiClock, FiEdit2, FiTag, FiMessageCircle } from "react-icons/fi";
import { FONTE_CORPO, RAIO_SM, RAIO_MD, RAIO_LG, RAIO_XL, overlayModal, containerModal } from "@/lib/estiloGlobal";
import { GavetaCadastroCliente } from "@/modules/crm/GavetaCadastroCliente";
import { ItemLinhaAgendamento } from "./components/ItemLinhaAgendamento";
import { useNovoAgendamento } from "./hooks/useNovoAgendamento";
import { encontrarConflitosDeHorario, temConflitoPagamentoPortal } from "@/lib/agendaUtils";
import { FiLock } from "react-icons/fi";

export function ModalNovoAgendamento({ perfil, onClose, dadosIniciais, onAbrirClienteRapido, agendamentosExistentes, onSalvarEFaturar, onVerHistorico, onEditarCadastro }: any) {
  const ctx = useNovoAgendamento({ perfil, dadosIniciais, agendamentosExistentes, onClose, onSalvarEFaturar });

  // Bloqueia salvar se qualquer item do agendamento conflita com pagamento em andamento no portal
  const conflitoPagamentoPortal = ctx.itensAgendamento?.some((item: any) =>
    temConflitoPagamentoPortal(encontrarConflitosDeHorario({
      profissionalId: item.profissional_id, data: item.data, hora: item.hora,
      duracaoMin: Number(item.duracao) || 60, agendamentos: ctx.agendamentosExistentes || [],
    }))
  ) ?? false;

  if (!ctx.isMounted) return null;

  const overlayStyle = { ...overlayModal, zIndex: 9999 };
  const modalStyle = { ...containerModal, width: "100%", maxWidth: 750, maxHeight: "90vh", display: "flex", flexDirection: "column" as const, overflow: "hidden" };
  const inputContainerStyle = { display: "flex", alignItems: "center", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "0 12px", background: C.bgCard, height: 42, position: "relative" as const, cursor: "text" };
  const inputStyle = { border: "none", outline: "none", width: "100%", height: "100%", background: "transparent", fontSize: 13, color: C.textMain, fontWeight: 500, fontFamily: FONTE_CORPO };
  const dropdownListStyle = { position: "absolute" as const, top: 46, left: 0, right: 0, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 99, maxHeight: 200, overflowY: "auto" as const };
  const dropdownItemStyle = { padding: "12px 14px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", color: C.textMain, fontWeight: 500, display: "flex", justifyContent: "space-between", fontFamily: FONTE_CORPO, fontSize: 13 };

  return (<>
    <div style={overlayStyle} className="font-body">
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
          <h2 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 10 }}>
            <FiCalendar size={18} /> Novo Agendamento
          </h2>
          <button onClick={() => onClose(false)} style={{ background: "transparent", border: "none", color: C.textLight, cursor: "pointer", padding: 4 }}><FiX size={24} /></button>
        </div>

        {/* Corpo */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1, background: C.bg, display: "flex", flexDirection: "column", gap: 24 }}>

          {/* 1. Cliente */}
          <div style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: 24, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="font-title uppercase tracking-widest" style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, margin: 0 }}>1. Quem é o cliente?</h3>
              <button type="button" onClick={() => { ctx.setNomeParaCadastro(''); ctx.setModalCadastroAberto(true); }} className="transition-all hover:scale-[1.02]"
                style={{ background: C.sidebarBg, color: C.bgCard, border: "none", borderRadius: RAIO_SM, padding: "6px 12px", fontWeight: 600, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <FiPlus size={12} /> Cadastrar Cliente
              </button>
            </div>
            <div style={inputContainerStyle} onClick={(e) => { e.stopPropagation(); ctx.setDropdownAtivo("cliente"); }}>
              <FiSearch size={16} color={C.textMuted} style={{ marginRight: 10 }} />
              <input
                autoFocus
                placeholder="Procurar por nome, CPF ou telefone..."
                style={inputStyle}
                value={ctx.buscaCliente}
                onChange={(e) => { ctx.setBuscaCliente(e.target.value); ctx.setDropdownAtivo("cliente"); ctx.setHighlightedCliente(-1); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (!ctx.dropdownAtivo) ctx.setDropdownAtivo("cliente");
                    ctx.setHighlightedCliente(prev => Math.min(prev + 1, ctx.resultadosCliente.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    ctx.setHighlightedCliente(prev => Math.max(prev - 1, -1));
                  } else if (e.key === 'Enter' && ctx.highlightedCliente >= 0) {
                    e.preventDefault();
                    const cli = ctx.resultadosCliente[ctx.highlightedCliente];
                    if (cli) { ctx.selecionarCliente(cli); ctx.setHighlightedCliente(-1); }
                  } else if (e.key === 'Escape') {
                    ctx.setDropdownAtivo(null); ctx.setHighlightedCliente(-1);
                  }
                }}
              />
              <FiChevronDown size={16} color={C.textLight} style={{ marginLeft: 10 }} />
              {ctx.dropdownAtivo === "cliente" && (
                <div style={dropdownListStyle}>
                  {ctx.resultadosCliente.length > 0 ? ctx.resultadosCliente.map((cli, i) => (
                    <div key={cli.id} onClick={() => { ctx.selecionarCliente(cli); ctx.setHighlightedCliente(-1); }}
                      style={{ ...dropdownItemStyle, background: i === ctx.highlightedCliente ? '#F1F5F9' : undefined }}
                      className="hover:bg-slate-50">
                      <span>{cli.nome_completo}</span>
                      <span style={{ color: C.textLight, fontSize: 11 }}>{cli.telefone_whatsapp || (cli.telefones && cli.telefones[0]?.numero) || cli.cpf}</span>
                    </div>
                  )) : ctx.bancoClientes.length === 0 ? (
                    <div style={{ ...dropdownItemStyle, justifyContent: 'center', fontStyle: 'italic', color: C.textLight, borderBottom: 'none' }}>A carregar clientes...</div>
                  ) : (
                    <div>
                      <div style={{ ...dropdownItemStyle, justifyContent: 'center', fontStyle: 'italic', color: C.textLight, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>Nenhum resultado para "{ctx.buscaCliente}"</div>
                      <div style={{ ...dropdownItemStyle, background: '#F0FDF4', color: '#166534', fontWeight: 700, gap: 10, borderBottom: 'none' }}
                        onClick={() => { ctx.setNomeParaCadastro(ctx.buscaCliente.trim()); ctx.setModalCadastroAberto(true); ctx.setDropdownAtivo(null); }}>
                        <FiUserPlus size={16} /> Cadastrar "{ctx.buscaCliente.trim()}" como novo cliente
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {ctx.clienteSelecionado && (
              <>
                <p style={{ margin: "8px 0 0 4px", fontSize: 11, color: C.success, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <FiCheck size={12} /> Cliente selecionado para a ficha.
                </p>

                {/* Faixa de ações rápidas */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 12px", background: C.bg, borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px", marginRight: 4 }}>Ações:</span>

                  {/* Histórico */}
                  <button
                    type="button"
                    title="Ver histórico"
                    onClick={() => onVerHistorico?.(ctx.clienteSelecionado)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_SM, fontSize: 11, fontWeight: 600, color: C.textMain, cursor: "pointer" }}
                  >
                    <FiClock size={13} /> Histórico
                  </button>

                  {/* Editar cadastro */}
                  <button
                    type="button"
                    title="Editar cadastro"
                    onClick={() => onEditarCadastro?.(ctx.clienteSelecionado)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_SM, fontSize: 11, fontWeight: 600, color: C.textMain, cursor: "pointer" }}
                  >
                    <FiEdit2 size={13} /> Editar cadastro
                  </button>

                  {/* Etiquetas do cliente */}
                  {ctx.clienteSelecionado.etiquetas && ctx.clienteSelecionado.etiquetas.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_SM }}>
                      <FiTag size={13} color={C.textMuted} />
                      <div style={{ display: "flex", gap: 4 }}>
                        {ctx.clienteSelecionado.etiquetas.slice(0, 5).map((tag: any) => (
                          <span
                            key={tag.id}
                            title={tag.nome}
                            style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", background: tag.cor + '22', border: `1px solid ${tag.cor}66`, borderRadius: 99, fontSize: 10, fontWeight: 700, color: tag.cor }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: tag.cor, flexShrink: 0 }} />
                            {tag.nome}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* WhatsApp de confirmação */}
                  <button
                    type="button"
                    title="Enviar confirmação por WhatsApp"
                    onClick={ctx.abrirWhatsAppConfirmacao}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: RAIO_SM, fontSize: 11, fontWeight: 700, color: "#15803d", cursor: "pointer", marginLeft: "auto" }}
                  >
                    <FiMessageCircle size={13} /> WhatsApp
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 2. Serviços */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="font-title uppercase tracking-widest" style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, margin: 0 }}>2. Serviços do Agendamento</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.sidebarBg, background: C.bg, padding: "4px 10px", borderRadius: RAIO_XL }}>{ctx.itensAgendamento.length} item(s)</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.bgCard, background: C.sidebarBg, padding: "4px 10px", borderRadius: RAIO_XL }}>Total: {brl(ctx.totalGeral)}</span>
              </div>
            </div>

            {ctx.itensAgendamento.map((item, index) => (
              <ItemLinhaAgendamento
                key={item.id}
                item={item}
                index={index}
                totalItems={ctx.itensAgendamento.length}
                dropdownAtivo={ctx.dropdownAtivo}
                setDropdownAtivo={ctx.setDropdownAtivo}
                atualizarItem={ctx.atualizarItem}
                atualizarItemCampos={ctx.atualizarItemCampos}
                onRemover={(id) => ctx.setItensAgendamento(prev => prev.filter(i => i.id !== id))}
                getServicosFiltrados={ctx.getServicosFiltrados}
                getProfissionaisFiltrados={ctx.getProfissionaisFiltrados}
                bancoServicos={ctx.bancoServicos}
                bancoProfissionais={ctx.bancoProfissionais}
                agendamentosExistentes={ctx.agendamentosExistentes}
                podeEditarValor={ctx.podeEditarValor}
                toast={ctx.toast}
              />
            ))}

            <button onClick={ctx.adicionarNovoItem} className="transition-all hover:bg-slate-50"
              style={{ width: "100%", padding: "14px", background: "transparent", color: C.sidebarBg, border: `1px dashed ${C.borderMid}`, borderRadius: RAIO_LG, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <FiPlus size={16} /> Adicionar Serviço
            </button>
          </div>
        </div>

        {/* Rodapé total */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg }}>
          <span className="font-title uppercase tracking-widest" style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>Valor Total do Agendamento</span>
          <span className="font-title" style={{ fontSize: 18, fontWeight: 800, color: C.sidebarBg }}>{brl(ctx.totalGeral)}</span>
        </div>

        {/* Rodapé ações */}
        <div style={{ padding: "20px 24px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10, background: C.bgCard, flexWrap: "wrap" }}>
          <button
            disabled={ctx.salvando || conflitoPagamentoPortal}
            onClick={conflitoPagamentoPortal ? undefined : ctx.handleConfirmarAgendamento}
            className="transition-all hover:opacity-90"
            style={{ flex: 2, minWidth: 160, padding: "14px", background: conflitoPagamentoPortal ? '#94A3B8' : ctx.salvando ? C.borderMid : C.sidebarBg, color: C.bgCard, border: "none", borderRadius: RAIO_MD, fontWeight: 600, fontSize: 14, cursor: (ctx.salvando || conflitoPagamentoPortal) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: conflitoPagamentoPortal ? 0.7 : 1 }}>
            {conflitoPagamentoPortal ? <><FiLock size={18} /> Horário com Pagamento em Curso</> : ctx.salvando ? "A gravar ficha..." : <><FiCheck size={18} /> Confirmar Agendamento</>}
          </button>
          {onSalvarEFaturar && (
            <button disabled={ctx.salvando || conflitoPagamentoPortal} onClick={conflitoPagamentoPortal ? undefined : ctx.handleSalvarEFaturar} className="transition-all hover:opacity-90"
              style={{ flex: 2, minWidth: 160, padding: "14px", background: (ctx.salvando || conflitoPagamentoPortal) ? C.borderMid : C.activeMenuBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 700, fontSize: 14, cursor: (ctx.salvando || conflitoPagamentoPortal) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <FiDollarSign size={18} /> Salvar e Faturar
            </button>
          )}
          <button disabled={ctx.salvando} onClick={() => onClose(false)} className="transition-all hover:bg-slate-50"
            style={{ flex: 1, minWidth: 100, padding: "14px", background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 600, fontSize: 14, cursor: ctx.salvando ? "not-allowed" : "pointer" }}>
            Cancelar
          </button>
        </div>

      </div>
    </div>

    {ctx.modalCadastroAberto && (
      <GavetaCadastroCliente
        perfil={perfil}
        nomeInicial={ctx.nomeParaCadastro}
        onClose={() => ctx.setModalCadastroAberto(false)}
        onClienteAdicionado={(novoCliente: any) => {
          ctx.setBancoClientes((prev: any[]) => [...prev, novoCliente]);
          ctx.selecionarCliente(novoCliente);
          ctx.setModalCadastroAberto(false);
        }}
      />
    )}
  </>);
}
