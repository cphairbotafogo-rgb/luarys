'use client'
/**
 * src/components/Toast.tsx
 *
 * Sistema de notificação toast no padrão Luarys.
 * Substitui todos os alert() nativos do browser.
 *
 * USO:
 *   import { useToast } from '@/components/Toast';
 *   const toast = useToast();
 *   toast.sucesso('Conta fechada com sucesso!');
 *   toast.erro('Erro ao salvar. Tente novamente.');
 *   toast.aviso('Selecione a bandeira do cartão.');
 *   toast.info('Agendamento confirmado para amanhã.');
 *
 * SETUP (adicionar uma vez no layout raiz ou page.tsx):
 *   import { ToastContainer } from '@/components/Toast';
 *   <ToastContainer />
 */

import { useState, useCallback, useEffect, createContext, useContext, useRef } from 'react';
import { FiCheckCircle, FiXCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi';
import { C } from '@/lib/constants';
import { RAIO_LG } from '@/lib/estiloGlobal';

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type ToastTipo = 'sucesso' | 'erro' | 'aviso' | 'info';

interface ToastItem {
  id: string;
  tipo: ToastTipo;
  mensagem: string;
  duracao: number;
}

interface ToastContextType {
  sucesso: (msg: string, duracao?: number) => void;
  erro:    (msg: string, duracao?: number) => void;
  aviso:   (msg: string, duracao?: number) => void;
  info:    (msg: string, duracao?: number) => void;
}

// ─── CONTEXT ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextType>({
  sucesso: () => {},
  erro:    () => {},
  aviso:   () => {},
  info:    () => {},
});

// ─── CONFIG VISUAL ────────────────────────────────────────────────────────────
const CONFIG: Record<ToastTipo, { bg: string; border: string; icon: any; cor: string; label: string }> = {
  sucesso: { bg: '#F0FDF4', border: '#86EFAC', icon: FiCheckCircle, cor: '#16A34A', label: 'Sucesso'  },
  erro:    { bg: '#FEF2F2', border: '#FCA5A5', icon: FiXCircle,     cor: '#DC2626', label: 'Erro'     },
  aviso:   { bg: '#FFFBEB', border: '#FCD34D', icon: FiAlertTriangle,cor: '#D97706', label: 'Atenção' },
  info:    { bg: '#EFF6FF', border: '#93C5FD', icon: FiInfo,         cor: '#2563EB', label: 'Info'    },
};

// ─── ITEM DO TOAST ────────────────────────────────────────────────────────────
function ToastItemComponent({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const [saindo, setSaindo] = useState(false);
  const cfg  = CONFIG[item.tipo];
  const Icon = cfg.icon;

  useEffect(() => {
    const t1 = setTimeout(() => setSaindo(true), item.duracao - 400);
    const t2 = setTimeout(() => onRemove(item.id), item.duracao);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [item.id, item.duracao, onRemove]);

  function fechar() {
    setSaindo(true);
    setTimeout(() => onRemove(item.id), 350);
  }

  return (
    <div
      className="font-body"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 16px',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderLeft: `4px solid ${cfg.cor}`,
        borderRadius: RAIO_LG,
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        minWidth: 280, maxWidth: 400,
        opacity: saindo ? 0 : 1,
        transform: saindo ? 'translateX(20px)' : 'translateX(0)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        pointerEvents: 'all',
      }}
    >
      {/* Ícone */}
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <Icon size={18} color={cfg.cor} />
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="font-title" style={{
          margin: '0 0 2px', fontSize: 10, fontWeight: 700,
          color: cfg.cor, textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {cfg.label}
        </p>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 500,
          color: '#1E293B', lineHeight: 1.4, wordBreak: 'break-word',
        }}>
          {item.mensagem}
        </p>
      </div>

      {/* Fechar */}
      <button
        onClick={fechar}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: cfg.cor, opacity: 0.6, padding: 2, flexShrink: 0,
          display: 'flex', alignItems: 'center',
        }}
      >
        <FiX size={15} />
      </button>
    </div>
  );
}

// ─── PROVIDER + CONTAINER ─────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remover = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  function adicionar(tipo: ToastTipo, mensagem: string, duracao = 4000) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-4), { id, tipo, mensagem, duracao }]);
  }

  const api: ToastContextType = {
    sucesso: (msg, dur) => adicionar('sucesso', msg, dur),
    erro:    (msg, dur) => adicionar('erro',    msg, dur ?? 6000),
    aviso:   (msg, dur) => adicionar('aviso',   msg, dur ?? 5000),
    info:    (msg, dur) => adicionar('info',    msg, dur),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Container fixo no canto inferior direito */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 10,
        zIndex: 99999, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <ToastItemComponent key={t.id} item={t} onRemove={remover} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────
export function useToast() {
  return useContext(ToastContext);
}

// ─── FUNÇÃO GLOBAL (para usar fora de componentes React, ex: hooks de lógica) ─
// Permite chamar toast.sucesso() de dentro de funções async puras
let _toastApi: ToastContextType | null = null;

export function setToastApi(api: ToastContextType) {
  _toastApi = api;
}

export const toast = {
  sucesso: (msg: string, dur?: number) => _toastApi?.sucesso(msg, dur),
  erro:    (msg: string, dur?: number) => _toastApi?.erro(msg, dur),
  aviso:   (msg: string, dur?: number) => _toastApi?.aviso(msg, dur),
  info:    (msg: string, dur?: number) => _toastApi?.info(msg, dur),
};