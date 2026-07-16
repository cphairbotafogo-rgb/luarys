'use client'
import { C } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { inputStyle, botaoPrimarioStyle, cardStyle, labelStyle } from '@/lib/portalEstilos';
import { FiUser, FiPhone, FiMail, FiCheckCircle, FiChevronLeft, FiLoader } from 'react-icons/fi';
import { formatarData } from './tipos';
import type { Servico, Profissional } from './tipos';

const wrapStyle = { minHeight: '100vh', background: '#F8FAFC', fontFamily: 'system-ui, sans-serif' };
const container = { maxWidth: 680, margin: '0 auto', padding: '0 16px 80px' };

interface Props {
  header: React.ReactNode;
  servicoSel: Servico;
  profissionalSel: Profissional;
  dataSel: string;
  horaSel: string;
  clienteNome: string; setClienteNome: (v: string) => void;
  clienteTel: string; setClienteTel: (v: string) => void;
  clienteEmail: string; setClienteEmail: (v: string) => void;
  enviando: boolean;
  erroEnvio: string;
  onBack: () => void;
  onConfirmar: () => void;
}

export function EtapaDados({ header, servicoSel, profissionalSel, dataSel, horaSel, clienteNome, setClienteNome, clienteTel, setClienteTel, clienteEmail, setClienteEmail, enviando, erroEnvio, onBack, onConfirmar }: Props) {
  return (
    <div style={wrapStyle}>
      {header}
      <div style={container}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 18px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sidebarBg, padding: 0, display: 'flex' }}><FiChevronLeft size={22} /></button>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.textMain }}>Seus dados</h2>
        </div>

        <div style={{ ...cardStyle, padding: '14px 18px', marginBottom: 20, background: `${C.sidebarBg}08`, borderColor: `${C.sidebarBg}30` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
            {[
              { l: 'Serviço',      v: servicoSel.nome_servico },
              { l: 'Profissional', v: profissionalSel.nome },
              { l: 'Data',         v: formatarData(dataSel) },
              { l: 'Horário',      v: horaSel },
            ].map(r => (
              <div key={r.l}>
                <span style={{ color: C.textMuted, display: 'block', fontSize: 11 }}>{r.l}</span>
                <span style={{ fontWeight: 600, color: C.textMain }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}><FiUser size={11} style={{ display: 'inline', marginRight: 4 }} />Nome completo *</label>
            <input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Seu nome" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}><FiPhone size={11} style={{ display: 'inline', marginRight: 4 }} />Celular (WhatsApp)</label>
            <input value={clienteTel} onChange={e => setClienteTel(e.target.value)} placeholder="(11) 99999-9999" type="tel" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}><FiMail size={11} style={{ display: 'inline', marginRight: 4 }} />E-mail</label>
            <input value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} placeholder="seu@email.com" type="email" style={inputStyle} />
          </div>
        </div>

        {erroEnvio && (
          <div style={{ marginTop: 14, padding: '12px 16px', background: '#FEE2E2', borderRadius: RAIO_MD, color: '#B91C1C', fontSize: 13 }}>
            {erroEnvio}
          </div>
        )}

        <button onClick={onConfirmar} disabled={enviando || !clienteNome.trim()}
          style={{ ...botaoPrimarioStyle, marginTop: 24, opacity: (enviando || !clienteNome.trim()) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {enviando
            ? <><FiLoader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Aguarde...</>
            : <><FiCheckCircle size={16} /> Confirmar agendamento</>}
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: C.textMuted, marginTop: 16, lineHeight: 1.5 }}>
          Ao confirmar, você concorda com os termos de uso do salão.
        </p>
      </div>
    </div>
  );
}
