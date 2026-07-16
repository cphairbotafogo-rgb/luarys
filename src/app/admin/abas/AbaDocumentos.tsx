'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { useToast } from "@/components/Toast";

type TipoDoc = 'regras' | 'contrato' | 'termos_uso' | 'privacidade' | 'dpa';
type AbaView = 'editor' | 'aceites';

const TIPOS: { chave: TipoDoc; label: string; descricao: string }[] = [
  { chave: 'regras',      label: 'Regras de Uso',          descricao: 'Visível para todos os estabelecimentos na área de Configurações. Não exige aceite.' },
  { chave: 'contrato',    label: 'Contrato',                descricao: 'Exige aceite do responsável pelo estabelecimento. Cada nova versão publicada re-exige aceite.' },
  { chave: 'termos_uso',  label: 'Termos de Uso',          descricao: 'Exibido na página pública /termos. Escreva HTML completo. Use <h2>, <p>, <ul>/<li> para estruturar o conteúdo. Publique para atualizar a página.' },
  { chave: 'privacidade', label: 'Política de Privacidade', descricao: 'Exibido em /privacidade. Escreva HTML completo. Use <h2>, <p>, <ul>/<li>. Publique para atualizar a página.' },
  { chave: 'dpa',         label: 'DPA / CTD',              descricao: 'Contrato de Tratamento de Dados exibido em /dpa. Escreva HTML completo. Use <h2>, <p>, <ul>/<li>. Publique para atualizar.' },
];

const LABELS: Record<TipoDoc, string> = {
  regras: 'Regras de Uso', contrato: 'Contrato',
  termos_uso: 'Termos de Uso', privacidade: 'Política de Privacidade', dpa: 'DPA',
};

