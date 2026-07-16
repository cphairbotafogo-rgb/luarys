'use client'
import { C } from '@/lib/constants';
import { FONTE_TITULO } from '@/modules/portal/estiloPortal';
import { FiHome, FiCalendar, FiClock, FiUser } from 'react-icons/fi';

interface Props {
  onAgendar: () => void;
  onHistorico: () => void;
  onPerfil: () => void;
}

export function NavBarMobile({ onAgendar, onHistorico, onPerfil }: Props) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: C.bgCard, borderTop: `1px solid ${C.border}`,
      display: 'flex', height: 64, zIndex: 100,
    }}>
      <NavItem icone={FiHome} label="Início" cor={C.sidebarBg} ativo />
      <button
        onClick={onAgendar}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer',
          color: C.sidebarBg, padding: '4px',
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: C.sidebarBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(44,54,67,0.35)', marginTop: -20,
        }}>
          <FiCalendar size={22} color="#fff" />
        </div>
      </button>
      <NavItem icone={FiClock} label="Serviços" onClick={onHistorico} />
      <NavItem icone={FiUser} label="Perfil" onClick={onPerfil} />
    </nav>
  );
}

function NavItem({ icone: Icone, label, cor, ativo, onClick }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 3, background: 'none', border: 'none',
        cursor: 'pointer', padding: '8px 4px',
        color: ativo ? C.sidebarBg : C.textLight,
      }}
    >
      <Icone size={20} />
      <span style={{ fontFamily: FONTE_TITULO, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>
        {label}
      </span>
    </button>
  );
}
