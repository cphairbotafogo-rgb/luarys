// src/modules/crm/AbaCRM.tsx
// Shell da aba CRM — lista de clientes com busca e ações rápidas.
// Toda lógica: useAbaCRM | Modal: ModalCliente.
'use client'
import { C, brl } from '@/lib/constants';
import { RAIO_XS, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { Card } from '@/components/ui';
import { FiUser, FiArchive, FiSearch, FiMessageCircle, FiCalendar, FiEdit2, FiAlertTriangle, FiPlus, FiChevronDown, FiGlobe, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useAbaCRM } from './useAbaCRM';
import { ModalCliente } from './ModalCliente';

const formatarData = (d: string) => {
  if (!d) return '—';
  const iso = d.split('T')[0];
  if (iso <= '1900-01-01') return '—';   // sentinela de importação legada
  return iso.split('-').reverse().join('/');
};

function formatarTelefone(tel: string | null | undefined): string {
  if (!tel) return 'Sem telefone';
  const digits = tel.replace(/\D/g, '');
  // Remove prefixo 55 (código do Brasil)
  let num = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (num.length === 11) return `+55 (${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
  if (num.length === 10) return `+55 (${num.slice(0, 2)}) ${num.slice(2, 6)}-${num.slice(6)}`;
  return tel.trim(); // fallback: exibe como está
}

const labelStyle = { margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#94A3B8', display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };

export function AbaCRM({ perfil }: any) {
  const crm = useAbaCRM(perfil);

  if (crm.carregando) return (
    <div className="flex h-full items-center justify-center font-title uppercase tracking-widest font-bold text-sm" style={{ color: '#94A3B8' }}>
      A carregar carteira de clientes... ⏳
    </div>
  );

  return (
    <div className="font-body" style={{ padding: 32, overflowY: 'auto', flex: 1, position: 'relative', background: C.bg }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: 16, top: 12, color: '#94A3B8' }} size={16} />
          <input value={crm.busca} onChange={e => crm.setBusca(e.target.value)}
            placeholder="Procurar por nome, CPF ou telefone..."
            style={{ padding: '10px 16px 10px 42px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, outline: 'none', width: 320, color: C.textMain, fontWeight: 500, fontFamily: 'var(--font-body)' }} />
        </div>
        <button onClick={crm.abrirNovoCliente}
          className="font-body font-semibold text-sm px-5 py-2.5 rounded-lg transition-all shadow-sm cursor-pointer hover:scale-[1.02] flex items-center gap-2"
          style={{ background: C.btnPrimary, color: '#fff', border: 'none' }}>
          <FiPlus size={18} /> Novo Cliente
        </button>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 32, marginBottom: 24, borderBottom: `1px solid ${C.borderMid}` }}>
        {[{ id: 'ativos', icon: FiUser, label: 'Clientes Ativos' }, { id: 'arquivados', icon: FiArchive, label: 'Arquivados' }].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => crm.setAbaLista(id)} className="font-title uppercase tracking-widest"
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', fontSize: 11, fontWeight: 700, color: crm.abaLista === id ? C.sidebarBg : '#94A3B8', cursor: 'pointer', borderBottom: crm.abaLista === id ? `2px solid ${C.sidebarBg}` : '2px solid transparent', paddingBottom: 12, transition: '0.2s' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 12 }}>
          <FiGlobe size={12} color="#94A3B8" />
          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Modelo Global de Clientes</span>
        </div>
      </div>

      {/* Cabeçalho da tabela */}
      <div style={{ display: 'flex', padding: '0 24px 12px', borderBottom: `1px solid ${C.borderMid}`, marginBottom: 16 }}>
        <span style={{ width: 44, marginRight: 16 }} />
        <span className="font-title uppercase tracking-widest" style={{ width: 280, fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>Cliente</span>
        <span className="font-title uppercase tracking-widest" style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>E-mail</span>
        <span className="font-title uppercase tracking-widest" style={{ width: 130, fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>Cadastro</span>
        <span className="font-title uppercase tracking-widest" style={{ width: 150, fontSize: 10, fontWeight: 700, color: '#94A3B8', textAlign: 'right', paddingRight: 8 }}>Ações</span>
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {crm.lista.length === 0 && (
          crm.busca.trim() ? (
            /* Busca sem resultado */
            <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
              <FiSearch size={36} color={C.borderMid} style={{ marginBottom: 12 }} />
              <h3 className="font-title" style={{ margin: '0 0 8px', color: C.textMain, fontSize: 15, fontWeight: 700 }}>Nenhum resultado para "{crm.busca}"</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13 }}>Verifique a grafia ou cadastre um novo cliente com esse nome.</p>
              <button onClick={crm.abrirNovoCliente}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <FiPlus size={15} /> Cadastrar "{crm.busca}"
              </button>
            </div>
          ) : (
            /* Lista vazia — nenhum cliente cadastrado */
            <div style={{ textAlign: 'center', padding: 80, color: C.textMuted, background: C.bgCard, borderRadius: 16, border: `1px dashed ${C.borderMid}` }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
              <h3 className="font-title" style={{ margin: '0 0 8px', color: C.textMain, fontSize: 16, fontWeight: 700 }}>Nenhum cliente cadastrado</h3>
              <p style={{ margin: '0 0 20px', fontSize: 13, lineHeight: 1.6 }}>
                Adicione seus clientes para agendar atendimentos, enviar lembretes e acompanhar o histórico.
              </p>
              <button onClick={crm.abrirNovoCliente}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <FiPlus size={16} /> Cadastrar primeiro cliente
              </button>
            </div>
          )
        )}

        {crm.listaPaginada.map(c => (
          <Card key={c._crm_id || c.id} onClick={() => crm.setSel(c === crm.sel ? null : c)}
            className="shadow-sm"
            style={{ padding: '16px 24px', cursor: 'pointer', border: `1px solid ${c === crm.sel ? C.sidebarBg : C.border}`, transition: 'all 0.2s', opacity: c.ativo === false ? 0.6 : 1, background: c.ativo === false ? C.bg : C.bgCard, borderRadius: RAIO_XL }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: c === crm.sel ? 20 : 0 }}>
              {c.foto_url
                ? <img src={c.foto_url} style={{ width: 44, height: 44, borderRadius: RAIO_MD, objectFit: 'cover', filter: !c.ativo ? 'grayscale(100%)' : 'none' }} alt="Foto" />
                : <div style={{ width: 44, height: 44, borderRadius: RAIO_MD, background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontWeight: 'bold', fontSize: 16, filter: !c.ativo ? 'grayscale(100%)' : 'none' }}>
                    {c.nome_completo?.substring(0, 2).toUpperCase() || 'CL'}
                  </div>}

              <div style={{ width: 280 }}>
                <p className="font-title" style={{ margin: 0, fontWeight: 700, fontSize: 14, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {c.nome_completo}
                  {!c.ativo && <span style={{ fontSize: 9, background: C.dangerBg, color: C.dangerText, padding: '3px 6px', borderRadius: RAIO_XS }}>ARQUIVADO</span>}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{formatarTelefone(c.telefone_whatsapp)}</p>
              </div>

              <div style={{ flex: 1, color: C.textMain, fontSize: 13, fontWeight: 500 }}>{c.email || '-'}</div>
              <div style={{ width: 130, color: C.textMuted, fontSize: 13, fontWeight: 500 }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '--/--/----'}</div>
              <div style={{ width: 150, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
                <FiChevronDown size={18} style={{ color: '#94A3B8', transform: c === crm.sel ? 'rotate(180deg)' : 'rotate(0)', transition: '0.2s' }} />
              </div>
            </div>

            {c === crm.sel && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                  {(() => {
                    const visitas = crm.statsCliente?.total_visitas ?? c.total_visitas ?? 0;
                    const gasto   = crm.statsCliente?.total_gasto   ?? c.total_gasto   ?? 0;
                    return [
                      { label: 'Última Visita',      val: formatarData(crm.statsCliente?.ultima_visita ?? c.data_ultima_visita) },
                      { label: 'Total de Visitas',    val: visitas },
                      { label: 'Origem',              val: c.como_conheceu || 'Balcão' },
                      { label: 'Ticket Médio',        val: brl(visitas > 0 ? gasto / visitas : 0), isBrl: true },
                      { label: 'Total Gasto na Loja', val: brl(gasto),                          isBrl: true },
                    ];
                  })().map(({ label, val, isBrl }) => (
                    <div key={label}>
                      <p style={labelStyle}>{label}</p>
                      <p className={isBrl ? 'font-title' : ''} style={{ margin: 0, fontSize: 13, fontWeight: isBrl ? 700 : 600, color: isBrl ? C.sidebarBg : C.textMain }}>{val as any}</p>
                    </div>
                  ))}
                </div>

                {c.observacoes && (
                  <div style={{ background: C.bg, padding: 16, borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}>
                    <p style={{ margin: '0 0 6px', fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FiAlertTriangle size={14} /> Observações desta unidade
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: C.textMain, fontWeight: 500 }}>{c.observacoes}</p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <button onClick={e => crm.abrirWhatsApp(e, c)} className="transition-all hover:opacity-90"
                    style={{ flex: 2, padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#fff', background: C.success, borderRadius: RAIO_MD, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
                    <FiMessageCircle size={16} /> WhatsApp
                  </button>
                  <button onClick={e => crm.abrirAgendamento(e, c)} disabled={!c.ativo} className="transition-all hover:bg-slate-100"
                    style={{ flex: 2, padding: '10px 0', fontSize: 13, fontWeight: 600, color: C.sidebarBg, background: 'transparent', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, opacity: c.ativo ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: c.ativo ? 'pointer' : 'not-allowed' }}>
                    <FiCalendar size={16} /> Agendar
                  </button>
                  <button onClick={e => { e.stopPropagation(); crm.abrirEdicao(c); }} className="transition-all hover:scale-[1.02]"
                    style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#fff', background: C.sidebarBg, border: 'none', borderRadius: RAIO_MD, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
                    <FiEdit2 size={16} /> Abrir Ficha
                  </button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Paginação */}
      {crm.totalPaginas > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.borderMid}` }}>
          <button
            onClick={() => crm.setPagina(p => Math.max(0, p - 1))}
            disabled={crm.pagina === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: 'transparent', color: crm.pagina === 0 ? C.textLight : C.textMain, cursor: crm.pagina === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            <FiChevronLeft size={15} /> Anterior
          </button>
          <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>
            {crm.pagina * crm.POR_PAGINA + 1}–{Math.min((crm.pagina + 1) * crm.POR_PAGINA, crm.lista.length)} de {crm.lista.length} clientes
          </span>
          <button
            onClick={() => crm.setPagina(p => Math.min(crm.totalPaginas - 1, p + 1))}
            disabled={crm.pagina >= crm.totalPaginas - 1}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: 'transparent', color: crm.pagina >= crm.totalPaginas - 1 ? C.textLight : C.textMain, cursor: crm.pagina >= crm.totalPaginas - 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Próxima <FiChevronRight size={15} />
          </button>
        </div>
      )}

      <ModalCliente crm={crm} perfil={perfil} />
    </div>
  );
}
