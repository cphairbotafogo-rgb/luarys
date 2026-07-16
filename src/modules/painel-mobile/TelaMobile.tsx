'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, getDataHojeLocal, brl } from '@/lib/constants';
import { NavBarPainelMobile } from './NavBarPainelMobile';
import { AgendaMobile } from './AgendaMobile';
import { CaixaMobile } from './CaixaMobile';
import { ClientesMobile } from './ClientesMobile';
import { HomeMobile } from './HomeMobile';
import type { AbaPainelMobile } from './tipos';

interface Props {
  perfil: any;
  onSair: () => void;
}

export function TelaMobile({ perfil, onSair }: Props) {
  const [aba, setAba] = useState<AbaPainelMobile>('agenda');
  const [resumo, setResumo] = useState({ agendamentos: 0, finalizados: 0, faturamento: 0 });

  useEffect(() => { carregarResumo(); }, [perfil?.salao_id]);

  async function carregarResumo() {
    if (!perfil?.salao_id) return;
    const hoje = getDataHojeLocal();
    const { data: ags } = await supabase.from('agendamentos').select('status,servicos(preco_padrao)').eq('salao_id', perfil.salao_id).eq('data', hoje).neq('status', 'Cancelado');
    if (!ags) return;
    const fin = ags.filter(a => a.status === 'Finalizado');
    setResumo({ agendamentos: ags.length, finalizados: fin.length, faturamento: fin.reduce((acc, a) => acc + ((a?.servicos as any)?.preco_padrao || 0), 0) });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: C.bg }}>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {aba === 'menu' && <HomeMobile perfil={perfil} resumo={resumo} onTrocarAba={setAba} onSair={onSair} />}
        {aba === 'agenda' && <AgendaMobile perfil={perfil} />}
        {aba === 'caixa' && <CaixaMobile perfil={perfil} />}
        {aba === 'clientes' && <ClientesMobile perfil={perfil} />}
      </div>
      <NavBarPainelMobile aba={aba} onTrocar={setAba} />
    </div>
  );
}
