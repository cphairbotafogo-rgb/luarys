'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { InputData } from "@/components/InputData";
import { RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { FiAlertOctagon, FiLoader, FiUser, FiCalendar, FiInfo, FiDollarSign } from "react-icons/fi";

export function GavetaCaixaNaoBate({ perfil }: any) {
  const [registros, setRegistros] = useState<any[]>([]);
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

    // Agendamentos marcados como "Finalizado" mas que nunca passaram pelo
    // Fechamento de Caixa (valor_comissao só é preenchido por useFechamentoCaixa).
    // Ou seja: o serviço conta nas estatísticas de performance/dashboard,
    // mas não gerou nenhum lançamento em `financeiro`.
    const { data: ags } = await supabase
      .from('agendamentos')
      .select('id, cliente_nome, profissional_id, servico_id, data, data_hora_inicio, valor_final')
      .eq('salao_id', perfil.salao_id)
      .eq('status', 'Finalizado')
      .is('valor_comissao', null)
      .gte('data', dataInicio)
      .order('data', { ascending: false });

    const idsServicos = [...new Set((ags || []).map((a: any) => a.servico_id).filter(Boolean))];
    const idsProfs = [...new Set((ags || []).map((a: any) => a.profissional_id).filter(Boolean))];

    const [resServicos, resProfs] = await Promise.all([
      idsServicos.length > 0 ? supabase.from('servicos').select('id, nome_servico, preco_padrao').in('id', idsServicos) : Promise.resolve({ data: [] }),
      idsProfs.length > 0 ? supabase.from('profissionais').select('id, nome').in('id', idsProfs) : Promise.resolve({ data: [] }),
    ]);

    const servicosMap: Record<string, any> = {};
    (resServicos.data || []).forEach((s: any) => { servicosMap[s.id] = s; });
    const profsMap: Record<string, string> = {};
    (resProfs.data || []).forEach((p: any) => { profsMap[p.id] = p.nome; });

    const enriquecidos = (ags || []).map((a: any) => ({
      ...a,
      servico: servicosMap[a.servico_id] || null,
      profissionalNome: profsMap[a.profissional_id] || "—",
      valorEstimado: Number(a.valor_final) || Number(servicosMap[a.servico_id]?.preco_padrao) || 0,
    }));

    setRegistros(enriquecidos);
    setCarregando(false);
  }

  const totalEstimado = registros.reduce((acc, r) => acc + r.valorEstimado, 0);

  if (carregando) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: C.sidebarBg, fontWeight: 700, padding: 40 }}>
      <FiLoader className="animate-spin" size={18} /> A cruzar agenda com o caixa...
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.2s ease-out" }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.sidebarBg}`, borderRadius: RAIO_XL, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <FiAlertOctagon size={28} color={C.sidebarBg} />
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Caixa Não Bate</h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>
            Atendimentos marcados como <strong>Finalizado</strong> que nunca passaram pelo Fechamento de Caixa — ou seja, contam como serviço prestado, mas não geraram nenhum lançamento em Financeiro nem comissão. Pode ser um ajuste manual de status, ou um atendimento pago "por fora".
          </p>
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", display: "block", marginBottom: 4 }}>A partir de</label>
          <InputData value={dataInicio} onChange={setDataInicio} style={{ padding: "8px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontFamily: "var(--font-body)" }} />
        </div>
      </div>

      {registros.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: RAIO_XL, padding: "16px 24px", flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#B45309", textTransform: "uppercase" }}>Atendimentos sem registro</p>
            <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: "#92400E" }}>{registros.length}</p>
          </div>
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: RAIO_XL, padding: "16px 24px", flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#B45309", textTransform: "uppercase" }}>Receita potencial não lançada</p>
            <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: "#92400E" }}>{brl(totalEstimado)}</p>
          </div>
        </div>
      )}

      {registros.length === 0 ? (
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 40, textAlign: "center" }}>
          <FiInfo size={24} color={C.textLight} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, color: C.textLight, fontSize: 13, fontStyle: "italic" }}>Nenhuma divergência encontrada no período. Tudo finalizado passou pelo caixa. 👍</p>
        </div>
      ) : (
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Data</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Cliente</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Profissional</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Serviço</th>
                <th style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "right" }}>Valor Estimado</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r: any) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: C.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                    <FiCalendar size={12} /> {r.data_hora_inicio ? new Date(r.data_hora_inicio).toLocaleString('pt-BR') : r.data}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: C.textMain }}>{r.cliente_nome || "—"}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: C.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                    <FiUser size={12} /> {r.profissionalNome}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: C.textMuted }}>{r.servico?.nome_servico || "—"}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "#B45309", textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                    <FiDollarSign size={12} /> {brl(r.valorEstimado)}
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