'use client'
import { C } from '@/lib/constants';
import { FiCalendar, FiDollarSign, FiUsers, FiMenu } from 'react-icons/fi';
import type { AbaPainelMobile } from './tipos';

const ABAS = [
  { id: 'agenda' as AbaPainelMobile, label: 'Agenda', icone: FiCalendar },
  { id: 'caixa' as AbaPainelMobile, label: 'Caixa', icone: FiDollarSign },
  { id: 'clientes' as AbaPainelMobile, label: 'Clientes', icone: FiUsers },
  { id: 'menu' as AbaPainelMobile, label: 'Menu', icone: FiMenu },
];

interface Props {
  aba: AbaPainelMobile;
  onTrocar: (a: AbaPainelMobile) => void;
}

export function NavBarPainelMobile({ aba, onTrocar }: Props) {
  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.sidebarBg, display: 'flex', height: 64, zIndex: 100 }}>
      {ABAS.map(({ id, label, icone: Icone }) => {
        const ativo = aba === id;
        return (
          <button key={id} onClick={() => onTrocar(id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', color: ativo ? C.douradoEleva : 'rgba(255,255,255,0.55)', borderTop: ativo ? `2px solid ${C.douradoEleva}` : '2px solid transparent' }}>
            <Icone size={20} />
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-title)', letterSpacing: '0.5px' }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
