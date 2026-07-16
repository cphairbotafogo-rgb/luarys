'use client'
import { useState, useRef, useEffect } from "react";
import { FiHelpCircle } from "react-icons/fi";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_LG } from "@/lib/estiloGlobal";

interface Props {
  texto: string;
  tamanho?: number;
  posicao?: 'cima' | 'baixo' | 'direita' | 'esquerda';
}

export function IconeAjuda({ texto, tamanho = 13, posicao = 'cima' }: Props) {
  const [visivel, setVisivel] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!visivel) return;
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setVisivel(false);
    }
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [visivel]);

  const popoverBase: React.CSSProperties = {
    position: 'absolute',
    zIndex: 9999,
    background: C.sidebarBg,
    color: '#fff',
    fontSize: 11,
    fontWeight: 500,
    lineHeight: 1.55,
    padding: '10px 14px',
    borderRadius: RAIO_LG,
    maxWidth: 260,
    minWidth: 160,
    whiteSpace: 'pre-line',
    boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
    pointerEvents: 'none',
  };

  const posStyle: React.CSSProperties =
    posicao === 'cima'     ? { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' } :
    posicao === 'baixo'    ? { top:    'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' } :
    posicao === 'direita'  ? { left:   'calc(100% + 8px)', top: '50%',  transform: 'translateY(-50%)' } :
                             { right:  'calc(100% + 8px)', top: '50%',  transform: 'translateY(-50%)' };

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      onMouseEnter={() => setVisivel(true)}
      onMouseLeave={() => setVisivel(false)}
      onClick={() => setVisivel(v => !v)}
    >
      <FiHelpCircle size={tamanho} color={C.textLight} style={{ flexShrink: 0 }} />
      {visivel && (
        <span style={{ ...popoverBase, ...posStyle }}>
          {texto}
        </span>
      )}
    </span>
  );
}
