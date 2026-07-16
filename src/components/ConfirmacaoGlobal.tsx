'use client'
/**
 * src/components/ConfirmacaoGlobal.tsx
 * Provider + hook para confirmar ações destrutivas sem usar window.confirm nativo.
 *
 * Uso em componentes React:
 *   const { confirmar } = useConfirmacao();
 *   await confirmar({ titulo: "Remover cliente?", descricao: "...", rotuloCta: "Remover" });
 *
 * Uso em hooks de lógica pura (fora de árvore React — via singleton):
 *   import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
 *   const ok = await confirmarAcaoGlobal({ titulo: "..." });
 */
import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, overlayModal } from '@/lib/estiloGlobal';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

interface OpcaoConfirmacao {
  titulo: string;
  descricao?: string;
  rotuloCta?: string;       // texto do botão de confirmar (padrão: "Confirmar")
  perigoso?: boolean;       // true → botão vermelho, false → botão primário do sistema
}

type ResolveFn = (v: boolean) => void;

interface ContextoConfirmacao {
  confirmar: (opcao: OpcaoConfirmacao) => Promise<boolean>;
}

const Ctx = createContext<ContextoConfirmacao | null>(null);

// ─── Singleton para uso fora de componentes React ─────────────────────────────
let _confirmarSingleton: ((op: OpcaoConfirmacao) => Promise<boolean>) | null = null;

export function confirmarAcaoGlobal(op: OpcaoConfirmacao): Promise<boolean> {
  if (!_confirmarSingleton) {
    // Fallback caso o provider ainda não esteja montado
    return Promise.resolve(window.confirm(op.titulo));
  }
  return _confirmarSingleton(op);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ConfirmacaoProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<OpcaoConfirmacao & { visivel: boolean }>({
    visivel: false, titulo: '', descricao: '', rotuloCta: 'Confirmar', perigoso: true,
  });
  const resolveRef = useRef<ResolveFn | null>(null);

  const confirmar = useCallback((op: OpcaoConfirmacao): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
      setEstado({ visivel: true, perigoso: true, rotuloCta: 'Confirmar', ...op });
    });
  }, []);

  // Expõe para uso singleton (hooks fora de árvore React)
  _confirmarSingleton = confirmar;

  function responder(ok: boolean) {
    setEstado(e => ({ ...e, visivel: false }));
    resolveRef.current?.(ok);
    resolveRef.current = null;
  }

  return (
    <Ctx.Provider value={{ confirmar }}>
      {children}
      {estado.visivel && (
        <div style={{ ...overlayModal, zIndex: 10500, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            background: '#fff', borderRadius: RAIO_XL, width: '100%', maxWidth: 420,
            boxShadow: '0 24px 64px rgba(0,0,0,0.22)', padding: '28px 32px', position: 'relative',
          }}>
            {/* Fechar */}
            <button
              onClick={() => responder(false)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}
            >
              <FiX size={18} />
            </button>

            {/* Ícone + Título */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: RAIO_MD, flexShrink: 0,
                background: estado.perigoso ? '#FEE2E2' : '#EFF6FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FiAlertTriangle size={18} color={estado.perigoso ? '#EF4444' : '#3B82F6'} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: C.textMain }}>
                  {estado.titulo}
                </h3>
                {estado.descricao && (
                  <p style={{ margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                    {estado.descricao}
                  </p>
                )}
              </div>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => responder(false)}
                style={{ padding: '10px 20px', background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => responder(true)}
                style={{
                  padding: '10px 20px', border: 'none', borderRadius: RAIO_MD,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#fff',
                  background: estado.perigoso ? '#EF4444' : C.sidebarBg,
                }}
              >
                {estado.rotuloCta ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

// ─── Hook para uso dentro de componentes React ────────────────────────────────
export function useConfirmacao() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirmacao deve ser usado dentro de <ConfirmacaoProvider>');
  return ctx;
}
