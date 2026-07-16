'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { FiZap, FiClock, FiLoader, FiTrash2, FiAlertTriangle } from "react-icons/fi";
import { thStyle, tdStyle } from "../shared";

interface PromoAtiva {
  modulo_chave: string;
  nome_modulo: string;
  total_saloes: number;
  expira_em: string | null;
}

export function PromocoesGlobais() {
  const [modulos, setModulos] = useState<any[]>([]);
  const [moduloSelecionado, setModuloSelecionado] = useState('');
  const [dias, setDias] = useState('');
  const [lancando, setLancando] = useState(false);
  const [revogando, setRevogando] = useState<string | null>(null);
  const [promos, setPromos] = useState<PromoAtiva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  useEffect(() => {
    carregarModulos();
    carregarPromos();
  }, []);

  async function carregarModulos() {
    const { data } = await supabase
      .from('modulos_catalogo')
      .select('chave, nome')
      .eq('ativo', true)
      .order('nome');
    if (data) setModulos(data);
  }

  async function carregarPromos() {
    setCarregando(true);
    const { data, error } = await supabase.rpc('admin_listar_promocoes_ativas');
    if (!error && data) setPromos(data as PromoAtiva[]);
    setCarregando(false);
  }

  function mostrarFeedback(tipo: 'sucesso' | 'erro', msg: string) {
    setFeedback({ tipo, msg });
    setTimeout(() => setFeedback(null), 5000);
  }

  async function lancarPromocao() {
    if (!moduloSelecionado) return;
    setLancando(true);

    const diasNum = dias.trim() ? Math.max(1, parseInt(dias, 10) || 1) : null;
    const { data, error } = await supabase.rpc('admin_liberar_modulo_global', {
      p_modulo_chave: moduloSelecionado,
      p_dias: diasNum,
    });

    setLancando(false);
    if (error) { mostrarFeedback('erro', error.message); return; }

    const nomeModulo = modulos.find(m => m.chave === moduloSelecionado)?.nome || moduloSelecionado;
    const prazo = diasNum ? `por ${diasNum} dia${diasNum > 1 ? 's' : ''}` : 'sem prazo definido';
    mostrarFeedback('sucesso', `"${nomeModulo}" liberado para ${data} salões ${prazo}.`);
    setModuloSelecionado('');
    setDias('');
    carregarPromos();
  }

  async function revogarPromocao(moduloChave: string, nomeModulo: string) {
    if (!confirm(`Revogar promoção de "${nomeModulo}"?\n\nOs salões que receberam via promoção perderão o acesso. Assinaturas pagas não são afetadas.`)) return;

    setRevogando(moduloChave);
    const { data, error } = await supabase.rpc('admin_revogar_promocao_global', {
      p_modulo_chave: moduloChave,
    });
    setRevogando(null);

    if (error) { mostrarFeedback('erro', error.message); return; }
    mostrarFeedback('sucesso', `Promoção de "${nomeModulo}" revogada. ${data} salões perderam o acesso promocional.`);
    carregarPromos();
  }

  function formatarExpiracao(expiraEm: string | null): string {
    if (!expiraEm) return 'Sem prazo — ativo até revogar';
    const data = new Date(expiraEm + (expiraEm.includes('T') ? '' : 'T12:00:00'));
    const agora = new Date();
    const diasRestantes = Math.ceil((data.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
    const dataFormatada = data.toLocaleDateString('pt-BR');
    if (diasRestantes <= 0) return `Expirou em ${dataFormatada}`;
    if (diasRestantes === 1) return `Expira amanhã (${dataFormatada})`;
    return `Expira em ${diasRestantes} dias — ${dataFormatada}`;
  }

  const inputSt: React.CSSProperties = {
    padding: "10px 14px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
    fontSize: 13, color: C.textMain, background: C.bgCard, fontFamily: "inherit",
    outline: "none",
  };

  return (
    <>
      <div style={{ marginTop: 40, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px", display: "flex", alignItems: "center", gap: 8 }}>
          <FiZap size={16} /> Promoções Globais
        </h2>
        <p style={{ color: C.textMuted, marginTop: 6, fontSize: 13 }}>
          Libera um módulo para <strong>todos os salões ativos</strong> de uma vez — ideal para degustação ou campanhas. Com prazo, o acesso é revogado automaticamente ao expirar.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

        {/* ── LANÇAR PROMOÇÃO ── */}
        <Card style={{ padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.5px" }}>Lançar Promoção</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>
                Módulo
              </label>
              <select
                value={moduloSelecionado}
                onChange={(e) => setModuloSelecionado(e.target.value)}
                style={{ ...inputSt, width: "100%", boxSizing: "border-box" }}
              >
                <option value="">Selecione um módulo...</option>
                {modulos.map(m => (
                  <option key={m.chave} value={m.chave}>{m.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 6 }}>
                Duração (dias) — deixe em branco para sem prazo
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiClock size={14} color={C.textLight} />
                <input
                  type="number"
                  min={1}
                  max={365}
                  placeholder="Ex: 3"
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  style={{ ...inputSt, width: 120 }}
                />
                {dias && <span style={{ fontSize: 12, color: C.textMuted }}>dia{parseInt(dias) !== 1 ? 's' : ''}</span>}
              </div>
            </div>

            {feedback && (
              <div style={{
                padding: "12px 16px",
                borderRadius: RAIO_MD,
                fontSize: 13,
                fontWeight: 600,
                background: feedback.tipo === 'sucesso' ? "#F0FDF4" : "#FEF2F2",
                color: feedback.tipo === 'sucesso' ? "#15803D" : "#DC2626",
                border: `1px solid ${feedback.tipo === 'sucesso' ? "#A7F3D0" : "#FECACA"}`,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}>
                {feedback.tipo === 'erro' && <FiAlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />}
                {feedback.msg}
              </div>
            )}

            <button
              onClick={lancarPromocao}
              disabled={!moduloSelecionado || lancando}
              style={{
                padding: "12px 0",
                borderRadius: RAIO_MD,
                border: "none",
                background: !moduloSelecionado || lancando ? C.bg : C.sidebarBg,
                color: !moduloSelecionado || lancando ? C.textLight : "#fff",
                fontWeight: 800,
                fontSize: 13,
                cursor: !moduloSelecionado || lancando ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {lancando ? <><FiLoader className="animate-spin" size={14} /> Lançando...</> : <><FiZap size={14} /> Lançar para todos os salões</>}
            </button>

            <p style={{ margin: 0, fontSize: 11, color: C.textLight, lineHeight: 1.5 }}>
              Salões que já têm o módulo ativo (por assinatura ou liberação manual) não são afetados. A expiração automática usa o agendador diário existente.
            </p>
          </div>
        </Card>

        {/* ── PROMOÇÕES ATIVAS ── */}
        <div>
          <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.5px" }}>Promoções em Andamento</h3>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                  <th style={thStyle}>Módulo</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Salões</th>
                  <th style={thStyle}>Prazo</th>
                  <th style={{ ...thStyle, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: C.textLight, fontStyle: "italic" }}>Carregando...</td></tr>
                ) : promos.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: C.textLight, fontStyle: "italic" }}>Nenhuma promoção ativa.</td></tr>
                ) : promos.map(p => (
                  <tr key={p.modulo_chave} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 700 }}>{p.nome_modulo}</span>
                      <br />
                      <span style={{ fontSize: 11, color: C.textLight }}>{p.modulo_chave}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{p.total_saloes}</td>
                    <td style={{ ...tdStyle }}>
                      <span style={{ fontSize: 12, color: p.expira_em ? C.textMuted : C.success }}>
                        {formatarExpiracao(p.expira_em)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        onClick={() => revogarPromocao(p.modulo_chave, p.nome_modulo)}
                        disabled={revogando === p.modulo_chave}
                        title="Revogar promoção — remove acesso dos salões que receberam via promoção"
                        style={{
                          padding: "6px 12px",
                          borderRadius: RAIO_MD,
                          border: `1px solid #FECACA`,
                          background: "#FEF2F2",
                          color: "#DC2626",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: revogando === p.modulo_chave ? "wait" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {revogando === p.modulo_chave ? <FiLoader className="animate-spin" size={12} /> : <FiTrash2 size={12} />}
                        Revogar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

      </div>
    </>
  );
}
