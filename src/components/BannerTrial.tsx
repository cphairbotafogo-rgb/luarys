'use client'
/**
 * src/components/BannerTrial.tsx
 * Faixa no topo do sistema enquanto o trial está ativo.
 * Mostra quantos dias restam e botão para escolher plano.
 */
import { C } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { FiClock, FiArrowRight, FiX } from 'react-icons/fi';
import { useState } from 'react';

interface Props {
  trialExpiracao: string;   // ISO date string
  onEscolherPlano: () => void;
}

export function BannerTrial({ trialExpiracao, onEscolherPlano }: Props) {
  const [fechado, setFechado] = useState(false);
  if (fechado) return null;

  const expiracao = new Date(trialExpiracao);
  const agora     = new Date();
  const diasRestantes = Math.ceil((expiracao.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));

  if (diasRestantes <= 0) return null; // já expirou — TelaTrialExpirado assume

  const urgente = diasRestantes <= 2;

  const bg     = urgente ? '#FEF3C7' : '#EFF6FF';
  const borda  = urgente ? '#FDE68A' : '#BFDBFE';
  const corIcon= urgente ? '#D97706' : '#3B82F6';
  const corTxt = urgente ? '#92400E' : '#1E40AF';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      padding: '10px 20px', background: bg, borderBottom: `1px solid ${borda}`,
      flexWrap: 'wrap', position: 'relative',
    }}>
      <FiClock size={15} color={corIcon} />

      <span style={{ fontSize: 13, fontWeight: 600, color: corTxt }}>
        {diasRestantes === 1
          ? 'Último dia do seu período de avaliação gratuita.'
          : `Seu trial grátis termina em <strong>${diasRestantes} dias</strong>.`
            .replace('<strong>', '').replace('</strong>', '')}
        {diasRestantes === 1 ? '' : ` (${diasRestantes} dias restantes)`}
      </span>

      <button
        onClick={onEscolherPlano}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', background: corIcon, color: '#fff',
          border: 'none', borderRadius: RAIO_MD, fontSize: 12,
          fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        Escolher plano <FiArrowRight size={12} />
      </button>

      <button
        onClick={() => setFechado(true)}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: corTxt, opacity: 0.5, padding: 4,
        }}
        title="Fechar (o banner volta amanhã)"
      >
        <FiX size={14} />
      </button>
    </div>
  );
}
