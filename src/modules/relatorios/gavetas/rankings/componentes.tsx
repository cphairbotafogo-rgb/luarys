// src/modules/relatorios/gavetas/rankings/componentes.tsx
// Helpers e estilos compartilhados entre as tabelas de GavetaRankings —
// extraído de GavetaRankings.tsx (regra do projeto: máx. 400 linhas/arquivo).
'use client'
import React from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { FiChevronUp, FiChevronDown, FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';
import type { OrdemCampo } from '@/modules/relatorios/hooks/useRankingPerformance';

export function fmtPer(s: string, e: string) {
  const [,ms,ds] = s.split('-'); const [,me,de] = e.split('-');
  return `${ds}/${ms} – ${de}/${me}`;
}

export function fmt(d: string | null | undefined) {
  if (!d) return '—';
  const p = d.split('T')[0].split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}

export function medal(i: number) {
  return i < 3 ? ['🥇','🥈','🥉'][i] : String(i + 1);
}

export function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const positivo = pct >= 0;
  const Icon = Math.abs(pct) < 0.1 ? FiMinus : positivo ? FiTrendingUp : FiTrendingDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: positivo ? '#047857' : '#B91C1C', background: positivo ? '#D1FAE5' : '#FEE2E2', borderRadius: 20, padding: '2px 8px' }}>
      <Icon size={11} /> {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function CelComp({ a, b }: { a: string; b?: string | null }) {
  if (!b) return <>{a}</>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontWeight: 700 }}>{a}</span>
      <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>{b}</span>
    </div>
  );
}

// Indicador A/B para a primeira coluna de cada linha
export function AbBadges() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: '#1E3A5F', borderRadius: 3, padding: '1px 5px', lineHeight: 1.5 }}>A</span>
      <span style={{ fontSize: 9, fontWeight: 800, color: '#64748B', background: '#E2E8F0', borderRadius: 3, padding: '1px 5px', lineHeight: 1.5 }}>B</span>
    </div>
  );
}

export function CelDelta({ pct, diff }: { pct: number | null; diff: number }) {
  if (pct === null) return null;
  const pos = diff >= 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <DeltaBadge pct={pct} />
      <span style={{ fontSize: 11, fontWeight: 700, color: pos ? '#047857' : '#B91C1C' }}>{pos ? '+' : ''}{brl(diff)}</span>
    </div>
  );
}

export const inputStyle = { padding: '9px 13px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: C.bgCard, fontWeight: 500 };

export const tdBase: React.CSSProperties = { padding: '13px 16px', fontSize: 13, borderBottom: `1px solid ${C.border}` };
export const tdNum:  React.CSSProperties = { ...tdBase, textAlign: 'right', fontWeight: 600 };
export const tdDest: React.CSSProperties = { ...tdNum, color: C.sidebarBg, fontWeight: 800 };
export const thFixo: React.CSSProperties = { padding: '12px 16px', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', background: C.bg, borderBottom: `1px solid ${C.borderMid}`, width: 48 };

export function thProps(campo: string, ordem: OrdemCampo, setOrdem: (o: OrdemCampo) => void) {
  const ativa = ordem.campo === campo;
  return {
    style: { padding: '12px 16px', fontSize: 10, fontWeight: 700, color: ativa ? C.sidebarBg : C.textLight, textTransform: 'uppercase' as const, cursor: 'pointer', whiteSpace: 'nowrap' as const, userSelect: 'none' as const, textAlign: 'left' as const, background: C.bg, borderBottom: `1px solid ${C.borderMid}` },
    onClick: () => setOrdem(ativa ? { campo, dir: ordem.dir === 'desc' ? 'asc' : 'desc' } : { campo, dir: 'desc' }),
  };
}

export function Seta({ campo, ordem }: { campo: string; ordem: OrdemCampo }) {
  if (ordem.campo !== campo) return <span style={{ color: C.textLight, marginLeft: 4, fontSize: 9 }}>↕</span>;
  return ordem.dir === 'desc' ? <FiChevronDown size={12} style={{ display: 'inline', marginLeft: 3 }} /> : <FiChevronUp size={12} style={{ display: 'inline', marginLeft: 3 }} />;
}
