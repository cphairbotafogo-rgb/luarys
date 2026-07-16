'use client'
import React, { useState, useMemo, useRef } from "react";
import { C } from "@/lib/constants";
import { RAIO_XS, RAIO_MD, RAIO_LG } from "@/lib/estiloGlobal";
import { FiX, FiChevronDown, FiChevronRight, FiLayers, FiTag, FiPercent } from "react-icons/fi";
import { labelStyle, inputStyle } from "./estilosCompartilhados";

type AgruparPor = 'setor' | 'categoria';

// Layout de colunas fixo para todas as linhas:
// [checkbox 32px] [nome flex-1] [% 90px]
const ROW: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "32px 1fr 90px",
  alignItems: "center",
  padding: "9px 14px",
  gap: 0,
};

export function AbaServicosColaborador({
  form, servicosDb, novaArea, setNovaArea, handleAddArea, removerArea, toggleServico, atualizarComissao,
}: any) {
  const [agruparPor, setAgruparPor] = useState<AgruparPor>('setor');
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const [loteValores, setLoteValores] = useState<Record<string, string>>({});

  const toggleGrupo = (chave: string) => setColapsados(prev => {
    const s = new Set(prev); s.has(chave) ? s.delete(chave) : s.add(chave); return s;
  });

  const grupos = useMemo(() => {
    const mapa: Record<string, any[]> = {};
    servicosDb.forEach((s: any) => {
      const chave = (agruparPor === 'setor' ? s.setor : s.categoria) || (agruparPor === 'setor' ? 'Sem Setor' : 'Sem Categoria');
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(s);
    });
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b));
  }, [servicosDb, agruparPor]);

  function aplicarLote(chaveGrupo: string, itens: any[]) {
    const perc = loteValores[chaveGrupo];
    if (!perc) return;
    itens.forEach(s => { if (form.comissoes[s.id] !== undefined) atualizarComissao(s.id, perc); });
    setLoteValores(p => ({ ...p, [chaveGrupo]: '' }));
  }

  function toggleGrupoTodos(itens: any[], habilitar: boolean) {
    itens.forEach(s => { if (habilitar !== (form.comissoes[s.id] !== undefined)) toggleServico(s, habilitar); });
  }

  const totalHabilitados = Object.keys(form.comissoes).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {!form.exibir_na_agenda && (
        <div style={{ background: C.dangerBg, color: C.danger, padding: 14, borderRadius: RAIO_LG, border: "1px solid #FECACA", fontSize: 12, fontWeight: 600 }}>
          Atenção: este profissional está configurado como Oculto da Agenda.
        </div>
      )}

      {/* Especialidades */}
      <div>
        <label style={labelStyle}>Especialidades / Áreas de Atuação (Tecle ENTER)</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.bgCard, padding: "8px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, flexWrap: "wrap" }}>
          {form.especialidades.map((area: any) => (
            <span key={area} style={{ background: C.sidebarBg, color: "#fff", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: RAIO_XS, display: "flex", alignItems: "center", gap: 6 }}>
              {area}
              <button type="button" onClick={() => removerArea(area)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, display: "flex" }}>
                <FiX size={12} />
              </button>
            </span>
          ))}
          <input value={novaArea} onChange={(e: any) => setNovaArea(e.target.value)} onKeyDown={handleAddArea}
            placeholder="Escreva e tecle enter..."
            style={{ border: "none", outline: "none", flex: 1, fontSize: 13, color: C.textMain, background: "transparent", minWidth: 120 }} />
        </div>
      </div>

      {/* Serviços */}
      <div>
        {/* Barra de controles */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <label style={{ ...labelStyle, marginBottom: 2 }}>Procedimentos Autorizados & Comissões (%)</label>
            <span style={{ fontSize: 11, color: C.textMuted }}>{totalHabilitados} de {servicosDb.length} habilitados</span>
          </div>
          <div style={{ display: "flex", gap: 2, background: C.bg, padding: 3, borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}>
            {([['setor', 'Setor', FiLayers], ['categoria', 'Categoria', FiTag]] as const).map(([v, label, Icon]) => (
              <button key={v} onClick={() => setAgruparPor(v)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "0.15s", background: agruparPor === v ? C.sidebarBg : "transparent", color: agruparPor === v ? "#fff" : C.textMuted }}>
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cabeçalho das colunas */}
        <div style={{ ...ROW, padding: "6px 14px", background: C.bg, borderRadius: `${RAIO_MD} ${RAIO_MD} 0 0`, border: `1px solid ${C.borderMid}`, borderBottom: "none" }}>
          <div />
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Serviço</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>% Comissão</span>
        </div>

        {/* Lista de grupos */}
        <div style={{ border: `1px solid ${C.borderMid}`, borderRadius: `0 0 ${RAIO_MD} ${RAIO_MD}`, overflowY: "auto", maxHeight: 380 }}>
          {grupos.map(([nomeGrupo, itens], gi) => {
            const aberto = !colapsados.has(nomeGrupo);
            const habilitadosNoGrupo = itens.filter((s: any) => form.comissoes[s.id] !== undefined);
            const nHab = habilitadosNoGrupo.length;
            const todosHab = nHab === itens.length;
            const algunsHab = nHab > 0 && !todosHab;
            const checkRef = (el: HTMLInputElement | null) => { if (el) el.indeterminate = algunsHab; };

            return (
              <div key={nomeGrupo} style={{ borderTop: gi === 0 ? "none" : `1px solid ${C.borderMid}` }}>
                {/* Cabeçalho do grupo */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: `${C.sidebarBg}08`, cursor: "pointer" }}
                  onClick={() => toggleGrupo(nomeGrupo)}>
                  {aberto ? <FiChevronDown size={13} color={C.sidebarBg} /> : <FiChevronRight size={13} color={C.sidebarBg} />}
                  <input type="checkbox" ref={checkRef} checked={todosHab}
                    onChange={e => { e.stopPropagation(); toggleGrupoTodos(itens, e.target.checked); }}
                    onClick={e => e.stopPropagation()}
                    style={{ accentColor: C.sidebarBg, width: 15, height: 15, cursor: "pointer", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    {nomeGrupo}
                  </span>
                  <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginRight: 8 }}>{nHab}/{itens.length}</span>
                  {/* Lote — só aparece se há algum habilitado */}
                  {nHab > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={e => e.stopPropagation()}>
                      <div style={{ position: "relative" }}>
                        <input type="number" min="0" max="100" placeholder="% lote"
                          value={loteValores[nomeGrupo] || ''}
                          onChange={e => setLoteValores(p => ({ ...p, [nomeGrupo]: e.target.value }))}
                          style={{ width: 76, padding: "3px 20px 3px 8px", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, color: C.textMain, outline: "none", background: "#fff" }} />
                        <FiPercent size={10} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
                      </div>
                      <button onClick={() => aplicarLote(nomeGrupo, itens)}
                        disabled={!loteValores[nomeGrupo]}
                        style={{ padding: "4px 10px", background: loteValores[nomeGrupo] ? C.sidebarBg : C.borderMid, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: loteValores[nomeGrupo] ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
                        Aplicar
                      </button>
                    </div>
                  )}
                </div>

                {/* Itens do grupo — grade fixa, sempre mesmo layout */}
                {aberto && itens.map((servico: any, idx: number) => {
                  const habilitado = form.comissoes[servico.id] !== undefined;
                  return (
                    <div key={servico.id} style={{
                      ...ROW,
                      borderTop: `1px solid ${C.border}`,
                      background: habilitado ? "#F0FDF4" : "#fff",
                    }}>
                      {/* Checkbox */}
                      <input type="checkbox" checked={habilitado}
                        onChange={e => toggleServico(servico, e.target.checked)}
                        style={{ accentColor: C.sidebarBg, width: 15, height: 15, cursor: "pointer" }} />

                      {/* Nome */}
                      <div style={{ paddingRight: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: habilitado ? 600 : 400, color: habilitado ? C.textMain : C.textMuted, display: "block" }}>
                          {servico.nome_servico}
                        </span>
                        {servico.comissao_padrao > 0 && !habilitado && (
                          <span style={{ fontSize: 10, color: C.textLight }}>Padrão: {servico.comissao_padrao}%</span>
                        )}
                      </div>

                      {/* % — sempre ocupa a coluna, habilitado mostra input, desabilitado mostra vazio */}
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        {habilitado ? (
                          <div style={{ position: "relative", width: 80 }}>
                            <input type="number" min="0" max="100"
                              value={form.comissoes[servico.id]}
                              onChange={e => atualizarComissao(servico.id, e.target.value)}
                              style={{ width: "100%", padding: "5px 22px 5px 8px", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 13, fontWeight: 700, color: C.textMain, outline: "none", background: "#fff", boxSizing: "border-box" }} />
                            <FiPercent size={10} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: C.border, width: 80, textAlign: "center" }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
