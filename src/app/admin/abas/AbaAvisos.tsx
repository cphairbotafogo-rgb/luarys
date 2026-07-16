/**
 * src/app/admin/abas/AbaAvisos.tsx
 *
 * Publicação de comunicados (manutenção, novidade, etc.) para todos os
 * salões — exibido como modal dentro do sistema via AvisoPlataforma.
 */
'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { thStyle, tdStyle, ToggleBtn } from "../shared";

export function AbaAvisos() {
  const toast = useToast();
  const [avisos, setAvisos] = useState<any[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [novoAviso, setNovoAviso] = useState({ titulo: '', mensagem: '', tipo: 'info', mostrar_no_sistema: true, enviar_email: false, enviar_whatsapp: false });

  useEffect(() => {
    carregarAvisos();
  }, []);

  async function carregarAvisos() {
    const { data } = await supabase
      .from('avisos_plataforma')
      .select('id, titulo, mensagem, tipo, mostrar_no_sistema, enviar_email, enviar_whatsapp, ativo, criado_em')
      .order('criado_em', { ascending: false });

    if (data) setAvisos(data);
  }

  async function publicarAviso() {
    if (!novoAviso.titulo.trim() || !novoAviso.mensagem.trim()) {
      toast.erro('Preencha título e mensagem.');
      return;
    }

    setSalvandoId('aviso-novo');

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('avisos_plataforma').insert({
      titulo: novoAviso.titulo.trim(),
      mensagem: novoAviso.mensagem.trim(),
      tipo: novoAviso.tipo,
      mostrar_no_sistema: novoAviso.mostrar_no_sistema,
      enviar_email: novoAviso.enviar_email,
      enviar_whatsapp: novoAviso.enviar_whatsapp,
      criado_por: user?.id,
    });

    if (error) {
      toast.erro('Erro ao publicar: ' + error.message);
    } else {
      toast.sucesso('Aviso publicado! Vai aparecer para todos os usuários no próximo acesso.');
      setNovoAviso({ titulo: '', mensagem: '', tipo: 'info', mostrar_no_sistema: true, enviar_email: false, enviar_whatsapp: false });
      await carregarAvisos();
    }

    setSalvandoId(null);
  }

  async function alternarAtivoAviso(aviso: any) {
    setSalvandoId(`aviso-${aviso.id}-ativo`);

    const { error } = await supabase.from('avisos_plataforma').update({ ativo: !aviso.ativo }).eq('id', aviso.id);
    if (!error) setAvisos(prev => prev.map(a => a.id === aviso.id ? { ...a, ativo: !a.ativo } : a));

    setSalvandoId(null);
  }

  return (
    <>
      <div style={{ marginTop: 8, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>Novo Aviso</h2>
        <p style={{ color: C.textMuted, marginTop: 6, fontSize: 13 }}>
          Publique um comunicado para todos os salões (ex: manutenção, nova funcionalidade). "Tela no sistema" aparece como um aviso ao abrir o app, até o usuário clicar em "Ok, entendi".
        </p>
      </div>
      <Card style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Título</label>
            <input
              value={novoAviso.titulo}
              onChange={(e) => setNovoAviso(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="ex: Manutenção programada hoje à noite"
              style={{ width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Mensagem</label>
            <textarea
              value={novoAviso.mensagem}
              onChange={(e) => setNovoAviso(prev => ({ ...prev, mensagem: e.target.value }))}
              placeholder="Escreva o que os salões precisam saber..."
              rows={4}
              style={{ width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Tipo</label>
              <select
                value={novoAviso.tipo}
                onChange={(e) => setNovoAviso(prev => ({ ...prev, tipo: e.target.value }))}
                style={{ display: "block", marginTop: 4, padding: "8px 10px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12 }}
              >
                <option value="info">Aviso</option>
                <option value="manutencao">Manutenção</option>
                <option value="novidade">Novidade</option>
                <option value="urgente">Importante / Urgente</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Canais</label>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.textMain, cursor: "pointer" }}>
                  <input type="checkbox" checked={novoAviso.mostrar_no_sistema} onChange={(e) => setNovoAviso(prev => ({ ...prev, mostrar_no_sistema: e.target.checked }))} />
                  Tela no sistema
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.textMain, cursor: "pointer" }}>
                  <input type="checkbox" checked={novoAviso.enviar_email} onChange={(e) => setNovoAviso(prev => ({ ...prev, enviar_email: e.target.checked }))} />
                  E-mail
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.textMain, cursor: "pointer" }}>
                  <input type="checkbox" checked={novoAviso.enviar_whatsapp} onChange={(e) => setNovoAviso(prev => ({ ...prev, enviar_whatsapp: e.target.checked }))} />
                  WhatsApp
                </label>
              </div>
            </div>
          </div>

          {(novoAviso.enviar_email || novoAviso.enviar_whatsapp) && (
            <p style={{ margin: 0, fontSize: 12, color: "#B45309", background: "#FFFBEB", padding: "8px 12px", borderRadius: RAIO_MD }}>
              E-mail e WhatsApp ainda não têm envio automático configurado (precisa de um provedor — Resend, WhatsApp Cloud API, etc.). Por enquanto, marcar essas opções só registra a intenção junto com o aviso.
            </p>
          )}

          <button
            onClick={publicarAviso}
            disabled={salvandoId === 'aviso-novo'}
            style={{ alignSelf: "flex-start", padding: "10px 24px", borderRadius: RAIO_MD, border: "none", background: C.sidebarBg, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {salvandoId === 'aviso-novo' ? 'Publicando...' : 'Publicar Aviso'}
          </button>
        </div>
      </Card>

      <div style={{ marginTop: 8, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>Avisos Publicados</h2>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <th style={thStyle}>Aviso</th>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Canais</th>
              <th style={thStyle}>Data</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Ativo</th>
            </tr>
          </thead>
          <tbody>
            {avisos.map(a => (
              <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 700, color: C.textMain }}>{a.titulo}</div>
                  <div style={{ fontSize: 11, color: C.textLight, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.mensagem}</div>
                </td>
                <td style={tdStyle}>{a.tipo}</td>
                <td style={tdStyle}>
                  {[a.mostrar_no_sistema && 'Sistema', a.enviar_email && 'E-mail', a.enviar_whatsapp && 'WhatsApp'].filter(Boolean).join(', ') || '—'}
                </td>
                <td style={tdStyle}>{new Date(a.criado_em).toLocaleDateString('pt-BR')}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <ToggleBtn
                    ativo={!!a.ativo}
                    carregando={salvandoId === `aviso-${a.id}-ativo`}
                    onClick={() => alternarAtivoAviso(a)}
                  />
                </td>
              </tr>
            ))}
            {avisos.length === 0 && (
              <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: C.textLight, fontStyle: "italic" }}>Nenhum aviso publicado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}