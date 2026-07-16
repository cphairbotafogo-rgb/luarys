'use client'
import { FiMail, FiLock } from 'react-icons/fi';
import { C } from '@/lib/constants';
import { inputStyle, labelStyle } from './helpers';

interface Props {
  email: string; setEmail: (v: string) => void;
  senha: string; setSenha: (v: string) => void;
  confirma: string; setConfirma: (v: string) => void;
  onEnter: () => void;
}

export function FormPasso1({ email, setEmail, senha, setSenha, confirma, setConfirma, onEnter }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label style={labelStyle}>E-mail profissional *</label>
        <div style={{ position: 'relative' }}>
          <FiMail size={15} style={{ position: 'absolute', left: 14, top: 15, color: C.textLight }} />
          <input type="email" placeholder="seu@email.com" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 40 }} autoFocus />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Senha *</label>
        <div style={{ position: 'relative' }}>
          <FiLock size={15} style={{ position: 'absolute', left: 14, top: 15, color: C.textLight }} />
          <input type="password" placeholder="Mínimo 6 caracteres" value={senha}
            onChange={e => setSenha(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 40 }} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Confirmar senha *</label>
        <div style={{ position: 'relative' }}>
          <FiLock size={15} style={{ position: 'absolute', left: 14, top: 15, color: C.textLight }} />
          <input type="password" placeholder="Repita a senha" value={confirma}
            onChange={e => setConfirma(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 40 }}
            onKeyDown={e => e.key === 'Enter' && onEnter()} />
        </div>
      </div>
    </div>
  );
}
