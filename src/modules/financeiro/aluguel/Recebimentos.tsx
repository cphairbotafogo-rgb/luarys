'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { FiCheckCircle, FiClock, FiAlertCircle, FiX, FiChevronLeft, FiChevronRight, FiPrinter, FiAlertTriangle } from 'react-icons/fi';
import { FONTE_TITULO } from '@/lib/estiloGlobal';

const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: '#fff', boxSizing: 'border-box' as const };
const lbl = { fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.textMuted, display: 'block' as const, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.5px' };

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const FORMAS = ['PIX', 'Dinheiro', 'Cartão de Débito', 'Cartão de Crédito', 'Transferência', 'Outro'];

function primeiroDiaMes(ano: number, mes: number) { return `${ano}-${String(mes + 1).padStart(2, '0')}-01`; }
function fmtData(iso: string) { return iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : ''; }

export function Recebimentos({ perfil }: { perfil: any }) {
  const toast = useToast();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [contratos, setContratos] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [salaoData, setSalaoData] = useState<any>(null);
  const [modalPag, setModalPag] = useState<any | null>(null);
  const [modalRecibo, setModalRecibo] = useState<{ contrato: any; pag: any } | null>(null);
  const [formPag, setFormPag] = useState({ data_pagamento: hoje.toISOString().split('T')[0], forma_pagamento: 'PIX', observacao: '' });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { carregar(); }, [perfil?.salao_id, ano, mes]);

  async function carregar() {
    if (!perfil?.salao_id) return;
    const mesRef = primeiroDiaMes(ano, mes);
    const [{ data: conts }, { data: pags }, { data: salao }] = await Promise.all([
      supabase.from('contratos_aluguel').select('*, locatarios(*)').eq('salao_id', perfil.salao_id).eq('ativo', true),
      supabase.from('pagamentos_aluguel').select('*').eq('salao_id', perfil.salao_id).eq('mes_referencia', mesRef),
      supabase.from('saloes').select('nome_fantasia, cnpj, endereco, bairro, cidade, estado, telefone').eq('id', perfil.salao_id).maybeSingle(),
    ]);
    setContratos(conts || []);
    setPagamentos(pags || []);
    setSalaoData(salao);
  }

  function getPagamento(contratoId: string) {
    return pagamentos.find(p => p.contrato_id === contratoId);
  }

  function statusPagamento(contrato: any) {
    const pag = getPagamento(contrato.id);
    if (pag?.status === 'pago') return 'pago';
    const vencimento = new Date(ano, mes, contrato.dia_vencimento);
    if (vencimento < hoje) return 'atrasado';
    return 'pendente';
  }

  function abrirModalPagamento(contrato: any) {
    setModalPag(contrato);
    setFormPag({ data_pagamento: hoje.toISOString().split('T')[0], forma_pagamento: 'PIX', observacao: '' });
  }

  async function registrarPagamento() {
    if (!modalPag) return;
    setSalvando(true);
    const mesRef = primeiroDiaMes(ano, mes);
    try {
      const { error } = await supabase.from('pagamentos_aluguel').upsert({
        salao_id: perfil.salao_id,
        contrato_id: modalPag.id,
        mes_referencia: mesRef,
        valor: modalPag.valor_mensal,
        data_pagamento: formPag.data_pagamento,
        status: 'pago',
        forma_pagamento: formPag.forma_pagamento,
        observacao: formPag.observacao || null,
        lancado_no_financeiro: false,
      }, { onConflict: 'contrato_id,mes_referencia' });

      if (error) throw error;

      await supabase.from('financeiro').insert({
        salao_id: perfil.salao_id,
        tipo: 'entrada',
        descricao: `Aluguel de Estação — ${modalPag.locatarios?.nome} (${MESES[mes]}/${ano})`,
        categoria: 'Aluguel de Estação',
        tipo_custo: 'Fixo',
        valor: modalPag.valor_mensal,
        data_movimentacao: formPag.data_pagamento,
        forma_pagamento: formPag.forma_pagamento,
        status: 'Pago',
      });

      await supabase.from('pagamentos_aluguel').update({ lancado_no_financeiro: true }).eq('contrato_id', modalPag.id).eq('mes_referencia', mesRef);

      toast.sucesso('Pagamento registrado e lançado no financeiro!');
      setModalPag(null);
      carregar();
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    }
    setSalvando(false);
  }

  async function estornarPagamento(contrato: any) {
    const pag = getPagamento(contrato.id);
    if (!pag) return;
    await supabase.from('pagamentos_aluguel').update({ status: 'pendente', data_pagamento: null, forma_pagamento: null }).eq('id', pag.id);
    toast.sucesso('Pagamento estornado.');
    carregar();
  }

  function navegarMes(dir: 1 | -1) {
    let novoMes = mes + dir;
    let novoAno = ano;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    if (novoMes > 11) { novoMes = 0; novoAno++; }
    setMes(novoMes); setAno(novoAno);
  }

  function imprimirRecibo() {
    if (!modalRecibo) return;
    const { contrato, pag } = modalRecibo;
    const loc = contrato.locatarios;
    const enderecoSalao = [salaoData?.endereco, salaoData?.bairro, salaoData?.cidade, salaoData?.estado].filter(Boolean).join(', ');
    const numeroRecibo = `${ano}${String(mes + 1).padStart(2, '0')}-${contrato.id.substring(0, 6).toUpperCase()}`;

    const janela = window.open('', '_blank');
    if (!janela) return;
    janela.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Recibo de Aluguel — ${loc?.nome}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; font-size: 14px; color: #000; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 20px; text-align: center; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 4px; }
        .subtitulo { text-align: center; font-size: 12px; color: #555; margin-bottom: 30px; }
        .numero { text-align: right; font-size: 12px; margin-bottom: 20px; }
        .bloco { border: 1px solid #ccc; border-radius: 4px; padding: 16px; margin-bottom: 16px; }
        .bloco h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
        .linha { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
        .linha span:first-child { color: #555; }
        .linha span:last-child { font-weight: bold; }
        .valor-total { background: #f5f5f5; border-radius: 4px; padding: 16px; text-align: center; margin: 20px 0; }
        .valor-total p { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 6px; }
        .valor-total strong { font-size: 28px; }
        .aviso { border: 2px solid #f59e0b; border-radius: 4px; padding: 14px 16px; margin: 20px 0; background: #fffbeb; }
        .aviso h4 { font-size: 12px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .aviso p { font-size: 11px; color: #78350f; line-height: 1.6; }
        .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
        .assinatura { text-align: center; }
        .assinatura .linha-assinatura { border-top: 1px solid #000; padding-top: 8px; margin-top: 40px; font-size: 12px; }
        .rodape { text-align: center; font-size: 10px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 14px; }
        @media print { body { padding: 20mm; } }
      </style>
    </head><body>
      <h1>Recibo de Aluguel de Estação</h1>
      <p class="subtitulo">Documento para controle interno — não substitui nota fiscal</p>
      <p class="numero">Nº ${numeroRecibo}</p>

      <div class="bloco">
        <h3>Estabelecimento (Locador)</h3>
        <div class="linha"><span>Nome</span><span>${salaoData?.nome_fantasia || ''}</span></div>
        <div class="linha"><span>CNPJ</span><span>${salaoData?.cnpj || 'Não informado'}</span></div>
        <div class="linha"><span>Endereço</span><span>${enderecoSalao || 'Não informado'}</span></div>
        ${salaoData?.telefone ? `<div class="linha"><span>Telefone</span><span>${salaoData.telefone}</span></div>` : ''}
      </div>

      <div class="bloco">
        <h3>Profissional (Locatário)</h3>
        <div class="linha"><span>Nome</span><span>${loc?.nome || ''}</span></div>
        <div class="linha"><span>CPF</span><span>${loc?.cpf || 'Não informado'}</span></div>
        ${loc?.telefone ? `<div class="linha"><span>Telefone</span><span>${loc.telefone}</span></div>` : ''}
        ${loc?.especialidade ? `<div class="linha"><span>Especialidade</span><span>${loc.especialidade}</span></div>` : ''}
      </div>

      <div class="bloco">
        <h3>Detalhes do Aluguel</h3>
        ${contrato.numero_estacao ? `<div class="linha"><span>Estação / Cadeira</span><span>Nº ${contrato.numero_estacao}</span></div>` : ''}
        <div class="linha"><span>Referência</span><span>${MESES[mes]} de ${ano}</span></div>
        <div class="linha"><span>Data do Pagamento</span><span>${fmtData(pag.data_pagamento)}</span></div>
        <div class="linha"><span>Forma de Pagamento</span><span>${pag.forma_pagamento || ''}</span></div>
        ${pag.observacao ? `<div class="linha"><span>Observação</span><span>${pag.observacao}</span></div>` : ''}
      </div>

      <div class="valor-total">
        <p>Valor Recebido</p>
        <strong>${brl(Number(pag.valor))}</strong>
      </div>

      <div class="aviso">
        <h4>⚠️ Aviso Legal Importante</h4>
        <p>
          O aluguel de cadeira/estação envolve aspectos legais e tributários que variam conforme a natureza jurídica
          do estabelecimento, o município e a forma de formalização da relação entre as partes.
          O STF (Súmula Vinculante 31) determina que ISS não incide sobre locação de bens móveis, porém
          a interpretação pode variar. <strong>Recomendamos fortemente que o empresário consulte um advogado
          especializado em direito trabalhista e tributário antes de formalizar contratos de aluguel de estação</strong>,
          a fim de evitar riscos de reconhecimento de vínculo empregatício ou autuações fiscais.
          Este recibo é um documento de controle interno e não substitui nota fiscal, contrato registrado
          ou qualquer outro instrumento legal exigível.
        </p>
      </div>

      <div class="assinaturas">
        <div class="assinatura">
          <div class="linha-assinatura">
            <strong>${salaoData?.nome_fantasia || 'Locador'}</strong><br>
            <span style="font-size:11px;color:#666;">Estabelecimento</span>
          </div>
        </div>
        <div class="assinatura">
          <div class="linha-assinatura">
            <strong>${loc?.nome || 'Locatário'}</strong><br>
            <span style="font-size:11px;color:#666;">Profissional Autônomo</span>
          </div>
        </div>
      </div>

      <div class="rodape">
        Gerado pelo sistema Luarys em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} •
        Este documento não tem valor fiscal. Consulte seu advogado ou contador.
      </div>

      <script>window.onload = function() { window.print(); }</script>
    </body></html>`);
    janela.document.close();
  }

  const totalEsperado = contratos.reduce((a, c) => a + Number(c.valor_mensal), 0);
  const totalRecebido = pagamentos.filter(p => p.status === 'pago').reduce((a, p) => a + Number(p.valor), 0);
  const totalPendente = totalEsperado - totalRecebido;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Aviso legal permanente */}
      <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderLeft: `4px solid ${C.warning}`, borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <FiAlertTriangle size={18} color={C.warning} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontFamily: FONTE_TITULO, fontSize: 12, fontWeight: 800, color: '#92400E', margin: '0 0 4px' }}>Consulte um advogado antes de formalizar contratos de aluguel de estação</p>
          <p style={{ fontSize: 12, color: '#78350F', margin: 0, lineHeight: 1.6 }}>
            O modelo de aluguel de cadeira envolve aspectos tributários e trabalhistas sensíveis. Dependendo de como é formalizado, pode haver risco de reconhecimento de vínculo empregatício ou exigência fiscal por parte do município. Um advogado especializado garante segurança jurídica para o seu negócio.
          </p>
        </div>
      </div>

      {/* Navegador de mês */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button onClick={() => navegarMes(-1)} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMain }}>
          <FiChevronLeft size={16} />
        </button>
        <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 16, fontWeight: 800, color: C.textMain, margin: 0, minWidth: 180, textAlign: 'center' }}>
          {MESES[mes]} {ano}
        </h3>
        <button onClick={() => navegarMes(1)} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMain }}>
          <FiChevronRight size={16} />
        </button>
      </div>

      {/* Resumo do mês */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {[
          { label: 'Esperado no Mês', valor: brl(totalEsperado), cor: C.textMain, bg: C.bgCard },
          { label: 'Recebido', valor: brl(totalRecebido), cor: C.success, bg: C.successBg },
          { label: 'Pendente / Atrasado', valor: brl(totalPendente), cor: totalPendente > 0 ? C.danger : C.success, bg: totalPendente > 0 ? C.dangerBg : C.successBg },
        ].map((card, i) => (
          <div key={i} style={{ background: card.bg, borderRadius: 12, border: `1px solid ${C.border}`, padding: '16px 18px' }}>
            <p style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>{card.label}</p>
            <p style={{ fontFamily: FONTE_TITULO, fontSize: 22, fontWeight: 800, color: card.cor, margin: 0 }}>{card.valor}</p>
          </div>
        ))}
      </div>

      {/* Lista de cobranças */}
      <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
        <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 800, color: C.textMain, margin: '0 0 16px' }}>Cobranças — {MESES[mes]}/{ano}</h3>

        {contratos.length === 0 && (
          <p style={{ textAlign: 'center', color: C.textLight, fontSize: 13, padding: '24px 0' }}>Nenhum contrato ativo. Cadastre locatários na aba Contratos.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contratos.map(cont => {
            const status = statusPagamento(cont);
            const pag = getPagamento(cont.id);
            const statusConfig = {
              pago:     { label: 'Pago',     cor: C.success, bg: C.successBg, icon: <FiCheckCircle size={14} /> },
              pendente: { label: 'Pendente', cor: C.warning, bg: C.warningBg, icon: <FiClock size={14} /> },
              atrasado: { label: 'Atrasado', cor: C.danger,  bg: C.dangerBg,  icon: <FiAlertCircle size={14} /> },
            }[status];

            return (
              <div key={cont.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 700, color: C.textMain, margin: '0 0 2px' }}>{cont.locatarios?.nome}</p>
                  <p style={{ fontSize: 11, color: C.textLight, margin: 0 }}>
                    {cont.locatarios?.especialidade && `${cont.locatarios.especialidade} · `}
                    {cont.numero_estacao && `Estação ${cont.numero_estacao} · `}
                    Vence dia {cont.dia_vencimento}
                    {pag?.data_pagamento && ` · Pago em ${fmtData(pag.data_pagamento)}`}
                  </p>
                </div>
                <p style={{ fontFamily: FONTE_TITULO, fontSize: 15, fontWeight: 800, color: C.textMain, margin: 0 }}>{brl(Number(cont.valor_mensal))}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: statusConfig.bg, color: statusConfig.cor, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                  {statusConfig.icon} {statusConfig.label}
                </div>
                {status !== 'pago' ? (
                  <button onClick={() => abrirModalPagamento(cont)} style={{ background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO, whiteSpace: 'nowrap' }}>
                    Registrar Pagamento
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setModalRecibo({ contrato: cont, pag })} style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.bg, color: C.sidebarBg, border: `1px solid ${C.sidebarBg}`, borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>
                      <FiPrinter size={12} /> Recibo
                    </button>
                    <button onClick={() => estornarPagamento(cont)} style={{ background: 'none', color: C.textLight, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONTE_TITULO }}>
                      Estornar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de pagamento */}
      {modalPag && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 28, boxShadow: '0 25px 50px rgba(0,0,0,0.2)', borderTop: `4px solid ${C.success}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 15, fontWeight: 800, color: C.textMain, margin: 0 }}>Registrar Pagamento</h3>
              <button onClick={() => setModalPag(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}><FiX size={20} /></button>
            </div>
            <div style={{ background: C.bg, borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
              <p style={{ fontFamily: FONTE_TITULO, fontSize: 13, fontWeight: 700, color: C.textMain, margin: '0 0 2px' }}>{modalPag.locatarios?.nome}</p>
              <p style={{ fontSize: 12, color: C.textLight, margin: 0 }}>{MESES[mes]}/{ano} · <strong style={{ color: C.success }}>{brl(Number(modalPag.valor_mensal))}</strong></p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div><label style={lbl}>Data do Pagamento</label><input type="date" style={inp} value={formPag.data_pagamento} onChange={e => setFormPag(p => ({ ...p, data_pagamento: e.target.value }))} /></div>
              <div>
                <label style={lbl}>Forma de Pagamento</label>
                <select style={inp} value={formPag.forma_pagamento} onChange={e => setFormPag(p => ({ ...p, forma_pagamento: e.target.value }))}>
                  {FORMAS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Observação (opcional)</label><input style={inp} value={formPag.observacao} onChange={e => setFormPag(p => ({ ...p, observacao: e.target.value }))} /></div>
            </div>
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 12px', marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: '#1D4ED8', margin: 0 }}>O pagamento será automaticamente lançado como receita no módulo Financeiro.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalPag(null)} style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.textMain, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>Cancelar</button>
              <button onClick={registrarPagamento} disabled={salvando} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: C.success, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>
                {salvando ? 'Registrando...' : 'Confirmar Recebimento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de recibo */}
      {modalRecibo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 28, boxShadow: '0 25px 50px rgba(0,0,0,0.2)', borderTop: `4px solid ${C.douradoLuarys}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: FONTE_TITULO, fontSize: 15, fontWeight: 800, color: C.textMain, margin: 0 }}>Recibo de Aluguel</h3>
              <button onClick={() => setModalRecibo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}><FiX size={20} /></button>
            </div>

            {/* Preview resumido */}
            <div style={{ background: C.bg, borderRadius: 10, padding: 16, marginBottom: 16, fontSize: 13, color: C.textMain, lineHeight: 1.7 }}>
              <p><strong>{modalRecibo.contrato.locatarios?.nome}</strong></p>
              <p style={{ color: C.textLight, fontSize: 12 }}>
                {modalRecibo.contrato.numero_estacao && `Estação ${modalRecibo.contrato.numero_estacao} · `}
                {MESES[mes]}/{ano} · Pago em {fmtData(modalRecibo.pag?.data_pagamento)}
              </p>
              <p style={{ fontFamily: FONTE_TITULO, fontSize: 20, fontWeight: 800, color: C.success, marginTop: 8 }}>{brl(Number(modalRecibo.pag?.valor))}</p>
            </div>

            {/* Aviso legal */}
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
              <p style={{ fontFamily: FONTE_TITULO, fontSize: 11, fontWeight: 800, color: '#92400E', margin: '0 0 4px' }}>⚠️ Aviso legal incluído no recibo</p>
              <p style={{ fontSize: 11, color: '#78350F', margin: 0, lineHeight: 1.5 }}>
                O recibo impresso contém um aviso recomendando consulta a advogado especializado antes de formalizar contratos de aluguel de estação.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalRecibo(null)} style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.textMain, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>Fechar</button>
              <button onClick={imprimirRecibo} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 8, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE_TITULO }}>
                <FiPrinter size={14} /> Imprimir / Salvar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
