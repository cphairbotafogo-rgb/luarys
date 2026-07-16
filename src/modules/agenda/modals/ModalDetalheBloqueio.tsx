'use client'
import { C } from "@/lib/constants";
import { RAIO_MD, overlayModal, containerModal } from "@/lib/estiloGlobal";
import { FiX, FiClock, FiEdit3, FiTrash2 } from "react-icons/fi";
import { TIPOS_BLOQUEIO } from "./ModalAusencia";

interface Props {
  bloqueio: any;
  onClose: () => void;
  onAlterarHorario: () => void;
  onRemover: () => void;
}

function calcularHoraFim(inicio: string, duracaoMin: number) {
  const [h, m] = (inicio || '00:00').split(':').map(Number);
  const total = h * 60 + m + (duracaoMin || 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function ModalDetalheBloqueio({ bloqueio, onClose, onAlterarHorario, onRemover }: Props) {
  const match = String(bloqueio?.observacao || '').match(/^\[(.+?)\]\s*([\s\S]*)/);
  const tipoStr = match ? match[1] : (bloqueio?.cliente || 'Bloqueio');
  const motivo = match ? match[2].trim() : '';

  const tipoBloqueio = TIPOS_BLOQUEIO.find(t => t.valor === tipoStr);
  const corPonto = tipoBloqueio?.cor || '#D4A09A';

  const dataFormatada = bloqueio?.data
    ? new Date(bloqueio.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';
  const horaFim = calcularHoraFim(bloqueio?.inicio, bloqueio?.duracaoMin);

  return (
    <div style={{ ...overlayModal, zIndex: 9999 }} onClick={onClose}>
      <div
        style={{ ...containerModal, width: '100%', maxWidth: 360, overflow: 'hidden', padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div style={{ background: '#FDF4F5', borderBottom: '1px solid #F0DADA', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: corPonto, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#7A3A40', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {tipoBloqueio?.label || tipoStr}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B08080', display: 'flex', padding: 4 }}>
            <FiX size={16} />
          </button>
        </div>

        {/* Corpo */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 12, background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiClock size={13} color="#B08080" />
            <span style={{ fontSize: 13, color: '#5A3030', fontWeight: 600 }}>
              {dataFormatada} · {bloqueio?.inicio} – {horaFim}
            </span>
          </div>

          {motivo ? (
            <div style={{ background: '#FDF8F8', borderRadius: RAIO_MD, padding: '10px 14px', border: '1px solid #F0DADA' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#B08080', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Motivo</span>
              <span style={{ fontSize: 13, color: '#3A2020', fontWeight: 500 }}>{motivo}</span>
            </div>
          ) : null}
        </div>

        {/* Ações */}
        <div style={{ padding: '0 18px 18px', display: 'flex', gap: 8, background: '#fff' }}>
          <button
            onClick={onAlterarHorario}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: '#FDF0EE', border: '1px solid #E8C4BC', borderRadius: RAIO_MD, color: '#7A3A3A', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            <FiEdit3 size={13} /> Alterar Horário
          </button>
          <button
            onClick={onRemover}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: RAIO_MD, color: '#DC2626', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            <FiTrash2 size={13} /> Remover Bloqueio
          </button>
        </div>
      </div>
    </div>
  );
}
