// src/lib/useEhMobile.ts
// Detecta tela estreita (celular) por largura de viewport — usado em todo
// lugar que precisa trocar um layout lado-a-lado por um empilhado/gaveta
// abaixo de 768px. Reagem a resize (giro de tela, etc.).
'use client'
import { useState, useEffect } from 'react';

const BREAKPOINT_MOBILE = 768;

export function useEhMobile(breakpoint: number = BREAKPOINT_MOBILE): boolean {
  const [ehMobile, setEhMobile] = useState(false);

  useEffect(() => {
    function checar() { setEhMobile(window.innerWidth < breakpoint); }
    checar();
    window.addEventListener('resize', checar);
    return () => window.removeEventListener('resize', checar);
  }, [breakpoint]);

  return ehMobile;
}
