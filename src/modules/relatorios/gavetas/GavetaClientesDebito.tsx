'use client'

import { useState, useEffect, useMemo } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_SM, RAIO_XS } from '@/lib/estiloGlobal';
import { supabase } from '@/lib/supabase';
import { FiSearch, FiAlertCircle, FiUser, FiDollarSign, FiChevronDown } from 'react-icons/fi';

type Ordenacao = 'maior_debito' | 'nome_az';

interface RegistroDebito {
  id: string;
  nome: string;
  telefone: string;
  valor: number;
  data: string;
  tipo: 'financeiro' | 'agendamento';
}

export function GavetaClientesDebito({ perfil }: any) {
  const [registros, setRegistros] = useState<RegistroDebito[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('maior_debito');

  useEffect(() => {
    async function buscarDebitos() {
      setCarregando(true);
      try {
        const salaoId = perfil?.salao_id;
        if (!salaoId) { setCarregando(false); return; }

        const statusPendente = ['Pendente', 'pendente', 'Em Aberto', 'em_aberto'];

        const [{ data: financeiroData }, { data: agendamentosData }, { data: idsFinanceiro }] = await Promise.all([
          supabase.from('financeiro')
            .select('id, descricao, valor, data_movimentacao')
            .eq('salao_id', salaoId)
            .eq('tipo', 'entrada')
            .in('status', statusPendente),
          supabase.from('agendamentos')
            .select('id, cliente_nome, valor_final, data')
            .eq('salao_id', salaoId)
            .eq('status', 'Finalizado')
            .gt('valor_final', 0),
          supabase.from('financeiro')
            .select('agendamento_ids')
            .eq('salao_id', salaoId)
            .eq('tipo', 'entrada')
            .neq('status', 'Estornado')
            .not('agendamento_ids', 'is', null),
        ]);

        const idsPagos = new Set<string>();
        (idsFinanceiro || []).forEach((f: any) => {
          if (Array.isArray(f.agendamento_ids)) f.agendamento_ids.forEach((id: string) => idsPagos.add(id));
        });

        const lista: RegistroDebito[] = [];

        (financeiroData || []).forEach((f: any) => {
          lista.push({
            id: f.id,
            nome: f.descricao ?? 'Cliente não identificado',
            telefone: '',
            valor: Number(f.valor) || 0,
            data: f.data_movimentacao ?? '',
            tipo: 'financeiro',
          });
        });

        (agendamentosData || []).forEach((ag: any) => {
          if (idsPagos.has(ag.id)) return;
          lista.push({
            id: ag.id,
            nome: ag.cliente_nome ?? 'Cliente não identificado',
            telefone: '',
            valor: Number(ag.valor_final) || 0,
            data: ag.data ?? '',
            tipo: 'agendamento',
          });
        });

        setRegistros(lista);
      } catch {
        setRegistros([]);
      } finally {
        setCarregando(false);
      }
    }

    buscarDebitos();
  }, [perfil?.salao_id]);

  const filtrados = useMemo(() => {
    let lista = registros.filter(r =>
      r.nome.toLowerCase().includes(busca.toLowerCase())
    );
    if (ordenacao === 'maior_debito') {
      lista = lista.sort((a, b) => b.valor - a.valor);
    } else {
      lista = lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }
    return lista;
  }, [registros, busca, ordenacao]);

  const totalDebito = filtrados.reduce((s, r) => s + r.valor, 0);
  const qtdClientes = filtrados.length;
  const maiorDebito = filtrados.length > 0 ? Math.max(...filtrados.map(r => r.valor)) : 0;

  function formatarData(data: string) {
    if (!data) return '—';
    const d = new Date(data);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR');
  }

  if (carregando) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: C.textMuted }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.sidebarBg, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 14 }}>Carregando débitos...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* FILTROS */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '7px 12px', flex: 1, minWidth: 200 }}>
          <FiSearch size={14} color={C.textLight} />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: C.textMain, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '7px 12px' }}>
          <select
            value={ordenacao}
            onChange={e => setOrdenacao(e.target.value as Ordenacao)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: C.textMain, cursor: 'pointer' }}
          >
            <option value="maior_debito">Maior débito</option>
            <option value="nome_az">Nome A-Z</option>
          </select>
          <FiChevronDown size={13} color={C.textLight} />
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total em Débito', valor: brl(totalDebito), icon: <FiDollarSign size={18} color={C.danger} />, destaque: C.danger },
          { label: 'Clientes com Débito', valor: String(qtdClientes), icon: <FiUser size={18} color={C.warning} />, destaque: C.textMain },
          { label: 'Maior Débito Individual', valor: brl(maiorDebito), icon: <FiAlertCircle size={18} color={C.danger} />, destaque: C.danger },
        ].map(card => (
          <div key={card.label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>{card.label}</span>
              {card.icon}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: card.destaque }}>{card.valor}</div>
          </div>
        ))}
      </div>

      {/* TABELA */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontWeight: 700, color: C.textMain, fontSize: 14 }}>Clientes com Débito em Aberto</span>
        </div>

        {filtrados.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FiUser size={26} color={C.textLight} />
            </div>
            <p style={{ fontWeight: 700, color: C.textMain, marginBottom: 6, fontSize: 15 }}>Nenhum débito em aberto</p>
            <p style={{ fontSize: 13, color: C.textMuted, maxWidth: 280, margin: '0 auto' }}>
              {busca ? 'Nenhum cliente encontrado com esse nome.' : 'Todos os clientes estão em dia — ótimo resultado!'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['Nome do Cliente', 'Telefone', 'Valor em Débito', 'Data do Débito', 'Ação'].map(col => (
                  <th key={col} style={{ padding: '10px 16px', textAlign: col === 'Nome do Cliente' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < filtrados.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? C.bgCard : C.bg }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${C.sidebarBg}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiUser size={13} color={C.sidebarBg} />
                      </div>
                      <span style={{ fontWeight: 600, color: C.textMain }}>{r.nome}</span>
                      {r.tipo === 'agendamento' && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                          SEM PGTO
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: C.textMuted }}>{r.telefone || '—'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: C.danger }}>{brl(r.valor)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: C.textMuted }}>{formatarData(r.data)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      disabled
                      title="Em breve"
                      style={{ padding: '5px 12px', borderRadius: RAIO_SM, border: `1px solid ${C.border}`, background: C.bg, color: C.textLight, fontSize: 12, fontWeight: 600, cursor: 'not-allowed', opacity: 0.6 }}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
