'use client'
import { FiBriefcase, FiFileText, FiUser } from 'react-icons/fi';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_LG } from '@/lib/estiloGlobal';
import { mascaraCNPJ, mascaraCPF, limpaCNPJ, validarCNPJ, inputStyle, labelStyle } from './helpers';

interface Props {
  cnpj: string; setCnpj: (v: string) => void;
  razaoSocial: string; setRazaoSocial: (v: string) => void;
  responsavelNome: string; setResponsavelNome: (v: string) => void;
  responsavelCpf: string; setResponsavelCpf: (v: string) => void;
  email: string; nomeSalao: string; cidade: string; estado: string;
}

export function FormPasso3({ cnpj, setCnpj, razaoSocial, setRazaoSocial, responsavelNome, setResponsavelNome, responsavelCpf, setResponsavelCpf, email, nomeSalao, cidade, estado }: Props) {
  const cnpjLimpo = limpaCNPJ(cnpj);
  const cnpjCompleto = cnpjLimpo.length === 14;
  const cnpjValido = cnpjCompleto && validarCNPJ(cnpj);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: '#1E40AF', lineHeight: 1.5 }}>
        <strong>Por que pedimos isso?</strong> Esses dados são necessários para emissão de notas fiscais, geração de contratos e identificação legal da sua empresa no sistema.
      </div>

      <div>
        <label style={labelStyle}>CNPJ *</label>
        <div style={{ position: 'relative' }}>
          <FiBriefcase size={15} style={{ position: 'absolute', left: 14, top: 15, color: C.textLight }} />
          <input
            type="text" placeholder="00.000.000/0001-00"
            value={cnpj}
            onChange={e => setCnpj(mascaraCNPJ(e.target.value))}
            style={{ ...inputStyle, paddingLeft: 40, borderColor: cnpjCompleto ? (cnpjValido ? '#10B981' : '#EF4444') : C.borderMid }}
            autoFocus maxLength={18}
          />
        </div>
        {cnpjCompleto && !cnpjValido && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#EF4444', fontWeight: 600 }}>CNPJ inválido. Verifique o número.</p>
        )}
      </div>

      <div>
        <label style={labelStyle}>Razão Social *</label>
        <div style={{ position: 'relative' }}>
          <FiFileText size={15} style={{ position: 'absolute', left: 14, top: 15, color: C.textLight }} />
          <input type="text" placeholder="Ex: Maria Silva Serviços de Beleza LTDA" value={razaoSocial}
            onChange={e => setRazaoSocial(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 40 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Nome do Responsável *</label>
          <div style={{ position: 'relative' }}>
            <FiUser size={15} style={{ position: 'absolute', left: 14, top: 15, color: C.textLight }} />
            <input type="text" placeholder="Nome completo" value={responsavelNome}
              onChange={e => setResponsavelNome(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 40 }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>CPF do Responsável *</label>
          <input type="text" placeholder="000.000.000-00" value={responsavelCpf}
            onChange={e => setResponsavelCpf(mascaraCPF(e.target.value))}
            style={inputStyle} maxLength={14} />
        </div>
      </div>

      <div style={{ background: C.bg, borderRadius: RAIO_LG, padding: 16, border: `1px solid ${C.border}` }}>
        <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Resumo do cadastro</p>
        {[
          { label: 'E-mail', valor: email },
          { label: 'Salão', valor: nomeSalao },
          { label: 'Cidade', valor: cidade && estado ? `${cidade} - ${estado}` : (cidade || estado || '—') },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: C.textMuted }}>{item.label}</span>
            <span style={{ color: C.textMain, fontWeight: 600 }}>{item.valor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
