'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { InputData } from "@/components/InputData";
import { RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { FiAlertTriangle, FiLoader, FiUser, FiInfo, FiRotateCcw } from "react-icons/fi";

// Limite a partir do qual a concentração de estornos por usuário é destacada
const LIMITE_ESTORNOS_USUARIO = 3;

export function GavetaAlertasEstorno({ perfil }: any) {
  const [estornos, setEstornos] = useState<any[]>([]);
  const [nomesUsuarios, setNomesUsuarios] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => { carregar(); }, [perfil, dataInicio]);

  async function carregar() {
    if (!perfil?.salao_id) return;
    setCarregando(true);

    const [resLogs, resDonos, resEquipe] = await Promise.all([
      supabase.from('auditoria_log').select('*').eq('salao_id', perfil.salao_id).eq('tabela', 'financeiro').gte('criado_em', `${dataInicio}T00:00:00.000Z`).order('criado_em', { ascending: false }).limit(500),
      supabase.from('perfis_usuarios').select('id, nome').eq('salao_id', perfil.salao_id),
      supabase.from('profissionais').select('id, nome').eq('salao_id', perfil.salao_id),
    ]);

    const mapaUsuarios: Record<string, string> = {};
    (resDonos.data || []).forEach((p: any) => { mapaUsuarios[p.id] = p.nome || 'Proprietário'; });
    (resEquipe.data || []).forEach((p: any) => { mapaUsuarios[p.id] = p.nome || 'Equipe'; });
    setNomesUsuarios(mapaUsuarios);

    // Apenas transições PARA 'Estornado' (o estorno em si, não edições posteriores)
    const apenasEstornos = (resLogs.data || []).filter((l: any) =>
      l.dados_novos?.status === 'Estornado' && l.dados_antigos?.status !== 'Estornado'
    );

    const enriquecidos = apenasEstornos.map((l: any) => {
      const comentario: string = l.dados_novos?.comentario || '';
      const matchMotivo = comentario.match(/Motivo:\s*(.*?)\s*\|/);
      return {
        ...l,
        valor: Number(l.dados_antigos?.valor) || 0,
        descricao: l.dados_antigos?.descricao || '—',
        motivo: matchMotivo ? matchMotivo[1] : '—',
      };
    });

    setEstornos(enriquecidos);
    setCarregando(false);
  }

  // Ranking por usuário
  const ranking: Record<string, { qtd: number; total: number }> = {};
  estornos.forEach(e => {
    const uid = e.usuario_id || 'desconhecido';
    if (!ranking[uid]) ranking[uid] = { qtd: 0, total: 0 };
    ranking[uid].qtd += 1;
    ranking[uid].total += e.valor;
  });
  const rankingOrdenado = Object.entries(ranking).sort((a, b) => b[1].qtd - a[1].qtd);

  const totalEstornado = estornos.reduce((acc, e) => acc + e.valor, 0);

  if (carregando) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: C.sidebarBg, fontWeight: 700, padding: 40 }}>
      <FiLoader className="animate-spin" size={18} /> A carregar estornos...
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.sidebarBg}`, borderRadius: RAIO_XL, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <FiRotateCcw size={28} color={C.sidebarBg} />
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Alertas de Estorno</h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>
            Todo estorno exige PIN de gerente e motivo — aqui você acompanha quem estornou, quanto e por quê. Usuários com {LIMITE_ESTORNOS_USUARIO}+ estornos no período são destacados para revisão.
          </p>
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", display: "block", marginBottom: 4 }}>A partir de</label>
          <InputData value={dataInicio} onChange={setDataInicio} style={{ padding: "8px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontFamily: "var(--font-body)" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: "16px 24px", flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Estornos no período</p>
          <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: C.sidebarBg }}>{estornos.length}</p>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: "16px 24px", flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Valor total estornado</p>
          <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: C.danger }}>{brl(totalEstornado)}</p>
        </div>
      </div>

      {/* RANKING POR USUÁRIO */}
      {rankingOrdenado.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.5px" }}>Por Usuário</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {rankingOrdenado.map(([uid, dados]) => {
              const alerta = dados.qtd >= LIMITE_ESTORNOS_USUARIO;
              return (
                <div key={uid} style={{ background: C.bgCard, border: `1px solid ${alerta ? '#FCA5A5' : C.border}`, borderRadius: RAIO_XL, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: C.textMain }}>
                      <FiUser size={14} color={C.textLight} /> {nomesUsuarios[uid] || "Sistema / Desconhecido"}
                    </span>
                    {alerta && (
                      <span title={`${dados.qtd} estornos — acima do esperado`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: C.danger, background: "#FEF2F2", border: "1px solid #FCA5A5", padding: "3px 8px", borderRadius: RAIO_LG }}>
                        <FiAlertTriangle size={10} /> Revisar
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: alerta ? C.danger : C.sidebarBg }}>{dados.qtd} estorno{dados.qtd > 1 ? 's' : ''}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>Total: {brl(dados.total)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETALHAMENTO */}
      {estornos.length === 0 ? (
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 40, textAlign: "center" }}>
          <FiInfo size={24} color={C.textLight} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, color: C.textLight, fontSize: 13, fontStyle: "italic" }}>Nenhum estorno registrado no período. 👍</p>
        </div>
      ) : (
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Quando</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Lançamento</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Motivo</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Estornado Por</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {estornos.map((e: any) => (
                <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: C.textMuted }}>{new Date(e.criado_em).toLocaleString('pt-BR')}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: C.textMain }}>{e.descricao}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: C.textMuted }}>{e.motivo}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: C.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                    <FiUser size={12} /> {nomesUsuarios[e.usuario_id] || "Sistema"}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: C.danger, textAlign: "right" }}>{brl(e.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}