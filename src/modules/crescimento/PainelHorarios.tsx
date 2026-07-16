'use client'
/**
 * src/modules/crescimento/PainelHorarios.tsx
 *
 * Onde a agenda fica vazia — inverso do Relatórios → Termômetro (que destaca
 * a célula mais cheia). Aqui o foco é achar oportunidade de preenchimento,
 * só dentro do horário de funcionamento real do salão.
 */

import { C } from '@/lib/constants';
import { RAIO_XS, RAIO_XL } from '@/lib/estiloGlobal';
import { FiClock } from 'react-icons/fi';
import { type CelulaHorario } from './tipos';

interface Props {
  celulas: CelulaHorario[];
}

export function PainelHorarios({ celulas }: Props) {
  if (celulas.length === 0) {
    return (
      <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <FiClock size={16} color={C.sidebarBg} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>Onde a agenda fica vazia</span>
        </div>
        <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic' }}>
          Configure o horário de funcionamento do salão em Configurações para ver esta análise.
        </p>
      </div>
    );
  }

  // Divide pelo número real de vezes que AQUELE DIA ocorreu no período
  // (calculado em tipos.ts → ocorrenciasDia), não pelo período total / 7.
  const comTaxa = celulas.map(c => ({ ...c, taxaOcupacao: c.ocupacao / Math.max(1, c.ocorrenciasDia) }));
  const ociosas = [...comTaxa].sort((a, b) => a.taxaOcupacao - b.taxaOcupacao).slice(0, 8);

  const maxTaxa = Math.max(1, ...comTaxa.map(c => c.taxaOcupacao));

  return (
    <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <FiClock size={16} color={C.sidebarBg} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>Onde a agenda fica vazia</span>
      </div>
      <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 16px' }}>
        Horários do seu próprio expediente com menos movimento — oportunidade de preencher com promoção ou divulgação.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ociosas.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
            <span style={{ width: 90, color: C.textMain, fontWeight: 600 }}>{c.dia}, {String(c.hora).padStart(2, '0')}h</span>
            <div style={{ flex: 1, height: 16, background: C.bg, borderRadius: RAIO_XS, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: RAIO_XS,
                width: `${Math.max(3, (c.taxaOcupacao / maxTaxa) * 100)}%`,
                background: c.taxaOcupacao === 0 ? '#FCA5A5' : '#FCD34D',
              }} />
            </div>
            <span style={{ width: 90, textAlign: 'right', color: C.textMuted, fontSize: 11 }}>
              {c.taxaOcupacao.toFixed(1)} agend./semana
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
