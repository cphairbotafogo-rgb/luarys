'use client'
/**
 * src/modules/crescimento/PainelEquipe.tsx
 *
 * Quem está com a agenda mais vazia na equipe — mesma base de cálculo do
 * Relatórios → Performance (receita por profissional no período), mas
 * ordenado para destacar quem está abaixo da média, não só o topo do ranking.
 */

import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiUsers, FiAlertTriangle } from 'react-icons/fi';
import { type ProfissionalDesempenho, brl } from './tipos';
import { BarraRelativa } from './componentes';

interface Props {
  profissionais: ProfissionalDesempenho[];
}

export function PainelEquipe({ profissionais }: Props) {
  if (profissionais.length === 0) {
    return (
      <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <FiUsers size={16} color={C.sidebarBg} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>Quem está com a agenda mais vazia</span>
        </div>
        <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic' }}>
          Nenhum profissional produtivo com atendimentos no período.
        </p>
      </div>
    );
  }

  const abaixoDaMedia = profissionais.filter(p => p.percentDaMedia < 70);

  return (
    <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <FiUsers size={16} color={C.sidebarBg} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>Quem está com a agenda mais vazia</span>
      </div>
      <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 16px' }}>
        Receita gerada no período, comparada à média da equipe. Ordenado do menor para o maior.
      </p>

      {abaixoDaMedia.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: RAIO_MD, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400E' }}>
          <FiAlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            {abaixoDaMedia.length === 1
              ? `${abaixoDaMedia[0].nome} está abaixo de 70% da média da equipe.`
              : `${abaixoDaMedia.length} profissionais estão abaixo de 70% da média da equipe.`}
            {' '}Considere redistribuir agenda, treinar ou divulgar os horários livres deles.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {profissionais.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12 }}>
            <span style={{ width: 110, fontWeight: 600, color: C.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
            <BarraRelativa percent={p.percentDaMedia} cor={p.percentDaMedia < 70 ? '#EF4444' : p.percentDaMedia < 100 ? '#F59E0B' : '#10B981'} />
            <span style={{ width: 80, color: C.textMuted, fontSize: 11 }}>{p.atendimentos} atend.</span>
            <span style={{ width: 90, fontWeight: 700, color: C.textMain, fontSize: 12, textAlign: 'right' }}>{brl(p.receita)}</span>
            <span style={{ width: 50, textAlign: 'right', fontSize: 11, fontWeight: 700, color: p.percentDaMedia < 70 ? '#EF4444' : C.textLight }}>{p.percentDaMedia}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