export function AbaDocumentos() {
  const toast = useToast();
  const [tipoAtivo, setTipoAtivo] = useState<TipoDoc>('regras');
  const [abaView, setAbaView]     = useState<AbaView>('editor');
  const [documentos, setDocumentos] = useState<Record<TipoDoc, any>>({
    regras: null, contrato: null, termos_uso: null, privacidade: null, dpa: null,
  });
  const [rascunhos, setRascunhos] = useState<Record<TipoDoc, { titulo: string; conteudo: string }>>({
    regras:      { titulo: '', conteudo: '' },
    contrato:    { titulo: '', conteudo: '' },
    termos_uso:  { titulo: '', conteudo: '' },
    privacidade: { titulo: '', conteudo: '' },
    dpa:         { titulo: '', conteudo: '' },
  });
  const [salvando, setSalvando]   = useState(false);
  const [aceites, setAceites]     = useState<any[]>([]);
  const [carregandoAceites, setCarregandoAceites] = useState(false);

  useEffect(() => { carregarDocumentos(); }, []);

  useEffect(() => {
    if (tipoAtivo === 'contrato' && abaView === 'aceites') carregarAceites();
  }, [tipoAtivo, abaView]);

  async function carregarDocumentos() {
    const { data } = await supabase
      .from('plataforma_documentos')
      .select('id, tipo, titulo, conteudo, versao, atualizado_em')
      .eq('ativo', true);

    if (data) {
      const mapa: Record<TipoDoc, any> = {
        regras: null, contrato: null, termos_uso: null, privacidade: null, dpa: null,
      };
      data.forEach(d => { mapa[d.tipo as TipoDoc] = d; });
      setDocumentos(mapa);
      setRascunhos({
        regras:      { titulo: mapa.regras?.titulo      || '', conteudo: mapa.regras?.conteudo      || '' },
        contrato:    { titulo: mapa.contrato?.titulo    || '', conteudo: mapa.contrato?.conteudo    || '' },
        termos_uso:  { titulo: mapa.termos_uso?.titulo  || '', conteudo: mapa.termos_uso?.conteudo  || '' },
        privacidade: { titulo: mapa.privacidade?.titulo || '', conteudo: mapa.privacidade?.conteudo || '' },
        dpa:         { titulo: mapa.dpa?.titulo         || '', conteudo: mapa.dpa?.conteudo         || '' },
      });
    }
  }

  async function carregarAceites() {
    setCarregandoAceites(true);
    // Admin usa service role via API route para listar aceites cross-tenant
    const res = await fetch('/api/admin/termos-aceites').catch(() => null);
    if (res?.ok) {
      const json = await res.json();
      setAceites(json.aceites ?? []);
    } else {
      // Fallback: query direta (só funciona se policy permitir)
      const { data } = await supabase
        .from('termos_aceites')
        .select('id, versao, ip, aceito_em, salao_id, saloes(nome_fantasia)')
        .order('aceito_em', { ascending: false });
      setAceites(data ?? []);
    }
    setCarregandoAceites(false);
  }

  async function publicar(tipo: TipoDoc) {
    const rascunho = rascunhos[tipo];
    if (!rascunho.titulo.trim() || !rascunho.conteudo.trim()) {
      toast.erro('Preencha o título e o conteúdo antes de publicar.');
      return;
    }
    setSalvando(true);
    const docAtual = documentos[tipo];
    const novaVersao = (docAtual?.versao || 0) + 1;

    if (docAtual) {
      await supabase.from('plataforma_documentos').update({ ativo: false }).eq('id', docAtual.id);
    }
    const { error } = await supabase.from('plataforma_documentos').insert({
      tipo, titulo: rascunho.titulo.trim(), conteudo: rascunho.conteudo.trim(),
      versao: novaVersao, ativo: true,
    });
    if (error) {
      toast.erro('Erro ao publicar: ' + error.message);
      if (docAtual) await supabase.from('plataforma_documentos').update({ ativo: true }).eq('id', docAtual.id);
    } else {
      toast.sucesso(`${LABELS[tipo]} publicado(a) — versão ${novaVersao}.${tipo === 'contrato' ? ' Todos os estabelecimentos precisarão aceitar novamente.' : ''}`);
      await carregarDocumentos();
    }
    setSalvando(false);
  }

  const doc      = documentos[tipoAtivo];
  const rascunho = rascunhos[tipoAtivo];
  const info     = TIPOS.find(t => t.chave === tipoAtivo)!;
  const alterado = doc
    ? (rascunho.titulo !== doc.titulo || rascunho.conteudo !== doc.conteudo)
    : (!!rascunho.titulo || !!rascunho.conteudo);

  return (
    <>
      <div style={{ marginTop: 8, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>Documentos da Plataforma</h2>
        <p style={{ color: C.textMuted, marginTop: 6, fontSize: 13 }}>Documentos da plataforma: regras, contrato e páginas legais públicas.</p>
      </div>

      {/* Seletor de tipo */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TIPOS.map(t => (
          <button key={t.chave} onClick={() => { setTipoAtivo(t.chave); setAbaView('editor'); }}
            style={{ padding: "8px 18px", borderRadius: RAIO_MD, border: `2px solid ${tipoAtivo === t.chave ? C.sidebarBg : C.border}`, background: tipoAtivo === t.chave ? C.sidebarBg : C.bgCard, color: tipoAtivo === t.chave ? "#fff" : C.textMain, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {t.label}
            {documentos[t.chave] && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.8 }}>v{documentos[t.chave].versao}</span>}
          </button>
        ))}
      </div>

      {/* Sub-abas: Editor | Aceites (só no contrato) */}
      {tipoAtivo === 'contrato' && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(['editor', 'aceites'] as AbaView[]).map(v => (
            <button key={v} onClick={() => setAbaView(v)}
              style={{ padding: "6px 16px", borderRadius: RAIO_MD, border: `1px solid ${abaView === v ? C.sidebarBg : C.borderMid}`, background: abaView === v ? `${C.sidebarBg}15` : '#fff', color: abaView === v ? C.sidebarBg : C.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              {v === 'editor' ? '✏️ Editor' : `✅ Aceites${aceites.length > 0 ? ` (${aceites.length})` : ''}`}
            </button>
          ))}
        </div>
      )}

      {/* Aba: Aceites */}
      {abaView === 'aceites' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {carregandoAceites ? (
            <p style={{ padding: 20, color: C.textLight, fontSize: 13 }}>Carregando aceites...</p>
          ) : aceites.length === 0 ? (
            <p style={{ padding: 20, color: C.textLight, fontSize: 13, fontStyle: 'italic' }}>Nenhum aceite registrado ainda.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                  {['Estabelecimento', 'Versão aceita', 'IP de Acesso', 'Data/Hora'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', fontWeight: 800, color: C.textMuted, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aceites.map(a => (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: C.textMain }}>{a.saloes?.nome_fantasia || a.salao_id}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '3px 8px', borderRadius: 20 }}>v{a.versao}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: C.textLight, fontFamily: 'monospace', fontSize: 11 }}>{a.ip || '—'}</td>
                    <td style={{ padding: '10px 14px', color: C.textMuted }}>
                      {new Date(a.aceito_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Aba: Editor */}
      {abaView === 'editor' && (
        <Card style={{ padding: 24 }}>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: C.textMuted }}>{info.descricao}</p>

          {doc && (
            <div style={{ marginBottom: 16, padding: "8px 12px", borderRadius: RAIO_MD, background: C.bg, fontSize: 12, color: C.textMuted }}>
              Versão atual: <strong>v{doc.versao}</strong> — publicada em {new Date(doc.atualizado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Título</label>
            <input
              value={rascunho.titulo}
              onChange={e => setRascunhos(prev => ({ ...prev, [tipoAtivo]: { ...prev[tipoAtivo], titulo: e.target.value } }))}
              placeholder={`ex: ${tipoAtivo === 'contrato' ? 'Contrato de Prestação de Serviços — Luarys' : 'Regras de Uso da Plataforma Luarys'}`}
              style={{ width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Conteúdo</label>
            <p style={{ margin: '4px 0 6px', fontSize: 11, color: C.textLight }}>
              {['termos_uso', 'privacidade', 'dpa'].includes(tipoAtivo)
                ? 'Escreva HTML: <h2>Seção</h2>, <p>Parágrafo</p>, <ul><li>Item</li></ul>. Este conteúdo substitui a página pública ao publicar.'
                : 'Use # para título principal, ## para subtítulo, linha em branco para separar parágrafos.'}
            </p>
            <textarea
              value={rascunho.conteudo}
              onChange={e => setRascunhos(prev => ({ ...prev, [tipoAtivo]: { ...prev[tipoAtivo], conteudo: e.target.value } }))}
              rows={20}
              placeholder="# Contrato de Prestação de Serviços&#10;&#10;## 1. Das Partes&#10;&#10;O presente contrato é firmado entre..."
              style={{ width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
            {alterado && <span style={{ fontSize: 12, color: "#D97706", fontWeight: 600 }}>Há alterações não publicadas</span>}
            <button
              onClick={() => publicar(tipoAtivo)}
              disabled={salvando || !alterado}
              style={{ padding: "10px 24px", borderRadius: RAIO_MD, border: "none", background: alterado ? C.sidebarBg : C.border, color: "#fff", fontWeight: 700, fontSize: 13, cursor: alterado ? "pointer" : "not-allowed", opacity: salvando ? 0.7 : 1 }}>
              {salvando ? 'Publicando...' : doc ? `Publicar nova versão (v${(doc.versao || 0) + 1})` : 'Publicar'}
            </button>
          </div>
        </Card>
      )}
    </>
  );
}
