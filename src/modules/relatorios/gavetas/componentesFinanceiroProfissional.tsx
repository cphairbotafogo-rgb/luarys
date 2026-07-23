// src/modules/relatorios/gavetas/componentesFinanceiroProfissional.tsx
// Subcomponentes de apresentação de GavetaFinanceiroProfissional.tsx —
// extraído para manter o componente principal abaixo de 400 linhas.
'use client'
import { C } from '@/lib/constants';
import { RAIO_XS, RAIO_XL } from '@/lib/estiloGlobal';

export function KpiCard({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: string }) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL,
      padding: '16px 20px', flex: 1, minWidth: 140 }}>
      <div style={{ color: C.textLight, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.textMain }}>{valor}</div>
    </div>
  );
}

export function BadgeStatus({ status }: { status: string }) {
  const verde = status === 'Finalizado';
  const vermelho = status === 'Cancelado' || status === 'Faltou';
  const bg = verde ? C.successBg : vermelho ? C.dangerBg : C.border;
  const cor = verde ? C.successText : vermelho ? C.dangerText : C.textMuted;
  return (
    <span style={{ background: bg, color: cor, borderRadius: RAIO_XS,
      padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}
