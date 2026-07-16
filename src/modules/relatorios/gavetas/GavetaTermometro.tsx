'use client'
import { useState, useMemo } from 'react';
import { C } from '@/lib/constants';
import { RAIO_XL, RAIO_LG, RAIO_MD } from '@/lib/estiloGlobal';
import { FiThermometer, FiClock, FiCalendar } from 'react-icons/fi';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HORAS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h–20h

type Periodo = '30' | '60' | '90' | '365';

function corCalor(ratio: number): string {
  if (ratio === 0)    return '#F8FAFC';
  if (ratio < 0.2)    return '#DBEAFE';
  if (ratio < 0.4)    return '#93C5FD';
  if (ratio < 0.6)    return '#3B82F6';
  if (ratio < 0.8)    return '#1D4ED8';
  return '#1E3A8A';
}

function corTexto(ratio: number): string {
  return ratio >= 0.4 ? '#fff' : C.textMain;
}

export function GavetaTermometro({ dados }: any) {
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const agendamentos = dados?.agendamentos || [];

  const agsFiltrados = useMemo(() => {
    const corte = new Date();
    corte.setDate(corte.getDate() - Number(periodo));
    return agendamentos.filter((ag: any) => {
      if (ag.status === 'Cancelado' || !ag.data) return false;
      return new Date(ag.data + 'T12:00:00') >= corte;
    });
  }, [agendamentos, periodo]);

  const porHora = useMemo(() => {
    const m: Record<number, number> = {};
    HORAS.forEach(h => { m[h] = 0; });
    agsFiltrados.forEach((ag: any) => {
      if (!ag.inicio) return;
      const h = parseInt(ag.inicio.split(':')[0], 10);
      if (h >= 7 && h <= 20) m[h] = (m[h] || 0) + 1;
    });
    return m;
  }, [agsFiltrados]);

  const porDia = useMemo(() => {
    const m: Record<number, number> = { 0:0,1:0,2:0,3:0,4:0,5:0,6:0 };
    agsFiltrados.forEach((ag: any) => {
      if (!ag.data) return;
      const d = new Date(ag.data + 'T12:00:00').getDay();
      m[d]++;
    });
    return m;
  }, [agsFiltrados]);

  // Mapa de calor hora × dia (linhas=hora, colunas=dia)
  const porHoraDia = useMemo(() => {
    const m: Record<string, number> = {};
    agsFiltrados.forEach((ag: any) => {
      if (!ag.inicio || !ag.data) return;
      const h = parseInt(ag.inicio.split(':')[0], 10);
      const d = new Date(ag.data + 'T12:00:00').getDay();
      if (h >= 7 && h <= 20) {
        const k = `${h}-${d}`;
        m[k] = (m[k] || 0) + 1;
      }
    });
    return m;
  }, [agsFiltrados]);

  const maxHora    = Math.max(...Object.values(porHora), 1);
  const maxDia     = Math.max(...Object.values(porDia), 1);
  const maxHoraDia = Math.max(...Object.values(porHoraDia), 1);

  const picoHora   = Number(Object.entries(porHora).sort((a,b)=>b[1]-a[1])[0]?.[0]);
  const picoDia    = Number(Object.entries(porDia).sort((a,b)=>b[1]-a[1])[0]?.[0]);
  const pctPicoHora = ((porHora[picoHora] / Math.max(agsFiltrados.length, 1)) * 100).toFixed(0);
  const pctPicoDia  = ((porDia[picoDia]  / Math.max(agsFiltrados.length, 1)) * 100).toFixed(0);

  if (agsFiltrados.length === 0) return (
    <div style={{ background: C.bgCard, padding: 40, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, textAlign: 'center' }}>
      <FiThermometer size={32} color={C.textLight} style={{ marginBottom: 12 }} />
      <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>Nenhum agendamento encontrado no período selecionado.</p>
    </div>
  );

  const card = { background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 24 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: C.sidebarBg, padding: 12, borderRadius: RAIO_XL, color: '#fff' }}>
            <FiThermometer size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Termômetro de Fluxo
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>
              {agsFiltrados.length} agendamentos analisados — últimos {periodo} dias
            </p>
          </div>
        </div>
        <select value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)}
          style={{ padding: '10px 16px', borderRadius: RAIO_XL, border: `1px solid ${C.borderMid}`, fontSize: 13, fontWeight: 600, color: C.textMain, background: C.bgCard }}>
          <option value="30">Últimos 30 dias</option>
          <option value="60">Últimos 60 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Último ano</option>
        </select>
      </div>

      {/* CARDS PICO */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[
          { icon: <FiClock size={28} color='#D4AF37' />, label: 'Horário de Pico', valor: `${picoHora}h`, sub: `${porHora[picoHora]} agendamentos — ${pctPicoHora}% do total` },
          { icon: <FiCalendar size={28} color='#D4AF37' />, label: 'Dia Mais Movimentado', valor: DIAS_SEMANA[picoDia], sub: `${porDia[picoDia]} agendamentos — ${pctPicoDia}% do total` },
        ].map(c => (
          <div key={c.label} style={{ background: C.sidebarBg, borderRadius: RAIO_XL, padding: '20px 28px', display: 'flex', gap: 18, alignItems: 'center' }}>
            {c.icon}
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>{c.label}</p>
              <p style={{ margin: '6px 0 2px', fontSize: 30, fontWeight: 900, color: '#fff' }}>{c.valor}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#94A3B8' }}>{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* MAPA DE CALOR HORA × DIA */}
      <div style={card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Mapa de Calor — Hora × Dia da Semana
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: C.textMuted }}>
          Cada célula mostra o total de agendamentos naquele horário e dia. Quanto mais escuro, mais movimentado.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: C.textMuted, textAlign: 'right', width: 44 }}></th>
                {DIAS_SEMANA.map(d => (
                  <th key={d} style={{ padding: '6px 4px', fontSize: 11, fontWeight: 800, color: C.textMain, textAlign: 'center' }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HORAS.map(h => (
                <tr key={h}>
                  <td style={{ padding: '3px 10px', fontSize: 11, fontWeight: 700, color: C.textMuted, textAlign: 'right', whiteSpace: 'nowrap' as const }}>{h}h</td>
                  {[0,1,2,3,4,5,6].map(d => {
                    const v = porHoraDia[`${h}-${d}`] || 0;
                    const r = maxHoraDia > 0 ? v / maxHoraDia : 0;
                    const isPico = h === picoHora && d === picoDia;
                    return (
                      <td key={d} style={{ padding: '3px 4px', textAlign: 'center' }}>
                        <div title={`${DIAS_SEMANA[d]} ${h}h — ${v} agend.`} style={{
                          background: isPico ? '#D4AF37' : corCalor(r),
                          color: isPico ? '#000' : corTexto(r),
                          borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700,
                          padding: '6px 4px', minWidth: 32,
                          border: isPico ? '2px solid #B8960C' : `1px solid ${v > 0 ? 'transparent' : C.border}`,
                        }}>
                          {v > 0 ? v : '·'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FLUXO POR HORÁRIO */}
      <div style={card}>
        <h3 style={{ margin: '0 0 20px', fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Fluxo por Horário
        </h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
          {HORAS.map(h => {
            const qtd = porHora[h] || 0;
            const ratio = maxHora > 0 ? qtd / maxHora : 0;
            const isPico = h === picoHora;
            return (
              <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                {qtd > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: isPico ? '#D4AF37' : C.textMuted }}>{qtd}</span>}
                <div title={`${h}h — ${qtd} agendamentos`} style={{
                  width: '100%',
                  height: `${Math.max(ratio * 100, qtd > 0 ? 4 : 0)}%`,
                  background: isPico ? '#D4AF37' : corCalor(ratio),
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.6s ease-out',
                  minHeight: qtd > 0 ? 6 : 0,
                }} />
                <span style={{ fontSize: 11, color: isPico ? C.sidebarBg : C.textMuted, fontWeight: isPico ? 800 : 500 }}>{h}h</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* FLUXO POR DIA DA SEMANA */}
      <div style={card}>
        <h3 style={{ margin: '0 0 20px', fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Fluxo por Dia da Semana
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
          {[0,1,2,3,4,5,6].map(d => {
            const qtd = porDia[d] || 0;
            const ratio = maxDia > 0 ? qtd / maxDia : 0;
            const isPico = d === picoDia;
            return (
              <div key={d} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '20px 8px', borderRadius: RAIO_LG,
                background: isPico ? C.sidebarBg : corCalor(ratio),
                border: isPico ? `2px solid #D4AF37` : `1px solid ${C.border}`,
              }}>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase' as const, color: isPico ? '#D4AF37' : corTexto(ratio) }}>
                  {DIAS_SEMANA[d]}
                </span>
                <span style={{ fontSize: 26, fontWeight: 900, color: isPico ? '#fff' : corTexto(ratio) }}>{qtd}</span>
                <span style={{ fontSize: 10, color: isPico ? '#94A3B8' : C.textLight }}>agend.</span>
                {qtd > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: isPico ? '#D4AF37' : C.textMuted }}>
                  {((qtd / agsFiltrados.length) * 100).toFixed(0)}%
                </span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
