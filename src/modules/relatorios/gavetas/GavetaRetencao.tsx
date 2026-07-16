'use client'
/**
 * FIX [C-4] — src/modules/relatorios/gavetas/GavetaRetencao.tsx
 *
 * Antes: texto estático "em desenvolvimento".
 *
 * Agora calcula com os dados reais de `agendamentos` + `clientes`:
 *
 *  🟢 Clientes Fiéis     — retornaram em ≤ 45 dias após última visita
 *  🟡 Em Risco           — última visita entre 46 e 90 dias atrás
 *  🔴 Perdidos (Churn)   — sem visita há mais de 90 dias
 *  ⚪ Novos              — apenas 1 visita registrada
 *
 *  + Lista dos clientes em risco (ação imediata)
 */

import { useMemo } from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiTarget, FiAlertTriangle, FiCheckCircle, FiUserX, FiUserPlus } from 'react-icons/fi';

const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

function diasDesde(dataStr: string): number {
  const d = new Date(dataStr + 'T12:00:00');
  return Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function GavetaRetencao({ dados }: any) {
  const agendamentos = dados?.agendamentos || [];
  const clientes     = dados?.clientes     || [];

  // ─── ÚLTIMA VISITA POR CLIENTE ────────────────────────────────────────────
  const ultimaVisitaPorCliente = useMemo(() => {
    const mapa: Record<string, string> = {};

    agendamentos
      .filter((ag: any) => ag.status === 'Finalizado' && ag.cliente_id && ag.data)
      .forEach((ag: any) => {
        const atual = mapa[ag.cliente_id];
        if (!atual || ag.data > atual) mapa[ag.cliente_id] = ag.data;
      });

    return mapa;
  }, [agendamentos]);

  // ─── CONTAGEM DE VISITAS POR CLIENTE ─────────────────────────────────────
  const visitasPorCliente = useMemo(() => {
    const mapa: Record<string, number> = {};
    agendamentos
      .filter((ag: any) => ag.status === 'Finalizado' && ag.cliente_id)
      .forEach((ag: any) => {
        mapa[ag.cliente_id] = (mapa[ag.cliente_id] || 0) + 1;
      });
    return mapa;
  }, [agendamentos]);

  // ─── CLASSIFICAÇÃO ────────────────────────────────────────────────────────
  const { fieis, emRisco, perdidos, novos, semVisita } = useMemo(() => {
    const fieis: any[]    = [];
    const emRisco: any[]  = [];
    const perdidos: any[] = [];
    const novos: any[]    = [];
    const semVisita: any[]= [];

    clientes.forEach((c: any) => {
      const ultima  = ultimaVisitaPorCliente[c.id];
      const visitas = visitasPorCliente[c.id] || 0;

      if (!ultima) { semVisita.push(c); return; }

      const dias = diasDesde(ultima);

      if (visitas === 1)    novos.push({ ...c, dias, visitas });
      else if (dias <= 45)  fieis.push({ ...c, dias, visitas });
      else if (dias <= 90)  emRisco.push({ ...c, dias, visitas });
      else                  perdidos.push({ ...c, dias, visitas });
    });

    // Em risco: ordenar pelos mais antigos primeiro (ação mais urgente)
    emRisco.sort((a, b) => b.dias - a.dias);
    perdidos.sort((a, b) => b.dias - a.dias);

    return { fieis, emRisco, perdidos, novos, semVisita };
  }, [clientes, ultimaVisitaPorCliente, visitasPorCliente]);

  const total = fieis.length + emRisco.length + perdidos.length + novos.length;
  const taxaRetencao = total > 0
    ? Math.round((fieis.length / total) * 100)
    : 0;

  // ─── ESTILOS ──────────────────────────────────────────────────────────────
  const metricCard = (bg: string, cor: string) => ({
    background: bg, borderRadius: RAIO_XL, padding: '20px 24px',
    border: `1px solid ${C.border}`, display: 'flex',
    flexDirection: 'column' as const, gap: 4,
  });

  const tagStyle = (bg: string, color: string) => ({
    display: 'inline-block', padding: '2px 8px',
    borderRadius: 20, fontSize: 10, fontWeight: 700, background: bg, color,
  });

  return (
    <div className="font-body" style={{ maxWidth: 900 }}>

      {/* CABEÇALHO */}
      <div style={{ marginBottom: 28 }}>
        <h2 className="font-title uppercase tracking-widest"
          style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FiTarget size={18} /> Radar de Retenção & Evasão
        </h2>
        <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: 13 }}>
          Análise de {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} com base no histórico de visitas.
        </p>
      </div>

      {/* ─── CARDS DE MÉTRICAS ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>

        <div style={metricCard('#F0FDF4', '#166534')}>
          <FiCheckCircle size={18} color="#16A34A" />
          <p className="font-title" style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, color: '#166534' }}>
            {fieis.length}
          </p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#16A34A' }}>Fiéis</p>
          <p style={{ margin: 0, fontSize: 10, color: '#166534', opacity: 0.7 }}>Voltaram em ≤ 45 dias</p>
        </div>

        <div style={metricCard('#FFFBEB', '#92400E')}>
          <FiAlertTriangle size={18} color="#D97706" />
          <p className="font-title" style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, color: '#92400E' }}>
            {emRisco.length}
          </p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#D97706' }}>Em Risco</p>
          <p style={{ margin: 0, fontSize: 10, color: '#92400E', opacity: 0.7 }}>46 – 90 dias sem visita</p>
        </div>

        <div style={metricCard('#FEF2F2', '#991B1B')}>
          <FiUserX size={18} color="#EF4444" />
          <p className="font-title" style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, color: '#991B1B' }}>
            {perdidos.length}
          </p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#EF4444' }}>Perdidos</p>
          <p style={{ margin: 0, fontSize: 10, color: '#991B1B', opacity: 0.7 }}>+90 dias sem visita</p>
        </div>

        <div style={metricCard('#EFF6FF', '#1E40AF')}>
          <FiUserPlus size={18} color="#3B82F6" />
          <p className="font-title" style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, color: '#1E40AF' }}>
            {novos.length}
          </p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#3B82F6' }}>Novos</p>
          <p style={{ margin: 0, fontSize: 10, color: '#1E40AF', opacity: 0.7 }}>Apenas 1 visita</p>
        </div>
      </div>

      {/* ─── TAXA DE RETENÇÃO ─────────────────────────────────────────────── */}
      <div style={{
        background: C.sidebarBg, borderRadius: RAIO_XL, padding: '20px 28px',
        display: 'flex', alignItems: 'center', gap: 32, marginBottom: 32,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>
            Taxa de Retenção
          </p>
          <p className="font-title" style={{ margin: '4px 0 0', fontSize: 40, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
            {taxaRetencao}%
          </p>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8', marginBottom: 6 }}>
            <span>0%</span><span>Meta: 70%</span><span>100%</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: RAIO_MD, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: RAIO_MD,
              width: `${taxaRetencao}%`,
              background: taxaRetencao >= 70 ? '#10B981' : taxaRetencao >= 50 ? C.douradoEleva : '#EF4444',
              transition: 'width 1s ease-out',
            }} />
          </div>
          <div style={{ height: 8, position: 'relative', marginTop: -8 }}>
            <div style={{
              position: 'absolute', left: '70%',
              width: 2, height: 8, background: C.bgCard, opacity: 0.4,
            }} />
          </div>
        </div>
      </div>

      {/* ─── LISTA: EM RISCO (ação imediata) ─────────────────────────────── */}
      {emRisco.length > 0 && (
        <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{
            padding: '14px 20px', background: '#FFFBEB',
            borderBottom: `1px solid #FEF3C7`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <FiAlertTriangle size={15} color="#D97706" />
            <span className="font-title" style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: 1 }}>
              Clientes em Risco — Acionar agora
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                {['Cliente', 'Última Visita', 'Dias sem Aparecer', 'Visitas Total', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emRisco.slice(0, 10).map((c: any) => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, color: C.textMain }}>
                    {c.nome_completo}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: C.textMuted }}>
                    {ultimaVisitaPorCliente[c.id]?.split('-').reverse().join('/')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="font-title" style={{ fontSize: 13, fontWeight: 800, color: '#D97706' }}>
                      {c.dias} dias
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: C.textMuted }}>
                    {c.visitas} visita{c.visitas !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={tagStyle('#FFFBEB', '#92400E')}>⚠ Em Risco</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {emRisco.length > 10 && (
            <div style={{ padding: '12px 16px', fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
              + {emRisco.length - 10} clientes em risco não exibidos
            </div>
          )}
        </div>
      )}

      {total === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
          <FiTarget size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: 13 }}>Nenhum agendamento finalizado encontrado para análise.</p>
        </div>
      )}
    </div>
  );
}