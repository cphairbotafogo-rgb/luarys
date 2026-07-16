'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { FiPlus, FiEdit2, FiX, FiUser, FiDollarSign, FiCalendar, FiToggleLeft, FiToggleRight, FiInfo } from 'react-icons/fi';
import { FONTE_TITULO } from '@/lib/estiloGlobal';

const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: '#fff', boxSizing: 'border-box' as const };
const lbl = { fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.textMuted, display: 'block' as const, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.5px' };

const FORM_VAZIO_LOCATARIO = { nome: '', cpf: '', telefone: '', email: '', especialidade: '' };
const FORM_VAZIO_CONTRATO = { numero_estacao: '', valor_mensal: '', dia_vencimento: '5', data_inicio: new Date().toISOString().split('T')[0], data_fim: '', observacoes: '' };

export function Contratos({ perfil }: { perfil: any }) {
  const toast = useToast();
  const [locatarios, setLocatarios] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [custoCalculado, setCustoCalculado] = useState<number | null>(null);
  const [modal, setModal] = useState<'novo' | 'editar' | null>(null);
  const [locatarioSelecionado, setLocatarioSelecionado] = useState<any>(null);
  const [formLoc, setFormLoc] = useState(FORM_VAZIO_LOCATARIO);
  const [formCont, setFormCont] = useState(FORM_VAZIO_CONTRATO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { carregar(); }, [perfil?.salao_id]);

  async function carregar() {
    if (!perfil?.salao_id) return;
    const [{ data: locs }, { data: conts }, { data: custos }] = await Promise.all([
      supabase.from('locatarios').select('*').eq('salao_id', perfil.salao_id).order('nome'),
      supabase.from('contratos_aluguel').select('*, locatarios(nome)').eq('salao_id', perfil.salao_id).order('criado_em', { ascending: false }),
      supabase.from('custos_fixos_salao').select('*').eq('salao_id', perfil.salao_id).maybeSingle(),
    ]);
    setLocatarios(locs || []);
    setContratos(conts || []);
    if (custos && custos.total_estacoes > 0) {
      const total = (custos.itens || []).reduce((a: number, it: any) => a + Number(it.valor || 0), 0);
      const custo = total / custos.total_estacoes;
      setCustoCalculado(custo * (1 + (custos.margem_lucro ?? 30) / 100));
    }
  }

  function abrirNovo() { setFormLoc(FORM_VAZIO_LOCATARIO); setFormCont(FORM_VAZIO_CONTRATO); setLocatarioSelecionado(null); setModal('novo'); }

  function abrirEditar(loc: any) {
    const contrato = contratos.find(c => c.locatario_id === loc.id && c.ativo);
    setLocatarioSelecionado(loc);
    setFormLoc({ nome: loc.nome, cpf: loc.cpf || '', telefone: loc.telefone || '', email: loc.email || '', especialidade: loc.especialidade || '' });
    setFormCont(contrato ? {
      numero_estacao: contrato.numero_estacao || '',
      valor_mensal: String(contrato.valor_mensal),
      dia_vencimento: String(contrato.dia_vencimento),
      data_inicio: contrato.data_inicio,
      data_fim: contrato.data_fim || '',
      observacoes: contrato.observacoes || '',
    } : FORM_VAZIO_CONTRATO);
    setModal('editar');
  }

  async function salvar() {
    if (!formLoc.nome.trim() || !formCont.valor_mensal || !formCont.data_inicio) {
      toast.erro('Preencha nome, valor mensal e data de início.');
      return;
    }
    setSalvando(true);
    try {
      let locId = locatarioSelecionado?.id;
      if (!locId) {
        const { data, error } = await supabase.from('locatarios').insert({ salao_id: perfil.salao_id, ...formLoc }).select().single();
        if (error) throw error;
        locId = data.id;
      } else {
        await supabase.from('locatarios').update(formLoc).eq('id', locId);
        // Encerra contrato anterior se valor ou estação mudou
        await supabase.from('contratos_aluguel').update({ ativo: false }).eq('locatario_id', locId).eq('ativo', true);
      }
      const { error: errCont } = await supabase.from('contratos_aluguel').insert({
        salao_id: perfil.salao_id,
        locatario_id: locId,
        numero_estacao: formCont.numero_estacao || null,
        valor_mensal: Number(formCont.valor_mensal),
        dia_vencimento: Number(formCont.dia_vencimento),
        data_inicio: formCont.data_inicio,
        data_fim: formCont.data_fim || null,
        observacoes: formCont.observacoes || null,
        ativo: true,
      });
      if (errCont) throw errCont;
      toast.sucesso(locatarioSelecionado ? 'Contrato atualizado!' : 'Locatário e contrato criados!');
      setModal(null);
      carregar();
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    }
    setSalvando(false);
  }

  async function toggleAtivo(loc: any) {
    await supabase.from('locatarios').update({ ativo: !loc.ativo }).eq('id', loc.id);
    if (loc.ativo) await supabase.from('contratos_aluguel').update({ ativo: false }).eq('locatario_id', loc.id).eq('ativo', true);
    carregar();
  }

  const ativos = locatarios.filter(l => l.ativo);
  const inativos = locatarios.filter(l => !l.ativo);
  const totalMensal = contratos.filter(c => c.ativo).reduce((a, c) => a + Number(c.valor_mensal), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {[
          { label: 'Locatários Ativos', valor: String(ativos.length), icon: <FiUser size={18} /> },
          { label: 'Receita Mensal Contratada', valor: brl(totalMensal), icon: <FiDollarSign size={18} /> },
          { label: 'Valor Sugerido pela Calculadora', valor: custoCalculado ? brl(custoCalculado) : '—', icon: <FiInfo size={18} /> },
        ].map((card, i) => (
          <div key={i} style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.sidebarBg, flexShrink: 0 }}>{card.icon}</div>
            <div><p style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>{card.label}</p><p style={{ fontFamily: FONTE_TITULO, fontSize: 18, fontWeight: 800, color: C.textMain, margin: 0 }}>{card.valor}</p></div>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 800, color: C.textMain, margin: 0 }}>Locatários e Contratos</h3>
          <button onClick={abrirNovo} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>
            <FiPlus size={14} /> Novo Locatário
          </button>
        </div>

        {locatarios.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textLight }}>
            <FiUser size={32} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13, margin: 0 }}>Nenhum locatário cadastrado ainda.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...ativos, ...inativos].map(loc => {
            const contrato = contratos.find(c => c.locatario_id === loc.id && c.ativo);
            return (
              <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: loc.ativo ? C.bg : '#fafafa', border: `1px solid ${C.border}`, opacity: loc.ativo ? 1 : 0.6 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: loc.ativo ? C.sidebarBg : C.borderMid, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                  {loc.nome.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 700, color: C.textMain, margin: '0 0 2px' }}>{loc.nome}</p>
                  <p style={{ fontSize: 11, color: C.textLight, margin: 0 }}>
                    {loc.especialidade && <span>{loc.especialidade} · </span>}
                    {loc.telefone && <span>{loc.telefone}</span>}
                  </p>
                </div>
                {contrato && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: FONTE_TITULO, fontSize: 14, fontWeight: 800, color: C.success, margin: '0 0 2px' }}>{brl(Number(contrato.valor_mensal))}<span style={{ fontSize: 10, fontWeight: 400, color: C.textLight }}>/mês</span></p>
                    <p style={{ fontSize: 11, color: C.textLight, margin: 0 }}>
                      {contrato.numero_estacao && `Estação ${contrato.numero_estacao} · `}Vence dia {contrato.dia_vencimento}
                    </p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => abrirEditar(loc)} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMain }}>
                    <FiEdit2 size={13} />
                  </button>
                  <button onClick={() => toggleAtivo(loc)} title={loc.ativo ? 'Desativar' : 'Reativar'} style={{ background: loc.ativo ? C.dangerBg : C.successBg, border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: loc.ativo ? C.danger : C.success }}>
                    {loc.ativo ? <FiToggleRight size={15} /> : <FiToggleLeft size={15} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, padding: 28, boxShadow: '0 25px 50px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', borderTop: `4px solid ${C.sidebarBg}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 15, fontWeight: 800, color: C.textMain, margin: 0 }}>{modal === 'novo' ? 'Novo Locatário' : 'Editar Locatário'}</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}><FiX size={20} /></button>
            </div>

            <p style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.douradoLuarys, textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 12px' }}>Dados do Profissional</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Nome Completo *</label><input style={inp} value={formLoc.nome} onChange={e => setFormLoc(p => ({ ...p, nome: e.target.value }))} /></div>
              <div><label style={lbl}>CPF</label><input style={inp} placeholder="000.000.000-00" value={formLoc.cpf} onChange={e => setFormLoc(p => ({ ...p, cpf: e.target.value }))} /></div>
              <div><label style={lbl}>Telefone</label><input style={inp} placeholder="(00) 90000-0000" value={formLoc.telefone} onChange={e => setFormLoc(p => ({ ...p, telefone: e.target.value }))} /></div>
              <div><label style={lbl}>E-mail</label><input style={inp} type="email" value={formLoc.email} onChange={e => setFormLoc(p => ({ ...p, email: e.target.value }))} /></div>
              <div><label style={lbl}>Especialidade</label><input style={inp} placeholder="Ex: Cabeleireira, Manicure..." value={formLoc.especialidade} onChange={e => setFormLoc(p => ({ ...p, especialidade: e.target.value }))} /></div>
            </div>

            <p style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.douradoLuarys, textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 12px' }}>Contrato de Aluguel</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div><label style={lbl}>Valor Mensal (R$) *</label><input type="number" min={0} step="0.01" style={inp} placeholder="0,00" value={formCont.valor_mensal} onChange={e => setFormCont(p => ({ ...p, valor_mensal: e.target.value }))} /></div>
              <div><label style={lbl}>Dia de Vencimento *</label><input type="number" min={1} max={28} style={inp} value={formCont.dia_vencimento} onChange={e => setFormCont(p => ({ ...p, dia_vencimento: e.target.value }))} /></div>
              <div><label style={lbl}>Nº da Estação / Cadeira</label><input style={inp} placeholder="Ex: 01, A, Cadeira 3..." value={formCont.numero_estacao} onChange={e => setFormCont(p => ({ ...p, numero_estacao: e.target.value }))} /></div>
              <div><label style={lbl}>Data de Início *</label><input type="date" style={inp} value={formCont.data_inicio} onChange={e => setFormCont(p => ({ ...p, data_inicio: e.target.value }))} /></div>
              <div><label style={lbl}>Data de Término (opcional)</label><input type="date" style={inp} value={formCont.data_fim} onChange={e => setFormCont(p => ({ ...p, data_fim: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Observações</label><textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }} value={formCont.observacoes} onChange={e => setFormCont(p => ({ ...p, observacoes: e.target.value }))} /></div>
            </div>

            {custoCalculado && (
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: '#1D4ED8', margin: 0 }}>
                  Valor sugerido pela calculadora: <strong>{brl(custoCalculado)}/mês</strong>
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.textMain, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
