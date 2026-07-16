'use client'
import { FiCheckCircle } from 'react-icons/fi';
import { C } from '@/lib/constants';
import { RAIO_LG } from '@/lib/estiloGlobal';
import type { Passo } from './helpers';

export function PainelLateral({ passo }: { passo: Passo }) {
  return (
    <div
      className="hidden md:flex"
      style={{
        flex: 1, background: `linear-gradient(135deg, ${C.sidebarBg} 0%, #1E252F 100%)`,
        flexDirection: 'column', justifyContent: 'center',
        padding: '60px', position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', zIndex: 10, maxWidth: 400 }}>
        <img src={C.logoUrl} alt="Luarys" style={{ height: 64, marginBottom: 48 }} />

        <h1 className="font-title" style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 20 }}>
          Comece a gerir o<br />seu salão hoje.
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, fontWeight: 500 }}>
          Agenda, caixa, equipe, estoque e relatórios<br />
          num único lugar. Sem complicação.
        </p>

        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { n: 1, label: 'Criar sua conta' },
            { n: 2, label: 'Dados do salão' },
            { n: 3, label: 'Dados da empresa' },
          ].map(({ n, label }) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: passo > n ? '#10B981' : passo === n ? C.douradoEleva : 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: passo > n ? '#fff' : passo === n ? C.sidebarBg : 'rgba(255,255,255,0.4)',
                transition: 'all 0.3s',
              }}>
                {passo > n ? <FiCheckCircle size={14} /> : n}
              </div>
              <span style={{
                fontSize: 13, fontWeight: passo === n ? 700 : 500,
                color: passo === n ? '#fff' : 'rgba(255,255,255,0.45)',
                transition: 'all 0.3s',
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: RAIO_LG, padding: '12px 16px' }}>
          <FiCheckCircle size={16} color={C.douradoEleva} />
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.douradoEleva }}>5 dias grátis, sem cartão</p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Depois, escolha o plano ideal para o seu negócio.</p>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: 400, height: 400, background: 'rgba(255,255,255,0.02)', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: 600, height: 600, background: 'rgba(255,255,255,0.02)', borderRadius: '50%' }} />
    </div>
  );
}
