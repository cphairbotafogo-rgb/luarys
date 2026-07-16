import { C } from '@/lib/constants';
import { FONTE_CORPO, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiTag } from 'react-icons/fi';

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
  etiquetasDb: any[];
  toggleEtiqueta: (tag: any) => void;
}

export function AbaPreferencias({ formCliente, set, etiquetasDb, toggleEtiqueta }: Props) {
  const etiquetasCliente: any[] = formCliente.etiquetas || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}><FiTag size={12} /> Etiquetas do Cliente</label>
        {etiquetasDb.length === 0
          ? <p style={{ fontSize: 12, color: C.textLight, margin: 0 }}>Nenhuma etiqueta criada ainda. Crie pelo modal de agendamento.</p>
          : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {etiquetasDb.map((tag: any) => {
                const ativa = etiquetasCliente.find((t: any) => t.id === tag.id);
                return (
                  <button key={tag.id} type="button" onClick={() => toggleEtiqueta(tag)}
                    style={{
                      padding: '7px 14px', borderRadius: 20, border: `2px solid ${tag.cor}`,
                      background: ativa ? tag.cor : 'transparent',
                      color: ativa ? '#fff' : tag.cor,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: '0.2s',
                    }}
                  >{ativa ? '✓ ' : ''}{tag.nome}</button>
                );
              })}
            </div>
          )
        }
      </div>
      <div>
        <label style={lbl}>Observações Fixas</label>
        <textarea style={{ ...inp, height: 90, resize: 'none' }}
          placeholder="Alergias, preferências, alertas importantes..."
          value={formCliente.observacoes || ''} onChange={e => set('observacoes', e.target.value)} />
      </div>
      <div style={{ background: C.bg, borderRadius: RAIO_XL, padding: 20, border: `1px solid ${C.border}` }}>
        <label className="font-title" style={{ ...lbl, color: C.textMain, margin: '0 0 14px' }}>Comunicação Automática</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { campo: 'aceita_notificacoes', label: 'Lembretes de agendamento (WhatsApp / E-mail)', icon: '🔔' },
            { campo: 'aceita_campanhas', label: 'Promoções e campanhas de marketing', icon: '📣' },
          ].map(({ campo, label, icon }) => (
            <label key={campo} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 13, color: C.textMain, fontWeight: 500 }}>
              <div onClick={() => set(campo, !formCliente[campo])}
                style={{
                  width: 44, height: 24, borderRadius: RAIO_XL, cursor: 'pointer',
                  background: formCliente[campo] !== false ? C.sidebarBg : '#CBD5E1',
                  position: 'relative', transition: '0.25s', flexShrink: 0,
                }}
              >
                <div style={{
                  width: 18, height: 18, background: C.bgCard, borderRadius: '50%',
                  position: 'absolute', top: 3,
                  left: formCliente[campo] !== false ? 23 : 3,
                  transition: '0.25s',
                }} />
              </div>
              {icon} {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
