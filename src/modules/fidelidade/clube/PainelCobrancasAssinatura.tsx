'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { RAIO_MD, RAIO_LG } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { FiCheckCircle, FiClock, FiAlertCircle, FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const FORMAS = ['PIX', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'Transferência', 'Outro'];
const primeiroDiaMes = (a: number, m: number) => `${a}-${String(m + 1).padStart(2, '0')}-01`;
const fmtData = (iso: string) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '';

export function PainelCobrancasAssinatura({ perfil }: any) {
  const toast = useToast();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [assinaturas, setAssinaturas] = useState<any[]>([]);
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalPag, setModalPag] = useState<any | null>(null);
  const [formPag, setFormPag] = useState({ data_pagamento: hoje.toISOString().split('T')[0], forma_pagamento: 'PIX', observacao: '' });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { carregar(); }, [perfil?.salao_id, ano, mes]);

  async function carregar() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const mesRef = primeiroDiaMes(ano, mes);
    const [{ data: assins }, { data: cobs }] = await Promise.all([
      supabase.from('assinaturas_cliente')
        .select('id, dia_vencimento, cliente_id, clientes(nome_completo), planos_assinatura_cliente(nome, preco_mensal)')
        .eq('salao_id', perfil.salao_id).eq('status', 'ativa'),
      supabase.from('cobrancas_assinatura').select('*').eq('salao_id', perfil.salao_id).eq('mes_referencia', mesRef),
    ]);
    setAssinaturas(assins || []);
    setCobrancas(cobs || []);
    setCarregando(false);
  }

  const getCobranca = (assinaturaId: string) => cobrancas.find(c => c.assinatura_id === assinaturaId);
  const valorDe = (a: any) => Number(a.planos_assinatura_cliente?.preco_mensal) || 0;

  function statusDe(a: any) {
    const cob = getCobranca(a.id);
    if (cob?.status === 'pago') return 'pago';
    const vencimento = new Date(ano, mes, a.dia_vencimento || 5);
    return vencimento < hoje ? 'atrasado' : 'pendente';
  }

  function abrirModal(a: any) {
    setModalPag(a);
    setFormPag({ data_pagamento: hoje.toISOString().split('T')[0], forma_pagamento: 'PIX', observacao: '' });
  }

  async function registrarPagamento() {
    if (!modalPag) return;
    setSalvando(true);
    const mesRef = primeiroDiaMes(ano, mes);
    const valor = valorDe(modalPag);
    const clienteNome = modalPag.clientes?.nome_completo || 'Cliente';
    const planoNome = modalPag.planos_assinatura_cliente?.nome || 'Plano';
    try {
      const { error } = await supabase.from('cobrancas_assinatura').upsert({
        salao_id: perfil.salao_id,
        assinatura_id: modalPag.id,
        mes_referencia: mesRef,
        valor,
        data_pagamento: formPag.data_pagamento,
        status: 'pago',
        forma_pagamento: formPag.forma_pagamento,
        observacao: formPag.observacao || null,
        lancado_no_financeiro: false,
      }, { onConflict: 'assinatura_id,mes_referencia' });
      if (error) throw error;

      await supabase.from('financeiro').insert({
        salao_id: perfil.salao_id,
        tipo: 'entrada',
        descricao: `Assinatura — ${clienteNome} · ${planoNome} (${MESES[mes]}/${ano})`,
        categoria: 'Assinaturas',
        valor,
        data_movimentacao: formPag.data_pagamento,
        forma_pagamento: formPag.forma_pagamento,
        status: 'Pago',
      });

      await supabase.from('cobrancas_assinatura').update({ lancado_no_financeiro: true })
        .eq('assinatura_id', modalPag.id).eq('mes_referencia', mesRef);

      toast.sucesso('Pagamento registrado e lançado no financeiro!');
      setModalPag(null);
      carregar();
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    }
    setSalvando(false);
  }

  async function estornar(a: any) {
    const cob = getCobranca(a.id);
    if (!cob) return;
    await supabase.from('cobrancas_assinatura').update({ status: 'pendente', data_pagamento: null, forma_pagamento: null }).eq('id', cob.id);
    toast.sucesso('Pagamento estornado.');
    carregar();
  }

  function navegarMes(dir: 1 | -1) {
    let m = mes + dir, a = ano;
    if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
    setMes(m); setAno(a);
  }

  const totalEsperado = assinaturas.reduce((s, a) => s + valorDe(a), 0);
  const totalRecebido = cobrancas.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.valor), 0);
  const totalPendente = Math.max(0, totalEsperado - totalRecebido);

  const STATUS: any = {
    pago: { label: 'Pago', cor: C.success, bg: '#ECFDF5', icon: <FiCheckCircle size={14} /> },
    pendente: { label: 'Pendente', cor: '#B45309', bg: '#FFFBEB', icon: <FiClock size={14} /> },
    atrasado: { label: 'Atrasado', cor: C.danger, bg: '#FEF2F2', icon: <FiAlertCircle size={14} /> },
  };

  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: '#fff', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Navegador de mês */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button onClick={() => navegarMes(-1)} style={navBtn}><FiChevronLeft size={16} /></button>
        <h3 className="font-title" style={{ fontSize: 16, fontWeight: 800, color: C.textMain, margin: 0, minWidth: 180, textAlign: 'center' }}>{MESES[mes]} {ano}</h3>
        <button onClick={() => navegarMes(1)} style={navBtn}><FiChevronRight size={16} /></button>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { label: 'Esperado no mês', valor: brl(totalEsperado), cor: C.textMain },
          { label: 'Recebido', valor: brl(totalRecebido), cor: C.success },
          { label: 'Pendente / Atrasado', valor: brl(totalPendente), cor: totalPendente > 0 ? C.danger : C.success },
        ].map((c, i) => (
          <div key={i} style={{ background: C.bgCard, borderRadius: RAIO_LG, border: `1px solid ${C.border}`, padding: '14px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>{c.label}</p>
            <p className="font-title" style={{ fontSize: 20, fontWeight: 800, color: c.cor, margin: 0 }}>{c.valor}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div style={{ background: C.bgCard, borderRadius: RAIO_LG, border: `1px solid ${C.border}`, padding: 18 }}>
        <h3 className="font-title" style={{ fontSize: 13, fontWeight: 800, color: C.textMain, margin: '0 0 14px' }}>Cobranças — {MESES[mes]}/{ano}</h3>
        {carregando ? (
          <p style={{ textAlign: 'center', color: C.textLight, fontSize: 13, padding: '20px 0' }}>Carregando…</p>
        ) : assinaturas.length === 0 ? (
          <p style={{ textAlign: 'center', color: C.textLight, fontSize: 13, padding: '20px 0' }}>Nenhuma assinatura ativa. Atribua planos aos clientes no CRM.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assinaturas.map(a => {
              const st = STATUS[statusDe(a)];
              const cob = getCobranca(a.id);
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: RAIO_MD, background: C.bg, border: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <p className="font-title" style={{ fontSize: 13, fontWeight: 700, color: C.textMain, margin: '0 0 2px' }}>{a.clientes?.nome_completo || 'Cliente'}</p>
                    <p style={{ fontSize: 11, color: C.textLight, margin: 0 }}>
                      {a.planos_assinatura_cliente?.nome} · vence dia {a.dia_vencimento}
                      {cob?.data_pagamento && ` · pago em ${fmtData(cob.data_pagamento)}`}
                    </p>
                  </div>
                  <p className="font-title" style={{ fontSize: 15, fontWeight: 800, color: C.textMain, margin: 0 }}>{brl(valorDe(a))}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: st.bg, color: st.cor, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{st.icon} {st.label}</div>
                  {statusDe(a) !== 'pago' ? (
                    <button onClick={() => abrirModal(a)} style={{ background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Registrar Pagamento</button>
                  ) : (
                    <button onClick={() => estornar(a)} style={{ background: 'none', color: C.textLight, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: '7px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Estornar</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de pagamento */}
      {modalPag && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 28, boxShadow: '0 25px 50px rgba(0,0,0,0.2)', borderTop: `4px solid ${C.success}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 className="font-title" style={{ fontSize: 15, fontWeight: 800, color: C.textMain, margin: 0 }}>Registrar Pagamento</h3>
              <button onClick={() => setModalPag(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}><FiX size={20} /></button>
            </div>
            <div style={{ background: C.bg, borderRadius: RAIO_MD, padding: '12px 16px', marginBottom: 20 }}>
              <p className="font-title" style={{ fontSize: 13, fontWeight: 700, color: C.textMain, margin: '0 0 2px' }}>{modalPag.clientes?.nome_completo}</p>
              <p style={{ fontSize: 12, color: C.textLight, margin: 0 }}>{modalPag.planos_assinatura_cliente?.nome} · {MESES[mes]}/{ano} · <strong style={{ color: C.success }}>{brl(valorDe(modalPag))}</strong></p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div><label style={lbl}>Data do Pagamento</label><input type="date" style={inp} value={formPag.data_pagamento} onChange={e => setFormPag(p => ({ ...p, data_pagamento: e.target.value }))} /></div>
              <div><label style={lbl}>Forma de Pagamento</label>
                <select style={inp} value={formPag.forma_pagamento} onChange={e => setFormPag(p => ({ ...p, forma_pagamento: e.target.value }))}>
                  {FORMAS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Observação (opcional)</label><input style={inp} value={formPag.observacao} onChange={e => setFormPag(p => ({ ...p, observacao: e.target.value }))} /></div>
            </div>
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: RAIO_MD, padding: '8px 12px', marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: '#1D4ED8', margin: 0 }}>Será lançado como receita (categoria "Assinaturas") no Financeiro.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalPag(null)} style={{ padding: '10px 18px', borderRadius: RAIO_MD, border: `1px solid ${C.border}`, background: '#fff', color: C.textMain, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={registrarPagamento} disabled={salvando} style={{ padding: '10px 20px', borderRadius: RAIO_MD, border: 'none', background: C.success, color: '#fff', fontSize: 13, fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer' }}>
                {salvando ? 'Registrando…' : 'Confirmar Recebimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMain };
