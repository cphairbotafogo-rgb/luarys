// src/modules/agenda/modals/MenuContextoAgendamento.tsx
// Menu de clique direito sobre um agendamento na grade.
// Opções: ver/editar, alterar status (com cor), serviços do dia,
//         fechar conta, editar cliente, cancelar/faltou.
'use client'
import { C } from '@/lib/constants';
import { RAIO_LG, SOMBRA_ELEVADO } from '@/lib/estiloGlobal';
import {
  FiEdit2, FiCheckCircle, FiX, FiUser, FiScissors,
  FiDollarSign, FiClock, FiAlertCircle, FiMessageCircle,
} from 'react-icons/fi';
import { COR_POR_STATUS } from '@/lib/agendaUtils';

interface Props {
  ag: any;                          // agendamento selecionado
  x: number;                        // posição X do menu (px, viewport)
  y: number;                        // posição Y do menu (px, viewport)
  onFechar: () => void;
  onEditar: () => void;
  onAlterarStatus: (status: string) => void;
  onFecharConta: () => void;
  onEditarCliente: () => void;
  onCancelar: () => void;           // abre ModalCancelamento com tipoAcao='cancelado'
  onFaltou: () => void;             // abre ModalCancelamento com tipoAcao='faltou'
  onWhatsApp?: () => void;
  temTelefone?: boolean;
  isGerenteOuDono: boolean;
}

const STATUS_MENU = [
  { status: 'Agendado',       label: 'Agendado',        icon: <FiClock size={13} /> },
  { status: 'Confirmado',     label: 'Confirmado',      icon: <FiCheckCircle size={13} /> },
  { status: 'Aguardando',     label: 'Aguardando',      icon: <FiClock size={13} /> },
  { status: 'Em Atendimento', label: 'Em Atendimento',  icon: <FiScissors size={13} /> },
  { status: 'Finalizado',     label: 'Finalizado',      icon: <FiCheckCircle size={13} /> },
];

