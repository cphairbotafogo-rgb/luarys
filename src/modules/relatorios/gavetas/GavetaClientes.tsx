'use client'
import { useMemo, useState } from "react";
import { C, brl } from "@/lib/constants";
import { RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";

type Visao = 'frequentes' | 'sumidas' | 'todas';

function diasDesde(dataStr: string) {
  const d = new Date(dataStr + 'T12:00:00');
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

// ─── Barra horizontal simples ─────────────────────────────────────────────────
function BarHoriz({ dados, cor }: { dados: { lb: string; v: number; extra?: string }[]; cor: string }) {
  const maxV = Math.max(...dados.map(d => d.v), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {dados.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 150, fontSize: 11, color: C.textMain, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }} title={d.lb}>{d.lb}</div>
          <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 4, height: 20, overflow: 'hidden' }}>
            <div style={{ width: `${(d.v / maxV) * 100}%`, minWidth: 4, height: '100%', background: cor, borderRadius: 4, transition: '0.4s ease' }} />
          </div>
          <div style={{ width: 56, fontSize: 11, fontWeight: 700, color: C.textMain, flexShrink: 0, textAlign: 'right' }}>{d.extra ?? d.v}</div>
        </div>
      ))}
    </div>
  );
}

export function GavetaClientes({ dados }: { dados: any }) {
  const [visao, setVisao] = useState<Visao>('frequentes');
  const [filtroServico, setFiltroServico] = useState('');
  const [limiteSumida, setLimiteSumida] = useState(60);

  const calc = useMemo(() => {
    // Última visita e contagem por cliente
    const ultimaVisita: Record<string, string> = {};
    const visitas: Record<string, number> = {};
    const ticket: Record<string, number> = {};
    const servicosPorCliente: Record<string, Set<string>> = {};

    for (const ag of (dados.agendamentos as any[])) {
      if (ag.status !== 'Finalizado' || !ag.cliente_id) continue;
      const d = ag.data;
      if (!ultimaVisita[ag.cliente_id] || d > ultimaVisita[ag.cliente_id]) ultimaVisita[ag.cliente_id] = d;
      visitas[ag.cliente_id] = (visitas[ag.cliente_id] || 0) + 1;
      ticket[ag.cliente_id] = (ticket[ag.cliente_id] || 0) + (Number(ag.valor_final) || 0);
      if (!servicosPorCliente[ag.cliente_id]) servicosPorCliente[ag.cliente_id] = new Set();
      const sNome = ag.servicos?.nome_servico || '';
      if (sNome) servicosPorCliente[ag.cliente_id].add(sNome);
    }

    const clientes = (dados.clientes as any[]).filter(c => ultimaVisita[c.id]);
    const filtroServLower = filtroServico.toLowerCase().trim();

    const base = clientes
      .filter(c => {
        if (!filtroServLower) return true;
        const servs = servicosPorCliente[c.id];
        return servs && [...servs].some(s => s.toLowerCase().includes(filtroServLower));
      })
      .map(c => ({
        id: c.id,
        nome: c.nome_completo || '—',
        telefone: c.telefone_whatsapp || null,
        visitas: visitas[c.id] || 0,
        ultimaVisita: ultimaVisita[c.id],
        diasAusente: diasDesde(ultimaVisita[c.id]),
        ticketMedio: visitas[c.id] > 0 ? ticket[c.id] / visitas[c.id] : 0,
        servicos: [...(servicosPorCliente[c.id] || [])],
      }));

    const frequentes = [...base].sort((a, b) => b.visitas - a.visitas).slice(0, 20);
    const sumidas = [...base].filter(c => c.diasAusente >= limiteSumida).sort((a, b) => b.diasAusente - a.diasAusente);
    const topTicket = [...base].sort((a, b) => b.ticketMedio - a.ticketMedio).slice(0, 10);

    return { frequentes, sumidas, topTicket, total: base.length };
  }, [dados, filtroServico, limiteSumida]);

  const btnVisao = (v: Visao, txt: string) => (
    <button onClick={() => setVisao(v)} style={{
      padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
      border: `1px solid ${visao === v ? C.sidebarBg : C.borderMid}`,
      background: visao === v ? C.sidebarBg : 'transparent',
      color: visao === v ? '#fff' : C.textMain,
    }}>
      {txt}
    </button>
  );

  const tabela = (lista: typeof calc.frequentes, colExtra: { label: string; fn: (c: (typeof calc.frequentes)[0]) => string }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: C.bg }}>
          {['#', 'Cliente', 'Tel.', 'Visitas', 'Última visita', colExtra.label].map(h => (
            <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', textAlign: 'left', borderBottom: `1px solid ${C.borderMid}` }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lista.map((c, i) => (
          <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}
            onMouseOver={e => (e.currentTarget.style.background = C.bg)}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
            <td style={{ padding: '12px 14px', fontSize: 12, color: C.textMuted }}>{i + 1}</td>
            <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: C.textMain }}>{c.nome}</td>
            <td style={{ padding: '12px 14px', fontSize: 12, color: C.textMuted }}>{c.telefone || '—'}</td>
            <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>{c.visitas}×</td>
            <td style={{ padding: '12px 14px', fontSize: 12, color: C.textMuted }}>{new Date(c.ultimaVisita + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
            <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: C.textMain }}>{colExtra.fn(c)}</td>
          </tr>
        ))}
        {lista.length === 0 && (
          <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Nenhum cliente neste critério.</td></tr>
        )}
      </tbody>
    </table>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {btnVisao('frequentes', 'Mais Frequentes')}
        {btnVisao('sumidas', 'Sumidas')}
        {btnVisao('todas', 'Ticket Médio')}

        <input
          placeholder="Filtrar por serviço..."
          value={filtroServico}
          onChange={e => setFiltroServico(e.target.value)}
          style={{ marginLeft: 'auto', padding: '7px 12px', fontSize: 12, borderRadius: 20, border: `1px solid ${C.borderMid}`, color: C.textMain, background: C.bgCard, outline: 'none', width: 220 }}
        />
      </div>

      {/* Aviso de período */}
      <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>
        Período definido no cabeçalho acima · {calc.total} clientes com atendimento no período
      </p>

      {/* Mais frequentes */}
      {visao === 'frequentes' && (
        <>
          <div style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: '20px 24px', border: `1px solid ${C.border}` }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 800, color: C.textMain }}>Top 20 — Clientes Mais Frequentes</h3>
            <BarHoriz dados={calc.frequentes.slice(0, 12).map(c => ({ lb: c.nome, v: c.visitas, extra: `${c.visitas}×` }))} cor={C.sidebarBg} />
          </div>
          <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {tabela(calc.frequentes, { label: 'Ticket Médio', fn: c => brl(c.ticketMedio) })}
          </div>
        </>
      )}

      {/* Sumidas */}
      {visao === 'sumidas' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>Ausente há mais de:</span>
            {[30, 60, 90, 120].map(d => (
              <button key={d} onClick={() => setLimiteSumida(d)} style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${limiteSumida === d ? '#EF4444' : C.borderMid}`,
                background: limiteSumida === d ? '#EF4444' : 'transparent',
                color: limiteSumida === d ? '#fff' : C.textMain,
              }}>{d} dias</button>
            ))}
            <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{calc.sumidas.length} cliente(s)</span>
          </div>
          <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {tabela(calc.sumidas, { label: 'Dias ausente', fn: c => `${c.diasAusente}d` })}
          </div>
        </>
      )}

      {/* Ticket médio */}
      {visao === 'todas' && (
        <>
          <div style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: '20px 24px', border: `1px solid ${C.border}` }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 800, color: C.textMain }}>Top 10 — Maior Ticket Médio</h3>
            <BarHoriz dados={calc.topTicket.map(c => ({ lb: c.nome, v: c.ticketMedio, extra: brl(c.ticketMedio) }))} cor="#D4AF37" />
          </div>
          <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {tabela(calc.topTicket, { label: 'Ticket Médio', fn: c => brl(c.ticketMedio) })}
          </div>
        </>
      )}
    </div>
  );
}
