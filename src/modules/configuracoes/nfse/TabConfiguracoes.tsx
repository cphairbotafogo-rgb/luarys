'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { inputAdmin, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiSave } from 'react-icons/fi';
import { CFG_INICIAL } from './tipos';
import type { FormConfiguracao } from './tipos';

const REGIMES_ESPECIAIS = [
  '', 'Sem Regime Especial', 'Microempresa Municipal', 'Estimativa',
  'Sociedade de Profissionais', 'Cooperativa', 'MEI', 'Microempresa ou EPP',
];
const CHECKS: Array<{ key: keyof FormConfiguracao; label: string }> = [
  { key: 'nao_enviar_cnae',        label: 'Não enviar CNAE' },
  { key: 'desconto_operadora',     label: 'Desconto de operadora' },
  { key: 'emitir_padrao_nacional', label: 'Emitir padrão nacional' },
];

export function TabConfiguracoes({ perfil }: { perfil: any }) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  const [cfg, setCfg]           = useState<FormConfiguracao>({ ...CFG_INICIAL });

  useEffect(() => {
    if (!perfil?.salao_id) return;
    supabase
      .from('saloes')
      .select('cnae, codigo_ibge, config_fiscal')
      .eq('id', perfil.salao_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const cf = data.config_fiscal || {};
        setCfg({
          ...CFG_INICIAL,
          regime_tributario:            cf.regime_tributario            || 'Simples Nacional',
          aliquota_padrao:              String(cf.aliquota_padrao       || '2.00'),
          modo_emissao:                 cf.modo_emissao                 || 'Lote Manual',
          codigo_ibge:                  data.codigo_ibge                || '',
          item_lista_servico:           cf.item_lista_servico           || '6.01',
          codigo_tributacao_municipio:  cf.codigo_tributacao_municipio  || '',
          optante_simples:              cf.optante_simples !== undefined ? cf.optante_simples : true,
          cpf_emissor:                  cf.cpf_emissor                  || '',
          pis_percentual:               String(cf.pis_percentual        || '0.65'),
          cofins_percentual:            String(cf.cofins_percentual     || '3.00'),
          regime_especial_tributacao:   cf.regime_especial_tributacao   || '',
          cmc:                          cf.cmc                          || '',
          cnae:                         data.cnae                       || '',
          nao_enviar_cnae:              cf.nao_enviar_cnae              || false,
          desconto_operadora:           cf.desconto_operadora           || false,
          emitir_padrao_nacional:       cf.emitir_padrao_nacional       || false,
        });
      });
  }, [perfil?.salao_id]);

  async function salvar() {
    if (!perfil?.salao_id) return;
    setSalvando(true);
    try {
      const { data: atual } = await supabase.from('saloes').select('config_fiscal').eq('id', perfil.salao_id).maybeSingle();
      const cfNovo: Record<string, any> = {
        ...(atual?.config_fiscal || {}),
        regime_tributario:            cfg.regime_tributario,
        aliquota_padrao:              cfg.aliquota_padrao,
        modo_emissao:                 cfg.modo_emissao,
        item_lista_servico:           cfg.item_lista_servico,
        codigo_tributacao_municipio:  cfg.codigo_tributacao_municipio,
        optante_simples:              cfg.optante_simples,
        cpf_emissor:                  cfg.cpf_emissor,
        pis_percentual:               cfg.pis_percentual,
        cofins_percentual:            cfg.cofins_percentual,
        regime_especial_tributacao:   cfg.regime_especial_tributacao,
        cmc:                          cfg.cmc,
        nao_enviar_cnae:              cfg.nao_enviar_cnae,
        desconto_operadora:           cfg.desconto_operadora,
        emitir_padrao_nacional:       cfg.emitir_padrao_nacional,
      };
      const updates: Record<string, any> = { config_fiscal: cfNovo };
      if (cfg.cnae.trim())        updates.cnae        = cfg.cnae.trim();
      if (cfg.codigo_ibge.trim()) updates.codigo_ibge = cfg.codigo_ibge.replace(/\D/g, '').slice(0, 7) || null;
      const { error } = await supabase.from('saloes').update(updates).eq('id', perfil.salao_id);
      if (error) throw error;
      toast.sucesso('Configurações da nota fiscal salvas!');
    } catch (e: any) {
      toast.erro('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  const up = (k: keyof FormConfiguracao, v: any) => setCfg(p => ({ ...p, [k]: v }));
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.textLight,
    textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 5,
  };
  const card = { background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 24 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 780 }}>

      {/* PARÂMETROS FISCAIS */}
      <div style={card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>Parâmetros Fiscais</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>Item da Lista de Serviços (LC 116)</label>
              <select style={inputAdmin} value={cfg.item_lista_servico} onChange={e => up('item_lista_servico', e.target.value)}>
                <option value="6.01">6.01 — Cabeleireiros, manicuros, pedicuros</option>
                <option value="6.02">6.02 — Esteticistas, tratamento de pele, depilação</option>
                <option value="6.03">6.03 — Banhos, sauna, massagens, ginástica</option>
                <option value="6.04">6.04 — Centros de emagrecimento, spa</option>
                <option value="14.13">14.13 — Tatuar / piercing</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Alíquota ISS (%)</label>
              <input type="number" min={0} max={5} step={0.01} style={inputAdmin}
                value={cfg.aliquota_padrao} onChange={e => up('aliquota_padrao', e.target.value)} placeholder="2.00" />
            </div>
            <div>
              <label style={lbl}>Código de Tributação do Município</label>
              <input style={inputAdmin} value={cfg.codigo_tributacao_municipio}
                onChange={e => up('codigo_tributacao_municipio', e.target.value)} placeholder="Ex: 0601" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.textMain }}>
              <input type="checkbox" checked={cfg.optante_simples} onChange={e => up('optante_simples', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: C.sidebarBg, cursor: 'pointer' }} />
              Optante pelo Simples Nacional
            </label>
            <div>
              <label style={lbl}>CPF do Emissor</label>
              <input style={{ ...inputAdmin, fontFamily: 'monospace' }} value={cfg.cpf_emissor}
                onChange={e => up('cpf_emissor', e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="00000000000" />
            </div>
            <div>
              <label style={lbl}>PIS (%)</label>
              <input type="number" min={0} max={10} step={0.01} style={inputAdmin}
                value={cfg.pis_percentual} onChange={e => up('pis_percentual', e.target.value)} placeholder="0.65" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>CNAE</label>
              <input style={{ ...inputAdmin, fontFamily: 'monospace' }} value={cfg.cnae}
                onChange={e => up('cnae', e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="Ex: 9602501" />
              <p style={{ margin: '3px 0 0', fontSize: 11, color: C.textLight }}>9602501 — cabeleireiros · 9602502 — estética</p>
            </div>
            <div>
              <label style={lbl}>Regime Especial de Tributação</label>
              <select style={inputAdmin} value={cfg.regime_especial_tributacao} onChange={e => up('regime_especial_tributacao', e.target.value)}>
                {REGIMES_ESPECIAIS.map(r => <option key={r} value={r}>{r || '— Nenhum —'}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>CMC</label>
              <input style={{ ...inputAdmin, fontFamily: 'monospace' }} value={cfg.cmc}
                onChange={e => up('cmc', e.target.value)} placeholder="Código do Município" />
            </div>
            <div>
              <label style={lbl}>COFINS (%)</label>
              <input type="number" min={0} max={10} step={0.01} style={inputAdmin}
                value={cfg.cofins_percentual} onChange={e => up('cofins_percentual', e.target.value)} placeholder="3.00" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 20, padding: '16px 0 0', borderTop: `1px solid ${C.border}` }}>
          {CHECKS.map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.textMain }}>
              <input type="checkbox" checked={cfg[key] as boolean} onChange={e => up(key, e.target.checked)}
                style={{ width: 15, height: 15, accentColor: C.sidebarBg, cursor: 'pointer' }} />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* REGIME + MODO */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>Regime Tributário</h3>
          <select style={inputAdmin} value={cfg.regime_tributario} onChange={e => up('regime_tributario', e.target.value)}>
            <option value="Simples Nacional">Simples Nacional</option>
            <option value="MEI">MEI</option>
            <option value="Lucro Presumido">Lucro Presumido</option>
            <option value="Lucro Real">Lucro Real</option>
          </select>
        </div>
        <div style={card}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>Modo de Emissão</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['Automático', 'Lote Manual'] as const).map(val => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.textMain, padding: '8px 12px', borderRadius: RAIO_MD, border: `1px solid ${cfg.modo_emissao === val ? C.sidebarBg : C.borderMid}`, background: cfg.modo_emissao === val ? C.bg : 'transparent' }}>
                <input type="radio" name="modo_emissao" value={val} checked={cfg.modo_emissao === val} onChange={() => up('modo_emissao', val)} style={{ accentColor: C.sidebarBg }} />
                <div>
                  <div>{val}</div>
                  <div style={{ fontSize: 11, fontWeight: 400, color: C.textLight }}>
                    {val === 'Automático' ? 'Ao finalizar a conta no Caixa' : 'Requer aprovação em Emitir Notas'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={salvar} disabled={salvando} style={{ background: C.sidebarBg, color: '#fff', border: 'none', padding: '12px 32px', borderRadius: RAIO_MD, fontWeight: 800, fontSize: 13, cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: salvando ? 0.7 : 1 }}>
          <FiSave size={15} /> {salvando ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
}
