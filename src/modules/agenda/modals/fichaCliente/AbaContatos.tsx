import { C } from '@/lib/constants';
import { FONTE_CORPO, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { DDIS } from '@/lib/ddis';

const COMO_CONHECEU = [
  'Instagram', 'Indicação de cliente', 'Passou na frente',
  'Google', 'Facebook', 'TikTok', 'Evento', 'Outro',
];

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

export function AbaContatos({ formCliente, set }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: C.bg, padding: 20, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <label className="font-title" style={{ ...lbl, margin: 0, color: C.textMain }}>Telefones (até 4)</label>
          {(formCliente.telefones || []).length < 4 && (
            <button type="button"
              onClick={() => set('telefones', [...(formCliente.telefones || []), { ddi: '+55', ddd: '', numero: '', tipo: 'Celular' }])}
              style={{ color: C.sidebarBg, fontWeight: 700, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <FiPlus size={14} /> Adicionar
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(formCliente.telefones || []).map((tel: any, idx: number) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 70px 1fr 120px 40px', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={lbl}>País (DDI)</label>
                <select
                  style={{ ...inp, padding: '10px 6px', cursor: 'pointer' }}
                  value={tel.ddi?.startsWith('+') ? tel.ddi : `+${tel.ddi}`}
                  onChange={e => { const n = [...(formCliente.telefones || [])]; n[idx] = { ...n[idx], ddi: e.target.value }; set('telefones', n); }}
                >
                  {DDIS.map(d => (
                    <option key={d.code} value={d.code}>{d.code} {d.emoji} {d.nome}</option>
                  ))}
                </select>
              </div>
              <div><label style={lbl}>DDD</label><input style={{ ...inp, padding: '10px 6px', textAlign: 'center' }} placeholder="21" value={tel.ddd || ''} onChange={e => { const n = [...(formCliente.telefones || [])]; n[idx] = { ...n[idx], ddd: e.target.value }; set('telefones', n); }} /></div>
              <div><label style={lbl}>Número</label><input style={{ ...inp, padding: '10px 12px' }} placeholder="99999-9999" value={tel.numero || ''} onChange={e => { const n = [...(formCliente.telefones || [])]; n[idx] = { ...n[idx], numero: e.target.value }; set('telefones', n); }} /></div>
              <div><label style={lbl}>Tipo</label>
                <select style={{ ...inp, padding: '10px 8px' }} value={tel.tipo || 'Celular'} onChange={e => { const n = [...(formCliente.telefones || [])]; n[idx] = { ...n[idx], tipo: e.target.value }; set('telefones', n); }}>
                  <option>Celular</option><option>Trabalho</option><option>Casa</option><option>Outro</option>
                </select>
              </div>
              {idx > 0 && (
                <button onClick={() => set('telefones', (formCliente.telefones || []).filter((_: any, i: number) => i !== idx))}
                  style={{ background: '#FEF2F2', border: 'none', color: '#EF4444', borderRadius: RAIO_MD, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiTrash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><label style={lbl}>E-mail</label><input type="email" style={inp} value={formCliente.email || ''} onChange={e => set('email', e.target.value)} /></div>
        <div><label style={lbl}>Instagram</label><input style={inp} placeholder="@usuario" value={formCliente.instagram || ''} onChange={e => set('instagram', e.target.value)} /></div>
      </div>
      <div>
        <label style={lbl}>Como nos conheceu</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {COMO_CONHECEU.map(op => (
            <button key={op} type="button" onClick={() => set('como_conheceu', op)}
              style={{
                padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '0.2s',
                border: `1px solid ${formCliente.como_conheceu === op ? C.sidebarBg : C.borderMid}`,
                background: formCliente.como_conheceu === op ? C.sidebarBg : C.bgCard,
                color: formCliente.como_conheceu === op ? '#fff' : C.textMuted,
              }}
            >{op}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
