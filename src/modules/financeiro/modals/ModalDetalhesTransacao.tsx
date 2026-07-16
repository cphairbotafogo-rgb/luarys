'use client'
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl } from '@/lib/constants';
import { RAIO_SM, RAIO_MD, RAIO_LG, RAIO_XL, RAIO_2XL, SOMBRA_MODAL, overlayModal, containerModal, inputAdmin, labelPadrao } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import {
  FiX, FiEdit3, FiAlertTriangle, FiCheck, FiCheckCircle,
  FiPrinter, FiCalendar, FiLock, FiTrash2
} from 'react-icons/fi';

type Modo = 'ver' | 'editar' | 'estornar' | 'excluir' | 'pagar';

const CORES_BANDEIRA: Record<string, { bg: string; color: string }> = {
  'Visa':             { bg: '#1A1F71', color: '#fff'    },
  'Visa Electron':    { bg: '#1A1F71', color: '#FFD700' },
  'Mastercard':       { bg: '#EB001B', color: '#fff'    },
  'Maestro':          { bg: '#007DBA', color: '#fff'    },
  'Elo':              { bg: '#FFE000', color: '#1A1F71' },
  'American Express': { bg: '#007BC1', color: '#fff'    },
  'Hipercard':        { bg: '#B22222', color: '#fff'    },
  'Diners Club':      { bg: '#004A97', color: '#fff'    },
  'Cabal':            { bg: '#003087', color: '#fff'    },
};

