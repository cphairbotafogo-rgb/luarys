'use client'
import { C } from '@/lib/constants';

export function BarraProgresso({ pct, cor, height = 6 }: { pct: number; cor: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: 99, background: C.border, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 99, background: cor,
        width: `${Math.min(pct, 100)}%`,
        transition: 'width 1s ease',
      }} />
    </div>
  );
}
