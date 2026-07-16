'use client'
/**
 * src/modules/configuracoes/duplicados/componentes.tsx
 *
 * Card de grupo de duplicata — mostra os registros candidatos lado a lado,
 * com badge de confiança e ações de mesclar/ignorar. Inspirado na tela de
 * "contatos duplicados" dos celulares.
 */

import { C } from '@/lib/constants';
import { RAIO_SM, RAIO_MD, RAIO_LG } from '@/lib/estiloGlobal';
import { FiUsers, FiX, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import { type Confianca } from './tipos';

/**
 * Barra de progresso animada da mesclagem em lote — mostra item a item o que
 * está sendo processado, com transição suave de largura (CSS transition).
 */
export function BarraProgressoMesclagem({ atual, total, nomeAtual }: { atual: number; total: number; nomeAtual: string }) {
  const percent = total > 0 ? Math.round((atual / total) * 100) : 0;
  const concluido = total > 0 && atual >= total;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: C.textMain }}>
          {!concluido && (
            <FiLoader size={14} color={C.douradoEleva} style={{ animation: 'eleva-spin 0.8s linear infinite' }} />
          )}
          {concluido ? 'Mesclagem concluída' : `Mesclando: ${nomeAtual || '...'}`}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.douradoEleva }}>{atual} / {total}</span>
      </div>

      <div style={{ height: 10, background: C.bg, borderRadius: RAIO_SM, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: RAIO_SM, width: `${percent}%`,
          background: `linear-gradient(90deg, ${C.douradoEleva}, #B8960C)`,
          transition: 'width 0.35s ease',
        }} />
      </div>

      <style>{`
        @keyframes eleva-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function BadgeConfianca({ confianca }: { confianca: Confianca }) {
  const alta = confianca === 'alta';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800,
      padding: '3px 8px', borderRadius: RAIO_SM, textTransform: 'uppercase',
      background: alta ? C.dangerBg : '#FFFBEB', color: alta ? C.dangerText : '#92400E',
    }}>
      {alta ? <FiAlertTriangle size={10} /> : <FiAlertTriangle size={10} />}
      {alta ? 'Provável duplicata' : 'Possível duplicata'}
    </span>
  );
}

interface CardClienteProps {
  motivo: string;
  confianca: Confianca;
  registros: any[];
  executando: string | null;
  onMesclar: (manterId: string, removerId: string) => void;
  onIgnorar: () => void;
}

export function CardGrupoCliente({ motivo, confianca, registros, executando, onMesclar, onIgnorar }: CardClienteProps) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiUsers size={14} color={C.textMuted} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textMain }}>{motivo}</span>
          <BadgeConfianca confianca={confianca} />
        </div>
        <button onClick={onIgnorar} title="Não são duplicatas" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
          <FiX size={13} /> Ignorar
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {registros.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: C.bg, borderRadius: RAIO_MD }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{r.nome_completo}</span>
              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                {r.telefone_whatsapp && <span style={{ fontSize: 11, color: C.textLight }}>{r.telefone_whatsapp}</span>}
                {r.email && <span style={{ fontSize: 11, color: C.textLight }}>{r.email}</span>}
                {r.cpf && <span style={{ fontSize: 11, color: C.textLight }}>CPF {r.cpf}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {registros.filter(o => o.id !== r.id).map(outro => (
                <button
                  key={outro.id}
                  onClick={() => onMesclar(r.id, outro.id)}
                  disabled={executando === outro.id}
                  title={`Manter "${r.nome_completo}" e mesclar o(s) outro(s) nele`}
                  style={{ fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: RAIO_SM, border: 'none', background: C.sidebarBg, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {executando === outro.id ? 'Mesclando...' : `Manter este`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CardItemProps {
  motivo: string;
  confianca: Confianca;
  registros: any[]; // precisa ter: id, nome_servico/nome_produto, qtdUso
  executando: string | null;
  onMesclar: (manterId: string, removerId: string) => void;
  onIgnorar: () => void;
}

/** Usado para serviços e produtos — mesma estrutura visual, rótulos genéricos. */
export function CardGrupoItem({ motivo, confianca, registros, executando, onMesclar, onIgnorar }: CardItemProps) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_LG, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiUsers size={14} color={C.textMuted} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textMain }}>{motivo}</span>
          <BadgeConfianca confianca={confianca} />
        </div>
        <button onClick={onIgnorar} title="Não são duplicatas" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
          <FiX size={13} /> Ignorar
        </button>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: 11, color: C.textLight }}>
        Clique em "Manter este" no registro que deve sobreviver — o histórico, ficha técnica, comissão e estoque dos outros são transferidos para ele antes de serem removidos.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {registros.map((r: any) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: C.bg, borderRadius: RAIO_MD }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{r.nome_servico || r.nome_produto}</span>
              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: C.textLight }}>
                  {(r.qtdUso || 0) > 0 ? `${r.qtdUso} uso(s) registrado(s)` : 'Sem histórico de uso ainda'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {registros.filter(o => o.id !== r.id).map(outro => (
                <button
                  key={outro.id}
                  onClick={() => onMesclar(r.id, outro.id)}
                  disabled={executando === outro.id}
                  title={`Manter este e mesclar o(s) outro(s) nele`}
                  style={{ fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: RAIO_SM, border: 'none', background: C.sidebarBg, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {executando === outro.id ? 'Mesclando...' : 'Manter este'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
