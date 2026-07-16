'use client'
/**
 * src/modules/relatorios/gavetas/GavetaAniversariantes.tsx
 *
 * Relatório de aniversariantes com 3 filtros:
 *   📅 Hoje / 📆 Esta semana / 🗓 Este mês
 *
 * Para cada cliente exibe:
 *   - Status: 🎂 Hoje | ⚠️ Alerta | 📅 Agendado | ✅ Já veio | ⏳ Pendente
 *   - Botão WhatsApp com mensagem de parabéns pré-pronta
 *   - Botão Agendar
 *   - Export CSV e PDF
 */

import { useState, useMemo } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_MD, RAIO_XL, RAIO_LG } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import {
  filtrarAniversariantes, montarMsgAniversario,
  type FiltroAniversario
} from '@/lib/aniversarios';
import {
  FiGift, FiMessageCircle, FiCalendar,
  FiDownload, FiFilter, FiAlertTriangle
} from 'react-icons/fi';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function GavetaAniversariantes({ dados, perfil }: any) {
  const toast = useToast();
    const [filtro, setFiltro] = useState<FiltroAniversario>('mes');

  const clientes     = dados?.clientes     || [];
  const agendamentos = dados?.agendamentos || [];
  const nomeSalao    = perfil?.nome_salao  || 'nosso salão';

  // ─── CALCULAR LISTA ────────────────────────────────────────────────────────
  const lista = useMemo(() =>
    filtrarAniversariantes(clientes, agendamentos, filtro),
  [clientes, agendamentos, filtro]);

  // ─── CONTADORES POR STATUS ─────────────────────────────────────────────────
  const contadores = useMemo(() => {
    const c = { hoje: 0, alerta: 0, agendado: 0, veio: 0, pendente: 0 };
    lista.forEach(({ info }) => { if (info.status) c[info.status] = (c[info.status] || 0) + 1; });
    return c;
  }, [lista]);

  // ─── WHATSAPP ──────────────────────────────────────────────────────────────
  function abrirWhatsApp(cliente: any) {
    toast.aviso('Cliente sem telefone cadastrado.');

    const num = cliente.telefone_whatsapp.replace(/\D/g, '');
    const msg = montarMsgAniversario(cliente.nome_completo, nomeSalao);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // ─── EXPORTAR CSV ──────────────────────────────────────────────────────────
  function exportarCSV() {
    const bom = '\uFEFF';
    const cab = ['Nome', 'Telefone', 'E-mail', 'Dia Aniversário', 'Status', 'Total Gasto (R$)'];
    const linhas = lista.map(({ cliente, info }) => [
      cliente.nome_completo,
      cliente.telefone_whatsapp || '',
      cliente.email || '',
      `${info.diaAniversario}/${MESES[info.mesAniversario]}`,
      info.label.replace(/[^\w\s]/g, ''),
      String(cliente.total_gasto || 0).replace('.', ','),
    ]);
    const csv = [cab, ...linhas].map(l => l.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `Aniversariantes_${filtro}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  // ─── ESTILOS ───────────────────────────────────────────────────────────────
  const filtroBtnStyle = (ativo: boolean) => ({
    padding: '9px 20px', borderRadius: RAIO_MD,
    border: `1px solid ${ativo ? C.sidebarBg : C.borderMid}`,
    background: ativo ? C.sidebarBg : C.bgCard,
    color: ativo ? '#fff' : C.textMuted,
    fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: '0.2s',
  });

  const statusBadge = (cor: string, label: string) => (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: 20,
      background: cor + '18', color: cor,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{label}</span>
  );

  return (
    <div className="font-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexShrink: 0 }}>
        <div>
          <h2 className="font-title uppercase tracking-widest"
            style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiGift size={18} /> Aniversariantes
          </h2>
          <p style={{ margin: '6px 0 0', color: C.textMuted, fontSize: 13 }}>
            {lista.length} cliente{lista.length !== 1 ? 's' : ''} no período selecionado.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={filtroBtnStyle(filtro === 'dia')}    onClick={() => setFiltro('dia')}>📅 Hoje</button>
          <button style={filtroBtnStyle(filtro === 'semana')} onClick={() => setFiltro('semana')}>📆 Esta semana</button>
          <button style={filtroBtnStyle(filtro === 'mes')}    onClick={() => setFiltro('mes')}>🗓 Este mês</button>
          <button
            onClick={exportarCSV}
            style={{ padding: '9px 16px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMain, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FiDownload size={14} /> CSV
          </button>
        </div>
      </div>

      {/* CARDS DE STATUS */}
      {filtro === 'mes' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28, flexShrink: 0 }}>
          {[
            { key: 'hoje',     label: 'Hoje',         cor: '#F59E0B', emoji: '🎂' },
            { key: 'alerta',   label: 'Em 7 dias',    cor: '#EF4444', emoji: '⚠️' },
            { key: 'agendado', label: 'Agendados',    cor: '#3B82F6', emoji: '📅' },
            { key: 'veio',     label: 'Já vieram',    cor: '#10B981', emoji: '✅' },
            { key: 'pendente', label: 'Pendentes',    cor: '#94A3B8', emoji: '⏳' },
          ].map(({ key, label, cor, emoji }) => (
            <div key={key} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderTop: `3px solid ${cor}`, borderRadius: RAIO_LG, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 20 }}>{emoji}</p>
              <p className="font-title" style={{ margin: '6px 0 2px', fontSize: 22, fontWeight: 800, color: cor }}>
                {contadores[key as keyof typeof contadores] || 0}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ALERTA DE URGÊNCIA */}
      {contadores.hoje > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: RAIO_LG, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🎂</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#92400E' }}>
              {contadores.hoje} cliente{contadores.hoje > 1 ? 's fazem' : ' faz'} aniversário hoje!
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#B45309' }}>
              Envie uma mensagem de parabéns pelo WhatsApp agora mesmo. 💛
            </p>
          </div>
        </div>
      )}

      {contadores.alerta > 0 && filtro !== 'dia' && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: RAIO_LG, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <FiAlertTriangle size={20} color="#EF4444" />
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#991B1B' }}>
              {contadores.alerta} cliente{contadores.alerta > 1 ? 's têm' : ' tem'} aniversário nos próximos 7 dias sem agendamento
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#B91C1C' }}>
              Ótima oportunidade para entrar em contato e oferecer um mimo especial.
            </p>
          </div>
        </div>
      )}

      {/* LISTA */}
      {lista.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.textLight }}>
          <FiGift size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Nenhum aniversariante no período selecionado.</p>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: 'hidden' }}>

          {/* Cabeçalho da tabela */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 180px', padding: '12px 20px', background: C.bg, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            {['Cliente', 'Aniversário', 'Total Gasto', 'Status', 'Ações'].map(h => (
              <span key={h} className="font-title" style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</span>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
          {lista.map(({ cliente, info }, idx) => (
            <div
              key={cliente.id}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 180px',
                padding: '16px 20px', borderBottom: idx < lista.length - 1 ? `1px solid ${C.border}` : 'none',
                background: info.status === 'hoje' ? '#FFFBEB' : info.status === 'alerta' ? '#FEF2F2' : C.bgCard,
                transition: 'background 0.2s',
              }}
            >
              {/* Nome */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: RAIO_MD, flexShrink: 0,
                  background: info.status === 'hoje' ? '#FEF3C7' : C.sidebarBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: info.status === 'hoje' ? 18 : 13,
                  fontWeight: 700, color: info.status === 'hoje' ? '#92400E' : '#fff',
                }}>
                  {info.status === 'hoje' ? '🎂' : (cliente.nome_completo || 'CL').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.textMain }}>{cliente.nome_completo}</p>
                  {cliente.telefone_whatsapp && (
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textLight }}>{cliente.telefone_whatsapp}</p>
                  )}
                </div>
              </div>

              {/* Aniversário */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="font-title" style={{ fontSize: 14, fontWeight: 700, color: info.cor }}>
                  {info.diaAniversario}/{MESES[info.mesAniversario]}
                </span>
              </div>

              {/* Total gasto */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>
                  {brl(cliente.total_gasto || 0)}
                </span>
              </div>

              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {statusBadge(info.cor, info.label)}
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => abrirWhatsApp(cliente)}
                  title="Enviar parabéns pelo WhatsApp"
                  style={{
                    padding: '7px 12px', borderRadius: 7, border: 'none',
                    background: '#ECFDF5', color: '#059669',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <FiMessageCircle size={13} /> Parabéns
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('eleva_prefill_agendamento', JSON.stringify({
                      id: cliente.id, nome_completo: cliente.nome_completo, telefone_whatsapp: cliente.telefone_whatsapp,
                    }));
                    window.location.hash = '#agendamento';
                  }}
                  title="Agendar"
                  style={{
                    padding: '7px 10px', borderRadius: 7,
                    border: `1px solid ${C.borderMid}`, background: C.bgCard,
                    color: C.textMuted, fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <FiCalendar size={13} />
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}