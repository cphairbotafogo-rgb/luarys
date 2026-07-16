'use client'
import type { CSSProperties } from 'react';

/**
 * Campo de data SEGURO para filtros de busca.
 *
 * Não-controlado durante a digitação (defaultValue + key), então digitar NÃO
 * re-renderiza a tela nem faz o cursor pular de segmento. O valor só é confirmado
 * (onChange do pai) quando o usuário SAI do campo (blur) ou aperta Enter — evitando
 * buscas/re-render a cada tecla. O `key={value}` faz o campo refletir mudanças
 * externas (ex.: botões de período "Hoje/Semana").
 */
export function InputData({
  value, onChange, style, min, max, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  style?: CSSProperties;
  min?: string;
  max?: string;
  disabled?: boolean;
}) {
  const commit = (v: string) => { if (v && v !== value) onChange(v); };
  return (
    <input
      key={value}
      type="date"
      defaultValue={value}
      min={min}
      max={max}
      disabled={disabled}
      onBlur={e => commit(e.currentTarget.value)}
      onKeyDown={e => { if (e.key === 'Enter') commit(e.currentTarget.value); }}
      style={style}
    />
  );
}
