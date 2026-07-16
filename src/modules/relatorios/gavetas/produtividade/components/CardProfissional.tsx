'use client'
import { C } from '@/lib/constants';
import { RAIO_SM, RAIO_XL } from '@/lib/estiloGlobal';
import { corValorHora, labelValorHora, brl as brlLocal, fmtHoras } from '../tipos';

const card = {
  background: C.bgCard,
  border: `1px solid ${C.border}`,
  borderRadius: RAIO_XL,
  padding: '20px 24px',
} as const;

export function CardProfissional({ prof, meta, rank }: { prof: any; meta: number; rank: number }) {
  const pct = meta > 0 ? Math.min((prof.valorHora / meta) * 100, 100) : 0;
  const cor = corValorHora(prof.valorHora);
  const label = labelValorHora(prof.valorHora);

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12, borderLeft: `4px solid ${cor}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: C.sidebarBg, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#fff',
          }}>
            {rank}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textMain }}>{prof.nome}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              {prof.atendimentos} atend. · {fmtHoras(prof.minutosTrabalhados)} em cadeira
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: cor }}>{brlLocal(prof.valorHora)}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>por hora</div>
        </div>
      </div>

      {prof.atendimentos > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginBottom: 5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: cor, fontWeight: 700 }}>{label}</span>
            <span>{Math.round(pct)}% da meta ({brlLocal(meta)}/h)</span>
          </div>
          <div style={{ height: 7, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: cor, width: `${pct}%`, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      )}

      {prof.atendimentos === 0 && (
        <div style={{ background: C.bg, borderRadius: RAIO_SM, padding: '8px 12px', fontSize: 12, color: C.textMuted, fontWeight: 500, textAlign: 'center' }}>
          Nenhum atendimento finalizado neste período
        </div>
      )}

      {prof.semDuracao && prof.atendimentos > 0 && (
        <div style={{ background: C.warningBg, borderRadius: RAIO_SM, padding: '8px 12px', fontSize: 12, color: C.warning, fontWeight: 600 }}>
          ⚠️ Duração dos serviços não preenchida — valor/hora não pode ser calculado.
          Configure a duração nos serviços desta profissional para ver o indicador.
        </div>
      )}

      {!prof.semDuracao && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 4 }}>
          {[
            { label: 'Faturamento', valor: brlLocal(prof.faturamento) },
            { label: 'Ticket médio', valor: brlLocal(prof.ticketMedio) },
          ].map(m => (
            <div key={m.label} style={{ background: C.bg, borderRadius: RAIO_SM, padding: '8px 12px' }}>
              <div style={{ fontSize: 11, color: C.textMuted }}>{m.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textMain }}>{m.valor}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
