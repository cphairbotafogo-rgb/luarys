/**
 * src/app/admin/abas/PacotesWhatsapp.tsx
 *
 * Preço e quantidade dos pacotes de créditos WhatsApp (whatsapp_pacotes),
 * vendidos na Central de Comunicação de cada salão via Asaas
 * (ver /api/whatsapp/comprar-creditos). "Ativo" controla se o pacote pode
 * ser comprado — desativar não afeta créditos já comprados.
 */
'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { thStyle, tdStyle, ToggleBtn, PrecoInput } from "../shared";
import { useToast } from "@/components/Toast";
import { confirmarAcaoGlobal } from "@/components/ConfirmacaoGlobal";
import { FiRefreshCw } from "react-icons/fi";

const NOME_TIPO: Record<string, string> = {
  atendimento: 'Atendimento (24h)',
  campanha: 'Campanha (marketing)',
};

export function PacotesWhatsapp() {
  const toast = useToast();
  const [pacotes, setPacotes] = useState<any[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [reajustandoId, setReajustandoId] = useState<string | null>(null);

  useEffect(() => { carregarPacotes(); }, []);

  async function carregarPacotes() {
    const { data } = await supabase
      .from('whatsapp_pacotes')
      .select('id, tipo, quantidade, preco, ativo')
      .order('tipo').order('quantidade');
    if (data) setPacotes(data);
  }

  async function salvarPreco(id: string, valor: string) {
    const novoPreco = Math.max(0, parseFloat(valor.replace(',', '.')) || 0);
    setPacotes(prev => prev.map(p => p.id === id ? { ...p, preco: novoPreco } : p));
    setSalvandoId(`${id}-preco`);
    const { error } = await supabase.from('whatsapp_pacotes').update({ preco: novoPreco }).eq('id', id);
    if (error) await carregarPacotes();
    setSalvandoId(null);
  }

  async function salvarQuantidade(pacote: any, valor: string) {
    const novaQtd = Math.max(1, parseInt(valor, 10) || pacote.quantidade);
    setPacotes(prev => prev.map(p => p.id === pacote.id ? { ...p, quantidade: novaQtd } : p));
    setSalvandoId(`${pacote.id}-quantidade`);
    const { error } = await supabase.from('whatsapp_pacotes').update({ quantidade: novaQtd }).eq('id', pacote.id);
    if (error) setPacotes(prev => prev.map(p => p.id === pacote.id ? { ...p, quantidade: pacote.quantidade } : p));
    setSalvandoId(null);
  }

  async function alternarAtivo(pacote: any) {
    setSalvandoId(`${pacote.id}-ativo`);
    const novoValor = !pacote.ativo;
    const { error } = await supabase.from('whatsapp_pacotes').update({ ativo: novoValor }).eq('id', pacote.id);
    if (!error) setPacotes(prev => prev.map(p => p.id === pacote.id ? { ...p, ativo: novoValor } : p));
    setSalvandoId(null);
  }

  // Reajusta o valor das PRÓXIMAS cobranças de quem já assina o pacote —
  // mudar o preço aqui em cima não propaga sozinho pra Asaas (a subscription
  // já criada fica "congelada" no valor de quando foi contratada).
  async function reajustarAssinantes(pacote: any) {
    const nome = `${NOME_TIPO[pacote.tipo] || pacote.tipo} — ${pacote.quantidade} créditos`;
    setReajustandoId(pacote.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` };

      const respPreview = await fetch('/api/admin/whatsapp/reajustar-assinaturas', {
        method: 'POST', headers, body: JSON.stringify({ pacote_id: pacote.id, preview: true }),
      });
      const preview = await respPreview.json();
      if (!respPreview.ok) { toast.erro(preview.erro || 'Erro ao consultar assinantes.'); return; }

      if (!preview.total_afetados) {
        toast.info(`Nenhuma assinatura ativa de "${nome}" no Asaas — nada para reajustar.`);
        return;
      }

      const confirmou = await confirmarAcaoGlobal({
        titulo: `Reajustar ${preview.total_afetados} assinante(s) de "${nome}"?`,
        descricao: `As próximas cobranças passam a ser R$ ${Number(pacote.preco).toFixed(2)}/mês. Faturas já geradas não são alteradas.`,
        perigoso: true,
        rotuloCta: 'Reajustar agora',
      });
      if (!confirmou) return;

      const respExec = await fetch('/api/admin/whatsapp/reajustar-assinaturas', {
        method: 'POST', headers, body: JSON.stringify({ pacote_id: pacote.id }),
      });
      const resultado = await respExec.json();
      if (!respExec.ok) { toast.erro(resultado.erro || 'Erro ao reajustar.'); return; }

      if (resultado.falhas?.length > 0) {
        console.error('[PacotesWhatsapp] Falhas ao reajustar:', resultado.falhas);
        toast.aviso(`${resultado.atualizados} reajustado(s), ${resultado.falhas.length} falharam (veja o console).`);
      } else {
        toast.sucesso(`${resultado.atualizados} assinante(s) reajustado(s) com sucesso!`);
      }
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    } finally {
      setReajustandoId(null);
    }
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>
          Pacotes de Créditos WhatsApp
        </h2>
        <p style={{ color: C.textMuted, marginTop: 4, fontSize: 12 }}>
          Preço e quantidade dos pacotes vendidos na Central de Comunicação (cobrança via Asaas). Ajuste aqui quando houver reajuste de preço — não afeta créditos já comprados.
        </p>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <th style={thStyle}>Tipo</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Quantidade</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Preço</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Ativo</th>
              <th style={{ ...thStyle, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {pacotes.map(p => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, opacity: p.ativo ? 1 : 0.35 }}>
                <td style={tdStyle}>{NOME_TIPO[p.tipo] || p.tipo}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <input
                    type="number" min={1} defaultValue={p.quantidade}
                    onBlur={(e) => salvarQuantidade(p, e.target.value)}
                    disabled={salvandoId === `${p.id}-quantidade`}
                    style={{ width: 80, padding: "5px 8px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, textAlign: "right", fontWeight: 700, color: C.textMain, opacity: salvandoId === `${p.id}-quantidade` ? 0.6 : 1 }}
                  />
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <PrecoInput valor={p.preco} carregando={salvandoId === `${p.id}-preco`} onSalvar={(v) => salvarPreco(p.id, v)} />
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <ToggleBtn ativo={!!p.ativo} carregando={salvandoId === `${p.id}-ativo`} onClick={() => alternarAtivo(p)} />
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <button
                    onClick={() => reajustarAssinantes(p)}
                    disabled={reajustandoId === p.id}
                    title="Aplica o preço atual às assinaturas já ativas no Asaas"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 11, fontWeight: 700, cursor: reajustandoId === p.id ? "wait" : "pointer" }}
                  >
                    <FiRefreshCw size={12} className={reajustandoId === p.id ? "animate-spin" : ""} /> Reajustar
                  </button>
                </td>
              </tr>
            ))}
            {pacotes.length === 0 && (
              <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: C.textLight, fontStyle: "italic" }}>Nenhum pacote cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
