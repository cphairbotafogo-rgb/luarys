'use client'
import { FiCheckCircle, FiLoader } from 'react-icons/fi';
import { C } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';

export function FormPasso4({ responsavelNome }: { responsavelNome: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ width: 72, height: 72, background: '#F0FDF4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <FiCheckCircle size={36} color="#10B981" />
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: C.sidebarBg }}>
        Bem-vindo ao Luarys, {responsavelNome.split(' ')[0]}!
      </h3>
      <p style={{ margin: '0 0 8px', fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
        Sua conta foi criada com sucesso.
      </p>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: RAIO_MD, padding: '8px 16px', marginBottom: 20 }}>
        <FiCheckCircle size={14} color="#D97706" />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>5 dias de trial grátis ativados</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.textLight }}>
        <FiLoader className="animate-spin" size={16} />
        <span style={{ fontSize: 13 }}>Entrando no sistema...</span>
      </div>
    </div>
  );
}
