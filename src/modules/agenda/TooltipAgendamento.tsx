// src/modules/agenda/TooltipAgendamento.tsx
// Tooltip exibido ao passar o mouse sobre um agendamento na grade.
// Mostra: nome, horário, serviço, observações (se houver) e telefone clicável (abre WhatsApp).
'use client'
import { C } from '@/lib/constants';
import { RAIO_LG, SOMBRA_ELEVADO } from '@/lib/estiloGlobal';
import { FiPhone, FiScissors, FiClock, FiMessageSquare } from 'react-icons/fi';

interface Props {
  ag: any;
  clientesDb: any[];
  // coordenadas de viewport (getBoundingClientRect)
  top: number;
  left: number;
  larguraColuna: number;
}

export function TooltipAgendamento({ ag, clientesDb, top, left }: Props) {
  const cliente = clientesDb.find((c: any) => c.nome_completo === ag.cliente);
  const telefone = cliente?.telefone_whatsapp || cliente?.telefone || null;
  const obsFixa = cliente?.obs_fixa || null;
  const numeroLimpo = telefone ? telefone.replace(/\D/g, '') : null;

  // Garante que não saia da tela pela direita
  const menuWidth = 230;
  const posLeft = left + menuWidth > window.innerWidth ? left - menuWidth - 16 : left;

  function abrirWhatsApp(e: React.MouseEvent) {
    e.stopPropagation();
    if (!numeroLimpo) return;
    const nome = ag.cliente.split(' ')[0];
    const msg = encodeURIComponent(`Olá ${nome}, tudo bem? Aqui é do salão! `);
    window.open(`https://wa.me/55${numeroLimpo}?text=${msg}`, '_blank');
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: Math.max(top, 8),
        left: posLeft,
        zIndex: 9991,
        background: C.bgCard,
        border: `1px solid ${C.borderMid}`,
        borderRadius: RAIO_LG,
        boxShadow: SOMBRA_ELEVADO,
        padding: '14px 16px',
        width: 220,
        pointerEvents: 'all',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Nome do cliente */}
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: C.textMain }}>
        {ag.cliente}
      </p>

      {/* Horário */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
        <FiClock size={11} />
        <span>{ag.inicio} — {(() => {
          const [h, m] = ag.inicio.split(':').map(Number);
          const fimMin = h * 60 + m + (ag.duracaoMin || 60);
          return `${String(Math.floor(fimMin / 60)).padStart(2, '0')}:${String(fimMin % 60).padStart(2, '0')}`;
        })()}</span>
      </div>

      {/* Serviço */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textMuted, marginBottom: ag.observacao ? 8 : 10 }}>
        <FiScissors size={11} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ag.servico}</span>
      </div>

      {/* Observações Fixas do cliente (prioridade) */}
      {obsFixa && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, marginBottom: 10, lineHeight: 1.4, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '6px 8px' }}>
          <FiMessageSquare size={11} style={{ marginTop: 1, flexShrink: 0, color: '#B45309' }} />
          <span style={{ wordBreak: 'break-word', color: '#92400E', fontWeight: 600 }}>{obsFixa}</span>
        </div>
      )}

      {/* Telefone clicável */}
      {telefone ? (
        <button
          onClick={abrirWhatsApp}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#25D366', color: '#fff',
            border: 'none', borderRadius: 8, padding: '8px 12px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textLight }}>
          <FiPhone size={11} /> Sem telefone cadastrado
        </div>
      )}
    </div>
  );
}
