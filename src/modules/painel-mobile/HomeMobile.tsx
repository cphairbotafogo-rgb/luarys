'use client'
import { C, brl, getDataHojeLocal } from '@/lib/constants';
import { FiCalendar, FiDollarSign, FiUsers, FiLogOut } from 'react-icons/fi';
import { RAIO_LG, RAIO_XL } from '@/lib/estiloGlobal';
import { BotaoTrocarLayout } from '@/components/BotaoTrocarLayout';
import type { AbaPainelMobile } from './tipos';

interface Props {
  perfil: any;
  resumo: { agendamentos: number; finalizados: number; faturamento: number };
  onTrocarAba: (a: AbaPainelMobile) => void;
  onSair: () => void;
}

export function HomeMobile({ perfil, resumo, onTrocarAba, onSair }: Props) {
  const hoje = getDataHojeLocal().split('-').reverse().join('/');
  const nome = perfil?.nome?.split(' ')[0] || 'Equipe';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ background: C.sidebarBg, padding: '20px 20px 24px', borderBottom: `3px solid ${C.douradoEleva}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: C.douradoEleva, textTransform: 'uppercase', letterSpacing: '1px' }}>Painel do Lojista</p>
            <h1 style={{ fontFamily: 'var(--font-title)', margin: 0, fontSize: 22, fontWeight: 900, color: '#fff' }}>Olá, {nome}!</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Hoje, {hoje}</p>
          </div>
          <button onClick={onSair} style={{ background: 'none', border: `1px solid rgba(255,255,255,0.2)`, color: 'rgba(255,255,255,0.7)', padding: '6px 12px', borderRadius: RAIO_LG, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><FiLogOut size={13} /> Sair</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: RAIO_LG, padding: '10px 12px' }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#fff' }}>{resumo.agendamentos}</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>Agendados</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: RAIO_LG, padding: '10px 12px' }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.success }}>{resumo.finalizados}</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>Finalizados</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: RAIO_LG, padding: '10px 12px' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.douradoEleva }}>{brl(resumo.faturamento)}</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>Faturado</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 80px' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Acesso Rápido</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Agenda', sub: 'Ver o dia', icone: FiCalendar, aba: 'agenda' as AbaPainelMobile },
            { label: 'Caixa', sub: 'Faturamento', icone: FiDollarSign, aba: 'caixa' as AbaPainelMobile },
            { label: 'Clientes', sub: 'Buscar ficha', icone: FiUsers, aba: 'clientes' as AbaPainelMobile },
          ].map(({ label, sub, icone: Icone, aba }) => (
            <div key={aba} onClick={() => onTrocarAba(aba)} style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: '20px 16px', cursor: 'pointer', border: `1px solid ${C.border}`, touchAction: 'manipulation' }}>
              <div style={{ width: 44, height: 44, borderRadius: RAIO_LG, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><Icone size={22} color={C.sidebarBg} /></div>
              <h4 style={{ fontFamily: 'var(--font-title)', margin: '0 0 2px', fontSize: 14, fontWeight: 800, color: C.textMain }}>{label}</h4>
              <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>{sub}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32 }}><BotaoTrocarLayout versaoAtual="mobile" /></div>
      </div>
    </div>
  );
}
