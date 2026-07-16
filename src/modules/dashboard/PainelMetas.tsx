'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_SM, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { Card } from '@/components/ui';
import {
  FiTarget, FiZap, FiEdit2, FiCheck, FiX,
  FiTrendingUp, FiAlertTriangle, FiCheckCircle, FiAward,
  FiDollarSign, FiMinusCircle, FiChevronDown,
} from 'react-icons/fi';
import { mesAtualStr, diaAtual, calcularDiasUteis } from './metas/helpers';
import { CardMeta } from './metas/CardMeta';

export function PainelMetas({ perfil, faturamentoMes, despesasMes, comissoesMes }: {
  perfil: any;
  faturamentoMes: number;
  despesasMes: number;
  comissoesMes: number;
}) {
  const mes             = mesAtualStr();
  const diaHoje         = diaAtual();
  const diasTotalCalend = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const [metas, setMetas] = useState({
    meta_bruta: 0, super_meta_bruta: 0,
    meta_liquida: 0, super_meta_liquida: 0,
  });
  const [horarios,   setHorarios]   = useState<any[]>([]);
  const [editando,   setEditando]   = useState(false);
  const [verCalculo, setVerCalculo] = useState(false);
  const [form,       setForm]       = useState({ ...metas });
  const [salvando,   setSalvando]   = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    (async () => {
      setCarregando(true);
      const [{ data }, { data: salaoData }] = await Promise.all([
        supabase.from('metas_salao').select('meta_bruta, super_meta_bruta, meta_liquida, super_meta_liquida')
          .eq('salao_id', perfil.salao_id).eq('mes', mes).maybeSingle(),
        supabase.from('saloes').select('horarios_funcionamento')
          .eq('id', perfil.salao_id).maybeSingle(),
      ]);
      if (data) {
        const m = {
          meta_bruta:         Number(data.meta_bruta)         || 0,
          super_meta_bruta:   Number(data.super_meta_bruta)   || 0,
          meta_liquida:       Number(data.meta_liquida)       || 0,
          super_meta_liquida: Number(data.super_meta_liquida) || 0,
        };
        setMetas(m); setForm(m);
      }
      const raw = salaoData?.horarios_funcionamento;
      if (raw) {
        try { setHorarios(typeof raw === 'string' ? JSON.parse(raw) : raw); } catch {}
      }
      setCarregando(false);
    })();
  }, [perfil?.salao_id, mes]);

  async function salvarMetas() {
    setSalvando(true);
    await supabase.from('metas_salao').upsert({
      salao_id: perfil.salao_id, mes,
      ...form,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'salao_id,mes' });
    setMetas({ ...form });
    setSalvando(false);
    setEditando(false);
  }

  const { total: diasUteisTotais, ateHoje: diasUteisAteHoje, restantes: diasUteisRestantes } = calcularDiasUteis(horarios);

  const liquidoMes        = faturamentoMes - despesasMes - comissoesMes;
  const ritmodiario       = diasUteisAteHoje > 0 ? faturamentoMes / diasUteisAteHoje : 0;
  const projecaoBruta     = ritmodiario * diasUteisTotais;
  const projecaoComissoes = diasUteisAteHoje > 0 ? (comissoesMes / diasUteisAteHoje) * diasUteisTotais : comissoesMes;
  const projecaoLiq       = projecaoBruta - despesasMes - projecaoComissoes;
  const taxaComissao      = faturamentoMes > 0 ? comissoesMes / faturamentoMes : 0;
  const pontoEquilibrio   = taxaComissao < 1 ? despesasMes / (1 - taxaComissao) : despesasMes;
  const estaSaudavel      = faturamentoMes >= pontoEquilibrio && pontoEquilibrio > 0;
  const faltaEquilibrio   = Math.max(0, pontoEquilibrio - faturamentoMes);
  const necessarioPorDia  = diasUteisRestantes > 0 ? faltaEquilibrio / diasUteisRestantes : 0;
  const mesLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  if (carregando) return null;

  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="m-0 font-title text-sm font-bold uppercase tracking-widest" style={{ color: C.textMuted }}>
            Metas do Mês
          </h2>
          <p className="m-0 mt-1 font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textLight }}>
            {mesLabel} · Dia {diaHoje} de {diasTotalCalend} · {diasUteisRestantes} dias úteis restantes
          </p>
        </div>

        {!editando ? (
          <button onClick={() => { setForm({ ...metas }); setEditando(true); }}
            className="flex items-center gap-2 transition-all hover:opacity-80"
            style={{ padding: '8px 16px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: 'white', fontSize: 12, fontWeight: 700, color: C.textMuted, cursor: 'pointer', fontFamily: 'var(--font-title)' }}>
            <FiEdit2 size={12} /> Editar Metas
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={salvarMetas} disabled={salvando}
              className="flex items-center gap-2 transition-all hover:opacity-90"
              style={{ padding: '8px 18px', borderRadius: RAIO_MD, border: 'none', background: C.sidebarBg, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-title)' }}>
              <FiCheck size={12} /> {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setEditando(false)}
              className="flex items-center gap-2"
              style={{ padding: '8px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: 'white', fontSize: 12, fontWeight: 700, color: C.textMuted, cursor: 'pointer' }}>
              <FiX size={12} />
            </button>
          </div>
        )}
      </div>

      {editando && (
        <Card className="p-6 bg-white rounded-xl shadow-sm border mb-4" style={{ borderColor: C.border }}>
          <p className="m-0 mb-4 font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>
            Configurar metas — {mesLabel}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'meta_bruta',         label: 'Meta Bruta',         cor: C.sidebarBg },
              { key: 'super_meta_bruta',   label: 'Super Meta Bruta',   cor: C.douradoLuarys },
              { key: 'meta_liquida',       label: 'Meta Líquida',       cor: '#10B981' },
              { key: 'super_meta_liquida', label: 'Super Meta Líquida', cor: '#8B5CF6' },
            ].map(f => (
              <div key={f.key}>
                <label className="font-title text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: f.cor }}>
                  {f.label}
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMuted, fontWeight: 700 }}>R$</span>
                  <input type="number" min={0} step={500}
                    value={(form as any)[f.key] || ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: Number(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full font-title font-bold"
                    style={{ padding: '9px 10px 9px 30px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 14, color: C.textMain, background: C.bg, boxSizing: 'border-box' as const }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="m-0 mt-3 text-xs" style={{ color: C.textLight }}>
            Meta Líquida = o que sobra depois de pagar despesas e comissões da equipe.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <CardMeta titulo="Faturamento Bruto" icone={FiDollarSign} corIcone="#10B981" bgIcone="#F4F8F5"
          realizado={faturamentoMes} meta={metas.meta_bruta} superMeta={metas.super_meta_bruta}
          corMeta={C.sidebarBg} corSuper={C.douradoLuarys} />
        <CardMeta titulo="Resultado Líquido" icone={FiTrendingUp} corIcone="#8B5CF6" bgIcone="#F5F3FF"
          realizado={liquidoMes} meta={metas.meta_liquida} superMeta={metas.super_meta_liquida}
          corMeta="#10B981" corSuper="#8B5CF6" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Projeção */}
        <Card className="p-6 bg-white rounded-xl shadow-sm border" style={{ borderColor: C.border }}>
          <div className="flex justify-between items-start mb-4">
            <p className="m-0 font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>Projeção ao Fim do Mês</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
              <FiTrendingUp size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Bruto projetado',   valor: projecaoBruta, cor: C.sidebarBg },
              { label: 'Líquido projetado', valor: projecaoLiq,   cor: '#10B981' },
            ].map(p => (
              <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>{p.label}</span>
                <span className="font-title text-sm font-bold" style={{ color: p.valor < 0 ? '#EF4444' : p.cor }}>{brl(p.valor)}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="font-title text-[10px]" style={{ color: C.textLight }}>
                Ritmo atual: {brl(ritmodiario)}/dia · {diasUteisAteHoje} de {diasUteisTotais} dias úteis
              </span>
              <button onClick={() => setVerCalculo(v => !v)}
                className="flex items-center gap-1 font-title"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', padding: 0 }}>
                {verCalculo ? 'Ocultar' : 'Ver cálculo'}
                <FiChevronDown size={11} style={{ transform: verCalculo ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
            </div>
            {verCalculo && (
              <div style={{ marginTop: 4, padding: '12px 14px', borderRadius: RAIO_SM, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p className="m-0 font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted, marginBottom: 4 }}>Como foi calculado</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8, borderBottom: `1px dashed ${C.border}` }}>
                  <span className="font-title text-[10px] font-bold" style={{ color: C.sidebarBg }}>BRUTO PROJETADO</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted }}>
                    <span>Receita até hoje</span><span style={{ fontWeight: 700 }}>{brl(faturamentoMes)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textLight }}>
                    <span>÷ {diasUteisAteHoje} dias úteis × {diasUteisTotais} dias úteis no mês</span>
                    <span style={{ fontWeight: 700, color: C.sidebarBg }}>{brl(projecaoBruta)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="font-title text-[10px] font-bold" style={{ color: '#10B981' }}>LÍQUIDO PROJETADO</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted }}>
                    <span>Bruto projetado</span><span style={{ fontWeight: 700 }}>{brl(projecaoBruta)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted }}>
                    <span>− Despesas fixas do mês</span><span style={{ fontWeight: 700, color: '#EF4444' }}>−{brl(despesasMes)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted }}>
                    <span>− Comissões projetadas</span><span style={{ fontWeight: 700, color: '#EF4444' }}>−{brl(projecaoComissoes)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 2 }}>
                    <span style={{ fontWeight: 700 }}>= Líquido projetado</span>
                    <span style={{ fontWeight: 800, color: projecaoLiq < 0 ? '#EF4444' : '#10B981' }}>{brl(projecaoLiq)}</span>
                  </div>
                </div>
                <p className="m-0" style={{ fontSize: 10, color: C.textLight, lineHeight: 1.5, marginTop: 4 }}>
                  Despesas fixas são usadas pelo valor já registrado — não extrapoladas. Receita e comissões são projetadas pelo ritmo dos {diasUteisAteHoje} dias úteis trabalhados.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Saúde Financeira */}
        <Card className="p-6 rounded-xl shadow-sm border-none relative overflow-hidden transition-transform hover:scale-[1.01]"
          style={{ background: estaSaudavel ? C.sidebarBg : 'white', border: estaSaudavel ? 'none' : `1px solid #FCA5A5`, borderRadius: RAIO_XL }}>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <p className="m-0 font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: estaSaudavel ? '#94A3B8' : C.textMuted }}>Saúde Financeira</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: estaSaudavel ? 'rgba(255,255,255,0.08)' : '#FEE2E2', color: estaSaudavel ? C.douradoLuarys : '#EF4444' }}>
              {estaSaudavel ? <FiCheckCircle size={18} /> : <FiAlertTriangle size={18} />}
            </div>
          </div>
          <div className="relative z-10">
            <p className="m-0 mb-3 font-title text-xs font-bold" style={{ color: estaSaudavel ? C.douradoLuarys : '#EF4444' }}>
              {estaSaudavel ? '✅ Operação saudável' : '⚠️ Ainda não cobriu os custos'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Ponto de equilíbrio', valor: pontoEquilibrio },
                { label: 'Despesas do mês',      valor: despesasMes },
                { label: 'Comissões geradas',     valor: comissoesMes },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: estaSaudavel ? '#94A3B8' : C.textMuted }}>{item.label}</span>
                  <span className="font-title text-xs font-bold" style={{ color: estaSaudavel ? '#E2E8F0' : C.textMain }}>{brl(item.valor)}</span>
                </div>
              ))}
            </div>
            {!estaSaudavel && faltaEquilibrio > 0 && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: RAIO_SM, background: '#FEF2F2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: '#EF4444' }}>Falta faturar</span>
                  <span className="font-title text-sm font-bold" style={{ color: '#EF4444' }}>{brl(faltaEquilibrio)}</span>
                </div>
                {diasUteisRestantes > 0 && (
                  <p className="m-0 text-[10px]" style={{ color: '#DC2626' }}>
                    {brl(necessarioPorDia)}/dia nos próximos {diasUteisRestantes} dias úteis
                  </p>
                )}
              </div>
            )}
            {estaSaudavel && (
              <div className="mt-4">
                <div className="flex justify-between font-title text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#E2E8F0' }}>
                  <span>Cobertura dos custos</span>
                  <span style={{ color: C.douradoLuarys }}>{pontoEquilibrio > 0 ? Math.round((faturamentoMes / pontoEquilibrio) * 100) : 100}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(pontoEquilibrio > 0 ? (faturamentoMes / pontoEquilibrio) * 100 : 100, 100)}%`, background: C.douradoLuarys, transition: 'width 1s ease' }} />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* DRE Mini */}
        <Card className="p-6 bg-white rounded-xl shadow-sm border" style={{ borderColor: C.border }}>
          <div className="flex justify-between items-start mb-4">
            <p className="m-0 font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>Composição do Resultado</p>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#F4F8F5', color: '#10B981' }}>
              <FiMinusCircle size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Faturamento bruto', valor: faturamentoMes, cor: C.sidebarBg, sinal: '+' },
              { label: 'Despesas',          valor: despesasMes,    cor: '#EF4444',   sinal: '−' },
              { label: 'Comissões',         valor: comissoesMes,   cor: '#F59E0B',   sinal: '−' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.cor, flexShrink: 0 }} />
                  <span className="font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMuted }}>{item.label}</span>
                </div>
                <span className="font-title text-xs font-bold" style={{ color: item.cor }}>{item.sinal} {brl(item.valor)}</span>
              </div>
            ))}
            <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="font-title text-[10px] font-bold uppercase tracking-wider" style={{ color: C.textMain }}>Resultado Líquido</span>
              <span className="font-title text-xl font-bold" style={{ color: liquidoMes >= 0 ? '#10B981' : '#EF4444' }}>{brl(liquidoMes)}</span>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
