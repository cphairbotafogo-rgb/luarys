'use client'
/**
 * src/components/AlertasAniversario.tsx
 *
 * Widget discreto para o Dashboard mostrando:
 *   - Aniversariantes de hoje (urgente)
 *   - Clientes com aniversário nos próximos 7 dias sem agendamento (alerta)
 *
 * Aparece apenas quando há clientes nessas condições.
 */

import { useMemo } from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { filtrarAniversariantes, montarMsgAniversario } from '@/lib/aniversarios';
import { FiGift, FiAlertTriangle, FiMessageCircle, FiCalendar, FiX } from 'react-icons/fi';

export function AlertasAniversario({
  clientes,
  agendamentos,
  nomeSalao,
  msgAniversario,
  onAgendar,
  onDismiss,
}: {
  clientes: any[];
  agendamentos: any[];
  nomeSalao: string;
  msgAniversario?: string | null;
  onAgendar?: (cliente: any) => void;
  onDismiss?: () => void;
}) {
  // Aniversariantes de hoje
  const hoje = useMemo(() =>
    filtrarAniversariantes(clientes, agendamentos, 'dia'),
  [clientes, agendamentos]);

  // Próximos 7 dias sem agendamento
  const proximosSemAgendamento = useMemo(() =>
    filtrarAniversariantes(clientes, agendamentos, 'semana')
      .filter(({ info }) => info.status === 'alerta'),
  [clientes, agendamentos]);

  if (hoje.length === 0 && proximosSemAgendamento.length === 0) return null;

  function abrirWhatsApp(cliente: any) {
    if (!cliente.telefone_whatsapp) return;
    const num = cliente.telefone_whatsapp.replace(/\D/g, '');
    const msg = montarMsgAniversario(cliente.nome_completo, nomeSalao, msgAniversario);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>

      {/* ── HOJE ──────────────────────────────────────────────────────────── */}
      {hoje.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
          border: '1px solid #FCD34D', borderRadius: RAIO_XL, padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🎂</span>
              <div>
                <p className="font-title" style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Aniversário Hoje!
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#B45309' }}>
                  {hoje.length} cliente{hoje.length > 1 ? 's fazem' : ' faz'} aniversário agora
                </p>
              </div>
            </div>
            {onDismiss && (
              <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B45309', opacity: 0.6 }}>
                <FiX size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hoje.map(({ cliente }) => (
              <div key={cliente.id} style={{
                background: 'rgba(255,255,255,0.7)', borderRadius: RAIO_MD,
                padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#78350F' }}>{cliente.nome_completo}</p>
                  {cliente.telefone_whatsapp && (
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#92400E' }}>{cliente.telefone_whatsapp}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => abrirWhatsApp(cliente)}
                    style={{
                      padding: '7px 12px', borderRadius: 7, border: 'none',
                      background: C.success, color: '#fff',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <FiMessageCircle size={13} /> Parabéns 🎉
                  </button>
                  {onAgendar && (
                    <button
                      onClick={() => onAgendar(cliente)}
                      style={{
                        padding: '7px 12px', borderRadius: 7,
                        border: '1px solid #D97706', background: 'transparent',
                        color: '#92400E', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <FiCalendar size={13} /> Agendar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PRÓXIMOS 7 DIAS SEM AGENDAMENTO ──────────────────────────────── */}
      {proximosSemAgendamento.length > 0 && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: RAIO_XL, padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <FiAlertTriangle size={18} color="#EF4444" />
            <div>
              <p className="font-title" style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Aniversários Próximos — Sem Agendamento
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#B91C1C' }}>
                {proximosSemAgendamento.length} cliente{proximosSemAgendamento.length > 1 ? 's' : ''} sem agendamento nos próximos 7 dias
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proximosSemAgendamento.slice(0, 5).map(({ cliente, info }) => (
              <div key={cliente.id} style={{
                background: 'rgba(255,255,255,0.7)', borderRadius: RAIO_MD,
                padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#991B1B' }}>{cliente.nome_completo}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#EF4444', fontWeight: 600 }}>{info.label}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => abrirWhatsApp(cliente)}
                    style={{ padding: '6px 10px', borderRadius: 7, border: 'none', background: '#ECFDF5', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <FiMessageCircle size={12} /> Contatar
                  </button>
                  {onAgendar && (
                    <button
                      onClick={() => onAgendar(cliente)}
                      style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <FiCalendar size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {proximosSemAgendamento.length > 5 && (
              <p style={{ margin: 0, fontSize: 12, color: '#B91C1C', textAlign: 'center', fontWeight: 600 }}>
                + {proximosSemAgendamento.length - 5} clientes — ver em Inteligência → Aniversariantes
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}