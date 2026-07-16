'use client'
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { InputData } from "@/components/InputData";
import { RAIO_XS, RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { FiCalendar, FiFilter, FiUser, FiClock, FiAlertCircle } from "react-icons/fi";

function localStr(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function dataHoje() { return localStr(new Date()); }
function inicioMesAtual() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; }

const TIPOS_BLOQUEIO = [
  'Todos',
  'Falta',
  'Atraso',
  'Saída Antecipada',
  'Bloqueio Pessoal',
  'Bloqueio Operacional',
  'Liberação Excepcional',
];

function extrairTipo(obs: string | null): string {
  if (!obs) return 'Não informado';
  const match = obs.match(/^\[([^\]]+)\]/);
  return match ? match[1] : 'Não informado';
}

function extrairMotivo(obs: string | null): string {
  if (!obs) return '—';
  return obs.replace(/^\[[^\]]+\]\s*/, '').trim() || '—';
}

function formatarDuracao(min: number | null): string {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${m}min`;
}

const corTipo = (tipo: string): { bg: string; cor: string } => {
  if (tipo === 'Falta') return { bg: '#FEE2E2', cor: '#991B1B' };
  if (tipo === 'Atraso') return { bg: '#FEF3C7', cor: '#92400E' };
  if (tipo === 'Saída Antecipada') return { bg: '#FEF3C7', cor: '#92400E' };
  if (tipo === 'Liberação Excepcional') return { bg: '#D1FAE5', cor: '#065F46' };
  return { bg: `${C.sidebarBg}18`, cor: C.sidebarBg };
};

export function GavetaAusencias({ perfil }: any) {
  const toast = useToast();
  const [registros, setRegistros]           = useState<any[]>([]);
  const [profissionais, setProfissionais]   = useState<any[]>([]);
  const [carregando, setCarregando]         = useState(false);
  const [dataInicio, setDataInicio]         = useState(inicioMesAtual);
  const [dataFim, setDataFim]               = useState(dataHoje);
  const [filtroProfissional, setFiltroProfissional] = useState('todos');
  const [filtroTipo, setFiltroTipo]         = useState('Todos');

  useEffect(() => {
    if (!perfil?.salao_id) return;
    supabase.from('profissionais').select('id, nome').eq('salao_id', perfil.salao_id).eq('ativo', true).order('nome')
      .then(({ data }) => setProfissionais(data || []));
  }, [perfil?.salao_id]);

  const carregar = useCallback(async () => {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    let q = supabase
      .from('agendamentos')
      .select('id, data, inicio, duracao_min, observacao, profissional_id, profissionais!profissional_id(nome)')
      .eq('salao_id', perfil.salao_id)
      .eq('status', 'Bloqueado')
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: false });

    if (filtroProfissional !== 'todos') q = q.eq('profissional_id', filtroProfissional);

    const { data, error } = await q;
    if (error) toast.erro("Erro ao carregar: " + error.message);

    let resultado = data || [];
    if (filtroTipo !== 'Todos') {
      resultado = resultado.filter((r: any) => extrairTipo(r.observacao) === filtroTipo);
    }
    setRegistros(resultado);
    setCarregando(false);
  }, [perfil?.salao_id, dataInicio, dataFim, filtroProfissional, filtroTipo]);

  useEffect(() => { carregar(); }, [carregar]);

  // ─── TOTAIS ──────────────────────────────────────────────────
  const totalPorTipo = registros.reduce((acc: Record<string, number>, r) => {
    const t = extrairTipo(r.observacao);
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const tipoMaisFrequente = Object.entries(totalPorTipo).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const totalMinutos = registros.reduce((acc, r) => acc + (r.duracao_min || 0), 0);

  const inputSt: React.CSSProperties = {
    padding: "9px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
    fontSize: 12, fontWeight: 600, color: C.textMain, background: C.bgCard, outlineColor: C.sidebarBg,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── FILTROS ── */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", marginBottom: 6 }}>
              <FiCalendar size={10} style={{ marginRight: 4 }}/> Período
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.bg, borderRadius: RAIO_MD, padding: "6px 10px", border: `1px solid ${C.borderMid}` }}>
              <InputData value={dataInicio} onChange={setDataInicio} style={{ border: "none", outline: "none", fontSize: 12, fontWeight: 600, color: C.textMain, background: "transparent" }} />
              <span style={{ fontSize: 12, color: C.textLight }}>à</span>
              <InputData value={dataFim} onChange={setDataFim} style={{ border: "none", outline: "none", fontSize: 12, fontWeight: 600, color: C.textMain, background: "transparent" }} />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", marginBottom: 6 }}>
              <FiUser size={10} style={{ marginRight: 4 }}/> Profissional
            </label>
            <select value={filtroProfissional} onChange={e => setFiltroProfissional(e.target.value)} style={{ ...inputSt, cursor: "pointer" }}>
              <option value="todos">Todos</option>
              {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", marginBottom: 6 }}>
              <FiFilter size={10} style={{ marginRight: 4 }}/> Tipo
            </label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ ...inputSt, cursor: "pointer" }}>
              {TIPOS_BLOQUEIO.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── CARDS DE RESUMO ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {[
          { label: "Registros no período", valor: registros.length, cor: C.sidebarBg, icon: <FiAlertCircle size={18}/> },
          { label: "Tempo total bloqueado", valor: formatarDuracao(totalMinutos), cor: C.danger, icon: <FiClock size={18}/> },
          { label: "Tipo mais frequente", valor: tipoMaisFrequente, cor: "#92400E", icon: <FiFilter size={18}/> },
        ].map(s => (
          <div key={s.label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ background: `${s.cor}18`, color: s.cor, padding: 10, borderRadius: RAIO_LG, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.cor, marginTop: 2 }}>{s.valor}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── TABELA ── */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.borderMid}`, background: C.bg }}>
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>
            Registros de Bloqueio — {registros.length} encontrado(s)
          </h3>
        </div>

        {carregando ? (
          <div style={{ padding: 48, textAlign: "center", color: C.textMuted, fontSize: 13 }}>Carregando...</div>
        ) : registros.length === 0 ? (
          <div style={{ padding: 56, textAlign: "center" }}>
            <FiClock size={28} style={{ color: C.borderMid, display: "block", margin: "0 auto 10px" }} />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.textMuted }}>Nenhum bloqueio no período selecionado.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: C.bg }}>
                <tr>
                  {["Data", "Hora", "Profissional", "Tipo", "Motivo", "Duração"].map(h => (
                    <th key={h} style={{ padding: "11px 20px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((r: any) => {
                  const tipo = extrairTipo(r.observacao);
                  const motivo = extrairMotivo(r.observacao);
                  const cor = corTipo(tipo);
                  return (
                    <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }} className="hover:bg-slate-50">
                      <td style={{ padding: "13px 20px", fontSize: 13, fontWeight: 700, color: C.textMain }}>
                        {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: "13px 20px", fontSize: 12, color: C.textMuted, fontFamily: "monospace" }}>
                        {r.inicio ? r.inicio.slice(0, 5) : '—'}
                      </td>
                      <td style={{ padding: "13px 20px", fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>
                        {(r.profissionais as any)?.nome || '—'}
                      </td>
                      <td style={{ padding: "13px 20px" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: RAIO_XS, background: cor.bg, color: cor.cor }}>
                          {tipo}
                        </span>
                      </td>
                      <td style={{ padding: "13px 20px", fontSize: 12, color: C.textMuted }}>{motivo}</td>
                      <td style={{ padding: "13px 20px", fontSize: 12, color: C.textMuted, fontFamily: "monospace" }}>
                        {formatarDuracao(r.duracao_min)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
