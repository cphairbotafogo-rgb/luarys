// src/components/AvisoFinanceiroClienteBanner.tsx
// Banner de aviso rápido de débito/crédito do cliente — usado no momento de
// agendar (ModalNovoAgendamento) e no fechamento de conta, pra recepção e
// caixa saberem antes de fechar a venda. Ver src/lib/useAvisoFinanceiroCliente.ts.
'use client'
import { brl } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { FiAlertCircle, FiCreditCard } from 'react-icons/fi';
import type { AvisoFinanceiroCliente } from '@/lib/useAvisoFinanceiroCliente';

export function AvisoFinanceiroClienteBanner({ aviso }: { aviso: AvisoFinanceiroCliente | null }) {
  if (!aviso || (!aviso.temDebito && !aviso.temCredito)) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      {aviso.temDebito && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: RAIO_MD, padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>
          <FiAlertCircle size={14} /> Cliente com débito pendente: {brl(aviso.valorDebito)}
        </div>
      )}
      {aviso.temCredito && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: RAIO_MD, padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#166534' }}>
          <FiCreditCard size={14} /> Cliente com crédito disponível: {brl(aviso.valorCredito)}
        </div>
      )}
    </div>
  );
}
