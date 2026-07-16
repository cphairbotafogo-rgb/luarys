'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C, brl, getDataHojeLocal } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import { FiCalendar, FiClock, FiSearch, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import { RAIO_MD, RAIO_LG, RAIO_XL } from '@/lib/estiloGlobal';
import { FONTE_TITULO, FONTE_CORPO } from '@/modules/portal/estiloPortal';
import { PortalPagamentoReserva } from '@/modules/portal/PortalPagamentoReserva';

const TITULOS = ['', '1. Data', '2. Serviço', '3. Horário', '4. Profissional', '5. Reserva', 'Agendado!'];

interface Props {
  salaoSelecionado: any;
  clienteFresh: any;
  onFinalizado: () => void;
  onVoltar: () => void;
}

export function TelaAgendamentoMobile({ salaoSelecionado, clienteFresh, onFinalizado, onVoltar }: Props) {
  const toast = useToast();
  const [passo, setPasso] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [servicos, setServicos] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [salaoFresh, setSalaoFresh] = useState<any>(salaoSelecionado);
  const [dataEscolhida, setDataEscolhida] = useState('');
  const [horaEscolhida, setHoraEscolhida] = useState('');
  const [servicoEscolhido, setServicoEscolhido] = useState<any>(null);
  const [profissionalEscolhido, setProfissionalEscolhido] = useState<any>(null);
  const [termoBusca, setTermoBusca] = useState('');
  const [setorFiltro, setSetorFiltro] = useState('');
  const [agendamentosDoDia, setAgendamentosDoDia] = useState<any[]>([]);
  const [buscandoAgenda, setBuscandoAgenda] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [horarios, setHorarios] = useState<string[]>([]);
  const [idCriado, setIdCriado] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/portal/dados-agendamento?salao_id=${salaoSelecionado.id}`, { cache: 'no-store' });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error ?? `Erro ${res.status}`);
        setServicos(payload.servicos ?? []);
        setProfissionais((payload.profissionais ?? []).filter((p: any) =>
          p.ativo !== false && p.produtivo !== false && p.perfil_avancado?.exibir_na_agenda !== false
        ));
        if (payload.salao) setSalaoFresh(payload.salao);
      } catch (e: any) {
        setErro('Não foi possível carregar os serviços. Tente novamente.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [salaoSelecionado.id]);

  const toMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };

  async function aoEscolherData(data: string) {
    setDataEscolhida(data); setHoraEscolhida('');
    if (!data) return;
    setBuscandoAgenda(true);
    const { data: diaExc } = await supabase.from('dias_excepcionais').select('tipo,hora_abertura,hora_fechamento').eq('salao_id', salaoSelecionado.id).eq('data', data).maybeSingle();
    if (diaExc?.tipo === 'fechado') { setHorarios([]); setBuscandoAgenda(false); return; }
    const diaDaSemana = new Date(data + 'T12:00:00').getDay();
    const padroes = [{ id: 1, ativo: true, inicio: '09:00', fim: '19:00' }, { id: 2, ativo: true, inicio: '09:00', fim: '19:00' }, { id: 3, ativo: true, inicio: '09:00', fim: '19:00' }, { id: 4, ativo: true, inicio: '09:00', fim: '19:00' }, { id: 5, ativo: true, inicio: '09:00', fim: '19:00' }, { id: 6, ativo: true, inicio: '09:00', fim: '18:00' }, { id: 0, ativo: false, inicio: '10:00', fim: '15:00' }];
    let cfg: any[] = [];
    try { cfg = typeof salaoFresh?.horarios_funcionamento === 'string' ? JSON.parse(salaoFresh.horarios_funcionamento) : (salaoFresh?.horarios_funcionamento || padroes); } catch { cfg = padroes; }
    let configDia: any = cfg.find((h: any) => h.id === diaDaSemana);
    if (diaExc?.tipo === 'horario_especial' && diaExc.hora_abertura && diaExc.hora_fechamento) configDia = { ativo: true, inicio: diaExc.hora_abertura, fim: diaExc.hora_fechamento };
    const hs: string[] = [];
    if (configDia?.ativo) {
      let t = toMin(configDia.inicio); const fim = toMin(configDia.fim);
      while (t <= fim) { hs.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`); t += 30; }
    }
    setHorarios(hs);
    const { data: ags } = await supabase.from('agendamentos').select('profissional_id,inicio,duracao_min,status').eq('salao_id', salaoSelecionado.id).eq('data', data).neq('status', 'Cancelado');
    if (ags) setAgendamentosDoDia(ags);
    setBuscandoAgenda(false);
  }

  function isEsgotado(hora: string) {
    if (!profissionais.length) return false;
    const ini = toMin(hora); const dur = servicoEscolhido?.duracao_minutos || 30; const fim = ini + dur;
    return profissionais.every(p => agendamentosDoDia.some(ag => { if (ag.profissional_id !== p.id) return false; const ai = toMin(ag.inicio); const af = ai + (ag.duracao_min || 30); return ini < af && fim > ai; }));
  }

  async function confirmar(statusForcado: string | null = null, profParam?: any) {
    const prof = profParam || profissionalEscolhido;
    if (!dataEscolhida || !horaEscolhida || !servicoEscolhido?.id || !prof?.id) return null;
    setSalvando(true);
    if (idCriado && statusForcado === 'Confirmado') {
      await supabase.from('agendamentos').update({ status: 'Confirmado' }).eq('id', idCriado);
      setSalvando(false); setPasso(6); return idCriado;
    }
    const cobrar = salaoFresh?.cobrar_sinal;
    const dur = servicoEscolhido?.duracao_minutos || 30;
    const iniMin = toMin(horaEscolhida); const fimMin = iniMin + dur;
    const { data: agsDia } = await supabase.from('agendamentos').select('inicio,duracao_min').eq('salao_id', salaoSelecionado.id).eq('profissional_id', prof.id).eq('data', dataEscolhida).neq('status', 'Cancelado');
    const conflito = (agsDia || []).some((ag: any) => { const ai = toMin(ag.inicio); const af = ai + (ag.duracao_min || 30); return iniMin < af && fimMin > ai; });
    if (conflito) { toast.aviso('Este horário foi reservado. Escolha outro.'); setSalvando(false); setPasso(3); return null; }
    const status = statusForcado || (cobrar ? 'Aguardando' : 'Confirmado');
    const { data, error } = await supabase.from('agendamentos').insert([{ salao_id: salaoSelecionado.id, cliente_id: clienteFresh.id, profissional_id: prof.id, servico_id: servicoEscolhido.id, data: dataEscolhida, inicio: horaEscolhida, duracao_min: dur, status, cliente_nome: clienteFresh.nome_completo || 'Cliente', observacao: '[Portal do Cliente Mobile]', valor_sinal: cobrar ? (servicoEscolhido?.preco_padrao || 0) * ((salaoFresh?.porcentagem_sinal || 0) / 100) : 0 }]).select('id');
    setSalvando(false);
    if (!error && data) { setIdCriado(data[0].id); if (!cobrar || status === 'Confirmado') setPasso(6); return data[0].id; }
    toast.erro('Erro ao agendar: ' + error?.message); return null;
  }

  const setoresUnicos = [...new Set(servicos.map((s: any) => s?.setor).filter(Boolean))].sort() as string[];
  const servicosFiltrados = servicos.filter(s => (!termoBusca || s?.nome_servico?.toLowerCase().includes(termoBusca.toLowerCase())) && (!setorFiltro || s?.setor === setorFiltro));
  const profsDisponiveis = profissionais.filter(p => { const ini = toMin(horaEscolhida); const dur = servicoEscolhido?.duracao_minutos || 30; const fim = ini + dur; const ocupado = agendamentosDoDia.some(ag => { if (ag.profissional_id !== p.id) return false; const ai = toMin(ag.inicio); const af = ai + (ag.duracao_min || 30); return ini < af && fim > ai; }); return !ocupado && (p?.servicos_habilitados ? p.servicos_habilitados.includes(servicoEscolhido?.id) : true); });

  const btnFooter = { width: '100%', padding: '0 24px', height: 56, background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_LG, fontFamily: FONTE_TITULO, fontSize: 15, fontWeight: 700, cursor: 'pointer' } as const;

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200, display: 'flex', flexDirection: 'column', fontFamily: FONTE_CORPO }}>
      <div style={{ background: C.bgCard, borderBottom: `1px solid ${C.border}`, borderTop: `3px solid ${C.douradoEleva}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={passo > 1 && passo < 6 ? () => setPasso(p => p - 1) : onVoltar} style={{ background: 'none', border: 'none', color: C.sidebarBg, cursor: 'pointer', display: 'flex', padding: 4 }}><FiArrowLeft size={22} /></button>
        <h2 style={{ fontFamily: FONTE_TITULO, margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg, flex: 1 }}>{TITULOS[passo]}</h2>
        <div style={{ display: 'flex', gap: 5 }}>{[1,2,3,4,5].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i <= passo && passo < 6 ? C.sidebarBg : C.borderMid }} />)}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 100px' }}>
        {carregando && <p style={{ textAlign: 'center', padding: 40, color: C.sidebarBg, fontWeight: 700 }}>A carregar serviços...</p>}
        {erro && <div style={{ background: '#FEF2F2', borderRadius: RAIO_XL, padding: 20, textAlign: 'center', color: C.danger, fontWeight: 700 }}>{erro}</div>}

        {!carregando && !erro && passo === 1 && (
          <>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Qual a melhor data?</label>
            <input type="date" value={dataEscolhida} onChange={e => aoEscolherData(e.target.value)} min={getDataHojeLocal()} style={{ width: '100%', padding: '14px 16px', borderRadius: RAIO_LG, border: `1px solid ${C.borderMid}`, fontSize: 16, outlineColor: C.sidebarBg, boxSizing: 'border-box', color: C.textMain }} />
            {buscandoAgenda && <p style={{ marginTop: 12, fontSize: 13, color: C.textMuted, textAlign: 'center' }}>A verificar disponibilidade...</p>}
          </>
        )}

        {!carregando && !erro && passo === 2 && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {setoresUnicos.map(s => <button key={s} onClick={() => setSetorFiltro(setorFiltro === s ? '' : s)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: setorFiltro === s ? C.sidebarBg : C.bgCard, color: setorFiltro === s ? '#fff' : C.textMuted, border: `1px solid ${setorFiltro === s ? C.sidebarBg : C.borderMid}` }}>{s}</button>)}
            </div>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <FiSearch size={15} color={C.textLight} style={{ position: 'absolute', left: 14, top: 15 }} />
              <input type="text" placeholder="Buscar serviço..." value={termoBusca} onChange={e => setTermoBusca(e.target.value)} style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: RAIO_LG, border: `1px solid ${C.borderMid}`, fontSize: 14, outlineColor: C.sidebarBg, boxSizing: 'border-box', color: C.textMain }} />
            </div>
            {servicosFiltrados.map(s => (
              <div key={s?.id} onClick={() => { setServicoEscolhido(s); setPasso(3); }} style={{ padding: '16px', border: `1px solid ${C.border}`, borderRadius: RAIO_XL, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, minHeight: 56, touchAction: 'manipulation' }}>
                <div><p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.textMain }}>{s?.nome_servico}</p><p style={{ margin: '4px 0 0', fontSize: 12, color: C.textLight, display: 'flex', alignItems: 'center', gap: 4 }}><FiClock size={11} /> {s?.duracao_minutos} min</p></div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.sidebarBg }}>{brl(s?.preco_padrao)}</p>
              </div>
            ))}
          </>
        )}

        {!carregando && !erro && passo === 3 && (() => {
          const horariosLivres = horarios.filter(h => !isEsgotado(h));
          if (horarios.length === 0) return (
            <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
              <FiCalendar size={40} color={C.borderMid} />
              <p style={{ margin: '12px 0 0', fontWeight: 700 }}>Fechado neste dia. Escolha outra data.</p>
            </div>
          );
          if (horariosLivres.length === 0) return (
            <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
              <FiCalendar size={40} color={C.borderMid} />
              <p style={{ margin: '12px 0 0', fontWeight: 700 }}>Sem horários disponíveis neste dia.</p>
              <p style={{ margin: '8px 0 0', fontSize: 13 }}>Escolha outra data ou outro serviço.</p>
            </div>
          );
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {horariosLivres.map(h => (
                <button key={h} onClick={() => { setHoraEscolhida(h); setProfissionalEscolhido(null); setPasso(4); }} style={{ padding: '14px 0', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMain, fontWeight: 800, fontSize: 15, cursor: 'pointer', minHeight: 52 }}>{h}</button>
              ))}
            </div>
          );
        })()}

        {!carregando && !erro && passo === 4 && (
          profsDisponiveis.length === 0
            ? <p style={{ textAlign: 'center', color: C.textMuted, padding: 20 }}>Nenhum profissional disponível neste horário.</p>
            : profsDisponiveis.map(p => (
                <div key={p?.id} onClick={() => { setProfissionalEscolhido(p); if (salaoFresh?.cobrar_sinal) setPasso(5); else { setAceitouTermos(true); setTimeout(() => confirmar('Confirmado', p), 100); } }} style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, minHeight: 56, touchAction: 'manipulation' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.sidebarBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>{p?.nome?.substring(0, 2).toUpperCase()}</div>
                  <span style={{ fontFamily: FONTE_TITULO, fontSize: 16, fontWeight: 800, color: C.textMain }}>{p?.nome}</span>
                </div>
              ))
        )}

        {passo === 5 && <PortalPagamentoReserva salaoSelecionado={salaoFresh} servicoEscolhido={servicoEscolhido} clienteNome={clienteFresh?.nome_completo || 'Cliente'} aceitouTermos={aceitouTermos} setAceitouTermos={setAceitouTermos} salvando={salvando} confirmarAgendamento={confirmar} />}

        {passo === 6 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <FiCheckCircle size={72} color={C.success} />
            <h2 style={{ fontFamily: FONTE_TITULO, margin: '16px 0 8px', color: C.sidebarBg, fontWeight: 900 }}>Agendado com Sucesso!</h2>
            <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 32px' }}>{dataEscolhida.split('-').reverse().join('/')} às {horaEscolhida} com {profissionalEscolhido?.nome}</p>
            <button onClick={onFinalizado} style={{ ...btnFooter, borderRadius: RAIO_LG }}>Voltar ao Início</button>
          </div>
        )}
      </div>

      {passo === 1 && !carregando && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: C.bgCard, borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => setPasso(2)} disabled={!dataEscolhida || buscandoAgenda} style={{ ...btnFooter, background: (!dataEscolhida || buscandoAgenda) ? C.borderMid : C.sidebarBg }}>Escolher Serviço</button>
        </div>
      )}
    </div>
  );
}
