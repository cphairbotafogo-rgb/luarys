'use client'
import { useState } from "react";
import { C, brl } from "@/lib/constants";
import { FiSearch, FiChevronDown, FiClock, FiX, FiZap, FiAlertTriangle, FiLock } from "react-icons/fi";
import { FONTE_CORPO, RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { encontrarConflitosDeHorario, temConflitoPagamentoPortal } from "@/lib/agendaUtils";

const inputContainerStyle = {
  display: "flex", alignItems: "center", border: `1px solid ${C.borderMid}`,
  borderRadius: RAIO_MD, padding: "0 12px", background: C.bgCard,
  height: 42, position: "relative" as const, cursor: "text",
};
const inputStyle = {
  border: "none", outline: "none", width: "100%", height: "100%",
  background: "transparent", fontSize: 13, color: C.textMain,
  fontWeight: 500, fontFamily: FONTE_CORPO,
};
const dropdownListStyle = {
  position: "absolute" as const, top: 46, left: 0, right: 0,
  background: C.bgCard, border: `1px solid ${C.borderMid}`,
  borderRadius: RAIO_MD, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
  zIndex: 99, maxHeight: 200, overflowY: "auto" as const,
};
const dropdownItemStyle = {
  padding: "12px 14px", borderBottom: `1px solid ${C.border}`,
  cursor: "pointer", color: C.textMain, fontWeight: 500,
  display: "flex", justifyContent: "space-between",
  fontFamily: FONTE_CORPO, fontSize: 13,
};
const miniLabelStyle = {
  fontSize: 10, fontWeight: 700, color: C.textMuted,
  textTransform: "uppercase" as const, letterSpacing: "0.5px",
  marginBottom: 4, display: "block",
};
const miniInputContainerStyle = { ...inputContainerStyle, height: 36 };

interface Props {
  item: any;
  index: number;
  totalItems: number;
  dropdownAtivo: string | null;
  setDropdownAtivo: (id: string | null) => void;
  atualizarItem: (id: string, campo: string, valor: any) => void;
  atualizarItemCampos: (id: string, campos: Record<string, any>) => void;
  onRemover: (id: string) => void;
  getServicosFiltrados: (busca: string, profId?: string) => any[];
  getProfissionaisFiltrados: (busca: string) => any[];
  bancoServicos: any[];
  bancoProfissionais: any[];
  agendamentosExistentes: any[];
  podeEditarValor: boolean;
  toast: any;
}

export function ItemLinhaAgendamento({ item, index, totalItems, dropdownAtivo, setDropdownAtivo, atualizarItem, atualizarItemCampos, onRemover, getServicosFiltrados, getProfissionaisFiltrados, bancoServicos, bancoProfissionais, agendamentosExistentes, podeEditarValor, toast }: Props) {
  const [highlightedServico, setHighlightedServico] = useState(-1);
  const [highlightedProfissional, setHighlightedProfissional] = useState(-1);
  const servicosFiltrados = getServicosFiltrados(item.buscaServico, item.profissional_id);
  const profissionaisFiltrados = getProfissionaisFiltrados(item.buscaProfissional);
  const conflitosHorario = encontrarConflitosDeHorario({
    profissionalId: item.profissional_id, data: item.data, hora: item.hora,
    duracaoMin: Number(item.duracao) || 60, agendamentos: agendamentosExistentes || [],
  });
  const conflitoPagamentoPortal = temConflitoPagamentoPortal(conflitosHorario);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: "16px", marginBottom: 12 }}>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div className="font-title" style={{ width: 28, height: 28, borderRadius: "50%", background: C.bg, color: C.textMain, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{index + 1}</div>
        {totalItems > 1 && (
          <button type="button" onClick={() => onRemover(item.id)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'transparent', border: `1px solid #FCA5A5`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <FiX size={13} color="#EF4444" />
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: 12 }}>

          {/* Serviço */}
          <div style={inputContainerStyle} onClick={(e) => { e.stopPropagation(); setDropdownAtivo(`servico-${item.id}`); }} onDoubleClick={(e) => { e.stopPropagation(); atualizarItemCampos(item.id, { buscaServico: '', servico_id: '' }); setDropdownAtivo(`servico-${item.id}`); }}>
            <FiSearch size={14} color={C.textMuted} style={{ marginRight: 6 }} />
            <input
              style={inputStyle}
              placeholder="Buscar Serviço..."
              value={item.buscaServico}
              onChange={(e) => { atualizarItemCampos(item.id, { buscaServico: e.target.value, servico_id: '' }); setDropdownAtivo(`servico-${item.id}`); setHighlightedServico(-1); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (dropdownAtivo !== `servico-${item.id}`) setDropdownAtivo(`servico-${item.id}`);
                  setHighlightedServico(prev => Math.min(prev + 1, servicosFiltrados.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedServico(prev => Math.max(prev - 1, -1));
                } else if (e.key === 'Enter' && highlightedServico >= 0) {
                  const s = servicosFiltrados[highlightedServico];
                  if (s) { e.preventDefault(); atualizarItemCampos(item.id, { servico_id: s.id, buscaServico: s.nome, duracao: s.duracao || 60, valor: s.preco ?? "", valorEditadoManualmente: false }); setDropdownAtivo(null); setHighlightedServico(-1); }
                } else if (e.key === 'Escape') {
                  setDropdownAtivo(null); setHighlightedServico(-1);
                }
              }}
            />
            <FiChevronDown size={14} color={C.textLight} />
            {dropdownAtivo === `servico-${item.id}` && (
              <div style={dropdownListStyle}>
                {servicosFiltrados.length > 0 ? servicosFiltrados.map((s, i) => (
                  <div key={s.id} style={{ ...dropdownItemStyle, background: i === highlightedServico ? '#F1F5F9' : undefined }} className="hover:bg-slate-50" onClick={() => { atualizarItemCampos(item.id, { servico_id: s.id, buscaServico: s.nome, duracao: s.duracao || 60, valor: s.preco ?? "", valorEditadoManualmente: false }); setDropdownAtivo(null); setHighlightedServico(-1); }}>
                    <span>{s.nome}</span><span style={{ color: C.textMuted }}>{brl(s.preco)}</span>
                  </div>
                )) : (
                  <div style={{ ...dropdownItemStyle, justifyContent: 'center', fontStyle: 'italic', color: C.textLight, borderBottom: 'none' }}>
                    {bancoServicos.length === 0 ? 'A carregar serviços...' : 'Nenhum serviço encontrado.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profissional */}
          <div style={inputContainerStyle} onClick={(e) => { e.stopPropagation(); setDropdownAtivo(`prof-${item.id}`); }} onDoubleClick={(e) => { e.stopPropagation(); atualizarItemCampos(item.id, { buscaProfissional: '', profissional_id: '' }); setDropdownAtivo(`prof-${item.id}`); }}>
            <input
              style={inputStyle}
              placeholder="Profissional"
              value={item.buscaProfissional}
              onChange={(e) => { atualizarItemCampos(item.id, { buscaProfissional: e.target.value, profissional_id: '' }); setDropdownAtivo(`prof-${item.id}`); setHighlightedProfissional(-1); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (dropdownAtivo !== `prof-${item.id}`) setDropdownAtivo(`prof-${item.id}`);
                  setHighlightedProfissional(prev => Math.min(prev + 1, profissionaisFiltrados.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedProfissional(prev => Math.max(prev - 1, -1));
                } else if (e.key === 'Enter' && highlightedProfissional >= 0) {
                  const p = profissionaisFiltrados[highlightedProfissional];
                  if (p) {
                    e.preventDefault();
                    const comissoes = p.servicos_comissoes;
                    const aindaValido = !item.servico_id || !comissoes || Object.keys(comissoes).includes(String(item.servico_id));
                    atualizarItemCampos(item.id, { profissional_id: p.id, buscaProfissional: p.nome, ...(!aindaValido ? { servico_id: '', buscaServico: '' } : {}) });
                    setDropdownAtivo(null); setHighlightedProfissional(-1);
                    if (!aindaValido) toast.aviso(`${p.nome} não está habilitado para o serviço selecionado.`);
                  }
                } else if (e.key === 'Escape') {
                  setDropdownAtivo(null); setHighlightedProfissional(-1);
                }
              }}
            />
            <FiChevronDown size={14} color={C.textLight} />
            {dropdownAtivo === `prof-${item.id}` && (
              <div style={dropdownListStyle}>
                {profissionaisFiltrados.length > 0 ? profissionaisFiltrados.map((p, i) => (
                  <div key={p.id} style={{ ...dropdownItemStyle, background: i === highlightedProfissional ? '#F1F5F9' : undefined }} className="hover:bg-slate-50" onClick={() => {
                    const comissoes = p.servicos_comissoes;
                    const aindaValido = !item.servico_id || !comissoes || Object.keys(comissoes).includes(String(item.servico_id));
                    atualizarItemCampos(item.id, { profissional_id: p.id, buscaProfissional: p.nome, ...(!aindaValido ? { servico_id: '', buscaServico: '' } : {}) });
                    setDropdownAtivo(null); setHighlightedProfissional(-1);
                    if (!aindaValido) toast.aviso(`${p.nome} não está habilitado para o serviço selecionado.`);
                  }}>{p.nome}</div>
                )) : (
                  <div style={{ ...dropdownItemStyle, justifyContent: 'center', fontStyle: 'italic', color: C.textLight, borderBottom: 'none' }}>
                    {bancoProfissionais.length === 0 ? 'A carregar profissionais...' : 'Nenhum profissional encontrado.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Data */}
          <div style={{ ...inputContainerStyle, padding: "0 8px" }}>
            <input type="date" style={inputStyle} value={item.data} onChange={(e) => atualizarItem(item.id, 'data', e.target.value)} />
          </div>

          {/* Hora */}
          <div style={{ ...inputContainerStyle, padding: "0 8px", justifyContent: "space-between" }}>
            <input type="time" style={{ ...inputStyle, width: "calc(100% - 20px)" }} value={item.hora} onChange={(e) => atualizarItem(item.id, 'hora', e.target.value)} />
            <FiClock size={16} color={C.textLight} />
          </div>
        </div>

        {conflitoPagamentoPortal && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: RAIO_MD, background: "#FEF2F2", border: "1px solid #FCA5A5" }}>
            <FiLock size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#DC2626", lineHeight: 1.4 }}>
              Horário bloqueado — há um pagamento de portal em andamento para este profissional neste horário.
              Aguarde o prazo expirar ou cancele a reserva do portal antes de prosseguir.
            </span>
          </div>
        )}
        {!conflitoPagamentoPortal && conflitosHorario.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: RAIO_MD, background: "#FEF3C7", border: "1px solid #FDE68A" }}>
            <FiAlertTriangle size={14} color="#B45309" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>
              {conflitosHorario.length === 1
                ? `Este profissional já tem ${conflitosHorario[0].cliente} marcado às ${conflitosHorario[0].inicio} neste horário.`
                : `Este profissional já tem ${conflitosHorario.length} agendamentos neste horário.`}
            </span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr", gap: 12 }}>
          <div />
          {/* Encaixe */}
          <div>
            <label style={miniLabelStyle}>Encaixe</label>
            <button type="button" onClick={() => atualizarItem(item.id, 'eh_encaixe', !item.eh_encaixe)} className="transition-all hover:opacity-90"
              style={{ ...miniInputContainerStyle, padding: "0 10px", cursor: "pointer", justifyContent: "center", gap: 6, background: item.eh_encaixe ? `${C.douradoEleva}1A` : C.bgCard, border: `1px solid ${item.eh_encaixe ? C.douradoEleva : C.borderMid}` }}>
              <FiZap size={14} color={item.eh_encaixe ? C.douradoEleva : C.textLight} />
              <span style={{ fontSize: 12, fontWeight: 700, color: item.eh_encaixe ? C.douradoEleva : C.textLight }}>{item.eh_encaixe ? "É um encaixe" : "Marcar encaixe"}</span>
            </button>
          </div>
          {/* Duração */}
          <div>
            <label style={miniLabelStyle}>Duração (min)</label>
            <div style={{ ...miniInputContainerStyle, padding: "0 8px" }}>
              <input type="number" min="0" style={inputStyle} value={item.duracao} onChange={(e) => atualizarItem(item.id, 'duracao', e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          </div>
          {/* Valor */}
          <div>
            <label style={miniLabelStyle}>
              Valor (R$){!podeEditarValor && <FiLock size={9} style={{ display: 'inline', marginLeft: 4, verticalAlign: 'middle', color: C.textLight }} />}
            </label>
            <div style={{ ...miniInputContainerStyle, padding: "0 8px" }}>
              <input type="number" min="0" step="0.01" placeholder="0,00" value={item.valor} disabled={!podeEditarValor}
                style={{ ...inputStyle, background: !podeEditarValor ? C.bg : undefined, color: !podeEditarValor ? C.textLight : undefined }}
                title={!podeEditarValor ? 'Sem permissão para alterar o valor.' : undefined}
                onChange={(e) => atualizarItemCampos(item.id, { valor: e.target.value === '' ? '' : Number(e.target.value), valorEditadoManualmente: true })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