export function MenuContextoAgendamento({
  ag, x, y, onFechar, onEditar, onAlterarStatus,
  onFecharConta, onEditarCliente, onCancelar, onFaltou,
  onWhatsApp, temTelefone, isGerenteOuDono,
}: Props) {
  const statusAtual = ag.status || 'Agendado';
  const ehBloqueio   = statusAtual === 'Bloqueado';
  const ehFinalizado = statusAtual === 'Finalizado';
  const ehEncerrado  = statusAtual === 'Faltou' || statusAtual === 'Cancelado';

  // Ajusta posição para não sair da tela
  const menuWidth  = 230;
  const menuHeight = 360;
  const left = x + menuWidth > window.innerWidth  ? x - menuWidth  : x;
  const top  = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  const itemStyle = (cor?: string): React.CSSProperties => ({
    background: 'none', border: 'none', textAlign: 'left', padding: '10px 16px',
    fontSize: 12, cursor: 'pointer', color: cor || C.textMain, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    transition: 'background 0.1s',
  });

  const secaoLabel = (texto: string) => (
    <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {texto}
    </div>
  );

  const divisor = () => <div style={{ height: 1, background: C.border, margin: '4px 0' }} />;

  return (
    <>
      {/* Overlay para fechar */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={onFechar} onContextMenu={e => { e.preventDefault(); onFechar(); }} />

      {/* Menu */}
      <div style={{
        position: 'fixed', top, left, zIndex: 9999,
        background: C.bgCard, border: `1px solid ${C.borderMid}`,
        borderRadius: RAIO_LG, boxShadow: SOMBRA_ELEVADO,
        width: menuWidth, overflow: 'hidden',
      }}>

        {/* Cabeçalho: nome + horário */}
        <div style={{ background: C.sidebarBg, color: '#fff', padding: '10px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ag.cliente}
          </div>
          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
            {ag.inicio} — {ag.servico}
          </div>
        </div>

        {/* Indicador de status atual */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: COR_POR_STATUS[statusAtual] || ag.cor || '#7BAED8', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>Status atual: {statusAtual}</span>
        </div>

        {/* Ações principais */}
        {!ehBloqueio && (
          <>
            <button style={itemStyle()} onClick={onEditar}
              onMouseOver={e => e.currentTarget.style.background = C.bg}
              onMouseOut={e => e.currentTarget.style.background = 'none'}>
              <FiEdit2 size={13} /> Ver / Editar Agendamento
            </button>

            <button style={itemStyle(C.sidebarBg)} onClick={onEditarCliente}
              onMouseOver={e => e.currentTarget.style.background = C.bg}
              onMouseOut={e => e.currentTarget.style.background = 'none'}>
              <FiUser size={13} /> Editar Cliente
            </button>

            {onWhatsApp && (
              <button
                style={{ ...itemStyle(temTelefone ? '#25D366' : C.textLight), opacity: temTelefone ? 1 : 0.45, cursor: temTelefone ? 'pointer' : 'not-allowed' }}
                onClick={temTelefone ? () => { onWhatsApp(); onFechar(); } : undefined}
                title={temTelefone ? 'Enviar confirmação pelo WhatsApp' : 'Cliente sem telefone cadastrado'}
                onMouseOver={e => { if (temTelefone) e.currentTarget.style.background = '#F0FFF4'; }}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                <FiMessageCircle size={13} /> WhatsApp
              </button>
            )}
          </>
        )}

        {/* Alterar Status — bloqueado para Finalizado (conta já fechada e paga) */}
        {!ehBloqueio && !ehFinalizado && (
          <>
            {divisor()}
            {secaoLabel('Alterar Status')}
            {STATUS_MENU.filter(s => s.status !== statusAtual).map(({ status, label, icon }) => (
              <button key={status} style={itemStyle()} onClick={() => { onAlterarStatus(status); onFechar(); }}
                onMouseOver={e => { e.currentTarget.style.background = COR_POR_STATUS[status] + '22'; }}
                onMouseOut={e => e.currentTarget.style.background = 'none'}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: COR_POR_STATUS[status], flexShrink: 0 }} />
                {icon} {label}
              </button>
            ))}
          </>
        )}
        {!ehBloqueio && ehFinalizado && (
          <div style={{ padding: '10px 14px 8px', fontSize: 11, color: '#10B981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiCheckCircle size={12} /> Conta fechada — status bloqueado
          </div>
        )}

        {/* Fechar Conta — bloqueado para Faltou e Cancelado (serviço não prestado) */}
        {!ehBloqueio && !ehFinalizado && !ehEncerrado && (
          <>
            {divisor()}
            <button style={itemStyle('#10B981')} onClick={() => { onFecharConta(); onFechar(); }}
              onMouseOver={e => e.currentTarget.style.background = '#F0FDF4'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}>
              <FiDollarSign size={13} /> Fechar Conta
            </button>
          </>
        )}
        {ehEncerrado && (
          <div style={{ padding: '8px 14px', fontSize: 11, color: '#B45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8 }}>
            <FiAlertCircle size={12} /> {statusAtual === 'Faltou' ? 'Cliente faltou — sem fechamento' : 'Cancelado — sem fechamento'}
          </div>
        )}

        {/* Cancelar / Faltou */}
        {!ehBloqueio && !ehFinalizado && isGerenteOuDono && (
          <>
            {divisor()}
            {secaoLabel('Problema')}
            <button style={itemStyle('#F59E0B')} onClick={() => { onFaltou(); onFechar(); }}
              onMouseOver={e => e.currentTarget.style.background = '#FFFBEB'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}>
              <FiAlertCircle size={13} /> Cliente Faltou (no-show)
            </button>
            <button style={itemStyle(C.danger)} onClick={() => { onCancelar(); onFechar(); }}
              onMouseOver={e => e.currentTarget.style.background = '#FEF2F2'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}>
              <FiX size={13} /> Cancelar Agendamento
            </button>
          </>
        )}
      </div>
    </>
  );
}
