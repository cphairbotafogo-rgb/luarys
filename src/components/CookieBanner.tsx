'use client'
import { useState, useEffect } from 'react';

const CHAVE = 'luarys_cookies_aceitos';

export function CookieBanner() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CHAVE)) setVisivel(true);
  }, []);

  function aceitar() {
    localStorage.setItem(CHAVE, JSON.stringify({ aceito: true, em: new Date().toISOString() }));
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#2C3643', color: '#E2E8F0',
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
      fontFamily: 'var(--font-body)',
    }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, flex: 1, minWidth: 260 }}>
        Usamos cookies estritamente necessários para manter sua sessão segura e suas preferências salvas.{' '}
        <a href="/privacidade#8" style={{ color: '#D4AF37', fontWeight: 600, textDecoration: 'underline' }}>
          Saiba mais
        </a>
      </p>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <a
          href="/privacidade"
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', color: '#E2E8F0', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', fontFamily: 'var(--font-title)', letterSpacing: '0.3px' }}
        >
          VER POLÍTICA
        </a>
        <button
          onClick={aceitar}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D4AF37', color: '#2C3643', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-title)', letterSpacing: '0.3px' }}
        >
          ENTENDIDO
        </button>
      </div>
    </div>
  );
}
