'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { FiSearch, FiUser, FiPhone, FiCalendar } from 'react-icons/fi';
import { RAIO_LG, RAIO_XL } from '@/lib/estiloGlobal';

interface Props {
  perfil: any;
}

export function ClientesMobile({ perfil }: Props) {
  const [busca, setBusca] = useState('');
  const [clientes, setClientes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    const timeout = setTimeout(() => pesquisar(), busca ? 400 : 0);
    return () => clearTimeout(timeout);
  }, [busca, perfil?.salao_id]);

  async function pesquisar() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    let q = supabase.from('clientes').select('id,nome_completo,telefone_whatsapp,total_visitas,ultima_visita').eq('salao_id', perfil.salao_id).order('nome_completo', { ascending: true }).limit(30);
    if (busca.trim()) q = q.or(`nome_completo.ilike.%${busca.trim()}%,telefone_whatsapp.ilike.%${busca.trim()}%`);
    const { data } = await q;
    setClientes(data || []);
    setCarregando(false);
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>
      <div style={{ background: C.sidebarBg, padding: '16px 20px', borderBottom: `3px solid ${C.douradoEleva}` }}>
        <h2 style={{ fontFamily: 'var(--font-title)', margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#fff' }}>Clientes</h2>
        <div style={{ position: 'relative' }}>
          <FiSearch size={15} color="rgba(255,255,255,0.5)" style={{ position: 'absolute', left: 14, top: 14 }} />
          <input type="text" placeholder="Buscar por nome ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: RAIO_LG, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 80px' }}>
        {carregando ? (
          <p style={{ textAlign: 'center', color: C.textMuted, padding: 40 }}>Pesquisando...</p>
        ) : clientes.length === 0 ? (
          <p style={{ textAlign: 'center', color: C.textMuted, padding: 40, fontSize: 14 }}>{busca ? 'Nenhum cliente encontrado.' : 'Digite um nome para pesquisar.'}</p>
        ) : clientes.map(c => (
          <div key={c.id} style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: '14px 16px', marginBottom: 10, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14, minHeight: 56 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.sidebarBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, flexShrink: 0 }}>{c.nome_completo?.substring(0, 1)?.toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome_completo}</p>
              {c.telefone_whatsapp && <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textLight, display: 'flex', alignItems: 'center', gap: 4 }}><FiPhone size={10} /> {c.telefone_whatsapp}</p>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {c.total_visitas > 0 && <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.sidebarBg }}>{c.total_visitas}x</p>}
              {c.ultima_visita && <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textLight }}>{c.ultima_visita.split('-').reverse().join('/')}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
