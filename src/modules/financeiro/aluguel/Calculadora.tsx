'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { FiSave, FiRefreshCw, FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronUp, FiInfo, FiPlus, FiTrash2 } from 'react-icons/fi';
import { FONTE_TITULO } from '@/lib/estiloGlobal';
import { CONFIG_DEFAULT, FORM_DEFAULT, type ConfigCustos, obterHorasMesEfetivo } from '@/modules/precificacao/tipos';
import { useDiagnosticoCatalogo } from '@/modules/precificacao/useDiagnosticoCatalogo';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const inp = { width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.borderMid}`, fontSize: 14, color: C.textMain, background: '#fff', boxSizing: 'border-box' as const };
const lbl = { fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.textMuted, display: 'block' as const, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.5px' };

interface ItemExtra { descricao: string; valor: number; }

export function Calculadora({ perfil }: { perfil: any }) {
  const toast = useToast();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [totalEstacoes, setTotalEstacoes] = useState(1);
  const [margemLucro, setMargemLucro] = useState(30);
  const [despesasFixas, setDespesasFixas] = useState<any[]>([]);
  const [despesasVariaveis, setDespesasVariaveis] = useState<any[]>([]);
  const [itensExtras, setItensExtras] = useState<ItemExtra[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [expandido, setExpandido] = useState(false);

  // ── Config da Precificação (só para referência de lucro/hora) ─────────────
  const STORAGE_KEY = `luarys_precificacao_config_${perfil?.salao_id}`;
  const [precConfig, setPrecConfig] = useState<ConfigCustos>(CONFIG_DEFAULT);
  const [precConfigCarregada, setPrecConfigCarregada] = useState(false);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPrecConfig(JSON.parse(saved));
    } catch { }
    setPrecConfigCarregada(true);
  }, [perfil?.salao_id]);

  const { servicos: servicosDiag, carregarDiagnostico } = useDiagnosticoCatalogo(perfil, precConfig, FORM_DEFAULT);

  useEffect(() => {
    if (precConfigCarregada && perfil?.salao_id) carregarDiagnostico();
  }, [precConfigCarregada, perfil?.salao_id]);

  const elegiveis = servicosDiag.filter((s: any) => !s.eh_cortesia && s.lucroHoraReal > 0);
  const lucroMedioHora = elegiveis.length > 0
    ? elegiveis.reduce((acc: number, s: any) => acc + s.lucroHoraReal, 0) / elegiveis.length
    : 0;
  const horasMes = obterHorasMesEfetivo(precConfig);
  const custoOportunidadePorEstacao = lucroMedioHora * horasMes;

  // ── Dados salvos ──────────────────────────────────────────────────────────
  useEffect(() => { carregarConfig(); }, [perfil?.salao_id]);
  useEffect(() => { buscarDespesas(); }, [perfil?.salao_id, ano, mes]);

  async function carregarConfig() {
    if (!perfil?.salao_id) return;
    const { data } = await supabase.from('custos_fixos_salao').select('*').eq('salao_id', perfil.salao_id).maybeSingle();
    if (data) {
      setTotalEstacoes(data.total_estacoes || 1);
      setMargemLucro(data.margem_lucro ?? 30);
      setItensExtras(data.itens || []);
    }
  }

  async function buscarDespesas() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const inicioMes = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
    const fimMes    = `${ano}-${String(mes + 1).padStart(2, '0')}-${new Date(ano, mes + 1, 0).getDate()}`;
    const { data } = await supabase
      .from('despesas')
      .select('descricao, categoria, valor, tipo_custo')
      .eq('salao_id', perfil.salao_id)
      .in('tipo_custo', ['Fixo', 'Variável'])
      .neq('status', 'Estornado')
      .gte('data_vencimento', inicioMes)
      .lte('data_vencimento', fimMes);
    const todas = data || [];
    setDespesasFixas(todas.filter(d => d.tipo_custo === 'Fixo').map(d => ({ descricao: d.descricao, categoria: d.categoria, valor: Number(d.valor) })));
    setDespesasVariaveis(todas.filter(d => d.tipo_custo === 'Variável').map(d => ({ descricao: d.descricao, categoria: d.categoria, valor: Number(d.valor) })));
    setCarregando(false);
  }

  async function salvar() {
    if (!perfil?.salao_id) return;
    setSalvando(true);
    const { error } = await supabase.from('custos_fixos_salao').upsert({
      salao_id: perfil.salao_id,
      total_estacoes: totalEstacoes,
      margem_lucro: margemLucro,
      itens: itensExtras,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'salao_id' });
    if (error) toast.erro('Erro ao salvar: ' + error.message);
    else toast.sucesso('Configuração salva!');
    setSalvando(false);
  }

  function navegarMes(dir: 1 | -1) {
    let m = mes + dir, a = ano;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMes(m); setAno(a);
  }

  function addExtra() { setItensExtras(p => [...p, { descricao: '', valor: 0 }]); }
  function removeExtra(i: number) { setItensExtras(p => p.filter((_, idx) => idx !== i)); }
  function updateExtra(i: number, campo: keyof ItemExtra, val: any) {
    setItensExtras(p => p.map((it, idx) => idx === i ? { ...it, [campo]: campo === 'valor' ? Number(val) : val } : it));
  }

  // ── Cálculo ───────────────────────────────────────────────────────────────
  const totalFixas        = despesasFixas.reduce((a, d) => a + d.valor, 0);
  const totalVariaveis    = despesasVariaveis.reduce((a, d) => a + d.valor, 0);
  const totalExtras       = itensExtras.reduce((a, it) => a + (it.valor || 0), 0);
  const totalCustos       = totalFixas + totalVariaveis + totalExtras;
  const custoPorEstacao   = totalEstacoes > 0 ? totalCustos / totalEstacoes : 0;
  const valorSugerido     = custoPorEstacao * (1 + margemLucro / 100);
  const lucroEstacao      = valorSugerido - custoPorEstacao; // margem pura por estação
  const lucroTotal        = lucroEstacao * totalEstacoes;
  const receitaTotal      = valorSugerido * totalEstacoes;
  const totalItens        = despesasFixas.length + despesasVariaveis.length;

  function agrupar(itens: any[]) {
    return itens.reduce((acc: Record<string, any[]>, d) => {
      const cat = d.categoria || 'Outros';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(d);
      return acc;
    }, {});
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Cabeçalho */}
      <div style={{ background: C.sidebarBg, borderRadius: 14, padding: '20px 24px', color: '#fff' }}>
        <p style={{ fontFamily: FONTE_TITULO, fontSize: 11, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: C.douradoLuarys, margin: '0 0 6px' }}>Calculadora</p>
        <h2 style={{ fontFamily: FONTE_TITULO, fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Custo por Estação</h2>
        <p style={{ fontSize: 13, opacity: 0.75, margin: 0 }}>Custo real do estabelecimento ÷ estações + margem = aluguel justo.</p>
      </div>

      {/* Configurações */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'end', background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
        <div>
          <label style={lbl}>Número de Estações / Cadeiras</label>
          <input type="number" min={1} style={inp} value={totalEstacoes} onChange={e => setTotalEstacoes(Math.max(1, Number(e.target.value)))} />
        </div>
        <div>
          <label style={lbl}>Margem do proprietário (%)</label>
          <div style={{ position: 'relative' }}>
            <input type="number" min={0} max={500} style={{ ...inp, paddingRight: 36 }} value={margemLucro} onChange={e => setMargemLucro(Number(e.target.value))} />
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.textLight, pointerEvents: 'none' }}>%</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={lbl}>Mês de referência</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navegarMes(-1)} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiChevronLeft size={14} />
            </button>
            <span style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 700, color: C.textMain, minWidth: 100, textAlign: 'center' }}>{MESES[mes].slice(0,3)} {ano}</span>
            <button onClick={() => navegarMes(1)} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiChevronRight size={14} />
            </button>
            <button onClick={buscarDespesas} title="Atualizar" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FiRefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Custos do sistema — expansível */}
      <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <button onClick={() => setExpandido(p => !p)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <div>
            <p style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 800, color: C.textMain, margin: '0 0 2px' }}>Custos do Estabelecimento — {MESES[mes]}/{ano}</p>
            <p style={{ fontSize: 11, color: C.textLight, margin: 0 }}>
              {carregando ? 'Carregando...' : totalItens === 0
                ? 'Nenhuma despesa cadastrada neste mês'
                : `${despesasFixas.length} fixo${despesasFixas.length !== 1 ? 's' : ''} · ${despesasVariaveis.length} variável${despesasVariaveis.length !== 1 ? 'is' : ''} · clique para ver`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: FONTE_TITULO, fontSize: 15, fontWeight: 800, color: C.textMain }}>{brl(totalFixas + totalVariaveis)}</span>
            {expandido ? <FiChevronUp size={16} color={C.textLight} /> : <FiChevronDown size={16} color={C.textLight} />}
          </div>
        </button>

        {expandido && (
          <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${C.border}` }}>
            {totalItens === 0 ? (
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '14px 16px', display: 'flex', gap: 10, marginTop: 16 }}>
                <FiInfo size={15} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#1D4ED8', margin: 0, lineHeight: 1.6 }}>
                  Cadastre despesas em <strong>Financeiro → Despesas</strong> com tipo <strong>Fixo</strong> ou <strong>Variável</strong> para aparecerem aqui.
                </p>
              </div>
            ) : (
              <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {despesasFixas.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fixos</span>
                      <span style={{ fontFamily: FONTE_TITULO, fontSize: 12, fontWeight: 700, color: C.textMain }}>{brl(totalFixas)}</span>
                    </div>
                    {Object.entries(agrupar(despesasFixas)).map(([cat, itens]) => (
                      <div key={cat} style={{ marginBottom: 8 }}>
                        <p style={{ fontFamily: FONTE_TITULO, fontSize: 9, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>{cat}</p>
                        {(itens as any[]).map((d, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, marginBottom: 3 }}>
                            <span style={{ fontSize: 13, color: C.textMain }}>{d.descricao || cat}</span>
                            <span style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 700 }}>{brl(d.valor)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {despesasVariaveis.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Variáveis</span>
                      <span style={{ fontFamily: FONTE_TITULO, fontSize: 12, fontWeight: 700, color: '#D97706' }}>{brl(totalVariaveis)}</span>
                    </div>
                    {Object.entries(agrupar(despesasVariaveis)).map(([cat, itens]) => (
                      <div key={cat} style={{ marginBottom: 8 }}>
                        <p style={{ fontFamily: FONTE_TITULO, fontSize: 9, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>{cat}</p>
                        {(itens as any[]).map((d, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: 3 }}>
                            <span style={{ fontSize: 13, color: C.textMain }}>{d.descricao || cat}</span>
                            <span style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 700, color: '#D97706' }}>{brl(d.valor)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custos adicionais não cadastrados */}
      <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <div>
            <p style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 800, color: C.textMain, margin: '0 0 2px' }}>Custos Adicionais</p>
            <p style={{ fontSize: 11, color: C.textLight, margin: 0 }}>Itens não cadastrados no financeiro · café, papel higiênico, etc. · <strong style={{ color: C.textMain }}>{brl(totalExtras)}</strong></p>
          </div>
          <button onClick={addExtra} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.bg, color: C.sidebarBg, border: `1px solid ${C.sidebarBg}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>
            <FiPlus size={13} /> Adicionar
          </button>
        </div>
        {itensExtras.length > 0 && (
          <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16 }}>
              {itensExtras.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 36px', gap: 8, alignItems: 'center' }}>
                  <input style={inp} placeholder="Descrição" value={it.descricao} onChange={e => updateExtra(i, 'descricao', e.target.value)} />
                  <input type="number" min={0} step="0.01" style={inp} placeholder="R$ 0,00" value={it.valor || ''} onChange={e => updateExtra(i, 'valor', e.target.value)} />
                  <button onClick={() => removeExtra(i)} style={{ background: C.dangerBg, color: C.danger, border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FiTrash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resultados */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: '18px 20px', borderLeft: `3px solid ${C.douradoLuarys}` }}>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>Custo por Estação / Mês</p>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: 22, fontWeight: 900, color: C.textMain, margin: '0 0 4px' }}>{brl(custoPorEstacao)}</p>
          <p style={{ fontSize: 11, color: C.textLight, margin: 0 }}>piso mínimo · sem prejuízo</p>
        </div>
        <div style={{ background: C.sidebarBg, borderRadius: 12, padding: '18px 20px' }}>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>Aluguel Sugerido (+{margemLucro}%)</p>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>{brl(valorSugerido)}</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0 }}>por estação / mês</p>
        </div>
        <div style={{ background: lucroEstacao >= 0 ? '#F0FDF4' : '#FEF2F2', borderRadius: 12, border: `1px solid ${lucroEstacao >= 0 ? '#BBF7D0' : '#FECACA'}`, padding: '18px 20px', borderLeft: `3px solid ${lucroEstacao >= 0 ? C.success : C.danger}` }}>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: lucroEstacao >= 0 ? '#166534' : '#991B1B', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
            {lucroEstacao >= 0 ? 'Lucro' : 'Prejuízo'} por Estação
          </p>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: 22, fontWeight: 900, color: lucroEstacao >= 0 ? C.success : C.danger, margin: '0 0 4px' }}>{brl(Math.abs(lucroEstacao))}</p>
          <p style={{ fontSize: 11, color: lucroEstacao >= 0 ? '#166534' : '#991B1B', margin: 0 }}>
            {margemLucro}% sobre o custo
          </p>
        </div>
        <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: '18px 20px', borderLeft: `3px solid ${lucroTotal >= 0 ? C.success : C.danger}` }}>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
            {lucroTotal >= 0 ? 'Lucro' : 'Prejuízo'} Total / Mês
          </p>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: 22, fontWeight: 900, color: lucroTotal >= 0 ? C.success : C.danger, margin: '0 0 4px' }}>{brl(Math.abs(lucroTotal))}</p>
          <p style={{ fontSize: 11, color: C.textLight, margin: 0 }}>{totalEstacoes} estação{totalEstacoes !== 1 ? 'ões' : ''} · 100% alugadas</p>
        </div>
      </div>

      {/* Referência de custo de oportunidade — informativo apenas */}
      {custoOportunidadePorEstacao > 0 && (
        <div style={{ background: C.bg, borderRadius: 12, border: `1px dashed ${C.borderMid}`, padding: '14px 20px' }}>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Referência — Luarys Precifica</p>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>
            Com um profissional próprio, cada estação geraria em média <strong style={{ color: C.textMain }}>{brl(custoOportunidadePorEstacao)}/mês</strong> de lucro ({brl(lucroMedioHora)}/h × {horasMes}h).
            {valorSugerido < custoOportunidadePorEstacao
              ? ` O aluguel sugerido (${brl(valorSugerido)}) é menor — considere isso ao tomar a decisão de alugar.`
              : ` O aluguel sugerido (${brl(valorSugerido)}) já supera esse valor.`}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={salvar} disabled={salvando} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>
          <FiSave size={15} /> {salvando ? 'Salvando...' : 'Salvar Configuração'}
        </button>
      </div>
    </div>
  );
}
