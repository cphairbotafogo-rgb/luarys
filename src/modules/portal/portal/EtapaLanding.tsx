'use client'
import { C, brl } from '@/lib/constants';
import { cardStyle, botaoPrimarioStyle } from '@/lib/portalEstilos';
import { FiCalendar, FiStar, FiPhone, FiInstagram } from 'react-icons/fi';
import type { Salao, Servico } from './tipos';

const wrapStyle  = { minHeight: '100vh', background: '#F8FAFC', fontFamily: 'system-ui, sans-serif' };
const container  = { maxWidth: 680, margin: '0 auto', padding: '0 16px 80px' };

interface Props {
  salao: Salao;
  servicos: Servico[];
  header: React.ReactNode;
  onIniciar: () => void;
  onServicoClick: (s: Servico) => void;
}

export function EtapaLanding({ salao, servicos, header, onIniciar, onServicoClick }: Props) {
  return (
    <div style={wrapStyle}>
      {header}
      <div style={container}>
        {salao.sobre_nos && (
          <div style={{ ...cardStyle, padding: '20px 24px', margin: '20px 0 0' }}>
            <p style={{ margin: 0, fontSize: 14, color: C.textMuted, lineHeight: 1.7 }}>{salao.sobre_nos}</p>
          </div>
        )}

        <div style={{ ...cardStyle, padding: '24px', marginTop: 20, textAlign: 'center' }}>
          <FiCalendar size={32} style={{ color: C.sidebarBg, marginBottom: 12 }} />
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: C.textMain }}>Agende online</h2>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: C.textMuted }}>Escolha o serviço, profissional e horário de sua preferência.</p>
          <button onClick={onIniciar} style={{ ...botaoPrimarioStyle, width: 'auto', padding: '12px 40px' }}>
            Agendar agora
          </button>
        </div>

        {servicos.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <FiStar size={13} style={{ display: 'inline', marginRight: 6 }} />Nossos serviços
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {servicos.slice(0, 6).map(s => (
                <div key={s.id} onClick={() => onServicoClick(s)}
                  style={{ ...cardStyle, padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600, color: C.textMain }}>{s.nome_servico}</p>
                    <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>{s.duracao_minutos} min</p>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.sidebarBg }}>{brl(s.preco_padrao)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(salao.telefone || salao.instagram) && (
          <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
            {salao.telefone && (
              <a href={`tel:${salao.telefone}`} style={{ flex: 1, ...cardStyle, padding: '14px', textAlign: 'center', textDecoration: 'none', color: C.textMain, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <FiPhone size={15} style={{ color: C.sidebarBg }} /> {salao.telefone}
              </a>
            )}
            {salao.instagram && (
              <a href={`https://instagram.com/${salao.instagram.replace('@','')}`} target="_blank" rel="noreferrer"
                style={{ flex: 1, ...cardStyle, padding: '14px', textAlign: 'center', textDecoration: 'none', color: C.textMain, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <FiInstagram size={15} style={{ color: '#E1306C' }} /> Instagram
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
