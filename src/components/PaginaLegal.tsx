import type { ReactNode } from 'react';

const S = {
  wrap:   { minHeight: '100vh', background: '#F8F9FA', fontFamily: 'var(--font-body)' } as React.CSSProperties,
  header: { background: '#2C3643', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  main:   { maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' } as React.CSSProperties,
  h1:     { fontFamily: 'var(--font-title)', fontSize: 26, fontWeight: 800, color: '#2C3643', margin: '0 0 8px' } as React.CSSProperties,
  meta:   { color: '#718096', fontSize: 13, margin: '0 0 40px', paddingBottom: 24, borderBottom: '1px solid #E2E8F0', display: 'block' } as React.CSSProperties,
  footer: { borderTop: '1px solid #E2E8F0', padding: '24px', textAlign: 'center' as const, color: '#718096', fontSize: 12 },
};

export const SL = {
  h2:  { fontFamily: 'var(--font-title)', fontSize: 15, fontWeight: 700, color: '#2C3643', margin: '36px 0 10px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  p:   { color: '#52525B', fontSize: 14, lineHeight: 1.75, margin: '0 0 12px' } as React.CSSProperties,
  ul:  { color: '#52525B', fontSize: 14, lineHeight: 1.75, paddingLeft: 20, margin: '0 0 12px' } as React.CSSProperties,
  box: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px 20px', margin: '16px 0' } as React.CSSProperties,
  tag: { display: 'inline-block', background: '#2C3643', color: '#D4AF37', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, marginRight: 6, fontFamily: 'var(--font-title)', letterSpacing: '0.3px' } as React.CSSProperties,
};

export function PaginaLegal({ titulo, atualizadoEm, children }: { titulo: string; atualizadoEm: string; children: ReactNode }) {
  return (
    <div style={S.wrap}>
      <header style={S.header}>
        <img src="/logo_luarys.png" alt="Luarys" style={{ height: 34 }} />
        <a href="/" style={{ color: '#D4AF37', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--font-title)', letterSpacing: '0.5px' }}>
          ← INÍCIO
        </a>
      </header>

      <main style={S.main}>
        <h1 style={S.h1}>{titulo}</h1>
        <span style={S.meta}>Última atualização: {atualizadoEm}</span>
        {children}
      </main>

      <footer style={S.footer}>
        © 2026 Luarys Tecnologia · &nbsp;
        <a href="/termos" style={{ color: '#718096' }}>Termos de Uso</a>
        &nbsp;·&nbsp;
        <a href="/privacidade" style={{ color: '#718096' }}>Política de Privacidade</a>
      </footer>
    </div>
  );
}
