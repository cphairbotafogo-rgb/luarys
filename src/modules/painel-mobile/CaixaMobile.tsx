'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl, getDataHojeLocal } from '@/lib/constants';
import { FiCheckCircle, FiAlertCircle, FiDollarSign } from 'react-icons/fi';
import { RAIO_LG, RAIO_XL } from '@/lib/estiloGlobal';

interface Props {
  perfil: any;
}

export function CaixaMobile({ perfil }: Props) {
  const [data, setData] = useState(getDataHojeLocal());
  const [ags, setAgs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { carregar(); }, [data, perfil?.salao_id]);

  async function carregar() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const { data: res } = await supabase.from('agendamentos').select('id,status,servicos(preco_padrao,nome_servico),cliente_nome,inicio').eq('salao_id', perfil.salao_id).eq('data', data).order('inicio', { ascending: true });
    setAgs(res || []);
    setCarregando(false);
  }

  const finalizados = ags.filter(a => a.status === 'Finalizado');
  const pendentes = ags.filter(a => ['Confirmado', 'Aguardando'].includes(a.status));
  const totalFaturado = finalizados.reduce((acc, a) => acc + (a?.servicos?.preco_padrao || 0), 0);
  const totalPendente = pendentes.reduce((acc, a) => acc + (a?.servicos?.preco_padrao || 0), 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ background: C.sidebarBg, padding: '16px 20px 20px', borderBottom: `3px solid ${C.douradoEleva}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-title)', margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>Caixa</h2>
          <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: RAIO_LG, padding: '6px 10px', color: '#fff', fontSize: 13, outline: 'none' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: 'rgba(16,185,129,0.15)', borderRadius: RAIO_LG, padding: '12px 14px', border: '1px solid rgba(16,185,129,0.3)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: C.success, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faturado</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff' }}>{brl(totalFaturado)}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{finalizados.length} serviços</p>
          </div>
          <div style={{ background: 'rgba(245,158,11,0.15)', borderRadius: RAIO_LG, padding: '12px 14px', border: '1px solid rgba(245,158,11,0.3)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>A receber</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff' }}>{brl(totalPendente)}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{pendentes.length} pendentes</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>
        {carregando ? (
          <p style={{ textAlign: 'center', color: C.textMuted, padding: 40 }}>Carregando...</p>
        ) : ags.length === 0 ? (
          <p style={{ textAlign: 'center', color: C.textMuted, padding: 40, fontSize: 14 }}>Nenhum atendimento neste dia.</p>
        ) : ags.map(ag => (
          <div key={ag.id} style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: '14px 16px', marginBottom: 10, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, minHeight: 56 }}>
            {ag.status === 'Finalizado' ? <FiCheckCircle size={20} color={C.success} /> : <FiAlertCircle size={20} color="#F59E0B" />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.cliente_nome}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textLight }}>{ag?.servicos?.nome_servico} · {ag.inicio?.substring(0, 5)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: ag.status === 'Finalizado' ? C.success : C.textMuted }}>{brl(ag?.servicos?.preco_padrao || 0)}</p>
              <p style={{ margin: 0, fontSize: 10, color: C.textLight }}>{ag.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
