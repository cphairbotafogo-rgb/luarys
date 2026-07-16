// src/modules/agenda/modals/ServicoExtra.tsx
// Linha de serviço adicional dentro do ModalEdicao.
// Campos: busca de serviço, profissional, valor, botão remover.
'use client'
import { C, brl } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { FiTrash2 } from 'react-icons/fi';
import { ServicoExtraItem } from './useModalEdicao';

const inputStyle = {
  padding: '10px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
  width: '100%', boxSizing: 'border-box' as const, outlineColor: C.sidebarBg,
  fontSize: 13, color: C.textMain, backgroundColor: C.bgCard, fontWeight: 500,
};
const labelStyle = {
  margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.textMuted,
  display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.5px',
};

interface Props {
  extra: ServicoExtraItem;
  servicosDb: any[];
  profissionaisDb: any[];
  onAtualizar: (key: number, campo: string, valor: any) => void;
  onSelecionar: (key: number, servico: any) => void;
  onRemover: (key: number) => void;
  isUltimo: boolean;
}

export function ServicoExtra({ extra, servicosDb, profissionaisDb, onAtualizar, onSelecionar, onRemover, isUltimo }: Props) {
  const termoBusca = (extra.servico_nome || '').toLowerCase();
  const filtrados = servicosDb.filter((s: any) => (s.nome_servico || '').toLowerCase().includes(termoBusca));

  return (
    <div style={{ padding: '14px 16px', borderBottom: isUltimo ? 'none' : `1px solid ${C.border}`, background: C.bgCard }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>

        {/* Busca de serviço */}
        <div style={{ position: 'relative' }}>
          <label style={labelStyle}>Serviço</label>
          <input
            style={inputStyle}
            placeholder="Buscar serviço..."
            value={extra.servico_nome}
            autoComplete="off"
            onChange={e => { onAtualizar(extra._key, 'servico_nome', e.target.value); onAtualizar(extra._key, 'buscaAberta', true); }}
            onFocus={() => onAtualizar(extra._key, 'buscaAberta', true)}
            onBlur={() => setTimeout(() => onAtualizar(extra._key, 'buscaAberta', false), 200)}
          />
          {extra.buscaAberta && filtrados.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 16px rgba(0,0,0,0.12)' }}>
              {filtrados.map((s: any) => (
                <div key={s.id} onMouseDown={() => onSelecionar(extra._key, s)}
                  style={{ padding: '9px 12px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', fontSize: 12, color: C.textMain, display: 'flex', justifyContent: 'space-between' }}
                  className="hover:bg-slate-50">
                  <span>{s.nome_servico}</span>
                  {s.preco_padrao != null && <span style={{ color: C.textLight, fontSize: 11 }}>{brl(s.preco_padrao)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profissional */}
        <div>
          <label style={labelStyle}>Profissional</label>
          <select style={inputStyle} value={extra.profissional_id} onChange={e => onAtualizar(extra._key, 'profissional_id', e.target.value)}>
            <option value="">Selecionar...</option>
            {profissionaisDb.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>

        {/* Remover */}
        <button type="button" onClick={() => onRemover(extra._key)}
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: RAIO_MD, padding: '10px', cursor: 'pointer', color: C.danger, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Remover">
          <FiTrash2 size={14} />
        </button>
      </div>

      {/* Valor */}
      <div style={{ marginTop: 10 }}>
        <label style={labelStyle}>Valor (R$)</label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: 11, color: '#10B981', fontWeight: 700, fontSize: 13 }}>R$</span>
          <input
            type="text" inputMode="decimal"
            style={{ ...inputStyle, paddingLeft: 32, fontWeight: 700, color: '#10B981', fontSize: 14 }}
            placeholder="0,00"
            value={extra.valor}
            onChange={e => {
              const v = e.target.value.replace(',', '.');
              if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) onAtualizar(extra._key, 'valor', e.target.value);
            }}
          />
        </div>
      </div>
    </div>
  );
}
