/**
 * src/app/admin/abas/AbaNotasFiscais.tsx
 *
 * Pagamentos de assinatura aprovados + status da NFS-e que o Luarys emite
 * para cada salão (preenchimento manual, pronto para automatizar depois).
 */
'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { thStyle, tdStyle } from "../shared";

export function AbaNotasFiscais() {
  const toast = useToast();
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  useEffect(() => {
    carregarPagamentos();
  }, []);

  async function carregarPagamentos() {
    const { data } = await supabase
      .from('pagamentos_assinatura')
      .select('id, salao_id, modulo_chave, valor, status, criado_em, saloes(nome_fantasia, razao_social, cnpj), notas_fiscais_plataforma(id, status, numero_nota, link_pdf, observacao, data_emissao)')
      .eq('status', 'approved')
      .order('criado_em', { ascending: false })
      .limit(200);

    if (data) setPagamentos(data);
  }

  async function salvarNotaFiscal(pagamento: any, campos: Record<string, any>) {
    setSalvandoId(`nf-${pagamento.id}`);

    const nfAtual = Array.isArray(pagamento.notas_fiscais_plataforma) ? pagamento.notas_fiscais_plataforma[0] : pagamento.notas_fiscais_plataforma;

    const payload = {
      pagamento_id: pagamento.id,
      salao_id: pagamento.salao_id,
      status: nfAtual?.status || 'pendente',
      numero_nota: nfAtual?.numero_nota ?? null,
      link_pdf: nfAtual?.link_pdf ?? null,
      observacao: nfAtual?.observacao ?? null,
      data_emissao: nfAtual?.data_emissao ?? null,
      ...campos,
    };

    const { error } = await supabase.from('notas_fiscais_plataforma').upsert(payload, { onConflict: 'pagamento_id' });

    if (error) toast.erro('Erro ao salvar: ' + error.message);
    else await carregarPagamentos();

    setSalvandoId(null);
  }

  return (
    <>
      <div style={{ marginTop: 8, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>Notas Fiscais — Luarys → Salões</h2>
        <p style={{ color: C.textMuted, marginTop: 6, fontSize: 13 }}>
          Pagamentos de assinatura aprovados e o status da nota fiscal de serviço (NFS-e) que o Luarys emite para cada salão. Preenchimento manual por enquanto — pronto para automatizar quando um provedor de NFS-e for integrado.
        </p>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <th style={thStyle}>Salão</th>
              <th style={thStyle}>Item</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Valor</th>
              <th style={thStyle}>Data Pagamento</th>
              <th style={thStyle}>Status da Nota</th>
              <th style={thStyle}>Número</th>
              <th style={thStyle}>Link PDF</th>
              <th style={thStyle}>Data Emissão</th>
            </tr>
          </thead>
          <tbody>
            {pagamentos.map(p => {
              const nf = Array.isArray(p.notas_fiscais_plataforma) ? p.notas_fiscais_plataforma[0] : p.notas_fiscais_plataforma;
              const salaoInfo = Array.isArray(p.saloes) ? p.saloes[0] : p.saloes;
              const statusAtual = nf?.status || 'pendente';
              const salvandoEste = salvandoId === `nf-${p.id}`;

              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700, color: C.textMain }}>{salaoInfo?.nome_fantasia || salaoInfo?.razao_social || '—'}</div>
                    <div style={{ fontSize: 11, color: C.textLight }}>{salaoInfo?.cnpj || 'CNPJ não cadastrado'}</div>
                  </td>
                  <td style={tdStyle}>{p.modulo_chave}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>R$ {Number(p.valor).toFixed(2)}</td>
                  <td style={tdStyle}>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td style={tdStyle}>
                    <select
                      defaultValue={statusAtual}
                      onChange={(e) => salvarNotaFiscal(p, { status: e.target.value })}
                      disabled={salvandoEste}
                      style={{ padding: "6px 8px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontWeight: 700 }}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="emitida">Emitida</option>
                      <option value="isento">Isento</option>
                      <option value="erro">Erro</option>
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <input
                      defaultValue={nf?.numero_nota || ''}
                      onBlur={(e) => salvarNotaFiscal(p, { numero_nota: e.target.value || null })}
                      disabled={salvandoEste}
                      placeholder="—"
                      style={{ width: 100, padding: "6px 8px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12 }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      defaultValue={nf?.link_pdf || ''}
                      onBlur={(e) => salvarNotaFiscal(p, { link_pdf: e.target.value || null })}
                      disabled={salvandoEste}
                      placeholder="https://..."
                      style={{ width: 160, padding: "6px 8px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12 }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="date"
                      defaultValue={nf?.data_emissao || ''}
                      onBlur={(e) => salvarNotaFiscal(p, { data_emissao: e.target.value || null })}
                      disabled={salvandoEste}
                      style={{ padding: "6px 8px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12 }}
                    />
                  </td>
                </tr>
              );
            })}
            {pagamentos.length === 0 && (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: C.textLight, fontStyle: "italic" }}>Nenhum pagamento aprovado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}