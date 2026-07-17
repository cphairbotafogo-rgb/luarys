'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { verificarPinGerente } from '@/lib/verificarPinGerente';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_LG, RAIO_XL, RAIO_SM, overlayModal, containerModal, inputAdmin, labelPadrao } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiX, FiCalendar, FiCreditCard, FiAlertTriangle, FiLock, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';

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

type Modo = 'ver' | 'data' | 'estornar' | 'reabrir';

interface Props {
  agendamento: any;
  perfil: any;
  onClose: () => void;
  onAtualizar: () => void;
}

export function ModalDetalhesFinalizado({ agendamento, perfil, onClose, onAtualizar }: Props) {
  const toast = useToast();
  const [carregando, setCarregando] = useState(true);
  const [transacao, setTransacao] = useState<any>(null);
  const [servicos, setServicos] = useState<any[]>([]);
  const [modo, setModo] = useState<Modo>('ver');
  const [salvando, setSalvando] = useState(false);
  const [novaData, setNovaData] = useState('');
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');

  const hoje = new Date();
  const hojeStr = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000).toISOString().split('T')[0];

  useEffect(() => {
    async function carregar() {
      if (!perfil?.salao_id || !agendamento?.id) return;

      const { data: ags } = await supabase
        .from('agendamentos')
        .select('id, cliente_nome, servico_id, profissional_id, valor_final, status')
        .eq('salao_id', perfil.salao_id)
        .eq('cliente_nome', agendamento.cliente)
        .eq('data', agendamento.data)
        .eq('status', 'Finalizado');

      const { data: profs } = await supabase
        .from('profissionais')
        .select('id, nome')
        .eq('salao_id', perfil.salao_id);

      const { data: svcs } = await supabase
        .from('servicos')
        .select('id, nome_servico, preco_padrao')
        .eq('salao_id', perfil.salao_id);

      const profMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { profMap[p.id] = p.nome; });
      const svcMap: Record<string, { nome: string; preco: number }> = {};
      (svcs || []).forEach((s: any) => { svcMap[s.id] = { nome: s.nome_servico, preco: s.preco_padrao ?? 0 }; });

      const linhas = (ags || []).map((ag: any) => ({
        id: ag.id,
        servico: svcMap[ag.servico_id]?.nome || agendamento.servico || '—',
        profissional: profMap[ag.profissional_id] || 'Equipe',
        valor: (ag.valor_final != null && ag.valor_final !== 0)
          ? ag.valor_final
          : (svcMap[ag.servico_id]?.preco ?? 0),
      }));
      setServicos(linhas);

      const { data: finRows } = await supabase
        .from('financeiro')
        .select('id, os_numero, valor, forma_pagamento, bandeira_cartao, data_movimentacao, status, comentario')
        .eq('salao_id', perfil.salao_id)
        .contains('agendamento_ids', [agendamento.id])
        .order('data_movimentacao', { ascending: false })
        .limit(1);

      if (finRows && finRows.length > 0) {
        setTransacao(finRows[0]);
        setNovaData(finRows[0].data_movimentacao?.split('T')[0] || hojeStr);
      }
      setCarregando(false);
    }
    carregar();
  }, [agendamento?.id]);

  async function verificarPin() {
    const { valido, erro } = await verificarPinGerente(perfil.salao_id, pin);
    if (erro) { toast.erro(erro); return false; }
    if (!valido) { toast.erro('PIN incorreto.'); return false; }
    return true;
  }

  async function salvarData() {
    if (!novaData) { toast.aviso('Informe a nova data.'); return; }
    if (novaData > hojeStr) { toast.aviso('Não é permitido data futura.'); return; }
    if (!await verificarPin()) return;
    setSalvando(true);
    const novaDataISO = new Date(novaData + 'T12:00:00Z').toISOString();
    const { error } = await supabase.from('financeiro')
      .update({ data_movimentacao: novaDataISO })
      .eq('id', transacao.id);
    if (error) { toast.erro('Erro: ' + error.message); setSalvando(false); return; }
    if (transacao.os_numero) {
      await supabase.from('caixa_transacoes')
        .update({ data_hora: novaDataISO })
        .eq('salao_id', perfil.salao_id)
        .eq('os_numero', transacao.os_numero);
    }
    toast.sucesso('Data alterada para ' + new Date(novaData + 'T12:00:00').toLocaleDateString('pt-BR') + '!');
    setSalvando(false);
    onAtualizar();
    onClose();
  }

  async function salvarEstorno() {
    if (!motivo.trim()) { toast.aviso('Informe o motivo do estorno.'); return; }
    if (!await verificarPin()) return;
    setSalvando(true);
    const nota = `Motivo: ${motivo} | Por: ${perfil?.nome || 'Gerente'} | Em: ${new Date().toLocaleString('pt-BR')}`;
    const { error } = await supabase.from('financeiro')
      .update({ status: 'Estornado', comentario: nota })
      .eq('id', transacao.id);
    if (error) { toast.erro('Erro: ' + error.message); setSalvando(false); return; }
    if (transacao.os_numero) {
      await supabase.from('caixa_transacoes')
        .update({ status: 'Estornado' })
        .eq('salao_id', perfil.salao_id)
        .eq('os_numero', transacao.os_numero);
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ids = servicos.map(s => s.id).filter((id: string) => UUID_RE.test(id));
    if (ids.length > 0) {
      await supabase.from('agendamentos')
        .update({ status: 'Confirmado', cor: '#94A3B8', valor_comissao: null, comissao_paga: null })
        .in('id', ids);
      await supabase.from('comissoes').delete().in('agendamento_id', ids).eq('status', 'Pendente');
    }
    toast.sucesso('Estorno realizado! Agendamentos revertidos para Confirmado.');
    setSalvando(false);
    onAtualizar();
    onClose();
  }

  // Atendimento Finalizado SEM lançamento financeiro (não foi enviado): reabre para
  // 'Confirmado' para que o usuário feche a conta normalmente na agenda e registre a
  // receita. Sem financeiro não há o que estornar — só reverter o status.
  async function reabrirParaFechar() {
    if (!await verificarPin()) return;
    setSalvando(true);
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ids = servicos.map(s => s.id).filter((id: string) => UUID_RE.test(id));
    if (ids.length > 0) {
      const { error } = await supabase.from('agendamentos')
        .update({ status: 'Confirmado', cor: '#94A3B8', valor_comissao: null, comissao_paga: null })
        .in('id', ids);
      if (error) { toast.erro('Erro: ' + error.message); setSalvando(false); return; }
      // Limpa comissões pendentes órfãs desses agendamentos (serão recriadas no fechamento)
      await supabase.from('comissoes').delete().in('agendamento_id', ids).eq('status', 'Pendente');
    }
    toast.sucesso('Atendimento reaberto! Agora feche a conta na agenda para registrar a receita.');
    setSalvando(false);
    onAtualizar();
    onClose();
  }

  // ── Derivações visuais ────────────────────────────────────────────────────
  const bandeira = transacao?.bandeira_cartao
    || ((transacao?.forma_pagamento || '').includes(' - ') ? transacao.forma_pagamento.split(' - ').pop() : null);
  const corBandeira = bandeira ? (CORES_BANDEIRA[bandeira] || { bg: '#6B7280', color: '#fff' }) : null;
  const dataFormatada = agendamento?.data
    ? new Date(agendamento.data + 'T12:00:00').toLocaleDateString('pt-BR')
    : '';
  const totalServicos = servicos.reduce((s, r) => s + (r.valor || 0), 0);

  const lbl = labelPadrao;
  const inp = inputAdmin;

  const estornado = transacao?.status === 'Estornado';

  return (
    <div style={{ ...overlayModal, zIndex: 9999 }}>
      <div style={{
        ...containerModal,
        width: '100%',
        maxWidth: 720,
        maxHeight: '92vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* ── CABEÇALHO ─────────────────────────────────────────────────── */}
        <div style={{ background: C.sidebarBg, padding: '16px 24px', position: 'relative', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 12, right: 14, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: RAIO_SM, color: '#fff', cursor: 'pointer', padding: 6, display: 'flex' }}
          >
            <FiX size={18} />
          </button>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Fechamento de Conta · {dataFormatada}
          </p>
          <h2 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, color: '#fff' }}>
            {agendamento?.cliente || '—'}
          </h2>
        </div>

        {/* ── CORPO ─────────────────────────────────────────────────────── */}
        {carregando ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>Carregando...</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 0,
            flex: 1,
            overflow: 'hidden',
          }}>

            {/* ── COLUNA ESQUERDA: Serviços ─────────────────────────────── */}
            <div style={{
              padding: '20px 20px 20px 24px',
              borderRight: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflowY: 'auto',
            }}>
              <p style={{ ...lbl, margin: 0 }}>Serviços realizados</p>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: RAIO_LG, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: `${C.sidebarBg}10` }}>
                      <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 700, color: C.textMuted, fontSize: 10, textTransform: 'uppercase' }}>Serviço</th>
                      <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 700, color: C.textMuted, fontSize: 10, textTransform: 'uppercase' }}>Profissional</th>
                      <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700, color: C.textMuted, fontSize: 10, textTransform: 'uppercase' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicos.map((s, i) => (
                      <tr key={s.id} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                        <td style={{ padding: '8px 10px', color: C.textMain, fontWeight: 600, fontSize: 13 }}>{s.servico}</td>
                        <td style={{ padding: '8px 10px', color: C.textMuted, fontSize: 12 }}>{s.profissional}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: C.textMain }}>{brl(s.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total */}
              {servicos.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: `${C.sidebarBg}08`, borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>Total dos serviços</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>{brl(totalServicos)}</span>
                </div>
              )}

              {/* Sem transação */}
              {!transacao && (
                <p style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', margin: 0 }}>
                  Lançamento financeiro não encontrado para este agendamento.
                </p>
              )}
            </div>

            {/* ── COLUNA DIREITA: Pagamento + Ações ────────────────────── */}
            <div style={{
              padding: '20px 24px 20px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              overflowY: 'auto',
            }}>

              {/* PAGAMENTO */}
              {transacao && (
                estornado ? (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: RAIO_LG, padding: '14px 16px' }}>
                    <p style={{ ...lbl, color: '#991B1B', marginBottom: 8 }}>Pagamento estornado</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 24, fontWeight: 900, color: '#991B1B', textDecoration: 'line-through' }}>{brl(transacao.valor)}</span>
                      <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '3px 10px', borderRadius: RAIO_XL, fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>ESTORNADO</span>
                    </div>
                    {transacao.comentario && (
                      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#6B7280' }}>{transacao.comentario}</p>
                    )}
                  </div>
                ) : (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: RAIO_LG, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <FiCheckCircle size={13} color="#065F46" />
                      <p style={{ ...lbl, color: '#065F46', margin: 0 }}>Pagamento recebido</p>
                    </div>
                    <span style={{ fontSize: 26, fontWeight: 900, color: '#065F46', display: 'block', marginBottom: 8 }}>{brl(transacao.valor)}</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ background: '#D1FAE5', color: '#065F46', padding: '3px 10px', borderRadius: RAIO_XL, fontSize: 12, fontWeight: 700 }}>
                        {transacao.forma_pagamento || '—'}
                      </span>
                      {bandeira && corBandeira && (
                        <span style={{ background: corBandeira.bg, color: corBandeira.color, padding: '3px 10px', borderRadius: RAIO_SM, fontSize: 12, fontWeight: 800 }}>
                          {bandeira}
                        </span>
                      )}
                    </div>
                    {transacao.os_numero && (
                      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#6B7280' }}>OS: {transacao.os_numero}</p>
                    )}
                  </div>
                )
              )}

              {/* SEM FINANCEIRO — atendimento finalizado que não foi enviado */}
              {!transacao && (
                <>
                  {modo === 'ver' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: RAIO_LG, padding: '12px 14px' }}>
                        <p style={{ margin: 0, fontSize: 12.5, color: '#92400E', lineHeight: 1.5 }}>
                          Este atendimento está <strong>finalizado sem lançamento financeiro</strong> — a receita não entrou no caixa/relatórios. Reabra para fazer o fechamento e registrar o pagamento.
                        </p>
                      </div>
                      <button
                        onClick={() => setModo('reabrir')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: RAIO_MD, color: '#1D4ED8', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                      >
                        <FiRefreshCw size={14} /> Reabrir para Fechar
                      </button>
                    </div>
                  )}

                  {modo === 'reabrir' && (
                    <div style={{ background: '#F0F9FF', padding: 14, borderRadius: RAIO_LG, border: '1px solid #BAE6FD', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FiRefreshCw size={13} color="#0284C7" />
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#0284C7', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Reabrir atendimento</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#0C4A6E', margin: 0, lineHeight: 1.5 }}>
                        Volta para <strong>Confirmado</strong>. Depois, na agenda, clique no atendimento → <strong>Fechar Conta</strong> para registrar o pagamento (a data entra automática no dia do serviço).
                      </p>
                      <div>
                        <span style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}><FiLock size={10} /> PIN do Gerente</span>
                        <input type="password" style={inp} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && reabrirParaFechar()} placeholder="••••" />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setModo('ver'); setPin(''); }} style={{ padding: '8px 14px', background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, color: C.textMain, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={reabrirParaFechar} disabled={salvando} style={{ flex: 1, padding: '8px 14px', background: '#0284C7', border: 'none', borderRadius: RAIO_MD, color: '#fff', fontWeight: 700, fontSize: 12, cursor: salvando ? 'not-allowed' : 'pointer' }}>{salvando ? 'Reabrindo...' : 'Confirmar Reabertura'}</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* AÇÕES */}
              {transacao && !estornado && (
                <>
                  {modo === 'ver' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        onClick={() => setModo('data')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: RAIO_MD, color: '#1D4ED8', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                      >
                        <FiCalendar size={14} /> Alterar Data
                      </button>
                      <button
                        onClick={() => setModo('estornar')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: RAIO_MD, color: '#DC2626', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                      >
                        <FiAlertTriangle size={14} /> Estornar Pagamento
                      </button>
                    </div>
                  )}

                  {modo === 'data' && (
                    <div style={{ background: '#F0F9FF', padding: 14, borderRadius: RAIO_LG, border: '1px solid #BAE6FD', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FiCalendar size={13} color="#0284C7" />
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#0284C7', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Alterar Data da Movimentação</span>
                      </div>
                      <div>
                        <span style={lbl}>Nova data</span>
                        <input type="date" style={inp} value={novaData} onChange={e => setNovaData(e.target.value)} />
                      </div>
                      <div>
                        <span style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}><FiLock size={10} /> PIN do Gerente</span>
                        <input type="password" style={inp} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setModo('ver'); setPin(''); }} style={{ padding: '8px 14px', background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, color: C.textMain, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={salvarData} disabled={salvando} style={{ flex: 1, padding: '8px 14px', background: '#0284C7', border: 'none', borderRadius: RAIO_MD, color: '#fff', fontWeight: 700, fontSize: 12, cursor: salvando ? 'not-allowed' : 'pointer' }}>{salvando ? 'Salvando...' : 'Confirmar'}</button>
                      </div>
                    </div>
                  )}

                  {modo === 'estornar' && (
                    <div style={{ background: '#FEF2F2', padding: 14, borderRadius: RAIO_LG, border: '1px dashed #FCA5A5', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FiAlertTriangle size={14} color="#DC2626" />
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' as const }}>Confirmar Estorno</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#B91C1C', margin: 0 }}>Ação irreversível. Os agendamentos voltarão para Confirmado.</p>
                      <div>
                        <span style={{ ...lbl, color: '#991B1B' }}>Motivo *</span>
                        <textarea
                          placeholder="Ex: Cobrança duplicada, erro de valor..."
                          value={motivo}
                          onChange={e => setMotivo(e.target.value)}
                          style={{ ...inp, height: 56, resize: 'none', borderColor: '#FCA5A5' } as any}
                        />
                      </div>
                      <div>
                        <span style={{ ...lbl, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 5 }}><FiLock size={10} /> PIN do Gerente *</span>
                        <input type="password" placeholder="••••" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && salvarEstorno()} style={{ ...inp, borderColor: '#FCA5A5' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setModo('ver'); setPin(''); setMotivo(''); }} style={{ padding: '8px 14px', background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, color: C.textMain, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={salvarEstorno} disabled={salvando} style={{ flex: 1, padding: '8px 14px', background: '#DC2626', border: 'none', borderRadius: RAIO_MD, color: '#fff', fontWeight: 700, fontSize: 12, cursor: salvando ? 'not-allowed' : 'pointer' }}>{salvando ? 'Estornando...' : 'Confirmar Estorno'}</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {estornado && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 13, color: '#991B1B', fontWeight: 600 }}>
                  Este pagamento foi estornado e não pode ser alterado.
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
