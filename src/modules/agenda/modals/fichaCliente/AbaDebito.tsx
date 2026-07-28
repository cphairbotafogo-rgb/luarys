// src/modules/agenda/modals/fichaCliente/AbaDebito.tsx
// Débito em aberto DESTE cliente, direto na ficha — mesma lógica do relatório
// "Clientes em Débito" (GavetaClientesDebito.tsx), só que já filtrada pro
// cliente que está sendo editado, sem precisar ir em Relatórios buscar o nome.
'use client'
import { useState, useEffect } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_SM } from '@/lib/estiloGlobal';
import { supabase } from '@/lib/supabase';
import { FiAlertCircle, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import { ModalDetalhesTransacao } from '@/modules/financeiro/modals/ModalDetalhesTransacao';
import { ModalDetalhesFinalizado } from '@/modules/agenda/modals/ModalDetalhesFinalizado';

interface RegistroDebito {
  id: string;
  valor: number;
  data: string;
  tipo: 'financeiro' | 'agendamento';
  bruto: any;
}

const STATUS_PENDENTE = ['Pendente', 'pendente', 'Em Aberto', 'em_aberto'];

interface Props {
  perfil: any;
  clienteId: string;
  clienteNome: string;
}

export function AbaDebito({ perfil, clienteId, clienteNome }: Props) {
  const [registros, setRegistros] = useState<RegistroDebito[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [transacaoAberta, setTransacaoAberta] = useState<any>(null);
  const [finalizadoAberto, setFinalizadoAberto] = useState<any>(null);

  async function buscarDebitos() {
    setCarregando(true);
    try {
      const salaoId = perfil?.salao_id;
      if (!salaoId || !clienteNome) { setCarregando(false); return; }

      const [{ data: financeiroData }, { data: agendamentosData }, { data: idsFinanceiro }] = await Promise.all([
        supabase.from('financeiro')
          .select('id, descricao, valor, data_movimentacao, status, tipo, categoria, forma_pagamento, metodo_pagamento, bandeira_cartao, comentario, profissional_nome, cliente_nome')
          .eq('salao_id', salaoId).eq('tipo', 'entrada').in('status', STATUS_PENDENTE)
          .ilike('cliente_nome', clienteNome),
        supabase.from('agendamentos')
          .select('id, cliente_nome, valor_final, data')
          .eq('salao_id', salaoId).eq('cliente_id', clienteId).eq('status', 'Finalizado').gt('valor_final', 0),
        supabase.from('financeiro')
          .select('agendamento_ids')
          .eq('salao_id', salaoId).eq('tipo', 'entrada').neq('status', 'Estornado').not('agendamento_ids', 'is', null),
      ]);

      const idsPagos = new Set<string>();
      (idsFinanceiro || []).forEach((f: any) => {
        if (Array.isArray(f.agendamento_ids)) f.agendamento_ids.forEach((id: string) => idsPagos.add(id));
      });

      const lista: RegistroDebito[] = [];
      (financeiroData || []).forEach((f: any) => {
        lista.push({ id: f.id, valor: Number(f.valor) || 0, data: f.data_movimentacao ?? '', tipo: 'financeiro', bruto: f });
      });
      (agendamentosData || []).forEach((ag: any) => {
        if (idsPagos.has(ag.id)) return;
        lista.push({ id: ag.id, valor: Number(ag.valor_final) || 0, data: ag.data ?? '', tipo: 'agendamento', bruto: ag });
      });

      setRegistros(lista);
    } catch {
      setRegistros([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { buscarDebitos(); }, [perfil?.salao_id, clienteId, clienteNome]); // eslint-disable-line react-hooks/exhaustive-deps

  function formatarData(data: string) {
    if (!data) return '—';
    const d = new Date(data);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR');
  }

  const totalDebito = registros.reduce((s, r) => s + r.valor, 0);

  if (carregando) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
        <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.sidebarBg, borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 13 }}>Carregando débitos...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total em Débito</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: totalDebito > 0 ? C.danger : C.success }}>{brl(totalDebito)}</span>
        </div>
        <button onClick={buscarDebitos} title="Atualizar" style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: C.textMain, cursor: 'pointer' }}>
          <FiRefreshCw size={12} /> Atualizar
        </button>
      </div>

      {registros.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: C.bg, borderRadius: RAIO_XL, border: `1px dashed ${C.borderMid}` }}>
          <FiCheckCircle size={26} color={C.success} style={{ marginBottom: 10 }} />
          <p style={{ margin: 0, fontWeight: 700, color: C.textMain, fontSize: 14 }}>Sem débitos em aberto</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textMuted }}>Este cliente está em dia.</p>
        </div>
      ) : (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['Valor', 'Data', 'Ação'].map(col => (
                  <th key={col} style={{ padding: '10px 16px', textAlign: col === 'Valor' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < registros.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? C.bgCard : C.bg }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FiAlertCircle size={14} color={C.danger} />
                      <span style={{ fontWeight: 700, color: C.danger }}>{brl(r.valor)}</span>
                      {r.tipo === 'agendamento' && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', borderRadius: 4, padding: '1px 5px' }}>SEM PGTO</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: C.textMuted }}>{formatarData(r.data)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        if (r.tipo === 'financeiro') setTransacaoAberta(r.bruto);
                        else setFinalizadoAberto({ id: r.bruto.id, cliente: r.bruto.cliente_nome, data: r.bruto.data });
                      }}
                      title={r.tipo === 'financeiro' ? 'Ver e confirmar pagamento' : 'Ver detalhes e reabrir para fechar conta'}
                      style={{ padding: '5px 12px', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.sidebarBg, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {transacaoAberta && (
        <ModalDetalhesTransacao
          transacao={transacaoAberta}
          perfil={perfil}
          onClose={() => setTransacaoAberta(null)}
          aoAtualizar={() => { buscarDebitos(); setTransacaoAberta(null); }}
        />
      )}

      {finalizadoAberto && (
        <ModalDetalhesFinalizado
          agendamento={finalizadoAberto}
          perfil={perfil}
          onClose={() => setFinalizadoAberto(null)}
          onAtualizar={buscarDebitos}
        />
      )}
    </div>
  );
}
