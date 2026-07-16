'use client'
import { FiLink, FiMapPin, FiPhone } from 'react-icons/fi';
import { C } from '@/lib/constants';
import { slugify, inputStyle, labelStyle } from './helpers';

interface Props {
  nomeSalao: string;
  setNomeSalao: (v: string) => void;
  slugPreview: string;
  onSlugChange: (val: string) => void;
  telefone: string; setTelefone: (v: string) => void;
  cidade: string; setCidade: (v: string) => void;
  estado: string; setEstado: (v: string) => void;
}

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
             'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export function FormPasso2({ nomeSalao, setNomeSalao, slugPreview, onSlugChange, telefone, setTelefone, cidade, setCidade, estado, setEstado }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label style={labelStyle}>Nome do salão *</label>
        <input type="text" placeholder="Ex: Studio Maria Beleza" value={nomeSalao}
          onChange={e => setNomeSalao(e.target.value)}
          style={inputStyle} autoFocus />
      </div>

      <div>
        <label style={labelStyle}>Link do seu portal *</label>
        <div style={{ position: 'relative' }}>
          <FiLink size={15} style={{ position: 'absolute', left: 14, top: 15, color: C.textLight }} />
          <input type="text" placeholder="meu-salao" value={slugPreview}
            onChange={e => onSlugChange(slugify(e.target.value))}
            style={{ ...inputStyle, paddingLeft: 40 }} />
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: C.textLight }}>
          Seus clientes acessarão: <strong style={{ color: C.sidebarBg }}>luarys.app/portal?s={slugPreview || 'meu-salao'}</strong>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Cidade</label>
          <div style={{ position: 'relative' }}>
            <FiMapPin size={15} style={{ position: 'absolute', left: 14, top: 15, color: C.textLight }} />
            <input type="text" placeholder="São Paulo" value={cidade}
              onChange={e => setCidade(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 40 }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Estado</label>
          <select value={estado} onChange={e => setEstado(e.target.value)} style={inputStyle}>
            <option value="">UF</option>
            {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Telefone / WhatsApp</label>
        <div style={{ position: 'relative' }}>
          <FiPhone size={15} style={{ position: 'absolute', left: 14, top: 15, color: C.textLight }} />
          <input type="tel" placeholder="(11) 99999-9999" value={telefone}
            onChange={e => setTelefone(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 40 }} />
        </div>
      </div>
    </div>
  );
}
