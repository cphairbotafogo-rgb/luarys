'use client'
import { useState } from 'react';
import { C } from '@/lib/constants';
import { FONTE_TITULO } from '@/lib/estiloGlobal';
import { FiSliders, FiFileText, FiDollarSign, FiBookOpen } from 'react-icons/fi';
import { Calculadora } from './Calculadora';
import { Contratos } from './Contratos';
import { Recebimentos } from './Recebimentos';
import { ModeloContrato } from './ModeloContrato';

type SubAba = 'calculadora' | 'contratos' | 'recebimentos' | 'modelo';

const ABAS: { id: SubAba; label: string; icon: React.ReactNode }[] = [
  { id: 'calculadora', label: 'Calculadora de Custo', icon: <FiSliders size={14} /> },
  { id: 'contratos',   label: 'Contratos',            icon: <FiFileText size={14} /> },
  { id: 'recebimentos',label: 'Recebimentos',          icon: <FiDollarSign size={14} /> },
  { id: 'modelo',      label: 'Modelo de Contrato',   icon: <FiBookOpen size={14} /> },
];

export function AbaAluguel({ perfil }: { perfil: any }) {
  const [subAba, setSubAba] = useState<SubAba>('calculadora');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Sub-navegação */}
      <div style={{ display: 'flex', background: C.bg, borderBottom: `1px solid ${C.border}`, padding: '0 4px', marginBottom: 28, borderRadius: '10px 10px 0 0', gap: 2 }}>
        {ABAS.map(aba => (
          <button
            key={aba.id}
            onClick={() => setSubAba(aba.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '12px 18px', border: 'none', background: 'transparent',
              color: subAba === aba.id ? C.sidebarBg : C.textLight,
              borderBottom: subAba === aba.id ? `2px solid ${C.sidebarBg}` : '2px solid transparent',
              fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 11,
              cursor: 'pointer', transition: '0.15s', textTransform: 'uppercase', letterSpacing: '0.4px',
              whiteSpace: 'nowrap',
            }}
          >
            {aba.icon} {aba.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {subAba === 'calculadora'  && <Calculadora  perfil={perfil} />}
      {subAba === 'contratos'    && <Contratos    perfil={perfil} />}
      {subAba === 'recebimentos' && <Recebimentos perfil={perfil} />}
      {subAba === 'modelo'       && <ModeloContrato perfil={perfil} />}
    </div>
  );
}
