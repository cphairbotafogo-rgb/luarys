import { C } from '@/lib/constants';
import { FONTE_CORPO, RAIO_MD } from '@/lib/estiloGlobal';
import { FiSearch } from 'react-icons/fi';

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

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

interface Props {
  formCliente: any;
  set: (campo: string, valor: any) => void;
  buscarCep: (cep: string) => void;
  buscandoCep: boolean;
}

export function AbaEndereco({ formCliente, set, buscarCep, buscandoCep }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label style={lbl}>CEP</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input style={{ ...inp, flex: 1 }} placeholder="00000-000"
            value={formCliente.cep || ''} onChange={e => set('cep', e.target.value)}
            onBlur={e => buscarCep(e.target.value)} maxLength={9} />
          <button type="button" onClick={() => buscarCep(formCliente.cep || '')} disabled={buscandoCep}
            style={{ padding: '0 16px', borderRadius: RAIO_MD, border: 'none', background: C.sidebarBg, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
            <FiSearch size={14} />{buscandoCep ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>
      <div><label style={lbl}>Logradouro</label><input style={inp} placeholder="Rua, Avenida..." value={formCliente.logradouro || ''} onChange={e => set('logradouro', e.target.value)} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16 }}>
        <div><label style={lbl}>Número</label><input style={inp} value={formCliente.numero || ''} onChange={e => set('numero', e.target.value)} /></div>
        <div><label style={lbl}>Complemento</label><input style={inp} placeholder="Apto, Bloco..." value={formCliente.complemento || ''} onChange={e => set('complemento', e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><label style={lbl}>Bairro</label><input style={inp} value={formCliente.bairro || ''} onChange={e => set('bairro', e.target.value)} /></div>
        <div><label style={lbl}>Cidade</label><input style={inp} value={formCliente.cidade || ''} onChange={e => set('cidade', e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 16 }}>
        <div>
          <label style={lbl}>UF</label>
          <select style={inp} value={formCliente.estado || ''} onChange={e => set('estado', e.target.value)}>
            <option value="">—</option>
            {UFS.map(uf => <option key={uf}>{uf}</option>)}
          </select>
        </div>
        <div><label style={lbl}>País</label><input style={inp} value={formCliente.pais || 'Brasil'} onChange={e => set('pais', e.target.value)} /></div>
      </div>
    </div>
  );
}
