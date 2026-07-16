'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { thStyle, tdStyle, ToggleBtn, PrecoInput, DescricaoInput, NomeInput } from "../shared";
import { LiberarModulosPorSalao } from "./LiberarModulosPorSalao";
import { PromocoesGlobais } from "./PromocoesGlobais";

export function AbaCatalogo() {
  const [planos, setPlanos] = useState<any[]>([]);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  useEffect(() => {
    carregarPlanos();
    carregarCatalogo();
  }, []);

  async function carregarPlanos() {
    const { data } = await supabase
      .from('planos')
      .select('chave, nome, descricao, limite_profissionais, preco_mensal, preco_anual, ativo, ordem')
      .order('ordem');
    if (data) setPlanos(data);
  }

  async function carregarCatalogo() {
    const { data } = await supabase
      .from('modulos_catalogo')
      .select('chave, nome, descricao, preco_mensal, preco_anual, ativo')
      .order('chave');
    if (data) setCatalogo(data);
  }

  async function salvarNomePlano(chave: string, valor: string) {
    setPlanos(prev => prev.map(p => p.chave === chave ? { ...p, nome: valor } : p));
    setSalvandoId(`plano-${chave}-nome`);
    const { error } = await supabase.from('planos').update({ nome: valor }).eq('chave', chave);
    if (error) await carregarPlanos();
    setSalvandoId(null);
  }

  async function salvarDescricaoPlano(chave: string, valor: string) {
    setPlanos(prev => prev.map(p => p.chave === chave ? { ...p, descricao: valor } : p));
    setSalvandoId(`plano-${chave}-descricao`);
    const { error } = await supabase.from('planos').update({ descricao: valor }).eq('chave', chave);
    if (error) await carregarPlanos();
    setSalvandoId(null);
  }

  async function salvarPrecoPlano(chave: string, valor: string) {
    const novoPreco = Math.max(0, parseFloat(valor.replace(',', '.')) || 0);
    setPlanos(prev => prev.map(p => p.chave === chave ? { ...p, preco_mensal: novoPreco } : p));
    setSalvandoId(`plano-${chave}-preco`);
    const { error } = await supabase.from('planos').update({ preco_mensal: novoPreco }).eq('chave', chave);
    if (error) await carregarPlanos();
    setSalvandoId(null);
  }

  async function salvarPrecoAnualPlano(chave: string, valor: string) {
    const novoPreco = valor.trim() === '' ? null : Math.max(0, parseFloat(valor.replace(',', '.')) || 0);
    setPlanos(prev => prev.map(p => p.chave === chave ? { ...p, preco_anual: novoPreco } : p));
    setSalvandoId(`plano-${chave}-preco_anual`);
    const { error } = await supabase.from('planos').update({ preco_anual: novoPreco }).eq('chave', chave);
    if (error) await carregarPlanos();
    setSalvandoId(null);
  }

  async function salvarLimitePlano(plano: any, valor: string) {
    const novoValor = valor.trim() === '' ? null : Math.max(0, parseInt(valor, 10) || 0);
    setPlanos(prev => prev.map(p => p.chave === plano.chave ? { ...p, limite_profissionais: novoValor } : p));
    setSalvandoId(`plano-${plano.chave}-limite`);
    const { error } = await supabase.from('planos').update({ limite_profissionais: novoValor }).eq('chave', plano.chave);
    if (error) setPlanos(prev => prev.map(p => p.chave === plano.chave ? { ...p, limite_profissionais: plano.limite_profissionais } : p));
    setSalvandoId(null);
  }

  async function alternarAtivoPlano(plano: any) {
    setSalvandoId(`plano-${plano.chave}-ativo`);
    const novoValor = !plano.ativo;
    const { error } = await supabase.from('planos').update({ ativo: novoValor }).eq('chave', plano.chave);
    if (!error) setPlanos(prev => prev.map(p => p.chave === plano.chave ? { ...p, ativo: novoValor } : p));
    setSalvandoId(null);
  }

  async function salvarNomeModulo(chave: string, valor: string) {
    setCatalogo(prev => prev.map(m => m.chave === chave ? { ...m, nome: valor } : m));
    setSalvandoId(`catalogo-${chave}-nome`);
    const { error } = await supabase.from('modulos_catalogo').update({ nome: valor }).eq('chave', chave);
    if (error) await carregarCatalogo();
    setSalvandoId(null);
  }

  async function salvarDescricaoModulo(chave: string, valor: string) {
    setCatalogo(prev => prev.map(m => m.chave === chave ? { ...m, descricao: valor } : m));
    setSalvandoId(`catalogo-${chave}-descricao`);
    const { error } = await supabase.from('modulos_catalogo').update({ descricao: valor }).eq('chave', chave);
    if (error) await carregarCatalogo();
    setSalvandoId(null);
  }

  async function salvarPrecoModulo(chave: string, valor: string) {
    const novoPreco = Math.max(0, parseFloat(valor.replace(',', '.')) || 0);
    setCatalogo(prev => prev.map(m => m.chave === chave ? { ...m, preco_mensal: novoPreco } : m));
    setSalvandoId(`catalogo-${chave}-preco`);
    const { error } = await supabase.from('modulos_catalogo').update({ preco_mensal: novoPreco }).eq('chave', chave);
    if (error) await carregarCatalogo();
    setSalvandoId(null);
  }

  async function salvarPrecoAnualModulo(chave: string, valor: string) {
    const novoPreco = valor.trim() === '' ? null : Math.max(0, parseFloat(valor.replace(',', '.')) || 0);
    setCatalogo(prev => prev.map(m => m.chave === chave ? { ...m, preco_anual: novoPreco } : m));
    setSalvandoId(`catalogo-${chave}-preco_anual`);
    const { error } = await supabase.from('modulos_catalogo').update({ preco_anual: novoPreco }).eq('chave', chave);
    if (error) await carregarCatalogo();
    setSalvandoId(null);
  }

  async function alternarAtivoModulo(modulo: any) {
    setSalvandoId(`catalogo-${modulo.chave}-ativo`);
    const novoValor = !modulo.ativo;
    const { error } = await supabase.from('modulos_catalogo').update({ ativo: novoValor }).eq('chave', modulo.chave);
    if (!error) setCatalogo(prev => prev.map(m => m.chave === modulo.chave ? { ...m, ativo: novoValor } : m));
    setSalvandoId(null);
  }

  const modulosAtivos   = catalogo.filter(m => !m.chave.startsWith('pacote_profissionais_') && m.ativo).sort((a, b) => a.nome.localeCompare(b.nome));
  const modulosInativos = catalogo.filter(m => !m.chave.startsWith('pacote_profissionais_') && !m.ativo).sort((a, b) => a.nome.localeCompare(b.nome));
  const modulosAdicionais = [...modulosAtivos, ...modulosInativos];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

      {/* ─── PLANOS ─── */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>Planos</h2>
          <p style={{ color: C.textMuted, marginTop: 4, fontSize: 12 }}>
            Preço e limite de profissionais por plano. Enterprise fica "Sob consulta" enquanto o preço estiver vazio.
          </p>
        </div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <th style={thStyle}>Plano</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Prof.</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Preço/mês</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Preço/ano</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Ativo</th>
              </tr>
            </thead>
            <tbody>
              {planos.map(p => (
                <tr key={p.chave} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={tdStyle}>
                    <NomeInput valor={p.nome} carregando={salvandoId === `plano-${p.chave}-nome`} onSalvar={(v) => salvarNomePlano(p.chave, v)} />
                    <DescricaoInput valor={p.descricao} carregando={salvandoId === `plano-${p.chave}-descricao`} onSalvar={(v) => salvarDescricaoPlano(p.chave, v)} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <input type="number" min={0} placeholder="∞" defaultValue={p.limite_profissionais ?? ''}
                      onBlur={(e) => salvarLimitePlano(p, e.target.value)}
                      disabled={salvandoId === `plano-${p.chave}-limite`}
                      style={{ width: 56, padding: "5px 8px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, textAlign: "right", fontWeight: 700, color: C.textMain, opacity: salvandoId === `plano-${p.chave}-limite` ? 0.6 : 1 }} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {p.chave === 'enterprise' && p.preco_mensal == null
                      ? <span style={{ fontSize: 11, color: C.textLight, fontStyle: "italic" }}>Sob consulta</span>
                      : <PrecoInput valor={p.preco_mensal} carregando={salvandoId === `plano-${p.chave}-preco`} onSalvar={(v) => salvarPrecoPlano(p.chave, v)} />}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <PrecoInput valor={p.preco_anual} carregando={salvandoId === `plano-${p.chave}-preco_anual`} onSalvar={(v) => salvarPrecoAnualPlano(p.chave, v)} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <ToggleBtn ativo={!!p.ativo} carregando={salvandoId === `plano-${p.chave}-ativo`} onClick={() => alternarAtivoPlano(p)} />
                  </td>
                </tr>
              ))}
              {planos.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: C.textLight, fontStyle: "italic" }}>Nenhum plano.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ─── MÓDULOS ADICIONAIS ─── */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>Módulos Adicionais</h2>
          <p style={{ color: C.textMuted, marginTop: 4, fontSize: 12 }}>
            Add-ons pagos por mês. "Ativo" controla se o módulo pode ser contratado pelos salões.
          </p>
        </div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <th style={thStyle}>Módulo</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Preço/mês</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Preço/ano</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Ativo</th>
              </tr>
            </thead>
            <tbody>
              {modulosAtivos.length === 0 && (
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: C.textLight, fontStyle: "italic" }}>Nenhum módulo ativo.</td></tr>
              )}
              {modulosAdicionais.map(m => (
                <tr key={m.chave} style={{ borderBottom: `1px solid ${C.border}`, opacity: m.ativo ? 1 : 0.35 }}>
                  <td style={tdStyle}>
                    <NomeInput valor={m.nome} carregando={salvandoId === `catalogo-${m.chave}-nome`} onSalvar={(v) => salvarNomeModulo(m.chave, v)} />
                    {!m.ativo && <span style={{ fontSize: 10, color: C.textLight, fontStyle: "italic" }}>{m.chave} — inativo</span>}
                    {m.ativo && <DescricaoInput valor={m.descricao} carregando={salvandoId === `catalogo-${m.chave}-descricao`} onSalvar={(v) => salvarDescricaoModulo(m.chave, v)} />}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {m.ativo ? <PrecoInput valor={m.preco_mensal} carregando={salvandoId === `catalogo-${m.chave}-preco`} onSalvar={(v) => salvarPrecoModulo(m.chave, v)} /> : <span style={{ fontSize: 11, color: C.textLight }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {m.ativo ? <PrecoInput valor={m.preco_anual} carregando={salvandoId === `catalogo-${m.chave}-preco_anual`} onSalvar={(v) => salvarPrecoAnualModulo(m.chave, v)} /> : <span style={{ fontSize: 11, color: C.textLight }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <ToggleBtn ativo={!!m.ativo} carregando={salvandoId === `catalogo-${m.chave}-ativo`} onClick={() => alternarAtivoModulo(m)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

    </div>
    <LiberarModulosPorSalao />
    <PromocoesGlobais />
    </div>
  );
}
