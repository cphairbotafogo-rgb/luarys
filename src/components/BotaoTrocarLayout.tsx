'use client'
import { C } from '@/lib/constants';

interface Props {
  versaoAtual: 'mobile' | 'desktop';
}

export function BotaoTrocarLayout({ versaoAtual }: Props) {
  function trocar() {
    const novaVersao = versaoAtual === 'mobile' ? 'desktop' : 'mobile';
    document.cookie = `eleva_layout=${novaVersao}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <button
      onClick={trocar}
      style={{
        background: 'none',
        border: 'none',
        color: C.textLight,
        fontSize: 11,
        cursor: 'pointer',
        textDecoration: 'underline',
        padding: '4px 0',
        fontFamily: 'var(--font-body)',
      }}
    >
      {versaoAtual === 'mobile' ? '🖥 Ver versão desktop' : '📱 Ver versão mobile'}
    </button>
  );
}