export function ModalDetalhesTransacao({ transacao, onClose, aoAtualizar, perfil }: any) {
  const toast   = useToast();
  const [modo,     setModo]    = useState<Modo>('ver');
  const [salvando, setSalvando] = useState(false);

  const [novaData,           setNovaData]           = useState(transacao.data_movimentacao?.split('T')[0] || '');
  const [novaFormaPagamento, setNovaFormaPagamento] = useState(transacao.forma_pagamento || transacao.metodo_pagamento || 'PIX');
  const [dataPagamento,      setDataPagamento]      = useState(new Date().toISOString().split('T')[0]);
  const [formaPagar,         setFormaPagar]         = useState(transacao.forma_pagamento || 'PIX');
  const [novaDescricao,      setNovaDescricao]      = useState(transacao.descricao || '');
  const [novaCategoria,      setNovaCategoria]      = useState(transacao.categoria || '');
  const [novoValor,          setNovoValor]          = useState(String(transacao.valor || ''));
  const [motivoEstorno,      setMotivoEstorno]      = useState('');
  const [pinEstorno,         setPinEstorno]         = useState('');
  const [pinExclusao,        setPinExclusao]        = useState('');

  const isEntrada   = transacao.tipo === 'entrada';
  const isEstornado = transacao.status === 'Estornado';
  const tabela      = (transacao.categoria || '').includes('Fixos') || (transacao.categoria || '').includes('Insumos')
    ? 'despesas' : 'financeiro';

  async function salvarEdicao() {
    if (!novaDescricao.trim()) { toast.aviso('Descrição obrigatória.'); return; }
    const valorNum = parseFloat(novoValor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) { toast.aviso('Valor deve ser maior que zero.'); return; }
    setSalvando(true);
    try {
      const payload: any = {
        forma_pagamento: novaFormaPagamento,
        descricao: novaDescricao.trim(),
        categoria: novaCategoria,
        valor: valorNum,
      };
      if (tabela === 'financeiro') payload.data_movimentacao = new Date(novaData + 'T12:00:00Z').toISOString();
      else payload.data_pagamento = novaData;
      const { error } = await supabase.from(tabela).update(payload).eq('id', transacao.id);
      if (error) throw error;
      toast.sucesso('Lançamento atualizado com sucesso!');
      aoAtualizar(); onClose();
    } catch (err: any) {
      toast.erro('Erro ao atualizar: ' + err.message);
    } finally { setSalvando(false); }
  }

  async function confirmarPagamento() {
    setSalvando(true);
    try {
      const payload: any = { status: 'Pago', forma_pagamento: formaPagar };
      if (tabela === 'financeiro') payload.data_movimentacao = new Date(dataPagamento + 'T12:00:00Z').toISOString();
      else payload.data_pagamento = dataPagamento;
      const { error } = await supabase.from(tabela).update(payload).eq('id', transacao.id);
      if (error) throw error;
      toast.sucesso('Pagamento confirmado! Baixa registrada com sucesso.');
      aoAtualizar(); onClose();
    } catch (err: any) {
      toast.erro('Erro ao confirmar pagamento: ' + err.message);
    } finally { setSalvando(false); }
  }

  async function confirmarExclusao() {
    const { data: sl, error: erroSl } = await supabase.from('saloes').select('pin_gerente').eq('id', perfil?.salao_id).maybeSingle();
    if (erroSl || !sl) { toast.erro('Não foi possível verificar permissão. Tente novamente.'); return; }
    if (sl.pin_gerente && pinExclusao !== sl.pin_gerente) {
      toast.erro('PIN incorreto.'); return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.from(tabela).delete().eq('id', transacao.id);
      if (error) throw error;
      toast.sucesso('Lançamento excluído.');
      aoAtualizar(); onClose();
    } catch (err: any) {
      toast.erro('Erro ao excluir: ' + err.message);
    } finally { setSalvando(false); }
  }

  async function confirmarEstorno() {
    if (!motivoEstorno.trim()) { toast.aviso('Informe o motivo do estorno.'); return; }
    const { data: sl, error: erroSl } = await supabase.from('saloes').select('pin_gerente').eq('id', perfil?.salao_id).maybeSingle();
    if (erroSl || !sl) { toast.erro('Não foi possível verificar permissão. Tente novamente.'); return; }
    if (!sl.pin_gerente) {
      toast.erro('PIN de gerente não configurado. Acesse Configurações para definir um PIN.');
      return;
    }
    if (pinEstorno !== sl.pin_gerente) {
      toast.erro('PIN incorreto. Apenas gerentes podem estornar.'); return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.from(tabela).update({
        status: 'Estornado',
        descricao: `[ESTORNADO] ${transacao.descricao}`,
        comentario: `Motivo: ${motivoEstorno} | Em: ${new Date().toLocaleString('pt-BR')}`,
      }).eq('id', transacao.id);
      if (error) throw error;

      // Cancelar NFS-e vinculada ao lançamento, se houver e estiver emitida
      if (tabela === 'financeiro' && isEntrada) {
        try {
          const { data: notaVinculada } = await supabase
            .from('notas_fiscais')
            .select('id, status')
            .eq('financeiro_id', transacao.id)
            .eq('salao_id', perfil?.salao_id)
            .maybeSingle();

          if (notaVinculada?.status === 'Emitida') {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              await fetch(`/api/nfse/cancelar/${notaVinculada.id}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ justificativa: `Estorno: ${motivoEstorno}` }),
              });
              toast.aviso('NFS-e vinculada cancelada automaticamente.');
            }
          }
        } catch {
          // falha silenciosa — não bloqueia o estorno
        }
      }

      toast.sucesso('Estorno realizado com sucesso.');
      aoAtualizar(); onClose();
    } catch (err: any) {
      toast.erro('Erro ao estornar: ' + err.message);
    } finally { setSalvando(false); }
  }

  function abrirRecibo() {
    window.print();
  }

  const inp = inputAdmin;
  const lbl = labelPadrao;

  const bandeira    = transacao.bandeira_cartao || ((transacao.forma_pagamento || '').includes(' - ') ? (transacao.forma_pagamento || '').split(' - ').pop() : null);
  const corBandeira = bandeira ? CORES_BANDEIRA[bandeira] : null;

  return (
    <div className="font-body" style={{ ...overlayModal, zIndex: 9999 }}>
      <div style={{ ...containerModal, width: '100%', maxWidth: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* CABEÇALHO */}
        <div style={{ background: isEstornado ? '#FEF2F2' : '#F8FAFC', padding: 24, borderBottom: `1px solid ${C.border}`, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: C.textLight, cursor: 'pointer' }}><FiX size={22} /></button>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <span className="font-title" style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Detalhes do Lançamento</span>
            <h2 className="font-title" style={{ margin: '8px 0', fontSize: 30, fontWeight: 800, color: isEstornado ? C.textMuted : (isEntrada ? '#10B981' : '#EF4444'), textDecoration: isEstornado ? 'line-through' : 'none' }}>
              {isEntrada ? '+' : '-'} {brl(transacao.valor)}
            </h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: isEstornado ? '#FECACA' : (transacao.status === 'Pago' ? '#D1FAE5' : '#FEF3C7'), color: isEstornado ? '#991B1B' : (transacao.status === 'Pago' ? '#065F46' : '#92400E'), padding: '4px 12px', borderRadius: RAIO_XL, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                {transacao.status}
              </span>
              {bandeira && corBandeira && (
                <span style={{ background: corBandeira.bg, color: corBandeira.color, padding: '4px 10px', borderRadius: RAIO_SM, fontSize: 11, fontWeight: 800 }}>{bandeira}</span>
              )}
            </div>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div>
            <span style={lbl}>Descrição / Origem</span>
            <strong style={{ fontSize: 14, color: C.sidebarBg }}>{transacao.descricao}</strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><span style={lbl}>Categoria</span><span style={{ fontSize: 13, color: C.textMain, fontWeight: 500 }}>{transacao.categoria || '—'}</span></div>
            <div><span style={lbl}>Profissional</span><span style={{ fontSize: 13, color: C.textMain, fontWeight: 600 }}>{transacao.profissional_nome || '—'}</span></div>
          </div>

          <hr style={{ border: 'none', borderTop: `1px dashed ${C.borderMid}` }} />

          {/* MODO VER */}
          {modo === 'ver' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><span style={lbl}>Data da Movimentação</span><span style={{ fontSize: 13, color: C.textMain, fontWeight: 600 }}>{novaData ? new Date(novaData + 'T12:00:00Z').toLocaleDateString('pt-BR') : '—'}</span></div>
              <div>
                <span style={lbl}>Forma de Pagamento</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, color: C.textMain, fontWeight: 600 }}>{novaFormaPagamento || '—'}</span>
                  {/* Bandeira: campo direto OU extraída da forma OU do comentário */}
                  {(() => {
                    const b = transacao.bandeira_cartao
                      || (novaFormaPagamento.includes(' - ') ? novaFormaPagamento.split(' - ').pop() : null)
                      || (() => {
                        // Tentar extrair do comentário (ex: "bandeira: Maestro")
                        const match = (transacao.comentario || '').match(/bandeira[:\s]+([A-Za-z\s]+)/i);
                        return match ? match[1].trim() : null;
                      })();
                    if (!b) return null;
                    const cor = CORES_BANDEIRA[b] || { bg: '#6B7280', color: '#fff' };
                    return (
                      <span style={{ display: 'inline-block', background: cor.bg, color: cor.color, padding: '3px 10px', borderRadius: RAIO_SM, fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', width: 'fit-content' }}>
                        {b}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* MODO EDITAR */}
          {modo === 'editar' && (
            <div style={{ background: '#F0F9FF', padding: 16, borderRadius: RAIO_LG, border: '1px solid #BAE6FD', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiEdit3 size={14} color="#0284C7" />
                <span className="font-title" style={{ fontSize: 11, fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Editar Lançamento</span>
              </div>
              <div>
                <span style={lbl}>Descrição *</span>
                <input style={inp} value={novaDescricao} onChange={e => setNovaDescricao(e.target.value)} placeholder="Descrição do lançamento" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={lbl}>Valor (R$) *</span>
                  <input type="number" min="0.01" step="0.01" style={inp} value={novoValor} onChange={e => setNovoValor(e.target.value)} />
                </div>
                <div>
                  <span style={lbl}>Data *</span>
                  <input type="date" style={inp} value={novaData} onChange={e => setNovaData(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={lbl}>Categoria</span>
                  <select style={inp} value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)}>
                    <option value="Serviços Prestados">Serviços Prestados</option>
                    <option value="Venda de Produtos">Venda de Produtos</option>
                    <option value="Comissões Pagas">Comissões Pagas</option>
                    <option value="Aluguel">Aluguel</option>
                    <option value="Água/Luz/Internet">Água/Luz/Internet</option>
                    <option value="Despesas Fixas">Despesas Fixas</option>
                    <option value="Impostos / Taxas">Impostos / Taxas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <span style={lbl}>Forma de Pagamento</span>
                  <select style={inp} value={novaFormaPagamento} onChange={e => setNovaFormaPagamento(e.target.value)}>
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* MODO PAGAR */}
          {modo === 'pagar' && (
            <div style={{ background: '#F0FDF4', padding: 16, borderRadius: RAIO_LG, border: '1px solid #86EFAC', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiCheckCircle size={16} color="#16A34A" />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#16A34A', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Confirmar Pagamento</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={lbl}>Data do Pagamento *</span>
                  <input type="date" style={inp} value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
                </div>
                <div>
                  <span style={lbl}>Forma de Pagamento *</span>
                  <select style={inp} value={formaPagar} onChange={e => setFormaPagar(e.target.value)}>
                    <option value="PIX">PIX</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Transferência">Transferência</option>
                    <option value="TED/DOC">TED/DOC</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#166534', lineHeight: 1.6 }}>
                O lançamento será marcado como <strong>Pago</strong>, a data de pagamento e a forma serão registradas.
              </p>
            </div>
          )}

          {/* MODO EXCLUIR */}
          {modo === 'excluir' && (
            <div style={{ background: '#FFF7ED', padding: 16, borderRadius: RAIO_LG, border: '1px dashed #FD8C00', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiTrash2 size={16} color="#C2410C" />
                <span className="font-title" style={{ fontSize: 11, fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Excluir Lançamento Permanentemente</span>
              </div>
              <p style={{ fontSize: 12, color: '#9A3412', margin: 0, lineHeight: 1.6 }}>
                Esta ação é <strong>irreversível</strong>. O registro será removido do banco de dados e não aparecerá mais em nenhum relatório. Use apenas para corrigir lançamentos errados.
              </p>
              <div>
                <span style={{ ...lbl, color: '#C2410C', display: 'flex', alignItems: 'center', gap: 6 }}><FiLock size={11} /> PIN do Gerente (se configurado)</span>
                <input type="password" placeholder="Digite o PIN para autorizar a exclusão" value={pinExclusao} onChange={e => setPinExclusao(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmarExclusao()} style={{ ...inp, borderColor: '#FD8C00' }} />
              </div>
            </div>
          )}

          {/* MODO ESTORNAR */}
          {modo === 'estornar' && (
            <div style={{ background: '#FEF2F2', padding: 16, borderRadius: RAIO_LG, border: '1px dashed #FCA5A5', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiAlertTriangle size={16} color="#DC2626" />
                <span className="font-title" style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confirmar Estorno</span>
              </div>
              <p style={{ fontSize: 12, color: '#B91C1C', margin: 0 }}>Esta ação é irreversível. O lançamento será marcado como Estornado e excluído dos relatórios.</p>
              <div>
                <span style={{ ...lbl, color: '#991B1B' }}>Motivo do Estorno *</span>
                <textarea placeholder="Ex: Cobrança duplicada, serviço cancelado, erro de valor..." value={motivoEstorno} onChange={e => setMotivoEstorno(e.target.value)} style={{ ...inp, height: 72, resize: 'none', borderColor: '#FCA5A5' } as any} />
              </div>
              <div>
                <span style={{ ...lbl, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 6 }}><FiLock size={11} /> PIN do Gerente *</span>
                <input type="password" placeholder="Digite o PIN para autorizar" value={pinEstorno} onChange={e => setPinEstorno(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmarEstorno()} style={{ ...inp, borderColor: '#FCA5A5' }} />
              </div>
            </div>
          )}

          {transacao.comentario && (
            <p style={{ fontSize: 11, color: C.textLight, margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>{transacao.comentario}</p>
          )}

          {isEntrada && !isEstornado && (
            <button onClick={abrirRecibo} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.sidebarBg, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              <FiPrinter size={14} /> Imprimir recibo deste lançamento
            </button>
          )}
        </div>

        {/* AÇÕES */}
        {!isEstornado && (
          <div style={{ display: 'flex', gap: 10, padding: '16px 24px', background: C.bg, borderTop: `1px solid ${C.border}` }}>
            {modo === 'ver' && (
              <>
                <button onClick={() => setModo('excluir')} style={{ padding: '12px 14px', background: 'transparent', color: '#C2410C', border: `1px solid #FD8C00`, borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FiTrash2 size={14} />
                </button>
                {transacao.status === 'Pendente' && (
                  <button onClick={() => setModo('pagar')} style={{ flex: 2, padding: '12px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <FiCheckCircle size={15} /> Confirmar Pagamento
                  </button>
                )}
                <button onClick={() => setModo('estornar')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.danger, border: `1px solid ${C.danger}`, borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <FiAlertTriangle size={15} /> Estornar
                </button>
                {transacao.status !== 'Pendente' && (
                  <button onClick={() => setModo('editar')} style={{ flex: 1, padding: '12px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <FiEdit3 size={15} /> Editar
                  </button>
                )}
              </>
            )}
            {modo === 'pagar' && (
              <>
                <button onClick={() => setModo('ver')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={confirmarPagamento} disabled={salvando || !dataPagamento} style={{ flex: 2, padding: '12px', background: salvando ? C.borderMid : '#16A34A', color: '#fff', border: 'none', borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <FiCheckCircle size={15} /> {salvando ? 'Confirmando...' : 'Dar Baixa — R$ ' + transacao.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </button>
              </>
            )}
            {modo === 'editar' && (
              <>
                <button onClick={() => setModo('ver')} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={salvarEdicao} disabled={salvando} style={{ flex: 1, padding: '12px', background: C.success, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <FiCheck size={15} /> {salvando ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </>
            )}
            {modo === 'estornar' && (
              <>
                <button onClick={() => { setModo('ver'); setMotivoEstorno(''); setPinEstorno(''); }} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={confirmarEstorno} disabled={salvando || !motivoEstorno.trim() || !pinEstorno} style={{ flex: 1, padding: '12px', background: salvando || !motivoEstorno.trim() || !pinEstorno ? C.borderMid : '#DC2626', color: '#fff', border: 'none', borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: salvando || !motivoEstorno.trim() || !pinEstorno ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <FiAlertTriangle size={15} /> {salvando ? 'Estornando...' : 'Confirmar Estorno'}
                </button>
              </>
            )}
            {modo === 'excluir' && (
              <>
                <button onClick={() => { setModo('ver'); setPinExclusao(''); }} style={{ flex: 1, padding: '12px', background: 'transparent', color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={confirmarExclusao} disabled={salvando} style={{ flex: 1, padding: '12px', background: salvando ? C.borderMid : '#C2410C', color: '#fff', border: 'none', borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <FiTrash2 size={15} /> {salvando ? 'Excluindo...' : 'Excluir Permanentemente'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}