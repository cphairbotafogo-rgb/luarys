'use client'
import { useState, useEffect, useRef } from "react";
import { C, brl } from "@/lib/constants";
import { RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { FiStar, FiCalendar, FiPause, FiPlay, FiX, FiCheckCircle, FiSearch, FiUser } from "react-icons/fi";
import { useAssinaturaCliente } from "./useAssinaturaCliente";

const hojeStr = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
const fmt = (d: string) => !d ? '—' : d.split('T')[0].split('-').reverse().join('/');
const norm = (t: string) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const CORES_STATUS: Record<string, { bg: string; cor: string; label: string }> = {
  ativa: { bg: '#ECFDF5', cor: '#059669', label: 'Ativa' },
  pausada: { bg: '#FFFBEB', cor: '#B45309', label: 'Pausada' },
  cancelada: { bg: '#F1F5F9', cor: '#64748B', label: 'Cancelada' },
};

export function AbaAssinaturaCliente({ perfil, clienteId }: any) {
  const { planos, assinaturas, profissionais, servicosCat, carregando, salvando, assinar, alterarStatus } = useAssinaturaCliente(perfil, clienteId);
  const [planoSel, setPlanoSel] = useState("");
  const [dataInicio, setDataInicio] = useState(hojeStr());
  const [diaVenc, setDiaVenc] = useState(5);
  const [profArea, setProfArea] = useState<Record<string, { id: string; nome: string }>>({});
  const [buscaProf, setBuscaProf] = useState<Record<string, string>>({});
  const [areaAberta, setAreaAberta] = useState<string | null>(null);
  const refAreas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (refAreas.current && !refAreas.current.contains(e.target as Node)) setAreaAberta(null);
    }
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  function selecionarPlano(id: string) {
    setPlanoSel(id); setProfArea({}); setBuscaProf({}); setAreaAberta(null);
  }

  if (!clienteId) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: C.textLight }}>
        <FiStar size={36} color={C.borderMid} style={{ marginBottom: 12 }} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.textMain }}>Salve o cliente primeiro</p>
        <p style={{ margin: "4px 0 0", fontSize: 12 }}>Depois de salvar a ficha, você poderá atribuir uma assinatura.</p>
      </div>
    );
  }

  const vigentes = assinaturas.filter(a => a.status !== 'cancelada');
  const historico = assinaturas.filter(a => a.status === 'cancelada');

  // Áreas (categorias) dos serviços inclusos do plano selecionado
  const planoAtual = planos.find(p => p.id === planoSel);
  const catDoServico = (sid: string) => servicosCat.find(x => x.id === sid)?.categoria || 'Geral';
  const areasPlano: string[] = planoAtual
    ? [...new Set((planoAtual.servicos_inclusos || []).map((si: any) => catDoServico(si.servico_id)))] as string[]
    : [];

  const areasOk = areasPlano.length === 0 || areasPlano.every(cat => profArea[cat]?.id);
  const podeAssinar = !!planoSel && areasOk && !salvando;

  async function confirmarAssinatura() {
    if (!podeAssinar) return;
    const designacao = areasPlano.map(cat => ({ categoria: cat, profissional_id: profArea[cat].id, profissional_nome: profArea[cat].nome }));
    const ok = await assinar(planoSel, dataInicio, diaVenc, designacao);
    if (ok) { setPlanoSel(""); setDiaVenc(5); setDataInicio(hojeStr()); setProfArea({}); setBuscaProf({}); }
  }

  function profsFiltrados(cat: string) {
    const termo = norm((buscaProf[cat] || '').trim());
    return termo ? profissionais.filter(p => norm(p.nome).includes(termo)) : profissionais;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ASSINATURAS VIGENTES */}
      {vigentes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p className="font-title uppercase" style={{ margin: 0, fontSize: 10, fontWeight: 800, color: C.textLight, letterSpacing: "0.5px" }}>Assinaturas do cliente</p>
          {vigentes.map(a => {
            const st = CORES_STATUS[a.status] || CORES_STATUS.cancelada;
            const plano = a.planos_assinatura_cliente || {};
            const designados = Array.isArray(a.profissionais_area) ? a.profissionais_area : [];
            return (
              <div key={a.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderLeft: `5px solid ${plano.cor || C.sidebarBg}`, borderRadius: RAIO_LG, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>{plano.nome || 'Plano'}</h4>
                    <p className="font-title" style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 800, color: C.textMain }}>{brl(plano.preco_mensal || 0)}<span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}> /mês</span></p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: st.cor, background: st.bg, padding: "4px 10px", borderRadius: 20, textTransform: "uppercase" }}>{st.label}</span>
                </div>

                {designados.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {designados.map((d: any, i: number) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 12px", fontSize: 12 }}>
                        <FiUser size={11} color={C.sidebarBg} />
                        <span style={{ color: C.textMuted, fontWeight: 600 }}>{d.categoria}:</span>
                        <strong style={{ color: C.textMain }}>{d.profissional_nome}</strong>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 12, color: C.textMuted, flexWrap: "wrap" }}>
                  <span><FiCalendar size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />Início: <strong style={{ color: C.textMain }}>{fmt(a.data_inicio)}</strong></span>
                  <span>Vencimento: dia <strong style={{ color: C.textMain }}>{a.dia_vencimento}</strong></span>
                  {a.proxima_cobranca && <span>Próxima: <strong style={{ color: C.textMain }}>{fmt(a.proxima_cobranca)}</strong></span>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                  {a.status === 'ativa' ? (
                    <button onClick={() => alterarStatus(a.id, 'pausada')} style={btnSec}><FiPause size={13} /> Pausar</button>
                  ) : (
                    <button onClick={() => alterarStatus(a.id, 'ativa')} style={btnSec}><FiPlay size={13} /> Reativar</button>
                  )}
                  <button onClick={() => alterarStatus(a.id, 'cancelada')} style={{ ...btnSec, color: C.danger }}><FiX size={14} /> Cancelar</button>
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 10, color: C.textLight }}>O profissional da assinatura é fixo. Para trocar, cancele e crie uma nova.</p>
              </div>
            );
          })}
        </div>
      )}

      {/* NOVA ASSINATURA */}
      <div ref={refAreas} style={{ background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_XL, padding: 18 }}>
        <p className="font-title uppercase" style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 800, color: C.sidebarBg, letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
          <FiStar size={12} /> Nova assinatura
        </p>

        {carregando ? (
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Carregando planos…</p>
        ) : planos.length === 0 ? (
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0, lineHeight: 1.5 }}>
            Nenhum plano criado ainda. Crie planos em <strong>Configurações → Clube de Assinaturas</strong> primeiro.
          </p>
        ) : (
          <>
            {/* Escolha do plano */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
              {planos.map(p => {
                const sel = planoSel === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => selecionarPlano(p.id)}
                    style={{ textAlign: "left", cursor: "pointer", background: C.bgCard, border: `2px solid ${sel ? (p.cor || C.sidebarBg) : C.border}`, borderRadius: RAIO_LG, padding: 14, position: "relative" }}>
                    {sel && <FiCheckCircle size={16} color={p.cor || C.sidebarBg} style={{ position: "absolute", top: 10, right: 10 }} />}
                    <span style={{ display: "block", width: 22, height: 6, borderRadius: 6, background: p.cor || C.sidebarBg, marginBottom: 8 }} />
                    <h5 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.sidebarBg }}>{p.nome}</h5>
                    <p className="font-title" style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 800, color: C.textMain }}>{brl(p.preco_mensal || 0)}<span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted }}>/mês</span></p>
                    {p.desconto_percentual > 0 && <p style={{ margin: "4px 0 0", fontSize: 11, color: C.success, fontWeight: 700 }}>{Number(p.desconto_percentual).toFixed(0)}% off</p>}
                  </button>
                );
              })}
            </div>

            {/* Designação de profissional por área (obrigatória, fixa) */}
            {planoSel && areasPlano.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.textMuted }}>Profissional responsável por área <span style={{ color: C.textLight, fontWeight: 500 }}>(a assinatura fica fixa a ele)</span></p>
                {areasPlano.map(cat => (
                  <div key={cat} style={{ position: "relative" }}>
                    <label style={{ ...labelSt, marginBottom: 4 }}>{cat}</label>
                    <div style={{ position: "relative" }}>
                      <FiSearch size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textLight, pointerEvents: "none" }} />
                      <input
                        style={{ ...inputSt, width: "100%", paddingLeft: 34, boxSizing: "border-box" }}
                        placeholder="Buscar profissional…"
                        value={buscaProf[cat] ?? (profArea[cat]?.nome || '')}
                        onChange={e => { setBuscaProf(prev => ({ ...prev, [cat]: e.target.value })); setProfArea(prev => { const n = { ...prev }; delete n[cat]; return n; }); setAreaAberta(cat); }}
                        onFocus={() => setAreaAberta(cat)}
                      />
                      {profArea[cat] && <FiCheckCircle size={14} color={C.success} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }} />}
                    </div>
                    {areaAberta === cat && profsFiltrados(cat).length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, marginTop: 4, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.12)", maxHeight: 180, overflowY: "auto" }}>
                        {profsFiltrados(cat).map(p => (
                          <div key={p.id} onMouseDown={e => e.preventDefault()}
                            onClick={() => { setProfArea(prev => ({ ...prev, [cat]: { id: p.id, nome: p.nome } })); setBuscaProf(prev => ({ ...prev, [cat]: p.nome })); setAreaAberta(null); }}
                            className="hover:bg-slate-50"
                            style={{ padding: "9px 12px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", fontSize: 13, color: C.textMain, fontWeight: 600 }}>
                            {p.nome}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <label style={labelSt}>Início</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Dia de vencimento</label>
                <input type="number" min="1" max="28" value={diaVenc} onChange={e => setDiaVenc(Number(e.target.value))} style={{ ...inputSt, width: 90 }} />
              </div>
              <button onClick={confirmarAssinatura} disabled={!podeAssinar}
                style={{ marginLeft: "auto", padding: "11px 24px", background: !podeAssinar ? C.borderMid : C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 700, cursor: !podeAssinar ? "not-allowed" : "pointer" }}>
                {salvando ? "Salvando…" : "Assinar"}
              </button>
            </div>
            {planoSel && !areasOk && (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: C.danger }}>Escolha um profissional para cada área antes de assinar.</p>
            )}
          </>
        )}
      </div>

      {/* HISTÓRICO DE CANCELADAS */}
      {historico.length > 0 && (
        <div>
          <p className="font-title uppercase" style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: C.textLight, letterSpacing: "0.5px" }}>Canceladas</p>
          {historico.map(a => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: RAIO_MD, background: C.bg, marginBottom: 6, fontSize: 12, color: C.textMuted }}>
              <span>{a.planos_assinatura_cliente?.nome || 'Plano'} · início {fmt(a.data_inicio)}</span>
              <span style={{ fontWeight: 700, color: C.textLight }}>Cancelada</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnSec: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "transparent", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, color: C.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" };
const labelSt: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 };
const inputSt: React.CSSProperties = { padding: "9px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: C.bgCard };
