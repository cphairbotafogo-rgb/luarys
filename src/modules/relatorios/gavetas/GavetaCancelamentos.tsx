'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_XL, RAIO_SM } from "@/lib/estiloGlobal";
import { FiAlertTriangle, FiLoader, FiClock, FiUser, FiCalendar, FiInfo } from "react-icons/fi";

export function GavetaCancelamentos({ perfil }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  const [nomesUsuarios, setNomesUsuarios] = useState<Record<string, string>>({});
  const [profissionaisMap, setProfissionaisMap] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<'POS_HORARIO' | 'TODOS'>('POS_HORARIO');

  useEffect(() => { carregar(); }, [perfil]);

  async function carregar() {
    if (!perfil?.salao_id) return;
    setCarregando(true);

    const [resLogs, resDonos, resEquipe] = await Promise.all([
      supabase.from('auditoria_log').select('*').eq('salao_id', perfil.salao_id).eq('tabela', 'agendamentos_cancelamento').order('criado_em', { ascending: false }).limit(200),
      supabase.from('perfis_usuarios').select('id, nome').eq('salao_id', perfil.salao_id),
      supabase.from('profissionais').select('id, nome').eq('salao_id', perfil.salao_id),
    ]);

    const mapaUsuarios: Record<string, string> = {};
    (resDonos.data || []).forEach((p: any) => { mapaUsuarios[p.id] = p.nome || 'Proprietário'; });
    (resEquipe.data || []).forEach((p: any) => { mapaUsuarios[p.id] = p.nome || 'Equipe'; });
    setNomesUsuarios(mapaUsuarios);

    const mapaProf: Record<string, string> = {};
    (resEquipe.data || []).forEach((p: any) => { mapaProf[p.id] = p.nome; });
    setProfissionaisMap(mapaProf);

    if (resLogs.data) setLogs(resLogs.data);
    setCarregando(false);
  }

  const registros = logs.map((l: any) => {
    const antigo = l.dados_antigos || {};
    const dataHoraInicio = antigo.data_hora_inicio ? new Date(antigo.data_hora_inicio) : null;
    const canceladoEm = new Date(l.criado_em);
    const posHorario = !!(dataHoraInicio && canceladoEm > dataHoraInicio);
    return { ...l, antigo, dataHoraInicio, canceladoEm, posHorario };
  });

  const registrosFiltrados = filtro === 'TODOS' ? registros : registros.filter(r => r.posHorario);
  const totalPosHorario = registros.filter(r => r.posHorario).length;

  const filtroBtnStyle = (ativo: boolean) => ({
    background: ativo ? C.sidebarBg : C.bgCard,
    color: ativo ? "#fff" : C.textMain,
    border: `1px solid ${C.borderMid}`,
    padding: "8px 16px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    textTransform: "uppercase" as const,
  });

  if (carregando) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: C.sidebarBg, fontWeight: 700, padding: 40 }}>
      <FiLoader className="animate-spin" size={18} /> A carregar cancelamentos...
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.sidebarBg}`, borderRadius: RAIO_XL, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
        <FiAlertTriangle size={28} color={C.sidebarBg} />
        <div>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Cancelamentos Pós-Horário</h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>
            Agendamentos cancelados <strong>depois</strong> do horário em que estavam marcados — um padrão clássico de "no-show disfarçado" para evitar registrar a falta. {totalPosHorario} ocorrência(s) no histórico recente.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button style={filtroBtnStyle(filtro === 'POS_HORARIO')} onClick={() => setFiltro('POS_HORARIO')}>Só pós-horário ({totalPosHorario})</button>
        <button style={filtroBtnStyle(filtro === 'TODOS')} onClick={() => setFiltro('TODOS')}>Todos os cancelamentos ({registros.length})</button>
      </div>

      {registrosFiltrados.length === 0 ? (
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 40, textAlign: "center" }}>
          <FiInfo size={24} color={C.textLight} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, color: C.textLight, fontSize: 13, fontStyle: "italic" }}>
            {filtro === 'POS_HORARIO' ? "Nenhum cancelamento pós-horário encontrado. 👍" : "Nenhum cancelamento registrado no período."}
          </p>
        </div>
      ) : (
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Cliente</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Profissional</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Horário Marcado</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Cancelado Em</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Cancelado Por</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }} title="Situação = tipo do cancelamento. 'Faltou' = cliente não apareceu. 'Pós-horário' = cancelado depois do horário marcado (suspeito). 'Normal' = cancelado com antecedência.">Situação ⓘ</th>
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.map((r: any) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: C.textMain }}>{r.antigo?.cliente_nome || "—"}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: C.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                    <FiUser size={12} /> {profissionaisMap[r.antigo?.profissional_id] || "—"}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: C.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                    <FiCalendar size={12} /> {r.dataHoraInicio ? r.dataHoraInicio.toLocaleString('pt-BR') : "—"}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: C.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                    <FiClock size={12} /> {r.canceladoEm.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: C.textMuted }}>{nomesUsuarios[r.usuario_id] || "Sistema"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    {/* Situação = combinação do tipo (faltou/cancelado) + timing (pós-horário/normal) */}
                    {r.antigo?.tipo === 'faltou' ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: C.dangerText, background: C.dangerBg, border: `1px solid ${C.danger}`, padding: "4px 10px", borderRadius: RAIO_XL }}>
                        <FiAlertTriangle size={12} /> Faltou
                      </span>
                    ) : r.posHorario ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "4px 10px", borderRadius: RAIO_XL }}>
                        <FiAlertTriangle size={12} /> Cancelado pós-horário
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.textLight, background: C.bg, padding: "4px 10px", borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
                        Cancelado normal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}