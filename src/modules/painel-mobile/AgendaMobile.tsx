'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, getDataHojeLocal } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { FiPlus, FiUser, FiClock } from 'react-icons/fi';
import { RAIO_MD, RAIO_LG, RAIO_XL } from '@/lib/estiloGlobal';

const COR_STATUS: Record<string, string> = { Confirmado: C.success, Aguardando: '#F59E0B', Finalizado: '#6B7280', Cancelado: C.danger };

interface Props {
  perfil: any;
}

export function AgendaMobile({ perfil }: Props) {
  const toast = useToast();
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [data, setData] = useState(getDataHojeLocal());
  const [agSelecionado, setAgSelecionado] = useState<any>(null);

  useEffect(() => { carregar(); }, [data, perfil?.salao_id]);

  async function carregar() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const { data: ags } = await supabase.from('agendamentos').select('id,inicio,status,cliente_nome,profissionais(nome),servicos(nome_servico),duracao_min').eq('salao_id', perfil.salao_id).eq('data', data).neq('status', 'Cancelado').order('inicio', { ascending: true });
    setAgendamentos(ags || []);
    setCarregando(false);
  }

  const total = agendamentos.length;
  const finalizados = agendamentos.filter(a => a.status === 'Finalizado').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ background: C.sidebarBg, padding: '16px 20px 12px', borderBottom: `3px solid ${C.douradoEleva}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'var(--font-title)', margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>Agenda do Dia</h2>
          <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: RAIO_MD, padding: '6px 10px', color: '#fff', fontSize: 13, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: RAIO_MD, padding: '8px 14px', flex: 1, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.douradoEleva }}>{total}</p>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Agendados</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: RAIO_MD, padding: '8px 14px', flex: 1, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.success }}>{finalizados}</p>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Finalizados</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>
        {carregando ? (
          <p style={{ textAlign: 'center', color: C.textMuted, padding: 40 }}>Carregando agenda...</p>
        ) : agendamentos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: C.textMuted, fontSize: 14 }}>Nenhum agendamento para este dia.</p>
          </div>
        ) : agendamentos.map(ag => (
          <div key={ag.id} onClick={() => toast.aviso('Abrir modal de edição em breve.')} style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: '14px 16px', marginBottom: 10, border: `1px solid ${C.border}`, borderLeft: `4px solid ${COR_STATUS[ag.status] || C.border}`, display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, cursor: 'pointer', touchAction: 'manipulation' }}>
            <div style={{ width: 52, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: C.sidebarBg }}>{ag.inicio?.substring(0, 5)}</p>
              <p style={{ margin: 0, fontSize: 10, color: C.textLight }}>{ag.duracao_min}min</p>
            </div>
            <div style={{ width: 1, height: 36, background: C.border, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.cliente_nome}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textLight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag?.servicos?.nome_servico}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textLight, display: 'flex', alignItems: 'center', gap: 4 }}><FiUser size={10} /> {ag?.profissionais?.nome}</p>
            </div>
            <span style={{ background: COR_STATUS[ag.status] || C.borderMid, color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>{ag.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
