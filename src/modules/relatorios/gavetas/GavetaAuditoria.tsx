'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { RAIO_SM, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { FiShield, FiEdit2, FiTrash2, FiArrowRight, FiUser, FiLoader, FiAlertTriangle } from "react-icons/fi";

export function GavetaAuditoria({ perfil }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  const [nomesUsuarios, setNomesUsuarios] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [filtroOperacao, setFiltroOperacao] = useState<'TODOS' | 'UPDATE' | 'DELETE'>('TODOS');

  useEffect(() => { carregar(); }, [perfil]);

  async function carregar() {
    if (!perfil?.salao_id) return;
    setCarregando(true);

    const [resLogs, resDonos, resEquipe] = await Promise.all([
      supabase.from('auditoria_log').select('*').eq('salao_id', perfil.salao_id).order('criado_em', { ascending: false }).limit(200),
      supabase.from('perfis_usuarios').select('id, nome').eq('salao_id', perfil.salao_id),
      supabase.from('profissionais').select('id, nome').eq('salao_id', perfil.salao_id),
    ]);

    const mapa: Record<string, string> = {};
    (resDonos.data || []).forEach((p: any) => { mapa[p.id] = p.nome || 'Proprietário'; });
    (resEquipe.data || []).forEach((p: any) => { mapa[p.id] = p.nome || 'Equipe'; });
    setNomesUsuarios(mapa);

    if (resLogs.data) setLogs(resLogs.data);
    setCarregando(false);
  }

  const logsFiltrados = logs.filter(l => filtroOperacao === 'TODOS' || l.operacao === filtroOperacao);

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
      <FiLoader className="animate-spin" size={18} /> A carregar log de auditoria...
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.sidebarBg}`, borderRadius: RAIO_XL, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16 }}>
        <FiShield size={28} color={C.sidebarBg} />
        <div>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Log de Auditoria — Lançamentos Financeiros</h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>
            Toda edição ou exclusão em "Financeiro" é registrada automaticamente, com data, hora e usuário responsável. Este registro não pode ser apagado pela equipe.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button style={filtroBtnStyle(filtroOperacao === 'TODOS')} onClick={() => setFiltroOperacao('TODOS')}>Todos</button>
        <button style={filtroBtnStyle(filtroOperacao === 'UPDATE')} onClick={() => setFiltroOperacao('UPDATE')}>Edições</button>
        <button style={filtroBtnStyle(filtroOperacao === 'DELETE')} onClick={() => setFiltroOperacao('DELETE')}>Exclusões</button>
      </div>

      {logsFiltrados.length === 0 && (
        <p style={{ color: C.textLight, fontStyle: "italic", fontSize: 13 }}>Nenhum registro de auditoria encontrado.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {logsFiltrados.map((log) => {
          const isDelete = log.operacao === 'DELETE';
          const antes = log.dados_antigos || {};
          const depois = log.dados_novos || {};
          const valorAntes = Number(antes.valor || 0);
          const valorDepois = Number(depois.valor || 0);
          const valorMudou = !isDelete && valorAntes !== valorDepois;
          const valorCaiu = valorMudou && valorDepois < valorAntes;
          const nomeUsuario = log.usuario_id ? (nomesUsuarios[log.usuario_id] || 'Usuário removido') : 'Sistema';

          return (
            <div key={log.id} style={{
              background: C.bgCard,
              border: `1px solid ${isDelete || valorCaiu ? '#FCA5A5' : C.border}`,
              borderLeft: `4px solid ${isDelete ? C.danger : valorCaiu ? '#D97706' : C.borderMid}`,
              borderRadius: RAIO_LG,
              padding: "16px 20px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isDelete ? <FiTrash2 size={14} color={C.danger} /> : <FiEdit2 size={14} color={C.textMuted} />}
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: isDelete ? C.danger : C.textMain }}>
                    {isDelete ? 'Lançamento Excluído' : 'Lançamento Editado'}
                  </span>
                  {valorCaiu && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: '#D97706', background: '#FFFBEB', padding: "2px 8px", borderRadius: RAIO_XL, textTransform: "uppercase" }}>
                      <FiAlertTriangle size={11} /> Valor reduzido
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: C.textLight }}>
                  {new Date(log.criado_em).toLocaleString('pt-BR')}
                </span>
              </div>

              <p style={{ margin: "10px 0 4px", fontSize: 13, fontWeight: 700, color: C.textMain }}>
                {(antes.descricao || depois.descricao) || '(sem descrição)'}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                {isDelete ? (
                  <span style={{ color: C.danger, fontWeight: 800 }}>{brl(valorAntes)}</span>
                ) : valorMudou ? (
                  <>
                    <span style={{ color: C.textLight, textDecoration: "line-through" }}>{brl(valorAntes)}</span>
                    <FiArrowRight size={12} color={C.textLight} />
                    <span style={{ color: valorCaiu ? '#D97706' : C.success, fontWeight: 800 }}>{brl(valorDepois)}</span>
                  </>
                ) : (
                  <span style={{ color: C.textMain, fontWeight: 700 }}>{brl(valorDepois || valorAntes)}</span>
                )}
              </div>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.textMuted }}>
                <FiUser size={12} /> Responsável: <strong style={{ color: C.textMain }}>{nomeUsuario}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}