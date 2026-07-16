'use client'
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { AlertasAniversario } from '@/components/AlertasAniversario';
import { filtrarAniversariantes, montarMsgAniversario } from '@/lib/aniversarios';
import { FiGift, FiMessageCircle, FiCalendar, FiLoader } from 'react-icons/fi';

const COR_STATUS: Record<string, { bg: string; texto: string }> = {
  hoje:     { bg: '#FEF3C7', texto: '#92400E' },
  alerta:   { bg: '#FEE2E2', texto: '#991B1B' },
  agendado: { bg: '#DBEAFE', texto: '#1E40AF' },
  veio:     { bg: '#D1FAE5', texto: '#065F46' },
  pendente: { bg: '#F1F5F9', texto: '#64748B' },
};

export function AbaAniversario({ perfil, setAba }: any) {
  const [carregando, setCarregando] = useState(true);
  const [clientes, setClientes] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [msgAniversario, setMsgAniversario] = useState<string | null>(null);
  const [nomeSalao, setNomeSalao] = useState('nosso salão');

  useEffect(() => {
    async function carregar() {
      if (!perfil?.salao_id) return;
      setCarregando(true);
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().split('T')[0];
      const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().split('T')[0];
      const [resCli, resAg, resSalao] = await Promise.all([
        supabase.from('clientes')
          .select('id, nome_completo, nascimento, telefone_whatsapp')
          .eq('salao_id', perfil.salao_id),
        supabase.from('agendamentos')
          .select('id, cliente_id, data, status')
          .eq('salao_id', perfil.salao_id)
          .gte('data', inicioMes).lte('data', fimMes),
        supabase.from('saloes')
          .select('nome_fantasia, msg_whatsapp_aniversario')
          .eq('id', perfil.salao_id)
          .maybeSingle(),
      ]);
      setClientes(resCli.data || []);
      setAgendamentos(resAg.data || []);
      if (resSalao.data) {
        if (resSalao.data.nome_fantasia) setNomeSalao(resSalao.data.nome_fantasia);
        if (resSalao.data.msg_whatsapp_aniversario) setMsgAniversario(resSalao.data.msg_whatsapp_aniversario);
      }
      setCarregando(false);
    }
    carregar();
  }, [perfil]);

  if (carregando) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 48, color: C.textLight, fontWeight: 700, fontSize: 13 }}>
      <FiLoader className="animate-spin" size={18} /> A carregar aniversariantes...
    </div>
  );

  const todosMes = filtrarAniversariantes(clientes, agendamentos, 'mes');

  function abrirWhatsApp(cliente: any) {
    if (!cliente.telefone_whatsapp) return;
    const num = cliente.telefone_whatsapp.replace(/\D/g, '');
    const msg = montarMsgAniversario(cliente.nome_completo, nomeSalao, msgAniversario);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function navAgendar(cliente: any) {
    localStorage.setItem('luarys_prefill_agendamento', JSON.stringify({
      id: cliente.id,
      nome_completo: cliente.nome_completo,
      telefone_whatsapp: cliente.telefone_whatsapp,
    }));
    if (setAba) setAba('agenda');
  }

  return (
    <div style={{ padding: 32, overflowY: 'auto', flex: 1, background: C.bg }}>

      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <div style={{ width: 48, height: 48, borderRadius: RAIO_XL, background: '#FCD34D', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FiGift size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Aniversariantes
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted, fontWeight: 500 }}>
            {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
            {todosMes.length > 0 && ` · ${todosMes.length} cliente${todosMes.length !== 1 ? 's' : ''} fazem aniversário este mês`}
          </p>
        </div>
      </div>

      {/* ── Urgências (hoje + próximos 7 dias sem agendamento) ───────────── */}
      <AlertasAniversario
        clientes={clientes}
        agendamentos={agendamentos}
        nomeSalao={nomeSalao}
        msgAniversario={msgAniversario}
        onAgendar={navAgendar}
      />

      {/* ── Lista completa do mês ─────────────────────────────────────────── */}
      {todosMes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: C.textLight }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎂</div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Nenhum cliente com aniversário cadastrado neste mês.</p>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: C.textLight }}>Certifique-se de que a data de nascimento está preenchida no cadastro do cliente.</p>
        </div>
      ) : (
        <div>
          <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Todos os aniversários deste mês
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todosMes.map(({ cliente, info }) => {
              const cores = COR_STATUS[info.status || 'pendente'] || COR_STATUS.pendente;
              return (
                <div key={cliente.id} style={{
                  background: C.bgCard, border: `1px solid ${C.border}`,
                  borderRadius: RAIO_XL, padding: '14px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: cores.bg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 18, flexShrink: 0,
                    }}>
                      {info.emoji}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: C.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cliente.nome_completo}
                      </p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: cores.texto, fontWeight: 600 }}>
                        {info.label}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 800, color: C.textLight,
                      fontFamily: 'monospace', background: C.bg,
                      padding: '4px 12px', borderRadius: RAIO_MD, whiteSpace: 'nowrap',
                    }}>
                      dia {info.diaAniversario}
                    </span>
                    {cliente.telefone_whatsapp && (
                      <button
                        onClick={() => abrirWhatsApp(cliente)}
                        style={{
                          padding: '8px 12px', borderRadius: RAIO_MD, border: 'none',
                          background: C.success, color: '#fff',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        <FiMessageCircle size={13} /> WhatsApp
                      </button>
                    )}
                    <button
                      onClick={() => navAgendar(cliente)}
                      style={{
                        padding: '8px 12px', borderRadius: RAIO_MD,
                        border: `1px solid ${C.borderMid}`, background: C.bgCard,
                        color: C.textMuted, fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <FiCalendar size={13} /> Agendar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
