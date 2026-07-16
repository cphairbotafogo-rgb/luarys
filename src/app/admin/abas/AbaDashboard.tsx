'use client'
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { FiTrendingUp, FiUsers, FiXCircle, FiDollarSign, FiPlus, FiTrash2, FiSave } from "react-icons/fi";

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, valor, sub, cor }: { label: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '20px 24px', flex: 1, minWidth: 160 }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: cor || C.sidebarBg }}>{valor}</p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>{sub}</p>}
    </div>
  );
}

// ─── Seção: Despesas ─────────────────────────────────────────────────────────
function SecaoDespesas({ despesas, onAdd, onRemove, onToggle, novaDesc, setNovaDesc, novoValor, setNovoValor, novoTipo, setNovoTipo }:
  { despesas: any[]; onAdd: () => void; onRemove: (id: string) => void; onToggle: (id: string, ativa: boolean) => void;
    novaDesc: string; setNovaDesc: (v: string) => void; novoValor: string; setNovoValor: (v: string) => void;
    novoTipo: 'fixa' | 'variavel'; setNovoTipo: (v: 'fixa' | 'variavel') => void }) {

  const inputSt: React.CSSProperties = { padding: '8px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.textMain, background: '#fff' };

  return (
    <div>
      <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Despesas</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input style={{ ...inputSt, flex: 2, minWidth: 140 }} placeholder="Descrição (ex: Servidor, Contador...)" value={novaDesc} onChange={e => setNovaDesc(e.target.value)} />
        <input type="number" min={0} step={0.01} style={{ ...inputSt, width: 110 }} placeholder="R$ 0,00" value={novoValor} onChange={e => setNovoValor(e.target.value)} />
        <select style={{ ...inputSt, width: 110 }} value={novoTipo} onChange={e => setNovoTipo(e.target.value as any)}>
          <option value="fixa">Fixa</option>
          <option value="variavel">Variável</option>
        </select>
        <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <FiPlus size={13} /> Adicionar
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {['fixa', 'variavel'].map(tipo => {
          const lista = despesas.filter(d => d.tipo === tipo);
          if (!lista.length) return null;
          return (
            <div key={tipo}>
              <p style={{ margin: '8px 0 4px', fontSize: 10, fontWeight: 800, color: tipo === 'fixa' ? '#2563EB' : '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {tipo === 'fixa' ? 'Fixas' : 'Variáveis'}
              </p>
              {lista.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: d.ativa ? '#F8FAFC' : '#F1F5F9', borderRadius: RAIO_MD, marginBottom: 4, opacity: d.ativa ? 1 : 0.5 }}>
                  <input type="checkbox" checked={d.ativa} onChange={() => onToggle(d.id, !d.ativa)} style={{ cursor: 'pointer' }} />
                  <span style={{ flex: 1, fontSize: 12, color: C.textMain, fontWeight: 500 }}>{d.descricao}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>- {brl(d.valor)}</span>
                  <button onClick={() => onRemove(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex', padding: 2 }}>
                    <FiTrash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        {despesas.length === 0 && <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', margin: 0 }}>Nenhuma despesa cadastrada.</p>}
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export function AbaDashboard() {
  const toast = useToast();

  // KPIs
  const [saloes, setSaloes]           = useState<any[]>([]);
  const [pagamentos, setPagamentos]   = useState<any[]>([]);
  const [planos, setPlanos]           = useState<any[]>([]);
  const [modulos, setModulos]         = useState<any[]>([]);

  // Despesas
  const [despesas, setDespesas]       = useState<any[]>([]);
  const [novaDesc, setNovaDesc]       = useState('');
  const [novoValor, setNovoValor]     = useState('');
  const [novoTipo, setNovoTipo]       = useState<'fixa' | 'variavel'>('fixa');

  // Config financeira
  const [taxaCredito, setTaxaCredito] = useState('');
  const [taxaDebito, setTaxaDebito]   = useState('');
  const [taxaPix, setTaxaPix]         = useState('');
  const [imposto, setImposto]         = useState('');
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const [carregando, setCarregando]   = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [resSaloes, resPags, resPlanos, resMods, resDespesas, resConf] = await Promise.allSettled([
      supabase.from('saloes').select('id, nome_fantasia, razao_social, cnpj, plano_chave, acesso_total').order('nome_fantasia'),
      supabase.from('pagamentos_assinatura').select('salao_id, modulo_chave, valor, status, criado_em').order('criado_em', { ascending: false }).limit(500),
      supabase.from('planos').select('chave, nome, preco_mensal').order('ordem'),
      supabase.from('salao_modulos').select('salao_id, modulo_chave, ativo, preco_customizado').eq('ativo', true),
      supabase.from('plataforma_despesas').select('*').order('criado_em'),
      supabase.from('plataforma_config_financeira').select('*').eq('id', 1).maybeSingle(),
    ]);

    const get = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value?.data : null;

    if (get(resSaloes))  setSaloes(get(resSaloes));
    if (get(resPags))    setPagamentos(get(resPags));
    if (get(resPlanos))  setPlanos(get(resPlanos));
    if (get(resMods))    setModulos(get(resMods));
    if (get(resDespesas)) setDespesas(get(resDespesas));

    const conf = get(resConf);
    if (conf) {
      setTaxaCredito(String(conf.taxa_cartao_credito ?? ''));
      setTaxaDebito(String(conf.taxa_cartao_debito ?? ''));
      setTaxaPix(String(conf.taxa_pix ?? ''));
      setImposto(String(conf.imposto_percentual ?? ''));
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // ── KPI helpers ─────────────────────────────────────────────────────────────
  const mesAtual = new Date().toISOString().slice(0, 7);
  const anoMes = (d: string) => d?.slice(0, 7);

  const precoPlano = (chave: string) => planos.find(p => p.chave === chave)?.preco_mensal ?? 0;

  const mrr = saloes.reduce((acc, s) => {
    if (s.acesso_total) return acc;
    return acc + precoPlano(s.plano_chave ?? '');
  }, 0);

  const cancelamentos = pagamentos.filter(p => p.status === 'cancelled' && anoMes(p.criado_em) === mesAtual).length;
  const ticketMedio = saloes.length ? mrr / saloes.length : 0;

  const pagsMes = pagamentos.filter(p => p.status === 'approved' && anoMes(p.criado_em) === mesAtual);
  const receitaMes = pagsMes.reduce((acc, p) => acc + Number(p.valor), 0);

  // ── P&L ─────────────────────────────────────────────────────────────────────
  const totalDespesasAtivas = despesas.filter(d => d.ativa).reduce((acc, d) => acc + Number(d.valor), 0);
  const baseCalculo = receitaMes || mrr;
  const taxasCred  = baseCalculo * (parseFloat(taxaCredito) || 0) / 100;
  const taxasDeb   = baseCalculo * (parseFloat(taxaDebito) || 0) / 100;
  const taxasPix   = baseCalculo * (parseFloat(taxaPix) || 0) / 100;
  const totalTaxas = taxasCred + taxasDeb + taxasPix;
  const totalImpos = baseCalculo * (parseFloat(imposto) || 0) / 100;
  const resultado  = baseCalculo - totalDespesasAtivas - totalTaxas - totalImpos;

  // ── Ações despesas ───────────────────────────────────────────────────────────
  async function adicionarDespesa() {
    if (!novaDesc.trim() || !novoValor) { toast.aviso('Preencha descrição e valor.'); return; }
    const { error } = await supabase.from('plataforma_despesas').insert({
      descricao: novaDesc.trim(), valor: parseFloat(novoValor) || 0, tipo: novoTipo, ativa: true,
    });
    if (error) { toast.erro('Erro: ' + error.message); return; }
    setNovaDesc(''); setNovoValor('');
    toast.sucesso('Despesa adicionada!');
    await carregar();
  }

  async function removerDespesa(id: string) {
    await supabase.from('plataforma_despesas').delete().eq('id', id);
    setDespesas(prev => prev.filter(d => d.id !== id));
  }

  async function toggleDespesa(id: string, ativa: boolean) {
    await supabase.from('plataforma_despesas').update({ ativa }).eq('id', id);
    setDespesas(prev => prev.map(d => d.id === id ? { ...d, ativa } : d));
  }

  async function salvarConfig() {
    setSalvandoConfig(true);
    const { error } = await supabase.from('plataforma_config_financeira').upsert({
      id: 1,
      taxa_cartao_credito: parseFloat(taxaCredito) || 0,
      taxa_cartao_debito: parseFloat(taxaDebito) || 0,
      taxa_pix: parseFloat(taxaPix) || 0,
      imposto_percentual: parseFloat(imposto) || 0,
    }, { onConflict: 'id' });
    if (error) toast.erro('Erro: ' + error.message);
    else toast.sucesso('Taxas e impostos salvos!');
    setSalvandoConfig(false);
  }

  const inputSt: React.CSSProperties = { padding: '8px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.textMain, width: '100%', boxSizing: 'border-box' };

  if (carregando) return <p style={{ color: C.textLight, padding: 24 }}>Carregando dashboard...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── KPIs ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KpiCard label="Salões Ativos" valor={String(saloes.length)} sub="total cadastrado" cor={C.sidebarBg} />
        <KpiCard label="MRR Estimado" valor={brl(mrr)} sub="receita recorrente mensal" cor="#16A34A" />
        <KpiCard label="Ticket Médio" valor={brl(ticketMedio)} sub="por salão" />
        <KpiCard label="Receita do Mês" valor={brl(receitaMes)} sub={`pagamentos aprovados em ${mesAtual}`} cor="#2563EB" />
        <KpiCard label="Cancelamentos" valor={String(cancelamentos)} sub="este mês" cor={cancelamentos > 0 ? '#DC2626' : C.textMuted} />
      </div>

      {/* ── Tabela de salões ── */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiUsers size={15} /> Lojas & Assinaturas
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {['Salão', 'CNPJ', 'Plano', 'Módulos Ativos', 'Últ. Pagamento', 'Valor', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontWeight: 800, color: C.textMuted, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {saloes.map(s => {
                const plano = planos.find(p => p.chave === s.plano_chave);
                const modsAtivos = modulos.filter(m => m.salao_id === s.id);
                const ultPag = pagamentos.find(p => p.salao_id === s.id && p.status === 'approved');
                const cancelou = pagamentos.find(p => p.salao_id === s.id && p.status === 'cancelled');
                const statusLabel = cancelou ? 'Cancelado' : s.acesso_total ? 'Acesso Total' : plano ? 'Ativo' : 'Sem plano';
                const statusCor = cancelou ? '#DC2626' : s.acesso_total ? '#7C3AED' : plano ? '#16A34A' : '#B45309';
                const statusBg  = cancelou ? '#FEF2F2' : s.acesso_total ? '#F5F3FF' : plano ? '#F0FDF4' : '#FFFBEB';

                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: C.textMain }}>{s.nome_fantasia || s.razao_social || '—'}</td>
                    <td style={{ padding: '10px 14px', color: C.textLight }}>{s.cnpj || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontWeight: 700, color: C.sidebarBg }}>{plano?.nome || '—'}</span>
                      {plano?.preco_mensal && <span style={{ fontSize: 11, color: C.textLight, marginLeft: 4 }}>{brl(plano.preco_mensal)}/mês</span>}
                    </td>
                    <td style={{ padding: '10px 14px', color: C.textMuted }}>
                      {modsAtivos.length > 0 ? modsAtivos.map(m => m.modulo_chave).join(', ') : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: C.textLight }}>
                      {ultPag ? new Date(ultPag.criado_em).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                      {ultPag ? brl(ultPag.valor) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusCor, background: statusBg, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {saloes.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: C.textLight, fontStyle: 'italic' }}>Nenhum salão cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── P&L + Despesas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* Despesas */}
        <Card style={{ padding: 20 }}>
          <SecaoDespesas
            despesas={despesas}
            onAdd={adicionarDespesa}
            onRemove={removerDespesa}
            onToggle={toggleDespesa}
            novaDesc={novaDesc} setNovaDesc={setNovaDesc}
            novoValor={novoValor} setNovoValor={setNovoValor}
            novoTipo={novoTipo} setNovoTipo={setNovoTipo}
          />
        </Card>

        {/* Demonstrativo */}
        <Card style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiTrendingUp size={14} /> Demonstrativo Financeiro
          </h3>

          {/* Taxas e impostos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Taxa Crédito %', val: taxaCredito, set: setTaxaCredito },
              { label: 'Taxa Débito %',  val: taxaDebito,  set: setTaxaDebito  },
              { label: 'Taxa PIX %',     val: taxaPix,     set: setTaxaPix     },
              { label: 'Impostos %',     val: imposto,     set: setImposto     },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase' }}>{label}</p>
                <input type="number" min={0} max={100} step={0.01} style={inputSt} value={val} onChange={e => set(e.target.value)} placeholder="0" />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button onClick={salvarConfig} disabled={salvandoConfig} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: salvandoConfig ? C.borderMid : C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: salvandoConfig ? 'not-allowed' : 'pointer' }}>
              <FiSave size={12} /> Salvar taxas
            </button>
          </div>

          {/* Resultado */}
          {[
            { label: '(+) Receita do mês',       valor: baseCalculo,           cor: '#16A34A', bold: false },
            { label: '(-) Despesas (fixas + var.)', valor: -totalDespesasAtivas, cor: '#DC2626', bold: false },
            { label: '(-) Taxas de cartão/PIX',   valor: -totalTaxas,           cor: '#DC2626', bold: false },
            { label: '(-) Impostos',              valor: -totalImpos,            cor: '#DC2626', bold: false },
          ].map(({ label, valor, cor }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: cor }}>{brl(Math.abs(valor))}</span>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 12px', marginTop: 8, background: resultado >= 0 ? '#F0FDF4' : '#FEF2F2', borderRadius: RAIO_LG }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: resultado >= 0 ? '#15803D' : '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiDollarSign size={14} /> Resultado Líquido
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: resultado >= 0 ? '#15803D' : '#DC2626' }}>
              {brl(resultado)}
            </span>
          </div>
        </Card>
      </div>

    </div>
  );
}
