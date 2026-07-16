'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_LG, RAIO_MD, RAIO_2XL } from "@/lib/estiloGlobal";
import { FiX } from "react-icons/fi";
import { ToggleBtn } from "../../shared";

export function ModalModulosSalao({ salao, onClose }: { salao: any; onClose: () => void }) {
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [modulosAtivos, setModulosAtivos] = useState<Record<string, any>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      const [resCatalogo, resModulos] = await Promise.all([
        supabase.from('modulos_catalogo').select('chave, nome, preco_mensal').eq('ativo', true).order('nome'),
        supabase.from('salao_modulos').select('modulo_chave, ativo, preco_customizado').eq('salao_id', salao.id),
      ]);
      if (resCatalogo.data) setCatalogo(resCatalogo.data);
      if (resModulos.data) {
        const mapa: Record<string, any> = {};
        resModulos.data.forEach(m => { mapa[m.modulo_chave] = m; });
        setModulosAtivos(mapa);
      }
    }
    carregar();
  }, [salao.id]);

  async function toggleModulo(chave: string, ativoAtual: boolean) {
    setSalvandoId(`toggle-${chave}`);
    const novoValor = !ativoAtual;
    const { error } = await supabase.from('salao_modulos').upsert(
      { salao_id: salao.id, modulo_chave: chave, ativo: novoValor, origem: 'admin', ativado_em: novoValor ? new Date().toISOString() : undefined, cancelamento_agendado: false },
      { onConflict: 'salao_id,modulo_chave' }
    );
    if (!error) setModulosAtivos(prev => ({ ...prev, [chave]: { ...prev[chave], modulo_chave: chave, ativo: novoValor } }));
    setSalvandoId(null);
  }

  async function salvarPrecoCustomizado(chave: string, valor: string) {
    const novoValor = valor.trim() === '' ? null : Math.max(0, parseFloat(valor.replace(',', '.')) || 0);
    setSalvandoId(`preco-${chave}`);
    const { error } = await supabase.from('salao_modulos').upsert(
      { salao_id: salao.id, modulo_chave: chave, preco_customizado: novoValor },
      { onConflict: 'salao_id,modulo_chave' }
    );
    if (!error) setModulosAtivos(prev => ({ ...prev, [chave]: { ...prev[chave], modulo_chave: chave, preco_customizado: novoValor } }));
    setSalvandoId(null);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.textMain }}>{salao.nome_fantasia || salao.razao_social}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Módulos adicionais — preço vazio usa o valor padrão do catálogo</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, padding: 4 }}><FiX size={20} /></button>
        </div>
        <div style={{ overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {catalogo.length === 0 && <p style={{ color: C.textLight, fontStyle: 'italic', fontSize: 13 }}>Nenhum módulo cadastrado no catálogo.</p>}
          {catalogo.map(m => {
            const info = modulosAtivos[m.chave];
            const ativo = !!info?.ativo;
            const precoCustom = info?.preco_customizado;
            return (
              <div key={m.chave} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: RAIO_LG, border: `1px solid ${ativo ? C.success : C.border}`, background: ativo ? '#F0FDF4' : '#FAFAFA' }}>
                <ToggleBtn ativo={ativo} carregando={salvandoId === `toggle-${m.chave}`} onClick={() => toggleModulo(m.chave, ativo)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.textMain }}>{m.nome}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>Padrão: R$ {Number(m.preco_mensal || 0).toFixed(2)}/mês</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>Preço custom</label>
                  <input
                    type="number" min={0} step={0.01} placeholder="Padrão"
                    defaultValue={precoCustom ?? ''}
                    onBlur={(e) => salvarPrecoCustomizado(m.chave, e.target.value)}
                    disabled={salvandoId === `preco-${m.chave}`}
                    style={{ width: 90, padding: '5px 8px', borderRadius: RAIO_MD, border: `1px solid ${precoCustom != null ? C.success : C.borderMid}`, fontSize: 12, textAlign: 'right', fontWeight: precoCustom != null ? 700 : 400, color: precoCustom != null ? C.success : C.textMuted }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
