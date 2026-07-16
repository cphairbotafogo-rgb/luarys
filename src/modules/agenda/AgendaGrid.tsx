// src/modules/agenda/AgendaGrid.tsx
// Grade visual da agenda — colunas por profissional, cards de agendamento.
// Novidades:
//   - Tooltip ao hover: telefone clicável (WhatsApp)
//   - Menu de clique direito sobre card: status, editar, fechar conta, faltou, cancelar
//   - Cor do card controlada por corPorStatus() — sempre reflete o status atual
'use client'
import { useState, useRef, useCallback } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_XS } from '@/lib/estiloGlobal';
import { FiGlobe, FiGift, FiCheckCircle, FiZap, FiCalendar, FiAlertCircle } from 'react-icons/fi';
import { converterParaMinutos, corPorStatus } from '@/lib/agendaUtils';
import { MSG_ZAP_PADRAO } from '@/lib/mensagensPadrao';
import { TooltipAgendamento } from '@/modules/agenda/TooltipAgendamento';
import { MenuContextoAgendamento } from '@/modules/agenda/modals/MenuContextoAgendamento';

export function AgendaGrid({
  gridScrollRef,
  diaSalaoFechado,
  horariosDoDia,
  profissionaisVisiveis,
  filtroFuncao,
  LARGURA_COLUNA,
  ALTURA_HORA,
  ALTURA_MINUTO,
  HORA_INICIO,
  HORA_FIM,
  horasDoDia,
  agendamentos,
  dataHojeStr,
  clientesDb,
  mesStr,
  diaStr,
  redimensionando,
  aoMoverMouse,
  aoSoltarMouse,
  abrirNovoAgendamentoGrid,
  lidarComCliqueDireito,
  iniciarRedimensionamento,
  aoClicarAgendamento,
  onDuploCliqueAgendamento,
  // novos handlers
  onAlterarStatus,
  onFecharConta,
  onEditarCliente,
  onCancelar,
  onFaltou,
  isGerenteOuDono,
  dadosSalao,
  perfil,
}: any) {

  // ── Tooltip state ───────────────────────────────────────────────────────────
  const [tooltip, setTooltip] = useState<{
    ag: any; screenY: number; screenX: number; larguraColuna: number;
  } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Menu de contexto sobre card ─────────────────────────────────────────────
  const [menuCard, setMenuCard] = useState<{ ag: any; x: number; y: number } | null>(null);

  // ── Cálculos visuais ────────────────────────────────────────────────────────
  function calcularPosicao(horaString: string, duracaoMinutos: number) {
    let [h, m] = horaString.split(':').map(Number);
    if (h === 0) h = 24;
    return {
      top: (((h - HORA_INICIO) * 60) + m) * ALTURA_MINUTO,
      height: duracaoMinutos * ALTURA_MINUTO,
    };
  }

  function calcularSobreposicao(ag: any, agsDoDia: any[]) {
    const aInicio = converterParaMinutos(ag.inicio);
    const aFim = aInicio + ag.duracaoMin;
    const conflitos = agsDoDia.filter(outro => {
      const bInicio = converterParaMinutos(outro.inicio);
      const bFim = bInicio + outro.duracaoMin;
      return (aInicio < bFim && aFim > bInicio);
    });
    if (conflitos.length <= 1) return { left: 4, width: 'calc(100% - 8px)' };
    const widthPerc = 100 / conflitos.length;
    return {
      left: `calc(${conflitos.findIndex(x => x.id === ag.id) * widthPerc}% + 2px)`,
      width: `calc(${widthPerc}% - 4px)`,
    };
  }

  function verificarAniversario(nomeCliente: string) {
    const cliente = clientesDb.find((c: any) => c.nome_completo === nomeCliente);
    if (!cliente?.nascimento) return null;
    const partesNasc = cliente.nascimento.split('-');
    if (partesNasc.length < 3) return null;
    if (partesNasc[1] === mesStr && partesNasc[2].substring(0, 2) === diaStr) return 'hoje';
    if (partesNasc[1] === mesStr) return 'mes';
    return null;
  }

  // ── Handlers de hover (tooltip) ─────────────────────────────────────────────
  const handleMouseEnterCard = useCallback((e: React.MouseEvent, ag: any) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tooltipTimer.current = setTimeout(() => {
      setTooltip({
        ag,
        screenY: rect.top,
        screenX: rect.right + 8,   // aparece à direita do card
        larguraColuna: LARGURA_COLUNA,
      });
    }, 600);
  }, [LARGURA_COLUNA]);

  const handleMouseLeaveCard = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    // pequeno delay para o usuário mover o mouse até o tooltip sem ele sumir
    tooltipTimer.current = setTimeout(() => setTooltip(null), 200);
  }, []);

  // ── Handler de clique direito sobre card ────────────────────────────────────
  const handleContextMenuCard = useCallback((e: React.MouseEvent, ag: any) => {
    e.preventDefault();
    e.stopPropagation();
    setTooltip(null);
    setMenuCard({ ag, x: e.clientX, y: e.clientY });
  }, []);

  // ── WhatsApp via template configurado em Textos Padrões ─────────────────────
  function abrirWhatsAppCard(ag: any) {
    const cliente = clientesDb.find((c: any) => c.nome_completo === ag.cliente);
    const telefone = cliente?.telefone_whatsapp;
    if (!telefone) return;
    const num = telefone.replace(/\D/g, '');
    const primeiroNome = (ag.cliente || '').split(' ')[0];
    const dataFormatada = ag.data ? ag.data.split('-').reverse().join('/') : '';
    const prof = profissionaisVisiveis?.find((p: any) => String(p.id) === String(ag.id_prof));
    const nomeSalao = dadosSalao?.nome_fantasia || dadosSalao?.razao_social || '';
    const template = dadosSalao?.msg_whatsapp || MSG_ZAP_PADRAO;
    let mensagem = template
      .replace(/\{nome_do_cliente\}/g, primeiroNome)
      .replace(/\{data\}/g, dataFormatada)
      .replace(/\{horario\}/g, ag.inicio || '')
      .replace(/\{servico\}/g, ag.servico || '')
      .replace(/\{nome_salao\}/g, nomeSalao);
    if (prof?.nome) {
      mensagem = mensagem.replace(/\{profissional\}/g, prof.nome);
    } else {
      mensagem = mensagem.replace(/.*\{profissional\}.*\n?/g, '');
    }
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`, '_blank');
  }

  return (
    <div
      ref={gridScrollRef}
      onMouseMove={aoMoverMouse}
      onMouseUp={aoSoltarMouse}
      onMouseLeave={aoSoltarMouse}
      onContextMenu={e => {
        // Bloqueia o menu nativo do navegador em toda a grade;
        // os handlers específicos de card e célula chamam e.preventDefault() individualmente.
        if ((e.target as HTMLElement).closest('[data-agenda-card]')) e.preventDefault();
      }}
      style={{ flex: 1, overflow: 'auto', position: 'relative', display: 'flex', background: C.bgCard, userSelect: redimensionando ? 'none' : 'auto' }}
    >

      {/* COLUNA DE HORÁRIOS */}
      <div style={{ width: 65, flexShrink: 0, borderRight: `1px solid ${C.borderMid}`, position: 'sticky', left: 0, background: C.bgCard, zIndex: 10 }}>
        <div style={{ height: 60, borderBottom: `1px solid ${C.borderMid}`, background: C.bgCard, position: 'sticky', top: 0, zIndex: 20 }} />
        <div style={{ position: 'relative', height: (HORA_FIM - HORA_INICIO + 1) * ALTURA_HORA }}>
          {horasDoDia.map((h: number) => (
            <div key={h} style={{ height: ALTURA_HORA, borderBottom: `1px solid ${C.borderMid}`, position: 'relative', color: C.textLight, fontSize: 12, fontWeight: 700 }}>
              <span style={{ position: 'absolute', top: 8, width: '100%', textAlign: 'center', color: C.textMuted }}>{h === 24 ? '0h' : `${h}h`}</span>
              <span style={{ position: 'absolute', top: '50%', width: '100%', textAlign: 'center', fontSize: 10, color: '#CBD5E1', marginTop: -6 }}>30</span>
            </div>
          ))}
        </div>
      </div>

      {/* ÁREA DOS PROFISSIONAIS */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>

        {diaSalaoFechado && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(248,250,252,0.92)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ fontSize: 40 }}>🔒</div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.textMain }}>Estabelecimento Fechado</p>
            <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>{horariosDoDia?.dia || 'Este dia'} não está marcado como dia útil nas Configurações.</p>
          </div>
        )}

        {profissionaisVisiveis.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, textAlign: 'center', gap: 12 }}>
            <FiCalendar size={40} color={C.borderMid} />
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: C.textMain }}>Nenhum profissional na agenda</p>
              <p style={{ margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                Cadastre profissionais em <strong>Minha Equipe</strong> e ative a opção<br />
                <em>"Visível na Agenda Geral"</em> no perfil de cada um.
              </p>
            </div>
          </div>
        )}

        {profissionaisVisiveis
          .filter((prof: any) => !filtroFuncao || prof.perfil_avancado?.contrato?.funcao === filtroFuncao)
          .map((prof: any) => (
            <div key={prof.id} style={{ flex: 1, minWidth: LARGURA_COLUNA, borderRight: `1px solid ${C.borderMid}`, position: 'relative' }}>

              {/* Cabeçalho da coluna */}
              <div style={{ height: 60, borderBottom: `1px solid ${C.borderMid}`, background: C.bgCard, position: 'sticky', top: 0, zIndex: 15, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px' }}>
                {prof.foto_url ? (
                  <img src={prof.foto_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.sidebarBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>
                    {prof.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.charcoal }}>{prof.nome}</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.textLight }}>{prof.perfil_avancado?.contrato?.funcao || 'Equipe'}</p>
                </div>
              </div>

              {/* Grade de horários */}
              <div style={{ position: 'relative', height: (HORA_FIM - HORA_INICIO + 1) * ALTURA_HORA }}>
                {horasDoDia.map((h: number) => {
                  const horaStrBase = h === 24 ? '00' : String(h).padStart(2, '0');
                  return (
                    <div key={h} style={{ height: ALTURA_HORA, borderBottom: `1px solid ${C.borderMid}`, position: 'relative' }}>
                      <div
                        onDoubleClick={() => abrirNovoAgendamentoGrid(prof.id, `${horaStrBase}:00`)}
                        onContextMenu={e => lidarComCliqueDireito(e, prof.id, `${horaStrBase}:00`)}
                        style={{ position: 'absolute', top: 0, height: '50%', left: 0, right: 0, cursor: 'pointer' }}
                      />
                      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: `1px dashed ${C.borderMid}`, pointerEvents: 'none' }} />
                      <div
                        onDoubleClick={() => abrirNovoAgendamentoGrid(prof.id, `${horaStrBase}:30`)}
                        onContextMenu={e => lidarComCliqueDireito(e, prof.id, `${horaStrBase}:30`)}
                        style={{ position: 'absolute', top: '50%', height: '50%', left: 0, right: 0, cursor: 'pointer' }}
                      />
                    </div>
                  );
                })}

                {/* Cards de agendamento */}
                {agendamentos
                  .filter((a: any) => String(a.id_prof) === String(prof.id) && a.data === dataHojeStr)
                  .map((ag: any, _idx: number, agsDoDia: any[]) => {
                    const styleP      = calcularPosicao(ag.inicio, ag.duracaoMin);
                    const sobreposicao = calcularSobreposicao(ag, agsDoDia);
                    const aniversario  = verificarAniversario(ag.cliente);
                    // Cor sempre controlada pelo status
                    const corCard      = corPorStatus(ag);

                    // "Faltou" ou "Cancelado": exibe riscado/opaco para sinalizar
                    const ehFaltou            = ag.status === 'Faltou';
                    const ehCancelado         = ag.status === 'Cancelado';
                    const ehAguardandoPagamento = ag.status === 'Aguardando Pagamento';
                    const ehBloqueado         = ag.status === 'Bloqueado';
                    const ehSemPagamento      = ag.semPagamento === true;
                    // Extrai motivo do campo observacao "[Tipo] Motivo"
                    const motivoBloqueio = ehBloqueado
                      ? (String(ag.observacao || '').match(/^\[.+?\]\s*([\s\S]*)/) || [])[1]?.trim() || ''
                      : '';

                    return (
                      <div
                        key={ag.id}
                        data-agenda-card="true"
                        onClick={e => { e.stopPropagation(); aoClicarAgendamento(ag); }}
                        onDoubleClick={e => { e.stopPropagation(); if (ag.status === 'Finalizado') onDuploCliqueAgendamento?.(ag); }}
                        onContextMenu={ehBloqueado ? e => e.preventDefault() : e => { e.preventDefault(); e.stopPropagation(); handleContextMenuCard(e, ag); }}
                        onMouseEnter={ehBloqueado ? undefined : e => handleMouseEnterCard(e, ag)}
                        onMouseLeave={ehBloqueado ? undefined : handleMouseLeaveCard}
                        style={{
                          position: 'absolute',
                          top: styleP.top,
                          left: sobreposicao.left,
                          width: sobreposicao.width,
                          height: styleP.height - 2,
                          background: ehBloqueado ? '#FDF4F5' : corCard,
                          opacity: ehCancelado ? 0.45 : 1,
                          borderRadius: RAIO_XS,
                          padding: '6px 10px',
                          color: ehBloqueado ? '#7A3A40' : '#fff',
                          overflow: 'hidden',
                          boxShadow: ehBloqueado
                            ? 'inset 0 0 0 1px #F0DADA'
                            : ag.eh_encaixe
                              ? `0 0 0 1px ${C.douradoEleva}, 0 2px 4px rgba(0,0,0,0.1)`
                              : '0 2px 4px rgba(0,0,0,0.1)',
                          cursor: 'pointer',
                          borderLeft: ehBloqueado
                            ? '4px solid #E8B4B8'
                            : ag.eh_encaixe ? `4px solid ${C.douradoEleva}` : '4px solid rgba(0,0,0,0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          transition: 'background 0.25s ease, opacity 0.25s ease',
                          zIndex: 5,
                          outline: ehFaltou ? '2px dashed rgba(255,255,255,0.6)' : ehAguardandoPagamento ? '2px dotted rgba(255,255,255,0.8)' : undefined,
                          outlineOffset: (ehFaltou || ehAguardandoPagamento) ? '-3px' : undefined,
                        }}
                      >
                        {/* Conteúdo do card — bloqueios têm layout próprio */}
                        {ehBloqueado ? (
                          <>
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#9A4A50', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              🔒 {ag.cliente}
                            </div>
                            {motivoBloqueio && (
                              <div style={{ fontSize: 10, marginTop: 2, color: '#B06060', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.9 }}>
                                {motivoBloqueio}
                              </div>
                            )}
                            <div style={{ fontSize: 9, marginTop: 2, color: '#C08080', opacity: 0.8 }}>{ag.inicio}</div>
                          </>
                        ) : (
                          <>
                            {/* Nome do cliente */}
                            <div style={{ fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {ag.status === 'Finalizado' && (
                                ehSemPagamento ? (
                                  <span title="Valor em aberto — cai para Clientes em Débito" style={{ background: '#F59E0B', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <FiAlertCircle size={10} color="#fff" />
                                  </span>
                                ) : (
                                  <span title="Conta Fechada e Paga" style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, flexShrink: 0 }}>
                                    <FiCheckCircle size={10} color="#fff" />
                                  </span>
                                )
                              )}
                              {ag.eh_encaixe && (
                                <span title="Encaixe" style={{ background: C.douradoEleva, color: '#2C3643', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <FiZap size={9} />
                                </span>
                              )}
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4, textDecoration: ehCancelado ? 'line-through' : undefined }}>
                                {ag.observacao?.includes('[Portal do Cliente]') && <FiGlobe size={12} title="Agendado online" />}
                                {ehFaltou ? <span style={{ opacity: 0.85 }}>⚠ {ag.cliente}</span> : ehAguardandoPagamento ? <span>💳 {ag.cliente}</span> : ag.cliente}
                              </span>
                              {aniversario === 'hoje' && (
                                <span title="Aniversário HOJE!" style={{ background: '#FFF', color: '#F26522', borderRadius: 8, padding: '1px 5px', fontSize: 9, fontWeight: 900, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                  <FiGift size={9} style={{ marginRight: 2 }} /> HOJE
                                </span>
                              )}
                              {aniversario === 'mes' && <FiGift size={10} title="Aniversário este mês" style={{ flexShrink: 0 }} />}
                            </div>

                            {/* Serviço + horário */}
                            <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ehFaltou ? 'FALTOU — ' : ehAguardandoPagamento ? 'SINAL PENDENTE — ' : ehSemPagamento ? 'DÉBITO — ' : ''}{ag.servico} - {ag.inicio}
                              </span>
                              {ag.etiquetas && ag.etiquetas.length > 0 && (
                                <div style={{ display: 'flex', gap: 2 }}>
                                  {ag.etiquetas.slice(0, 3).map((t: any) => (
                                    <span key={t.id} style={{ width: 6, height: 6, borderRadius: '50%', background: t.cor }} />
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {/* Alça de redimensionamento — oculta em bloqueios */}
                        {!ehBloqueado && (
                          <div
                            onMouseDown={e => iniciarRedimensionamento(e, ag)}
                            title="Arraste para ajustar"
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 8, cursor: 'ns-resize', background: 'rgba(255,255,255,0.4)', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
      </div>

      {/* TOOLTIP ao hover — renderizado via portal fixo para escapar do overflow:auto */}
      {tooltip && (
        <div
          onMouseEnter={() => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); }}
          onMouseLeave={handleMouseLeaveCard}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            overflow: 'visible',
            zIndex: 9990,
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'all' }}>
            <TooltipAgendamento
              ag={tooltip.ag}
              clientesDb={clientesDb}
              top={tooltip.screenY}
              left={tooltip.screenX}
              larguraColuna={tooltip.larguraColuna}
            />
          </div>
        </div>
      )}

      {/* MENU de contexto sobre card */}
      {menuCard && (
        <MenuContextoAgendamento
          ag={menuCard.ag}
          x={menuCard.x}
          y={menuCard.y}
          onFechar={() => setMenuCard(null)}
          onEditar={() => { setMenuCard(null); aoClicarAgendamento(menuCard.ag); }}
          onAlterarStatus={status => { onAlterarStatus?.(menuCard.ag, status); }}
          onFecharConta={() => { setMenuCard(null); onFecharConta?.(menuCard.ag); }}
          onEditarCliente={() => { setMenuCard(null); onEditarCliente?.(menuCard.ag); }}
          onCancelar={() => { setMenuCard(null); onCancelar?.(menuCard.ag); }}
          onFaltou={() => { setMenuCard(null); onFaltou?.(menuCard.ag); }}
          onWhatsApp={() => abrirWhatsAppCard(menuCard.ag)}
          temTelefone={!!clientesDb.find((c: any) => c.nome_completo === menuCard.ag.cliente)?.telefone_whatsapp}
          isGerenteOuDono={isGerenteOuDono ?? true}
        />
      )}
    </div>
  );
}
