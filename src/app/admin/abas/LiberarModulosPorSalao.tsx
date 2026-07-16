/**
 * src/app/admin/abas/LiberarModulosPorSalao.tsx
 *
 * Ativa/desativa um módulo específico para UM salão (cortesia, teste,
 * ou módulo contratado fora do checkout). Não cobra nem gera registro
 * de pagamento — liberação manual, sem prazo de validade.
 */
'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { ToggleBtn } from "../shared";

export function LiberarModulosPorSalao() {
  const [saloes, setSaloes] = useState<any[]>([]);
  const [modulosAdicionais, setModulosAdicionais] = useState<any[]>([]);
  const [salaoSelecionadoId, setSalaoSelecionadoId] = useState('');
  const [modulosDoSalao, setModulosDoSalao] = useState<Record<string, any>>({});
  const [carregandoModulosSalao, setCarregandoModulosSalao] = useState(false);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  useEffect(() => {
    carregarBase();
  }, []);

  useEffect(() => {
    carregarModulosDoSalao(salaoSelecionadoId);
  }, [salaoSelecionadoId]);

  async function carregarBase() {
    const [resSaloes, resCatalogo] = await Promise.all([
      supabase.from('saloes').select('id, nome_fantasia, razao_social').order('nome_fantasia', { ascending: true }),
      supabase.from('modulos_catalogo').select('chave, nome').eq('ativo', true),
    ]);

    if (resSaloes.data) setSaloes(resSaloes.data);
    if (resCatalogo.data) {
      setModulosAdicionais(
        resCatalogo.data
          .filter((m: any) => !m.chave.startsWith('pacote_profissionais_'))
          .sort((a: any, b: any) => a.nome.localeCompare(b.nome))
      );
    }
  }

  async function carregarModulosDoSalao(salaoId: string) {
    if (!salaoId) { setModulosDoSalao({}); return; }
    setCarregandoModulosSalao(true);

    const { data } = await supabase
      .from('salao_modulos')
      .select('modulo_chave, ativo, cancelamento_agendado, renovacao_em')
      .eq('salao_id', salaoId);

    const mapa: Record<string, any> = {};
    (data || []).forEach((m: any) => { mapa[m.modulo_chave] = m; });
    setModulosDoSalao(mapa);
    setCarregandoModulosSalao(false);
  }

  async function alternarModuloDoSalao(moduloChave: string, ativoAtual: boolean) {
    if (!salaoSelecionadoId) return;
    const novoValor = !ativoAtual;
    const chaveSalvando = `salaomod-${moduloChave}`;
    setSalvandoId(chaveSalvando);

    const payload: any = {
      salao_id: salaoSelecionadoId,
      modulo_chave: moduloChave,
      ativo: novoValor,
      origem: 'admin',
      cancelamento_agendado: false,
    };
    if (novoValor) {
      payload.ativado_em = new Date().toISOString();
      payload.renovacao_em = null; // liberação manual: sem prazo definido
    }

    const { error } = await supabase
      .from('salao_modulos')
      .upsert(payload, { onConflict: 'salao_id,modulo_chave' });

    if (!error) {
      setModulosDoSalao(prev => ({ ...prev, [moduloChave]: { ...prev[moduloChave], modulo_chave: moduloChave, ativo: novoValor, cancelamento_agendado: false, renovacao_em: novoValor ? null : prev[moduloChave]?.renovacao_em } }));
    }

    setSalvandoId(null);
  }

  return (
    <>
      <div style={{ marginTop: 40, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>Liberar Módulos por Salão</h2>
        <p style={{ color: C.textMuted, marginTop: 6, fontSize: 13 }}>
          Ativa/desativa um módulo específico para UM salão (cortesia, teste, ou módulo contratado fora do checkout). Não cobra nem gera registro de pagamento — é uma liberação manual, sem prazo de validade.
        </p>
      </div>
      <Card style={{ padding: 24 }}>
        <select
          value={salaoSelecionadoId}
          onChange={(e) => setSalaoSelecionadoId(e.target.value)}
          style={{ width: "100%", maxWidth: 400, padding: "10px 14px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, marginBottom: 20 }}
        >
          <option value="">Selecione um salão...</option>
          {saloes.map(s => (
            <option key={s.id} value={s.id}>{s.nome_fantasia || s.razao_social || s.id}</option>
          ))}
        </select>

        {!salaoSelecionadoId ? (
          <p style={{ color: C.textLight, fontStyle: "italic", fontSize: 13 }}>Selecione um salão para ver e alterar seus módulos.</p>
        ) : carregandoModulosSalao ? (
          <p style={{ color: C.textLight, fontStyle: "italic", fontSize: 13 }}>Carregando módulos...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {modulosAdicionais.map(m => {
              const info = modulosDoSalao[m.chave];
              const ativo = !!info?.ativo;
              return (
                <div key={m.chave} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderRadius: RAIO_MD, border: `1px solid ${C.border}`, background: C.bg }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.textMain }}>{m.nome}</div>
                    {ativo && info?.cancelamento_agendado && (
                      <div style={{ fontSize: 10, color: "#B45309", marginTop: 2 }}>Cancelamento agendado pelo dono</div>
                    )}
                  </div>
                  <ToggleBtn
                    ativo={ativo}
                    carregando={salvandoId === `salaomod-${m.chave}`}
                    onClick={() => alternarModuloDoSalao(m.chave, ativo)}
                  />
                </div>
              );
            })}
            {modulosAdicionais.length === 0 && (
              <p style={{ color: C.textLight, fontStyle: "italic", fontSize: 13 }}>Nenhum módulo cadastrado.</p>
            )}
          </div>
        )}
      </Card>
    </>
  );
}