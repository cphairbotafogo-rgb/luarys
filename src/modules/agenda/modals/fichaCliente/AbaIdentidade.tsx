import { C } from '@/lib/constants';
import { FONTE_CORPO, RAIO_MD } from '@/lib/estiloGlobal';

const inp = {
  padding: '11px 14px', borderRadius: RAIO_MD,
  border: `1px solid ${C.borderMid}`, width: '100%', boxSizing: 'border-box' as const,
  outlineColor: C.sidebarBg, fontSize: 13, color: C.textMain,
  backgroundColor: C.bgCard, fontWeight: 500, fontFamily: FONTE_CORPO,
};
const lbl = {
  margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.textMuted,
  display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.5px',
};

interface Props {
  formCliente: any;
  set: (campo: string, valor: any) => void;
}

export function AbaIdentidade({ formCliente, set }: Props) {
  const tipoCliente = formCliente.tipo_cliente || 'PF';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label style={lbl}>Nome Completo *</label>
        <input style={inp} value={formCliente.nome_completo || ''} onChange={e => set('nome_completo', e.target.value)} autoFocus />
      </div>
      <div>
        <label style={lbl}>Tipo de Cliente</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {['PF', 'PJ'].map(tipo => (
            <button key={tipo} type="button" onClick={() => set('tipo_cliente', tipo)}
              style={{
                flex: 1, padding: '11px', borderRadius: RAIO_MD, cursor: 'pointer', transition: '0.2s', fontWeight: 700, fontSize: 13,
                border: `1px solid ${tipoCliente === tipo ? C.sidebarBg : C.borderMid}`,
                background: tipoCliente === tipo ? C.sidebarBg : C.bgCard,
                color: tipoCliente === tipo ? '#fff' : C.textMuted,
              }}
            >
              {tipo === 'PF' ? '👤 Pessoa Física' : '🏢 Pessoa Jurídica'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={lbl}>{tipoCliente === 'PJ' ? 'CNPJ' : 'CPF'}</label>
          <input style={inp}
            placeholder={tipoCliente === 'PJ' ? '00.000.000/0001-00' : '000.000.000-00'}
            value={tipoCliente === 'PJ' ? (formCliente.cnpj || '') : (formCliente.cpf || '')}
            onChange={e => set(tipoCliente === 'PJ' ? 'cnpj' : 'cpf', e.target.value)}
          />
        </div>
        <div>
          <label style={lbl}>Data de Nascimento</label>
          <input type="date" style={inp} value={formCliente.nascimento || ''} onChange={e => set('nascimento', e.target.value)} />
        </div>
      </div>
      <div>
        <label style={lbl}>Gênero</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Feminino', 'Masculino', 'Não-binário', 'Prefiro não informar'].map(g => (
            <button key={g} type="button" onClick={() => set('genero', g)}
              style={{
                padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '0.2s',
                border: `1px solid ${formCliente.genero === g ? C.sidebarBg : C.borderMid}`,
                background: formCliente.genero === g ? C.sidebarBg : C.bgCard,
                color: formCliente.genero === g ? '#fff' : C.textMuted,
              }}
            >{g}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
