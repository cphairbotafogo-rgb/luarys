'use client'
/**
 * Painel de edição: lista os itens editáveis (não-fixos) que o login tem
 * permissão para ver, permitindo arrastar para reordenar e clicar no olho
 * para ocultar/mostrar. Itens fixos (Notas Fiscais, Migração de Dados)
 * não aparecem aqui — não são personalizáveis por design.
 */
import { useState } from 'react';
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { C } from '@/lib/constants';
import { RAIO_LG, RAIO_2XL } from '@/lib/estiloGlobal';
import { FiX, FiEye, FiEyeOff, FiMenu, FiRotateCcw } from 'react-icons/fi';
import type { ItemSidebar } from './catalogoItensSidebar';
import type { PreferenciasSidebar } from './usePreferenciasSidebar';

interface Props {
  itensEditaveis: ItemSidebar[];
  preferencias: PreferenciasSidebar;
  onAlternarOculto: (itemId: string) => void;
  onReordenar: (novaOrdem: string[]) => void;
  onRestaurar: () => void;
  onFechar: () => void;
}

export function EditorSidebar({ itensEditaveis, preferencias, onAlternarOculto, onReordenar, onRestaurar, onFechar }: Props) {
  const [itemArrastando, setItemArrastando] = useState<string | null>(null);

  const ordenados = [...itensEditaveis].sort((a, b) => {
    const posA = preferencias.ordem.indexOf(a.id);
    const posB = preferencias.ordem.indexOf(b.id);
    if (posA === -1 && posB === -1) return 0;
    if (posA === -1) return 1;
    if (posB === -1) return -1;
    return posA - posB;
  });

  function aoSoltar(idDestino: string) {
    if (!itemArrastando || itemArrastando === idDestino) { setItemArrastando(null); return; }
    const ids = ordenados.map(i => i.id);
    const origem = ids.indexOf(itemArrastando);
    const destino = ids.indexOf(idDestino);
    const nova = [...ids];
    nova.splice(origem, 1);
    nova.splice(destino, 0, itemArrastando);
    onReordenar(nova);
    setItemArrastando(null);
  }

  async function restaurarPadrao() {
    if (!await confirmarAcaoGlobal({ titulo: 'Restaurar a ordem e visibilidade padrão do menu?', perigoso: false })) return;
    onRestaurar();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onFechar}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.bgCard, borderRadius: RAIO_2XL, width: '100%', maxWidth: 380, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.textMain }}>Personalizar Menu</h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textLight }}>Arraste para reordenar. Clique no olho para ocultar.</p>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <FiX size={20} color={C.textLight} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 12px', flex: 1 }}>
          {ordenados.map(item => {
            const oculto = preferencias.ocultos.includes(item.id);
            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => setItemArrastando(item.id)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => aoSoltar(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: RAIO_LG, marginBottom: 4,
                  background: itemArrastando === item.id ? C.bg : C.bgCard,
                  border: `1px solid ${C.border}`, cursor: 'grab', opacity: oculto ? 0.5 : 1,
                }}
              >
                <FiMenu size={14} color={C.textLight} />
                <span style={{ display: 'flex', alignItems: 'center', opacity: 0.8 }}>{item.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.textMain }}>{item.label}</span>
                <button
                  onClick={() => onAlternarOculto(item.id)}
                  title={oculto ? 'Mostrar no menu' : 'Ocultar do menu'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
                >
                  {oculto ? <FiEyeOff size={16} color={C.textLight} /> : <FiEye size={16} color={C.sidebarBg} />}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={restaurarPadrao}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.textMuted }}
          >
            <FiRotateCcw size={13} /> Restaurar padrão
          </button>
        </div>
      </div>
    </div>
  );
}
