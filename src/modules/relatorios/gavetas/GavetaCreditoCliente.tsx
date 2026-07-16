'use client'

import { useState, useEffect, useMemo } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_SM, RAIO_XS } from '@/lib/estiloGlobal';
import { supabase } from '@/lib/supabase';
import { FiCreditCard, FiSearch, FiDownload, FiUsers, FiDollarSign } from 'react-icons/fi';

interface CreditoCliente {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  valor: number;
  data_criacao: string;
  data_expiracao: string | null;
  status: string;
}

function badgeStatus(status: string, expiracao: string | null) {
  const hoje = new Date();
  const dataExp = expiracao ? new Date(expiracao) : null;
  const aVencer = dataExp && dataExp > hoje && (dataExp.getTime() - hoje.getTime()) < 7 * 24 * 60 * 60 * 1000;

  if (aVencer) {
    return { label: 'A vencer', bg: `${C.warning}22`, cor: C.warning };
  }
  return { label: 'Ativo', bg: `${C.success}22`, cor: C.success };
}

function formatarData(data: string | null) {
  if (!data) return '—';
  const d = new Date(data);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function exportarCSV(lista: CreditoCliente[]) {
  const cabecalho = 'Cliente,Saldo Disponível,Data de Expiração,Status\n';
  const conteudo = lista.map(c => {
    const badge = badgeStatus(c.status, c.data_expiracao);
    return `"${c.cliente_nome}","${brl(c.valor)}","${formatarData(c.data_expiracao)}","${badge.label}"`;
  }).join('\n');
  const blob = new Blob(['﻿' + cabecalho + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `credito_clientes_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function GavetaCreditoCliente({ perfil }: any) {
  const [creditos, setCreditos] = useState<CreditoCliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [moduloDisponivel, setModuloDisponivel] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    async function buscarCreditos() {
      setCarregando(true);
      try {
        const salaoId = perfil?.salao_id;
        if (!salaoId) { setCarregando(false); return; }

        const { data, error } = await supabase
          .from('creditos_clientes')
          .select('id, cliente_id, cliente_nome, valor, data_criacao, data_expiracao, status')
          .eq('salao_id', salaoId)
          .eq('status', 'ativo');

        if (error) {
          const codigo = (error as any)?.code;
          if (codigo === '42P01' || codigo === 'PGRST116' || String(error.message).includes('does not exist')) {
            setModuloDisponivel(false);
          }
          setCreditos([]);
        } else {
          setModuloDisponivel(true);
          setCreditos(data ?? []);
        }
      } catch {
        setModuloDisponivel(false);
        setCreditos([]);
      } finally {
        setCarregando(false);
      }
    }

    buscarCreditos();
  }, [perfil?.salao_id]);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return creditos;
    return creditos.filter(c => c.cliente_nome?.toLowerCase().includes(busca.toLowerCase()));
  }, [creditos, busca]);

  const totalCredito = filtrados.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const qtdClientes = filtrados.length;
  const mediaPorCliente = qtdClientes > 0 ? totalCredito / qtdClientes : 0;

  if (carregando) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: C.textMuted }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.sidebarBg, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 14 }}>Carregando créditos...</p>
      </div>
    );
  }

  if (!moduloDisponivel) {
    return (
      <div style={{ padding: 64, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${C.douradoEleva}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <FiCreditCard size={28} color={C.douradoEleva} />
        </div>
        <p style={{ fontWeight: 700, color: C.textMain, fontSize: 16, marginBottom: 8 }}>Módulo de crédito não configurado</p>
        <p style={{ fontSize: 13, color: C.textMuted, maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>
          O módulo de crédito de cliente ainda não foi configurado. Os créditos aparecerão aqui assim que houver lançamentos.
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)' }}>
      {/* CARDS DE RESUMO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total em Crédito', valor: brl(totalCredito), icon: <FiDollarSign size={18} color={C.success} />, cor: C.success },
          { label: 'Clientes com Crédito', valor: String(qtdClientes), icon: <FiUsers size={18} color={C.douradoEleva} />, cor: C.textMain },
          { label: 'Crédito Médio por Cliente', valor: brl(mediaPorCliente), icon: <FiCreditCard size={18} color={C.warning} />, cor: C.textMain },
        ].map(card => (
          <div key={card.label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase' }}>{card.label}</span>
              {card.icon}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: card.cor }}>{card.valor}</div>
          </div>
        ))}
      </div>

      {/* FILTRO + BOTÃO EXPORTAR */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '7px 12px', flex: 1, minWidth: 200 }}>
          <FiSearch size={14} color={C.textLight} />
          <input
            type="text"
            placeholder="Buscar por nome do cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: C.textMain, width: '100%' }}
          />
        </div>
        <button
          onClick={() => exportarCSV(filtrados)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          <FiDownload size={13} /> Exportar CSV
        </button>
      </div>

      {/* TABELA */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontWeight: 700, color: C.textMain, fontSize: 14 }}>Créditos Ativos por Cliente</span>
        </div>

        {filtrados.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FiCreditCard size={26} color={C.textLight} />
            </div>
            <p style={{ fontWeight: 700, color: C.textMain, marginBottom: 6, fontSize: 15 }}>
              {busca ? 'Nenhum cliente encontrado' : 'Nenhum crédito ativo no momento'}
            </p>
            <p style={{ fontSize: 13, color: C.textMuted, maxWidth: 280, margin: '0 auto' }}>
              {busca ? 'Tente buscar por outro nome.' : 'Os créditos cadastrados aparecerão aqui automaticamente.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['Cliente', 'Saldo Disponível', 'Data de Expiração', 'Status'].map(col => (
                  <th key={col} style={{ padding: '10px 16px', textAlign: col === 'Cliente' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c, i) => {
                const badge = badgeStatus(c.status, c.data_expiracao);
                return (
                  <tr key={c.id} style={{ borderBottom: i < filtrados.length - 1 ? `1px solid ${C.border}` : 'none', background: i % 2 === 0 ? C.bgCard : C.bg }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${C.douradoEleva}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiCreditCard size={13} color={C.douradoEleva} />
                        </div>
                        <span style={{ fontWeight: 600, color: C.textMain }}>{c.cliente_nome}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: C.success }}>{brl(Number(c.valor) || 0)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: C.textMuted }}>{formatarData(c.data_expiracao)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{ background: badge.bg, color: badge.cor, borderRadius: RAIO_XS, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
