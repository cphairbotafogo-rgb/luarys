/**
 * src/app/admin/abas/ContasRecebimento.tsx
 *
 * Gestão das contas de recebimento da plataforma (Mercado Pago/InfinitePay).
 * Permite cadastrar mais de uma conta (ex: CNPJs diferentes) e escolher
 * qual está ativa — usada pelo /api/assinatura/criar-checkout.
 */
'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { FiXCircle } from "react-icons/fi";

export function ContasRecebimento() {
  const toast = useToast();
  const [contas, setContas] = useState<any[]>([]);
  const [novaConta, setNovaConta] = useState<{ nome: string; gateway: 'mercadopago' | 'infinitepay' | 'cielo' }>({ nome: '', gateway: 'mercadopago' });
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  useEffect(() => {
    carregarContas();
  }, []);

  async function carregarContas() {
    const { data } = await supabase
      .from('plataforma_contas_recebimento')
      .select('id, nome, gateway, mercadopago_access_token, mercadopago_webhook_secret, infinitepay_handle, infinitepay_webhook_token, cielo_merchant_id, cielo_merchant_key, ativa, created_at')
      .order('created_at');

    if (data) setContas(data);
  }

  async function adicionarConta() {
    if (!novaConta.nome.trim()) { toast.erro('Dê um nome para a conta (ex: "Principal - CNPJ A").'); return; }
    setSalvandoId('conta-nova');

    const { error } = await supabase.from('plataforma_contas_recebimento').insert({
      nome: novaConta.nome.trim(),
      gateway: novaConta.gateway,
      ativa: false,
    });

    if (error) {
      toast.erro('Erro ao criar conta: ' + error.message);
    } else {
      setNovaConta({ nome: '', gateway: 'mercadopago' });
      await carregarContas();
    }
    setSalvandoId(null);
  }

  async function removerConta(conta: any) {
    if (!await confirmarAcaoGlobal({ titulo: `Remover a conta "${conta.nome}"?`, descricao: 'Essa ação não pode ser desfeita.', perigoso: true })) return;
    setSalvandoId(`conta-${conta.id}-remover`);

    const { error } = await supabase.from('plataforma_contas_recebimento').delete().eq('id', conta.id);

    if (error) toast.erro('Erro ao remover: ' + error.message);
    else await carregarContas();

    setSalvandoId(null);
  }

  async function ativarConta(conta: any) {
    setSalvandoId(`conta-${conta.id}-ativar`);

    // desativa todas e ativa só esta
    await supabase.from('plataforma_contas_recebimento').update({ ativa: false }).neq('id', conta.id);
    const { error } = await supabase.from('plataforma_contas_recebimento').update({ ativa: true }).eq('id', conta.id);

    if (!error) await carregarContas();
    setSalvandoId(null);
  }

  async function salvarCredencial(conta: any, campo: 'mercadopago_access_token' | 'mercadopago_webhook_secret' | 'infinitepay_handle' | 'infinitepay_webhook_token' | 'cielo_merchant_id' | 'cielo_merchant_key', valor: string) {
    if (!valor.trim()) return; // campo vazio = mantém a credencial atual
    setSalvandoId(`conta-${conta.id}-${campo}`);

    const { error } = await supabase
      .from('plataforma_contas_recebimento')
      .update({ [campo]: valor.trim() })
      .eq('id', conta.id);

    if (error) toast.erro('Erro ao salvar credencial: ' + error.message);
    else {
      toast.sucesso('Credencial salva.');
      await carregarContas();
    }
    setSalvandoId(null);
  }

  async function salvarNome(conta: any, valor: string) {
    if (!valor.trim() || valor.trim() === conta.nome) return;
    setSalvandoId(`conta-${conta.id}-nome`);

    const { error } = await supabase.from('plataforma_contas_recebimento').update({ nome: valor.trim() }).eq('id', conta.id);
    if (!error) setContas(prev => prev.map(c => c.id === conta.id ? { ...c, nome: valor.trim() } : c));

    setSalvandoId(null);
  }

  return (
    <>
      <div style={{ marginTop: 8, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>Contas de Recebimento</h2>
        <p style={{ color: C.textMuted, marginTop: 6, fontSize: 13 }}>
          Cadastre uma ou mais contas (ex: CNPJs diferentes). A conta marcada como "Ativa" é a usada para gerar os checkouts de assinatura dos salões — só uma fica ativa por vez.
        </p>
      </div>
      <Card style={{ padding: 24, marginBottom: 24 }}>
        {contas.length === 0 && (
          <p style={{ color: C.textLight, fontStyle: "italic", fontSize: 13, marginBottom: 16 }}>Nenhuma conta cadastrada — o sistema usa as variáveis de ambiente (MERCADOPAGO_PLATFORM_ACCESS_TOKEN / INFINITEPAY_PLATFORM_HANDLE) como antes.</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {contas.map(c => (
            <div key={c.id} style={{ border: `2px solid ${c.ativa ? C.success : C.border}`, borderRadius: RAIO_LG, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <input
                  defaultValue={c.nome}
                  onBlur={(e) => salvarNome(c, e.target.value)}
                  disabled={salvandoId === `conta-${c.id}-nome`}
                  style={{ fontWeight: 700, fontSize: 14, color: C.textMain, border: "none", borderBottom: `1px dashed ${C.borderMid}`, padding: "4px 0", flex: 1, minWidth: 160 }}
                />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", background: C.bg, padding: "4px 10px", borderRadius: RAIO_XL }}>
                  {c.gateway === 'mercadopago' ? 'Mercado Pago' : c.gateway === 'infinitepay' ? 'InfinitePay' : 'Cielo'}
                </span>
                <button
                  onClick={() => ativarConta(c)}
                  disabled={c.ativa || salvandoId === `conta-${c.id}-ativar`}
                  style={{
                    padding: "8px 16px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                    cursor: c.ativa ? "default" : "pointer", background: c.ativa ? C.success : "#F1F5F9", color: c.ativa ? "#fff" : C.textMuted,
                    opacity: salvandoId === `conta-${c.id}-ativar` ? 0.6 : 1,
                  }}
                >
                  {c.ativa ? '✓ Ativa' : 'Ativar'}
                </button>
                <button
                  onClick={() => removerConta(c)}
                  disabled={salvandoId === `conta-${c.id}-remover`}
                  title="Remover conta"
                  style={{ padding: "8px 10px", borderRadius: RAIO_MD, border: `1px solid ${C.border}`, background: C.bgCard, color: "#DC2626", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  <FiXCircle size={14} />
                </button>
              </div>

              {c.gateway === 'mercadopago' ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Access Token</label>
                    <input
                      type="password"
                      placeholder={c.mercadopago_access_token ? "•••••••••••••••• (configurado — digite para alterar)" : "Cole o Access Token de produção..."}
                      onBlur={(e) => { salvarCredencial(c, 'mercadopago_access_token', e.target.value); e.target.value = ''; }}
                      disabled={salvandoId === `conta-${c.id}-mercadopago_access_token`}
                      style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, boxSizing: "border-box", fontFamily: "monospace" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Segredo do Webhook (HMAC)</label>
                    <input
                      type="password"
                      placeholder={c.mercadopago_webhook_secret ? "•••••••••••••••• (configurado — digite para alterar)" : "Cole o segredo gerado no painel do Mercado Pago..."}
                      onBlur={(e) => { salvarCredencial(c, 'mercadopago_webhook_secret', e.target.value); e.target.value = ''; }}
                      disabled={salvandoId === `conta-${c.id}-mercadopago_webhook_secret`}
                      style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: RAIO_MD, border: `1px solid ${c.mercadopago_webhook_secret ? C.borderMid : '#FCA5A5'}`, fontSize: 12, boxSizing: "border-box", fontFamily: "monospace" }}
                    />
                    {!c.mercadopago_webhook_secret && (
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: '#DC2626' }}>Obrigatório — sem isso, webhooks do Mercado Pago são bloqueados.</p>
                    )}
                  </div>
                </div>
              ) : c.gateway === 'infinitepay' ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Handle (@usuario)</label>
                    <input
                      placeholder={c.infinitepay_handle ? `Atual: ${c.infinitepay_handle} (digite para alterar)` : "ex: $minhaempresa"}
                      onBlur={(e) => { salvarCredencial(c, 'infinitepay_handle', e.target.value); e.target.value = ''; }}
                      disabled={salvandoId === `conta-${c.id}-infinitepay_handle`}
                      style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, boxSizing: "border-box", fontFamily: "monospace" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Token do Webhook</label>
                    <input
                      type="password"
                      placeholder={c.infinitepay_webhook_token ? "•••••••••••••••• (configurado — digite para alterar)" : "Token enviado pela InfinitePay no header Authorization..."}
                      onBlur={(e) => { salvarCredencial(c, 'infinitepay_webhook_token', e.target.value); e.target.value = ''; }}
                      disabled={salvandoId === `conta-${c.id}-infinitepay_webhook_token`}
                      style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, boxSizing: "border-box", fontFamily: "monospace" }}
                    />
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: C.textMuted }}>Confirmar na documentação da InfinitePay qual header eles enviam nas notificações.</p>
                  </div>
                </div>
              ) : (
                /* ─── CIELO ─── */
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, color: C.textMuted }}>
                    Cielo Checkout — obtenha o MerchantId e MerchantKey em: <strong>minhaconta.cielo.com.br → Dados de Integração</strong>
                  </p>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>MerchantId (clientId)</label>
                    <input
                      placeholder={c.cielo_merchant_id ? `Atual: ${c.cielo_merchant_id.slice(0, 8)}•••• (digite para alterar)` : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
                      onBlur={(e) => { salvarCredencial(c, 'cielo_merchant_id', e.target.value); e.target.value = ''; }}
                      disabled={salvandoId === `conta-${c.id}-cielo_merchant_id`}
                      style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: RAIO_MD, border: `1px solid ${c.cielo_merchant_id ? C.borderMid : '#FCA5A5'}`, fontSize: 12, boxSizing: "border-box", fontFamily: "monospace" }}
                    />
                    {!c.cielo_merchant_id && <p style={{ margin: "4px 0 0", fontSize: 11, color: '#DC2626' }}>Obrigatório para gerar checkouts Cielo.</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>MerchantKey (clientSecret)</label>
                    <input
                      type="password"
                      placeholder={c.cielo_merchant_key ? "•••••••••••••••• (configurado — digite para alterar)" : "Cole a MerchantKey de produção..."}
                      onBlur={(e) => { salvarCredencial(c, 'cielo_merchant_key', e.target.value); e.target.value = ''; }}
                      disabled={salvandoId === `conta-${c.id}-cielo_merchant_key`}
                      style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: RAIO_MD, border: `1px solid ${c.cielo_merchant_key ? C.borderMid : '#FCA5A5'}`, fontSize: 12, boxSizing: "border-box", fontFamily: "monospace" }}
                    />
                    {!c.cielo_merchant_key && <p style={{ margin: "4px 0 0", fontSize: 11, color: '#DC2626' }}>Obrigatório — trate como senha, nunca compartilhe.</p>}
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: C.textMuted }}>
                    URL do Webhook para configurar no painel Cielo: <code style={{ background: C.bg, padding: "1px 6px", borderRadius: 4 }}>/api/webhooks/cielo</code>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Nome da nova conta</label>
            <input
              value={novaConta.nome}
              onChange={(e) => setNovaConta(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="ex: Luarys — CNPJ B"
              style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Gateway</label>
            <select
              value={novaConta.gateway}
              onChange={(e) => setNovaConta(prev => ({ ...prev, gateway: e.target.value as 'mercadopago' | 'infinitepay' }))}
              style={{ display: "block", marginTop: 4, padding: "8px 10px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12 }}
            >
              <option value="mercadopago">Mercado Pago</option>
              <option value="infinitepay">InfinitePay</option>
              <option value="cielo">Cielo</option>
            </select>
          </div>
          <button
            onClick={adicionarConta}
            disabled={salvandoId === 'conta-nova'}
            style={{ padding: "9px 20px", borderRadius: RAIO_MD, border: "none", background: C.sidebarBg, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}
          >
            Adicionar Conta
          </button>
        </div>
      </Card>
    </>
  );
}