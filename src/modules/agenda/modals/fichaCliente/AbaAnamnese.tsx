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

const CAMPOS = [
  { campo: 'tipo_cabelo',         label: 'Tipo de Cabelo / Pele',             tipo: 'input',    ph: 'Ex: Cabelo fino, oleoso na raiz...' },
  { campo: 'quimicas_anteriores', label: 'Procedimentos Químicos Anteriores', tipo: 'textarea', ph: 'Ex: Descoloração há 2 meses...' },
  { campo: 'alergias',            label: 'Alergias e Restrições Conhecidas',  tipo: 'textarea', ph: 'Ex: Alergia a amônia, látex...' },
  { campo: 'medicamentos',        label: 'Medicamentos de Uso Frequente',     tipo: 'input',    ph: 'Ex: Isotretinoína, anticoagulantes...' },
  { campo: 'objetivos',           label: 'Objetivos e Desejos da Cliente',    tipo: 'textarea', ph: 'Ex: Quer fazer luzes naturais...' },
];

interface Props {
  formCliente: any;
  setAnamnese: (campo: string, valor: string) => void;
}

export function AbaAnamnese({ formCliente, setAnamnese }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ background: '#FFFBEB', padding: 14, borderRadius: RAIO_MD, border: '1px solid #FDE68A', fontSize: 12, color: '#92400E', fontWeight: 500 }}>
        🔒 Informações confidenciais de uso exclusivo dos profissionais desta unidade.
      </div>
      {CAMPOS.map(({ campo, label, tipo, ph }) => (
        <div key={campo}>
          <label style={lbl}>{label}</label>
          {tipo === 'textarea'
            ? <textarea style={{ ...inp, height: 70, resize: 'none' }} placeholder={ph} value={formCliente.anamnese?.[campo] || ''} onChange={e => setAnamnese(campo, e.target.value)} />
            : <input style={inp} placeholder={ph} value={formCliente.anamnese?.[campo] || ''} onChange={e => setAnamnese(campo, e.target.value)} />
          }
        </div>
      ))}
    </div>
  );
}
