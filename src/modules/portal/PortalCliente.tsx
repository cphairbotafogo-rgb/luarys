'use client'
import { useState, useEffect, useMemo } from 'react';
import { C, brl } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { inputStyle, botaoPrimarioStyle, cardStyle, labelStyle } from '@/lib/portalEstilos';
import { EtapaLanding } from './portal/EtapaLanding';
import { EtapaDados } from './portal/EtapaDados';
import { UUID_RE, DIAS_SEMANA, MESES, gerarSlots, formatarData, isoParaLocal, hoje, addDias } from './portal/tipos';
import type { Servico, Profissional, Salao, Etapa } from './portal/tipos';
import { FiCalendar, FiClock, FiUser, FiChevronLeft, FiChevronRight, FiMapPin, FiInstagram, FiLoader, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';

const wrapStyle = { minHeight: '100vh', background: '#F8FAFC', fontFamily: 'system-ui, sans-serif' };
const container = { maxWidth: 680, margin: '0 auto', padding: '0 16px 80px' };

export function PortalCliente({ salaoParam }: { salaoParam: string | null }) {
  const [salao, setSalao]             = useState<Salao | null>(null);
  const [servicos, setServicos]       = useState<Servico[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [carregando, setCarregando]   = useState(true);
  const [erroCarregar, setErroCarregar] = useState('');

  const [etapa, setEtapa]               = useState<Etapa>('landing');
  const [servicoSel, setServicoSel]     = useState<Servico | null>(null);
  const [profissionalSel, setProfissionalSel] = useState<Profissional | null>(null);
  const [dataSel, setDataSel]           = useState(hoje());
  const [horaSel, setHoraSel]           = useState('');
  const [clienteNome, setClienteNome]   = useState('');
  const [clienteTel, setClienteTel]     = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [enviando, setEnviando]         = useState(false);
  const [erroEnvio, setErroEnvio]       = useState('');
  const [categoriaSel, setCategoriaSel] = useState('');
  const [agendamentoId, setAgendamentoId] = useState('');

  useEffect(() => {
    if (!salaoParam) { setCarregando(false); return; }
    async function carregar() {
      let salaoId = salaoParam!;
      if (!UUID_RE.test(salaoId)) {
        const r = await fetch(`/api/portal/salao-por-slug?slug=${encodeURIComponent(salaoId)}`);
        if (!r.ok) { setErroCarregar('Salão não encontrado. Verifique o link.'); setCarregando(false); return; }
        salaoId = (await r.json()).salao_id;
      }
      const r = await fetch(`/api/portal/dados-agendamento?salao_id=${salaoId}`);
      if (!r.ok) { setErroCarregar('Não foi possível carregar os dados do salão.'); setCarregando(false); return; }
      const j = await r.json();
      setSalao({ ...j.salao, id: salaoId });
      setServicos(j.servicos || []);
      setProfissionais(j.profissionais || []);
      setCarregando(false);
    }
    carregar();
  }, [salaoParam]);

  const categorias = useMemo(() =>
    [...new Set(servicos.map(s => s.categoria).filter(Boolean))].sort() as string[],
  [servicos]);

  const servicosFiltrados = useMemo(() =>
    categoriaSel ? servicos.filter(s => s.categoria === categoriaSel) : servicos,
  [servicos, categoriaSel]);

  const slotsDisponiveis = useMemo(() =>
    servicoSel ? gerarSlots(servicoSel.duracao_minutos || 30) : [],
  [servicoSel]);

  const diasCalendario = useMemo(() => {
    const dias: string[] = [];
    let d = hoje();
    for (let i = 0; i < 30; i++) { dias.push(d); d = addDias(d, 1); }
    return dias;
  }, []);

  async function confirmarAgendamento() {
    if (!salao || !servicoSel || !profissionalSel || !dataSel || !horaSel || !clienteNome.trim()) {
      setErroEnvio('Preencha todos os campos obrigatórios.'); return;
    }
    setEnviando(true); setErroEnvio('');
    try {
      const r = await fetch('/api/portal/agendar-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salao_id: salao.id, servico_id: servicoSel.id, profissional_id: profissionalSel.id, data: dataSel, inicio: horaSel, cliente_nome: clienteNome, cliente_telefone: clienteTel, cliente_email: clienteEmail }),
      });
      const j = await r.json();
      if (!r.ok) { setErroEnvio(j.erro || 'Erro ao agendar.'); setEnviando(false); return; }
      setAgendamentoId(j.agendamentoId);
      setEtapa('sucesso');
    } catch { setErroEnvio('Erro de conexão. Tente novamente.'); }
    setEnviando(false);
  }

  const header = salao && (
    <div style={{ background: C.sidebarBg, color: '#fff', padding: '28px 24px 20px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>{salao.nome_fantasia}</h1>
        {salao.cidade && (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FiMapPin size={12} /> {salao.bairro ? `${salao.bairro}, ` : ''}{salao.cidade} - {salao.estado}
          </p>
        )}
      </div>
    </div>
  );

  if (carregando) return (
    <div style={{ ...wrapStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <FiLoader size={40} style={{ color: C.sidebarBg, animation: 'spin 1s linear infinite' }} />
        <p style={{ color: C.textMuted, marginTop: 16, fontSize: 14 }}>Carregando portal...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (!salaoParam || erroCarregar) return (
    <div style={{ ...wrapStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ ...cardStyle, maxWidth: 420, width: '100%', padding: 40, textAlign: 'center' }}>
        <FiAlertTriangle size={48} style={{ color: C.warning, marginBottom: 16 }} />
        <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: C.textMain }}>{erroCarregar || 'Link incompleto'}</h2>
        <p style={{ margin: 0, fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
          Acesse o portal pelo link completo fornecido pelo seu salão.<br />
          Exemplo: <code style={{ background: C.bg, padding: '2px 6px', borderRadius: 4 }}>luarys.app/portal?salao=nome-do-salao</code>
        </p>
      </div>
    </div>
  );

  if (etapa === 'sucesso') return (
    <div style={{ ...wrapStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ ...cardStyle, maxWidth: 460, width: '100%', padding: 48, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <FiCheckCircle size={36} style={{ color: '#047857' }} />
        </div>
        <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: C.textMain }}>Agendamento confirmado!</h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>Seu agendamento foi registrado com sucesso. O salão entrará em contato para confirmar.</p>
        <div style={{ background: C.bg, borderRadius: RAIO_MD, padding: '16px 20px', textAlign: 'left', marginBottom: 28 }}>
          {[
            { label: 'Serviço',      valor: servicoSel?.nome_servico },
            { label: 'Profissional', valor: profissionalSel?.nome },
            { label: 'Data',         valor: formatarData(dataSel) },
            { label: 'Horário',      valor: horaSel },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>{r.valor}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { setEtapa('landing'); setServicoSel(null); setProfissionalSel(null); setHoraSel(''); setClienteNome(''); setClienteTel(''); setClienteEmail(''); }} style={{ ...botaoPrimarioStyle }}>
          Fazer outro agendamento
        </button>
      </div>
    </div>
  );

  if (etapa === 'landing') return (
    <EtapaLanding
      salao={salao!}
      servicos={servicos}
      header={header}
      onIniciar={() => setEtapa('servico')}
      onServicoClick={s => { setServicoSel(s); setEtapa('profissional'); }}
    />
  );

  if (etapa === 'servico') return (
    <div style={wrapStyle}>
      {header}
      <div style={container}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 18px' }}>
          <button onClick={() => setEtapa('landing')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sidebarBg, padding: 0, display: 'flex' }}><FiChevronLeft size={22} /></button>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.textMain }}>Escolha o serviço</h2>
        </div>
        {categorias.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            {['', ...categorias].map(cat => (
              <button key={cat} onClick={() => setCategoriaSel(cat)}
                style={{ padding: '6px 16px', borderRadius: 20, border: `1px solid ${categoriaSel === cat ? C.sidebarBg : C.border}`, background: categoriaSel === cat ? C.sidebarBg : C.bgCard, color: categoriaSel === cat ? '#fff' : C.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {cat || 'Todos'}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {servicosFiltrados.map(s => (
            <div key={s.id} onClick={() => { setServicoSel(s); setEtapa('profissional'); }}
              style={{ ...cardStyle, padding: '16px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${servicoSel?.id === s.id ? C.sidebarBg : C.border}` }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: C.textMain }}>{s.nome_servico}</p>
                {s.descricao && <p style={{ margin: '0 0 4px', fontSize: 12, color: C.textMuted }}>{s.descricao}</p>}
                <p style={{ margin: 0, fontSize: 12, color: C.textLight, display: 'flex', alignItems: 'center', gap: 4 }}><FiClock size={11} /> {s.duracao_minutos} min</p>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.sidebarBg, marginLeft: 16 }}>{brl(s.preco_padrao)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (etapa === 'profissional') return (
    <div style={wrapStyle}>
      {header}
      <div style={container}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 18px' }}>
          <button onClick={() => setEtapa('servico')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sidebarBg, padding: 0, display: 'flex' }}><FiChevronLeft size={22} /></button>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.textMain }}>Escolha o profissional</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div onClick={() => { setProfissionalSel(profissionais[0] || null); setEtapa('dataHora'); }}
            style={{ ...cardStyle, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${C.sidebarBg}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FiUser size={20} style={{ color: C.sidebarBg }} />
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: C.textMain }}>Sem preferência</p>
              <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>O salão escolherá o profissional</p>
            </div>
          </div>
          {profissionais.map(p => (
            <div key={p.id} onClick={() => { setProfissionalSel(p); setEtapa('dataHora'); }}
              style={{ ...cardStyle, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${profissionalSel?.id === p.id ? C.sidebarBg : C.border}` }}>
              {p.foto_url
                ? <img src={p.foto_url} alt={p.nome} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${C.sidebarBg}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18, fontWeight: 700, color: C.sidebarBg }}>{p.nome.charAt(0).toUpperCase()}</div>
              }
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.textMain }}>{p.nome}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (etapa === 'dataHora') return (
    <div style={wrapStyle}>
      {header}
      <div style={container}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 18px' }}>
          <button onClick={() => setEtapa('profissional')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sidebarBg, padding: 0, display: 'flex' }}><FiChevronLeft size={22} /></button>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.textMain }}>Data e horário</h2>
        </div>
        <div style={{ marginBottom: 20 }}>
          <p style={{ ...labelStyle }}>Data</p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            {diasCalendario.map(d => {
              const dt = isoParaLocal(d);
              const ativo = dataSel === d;
              return (
                <button key={d} onClick={() => { setDataSel(d); setHoraSel(''); }}
                  style={{ flexShrink: 0, width: 56, padding: '10px 0', borderRadius: RAIO_MD, border: `1px solid ${ativo ? C.sidebarBg : C.border}`, background: ativo ? C.sidebarBg : C.bgCard, color: ativo ? '#fff' : C.textMain, cursor: 'pointer', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
                  <span style={{ display: 'block', fontSize: 10, opacity: 0.8 }}>{DIAS_SEMANA[dt.getDay()]}</span>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>{dt.getDate()}</span>
                  <span style={{ display: 'block', fontSize: 10, opacity: 0.8 }}>{MESES[dt.getMonth()].slice(0,3)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p style={{ ...labelStyle }}>Horário disponível</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {slotsDisponiveis.map(slot => (
              <button key={slot} onClick={() => setHoraSel(slot)}
                style={{ padding: '10px 0', borderRadius: RAIO_MD, border: `1px solid ${horaSel === slot ? C.sidebarBg : C.border}`, background: horaSel === slot ? C.sidebarBg : C.bgCard, color: horaSel === slot ? '#fff' : C.textMain, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {slot}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { if (dataSel && horaSel) setEtapa('dados'); }} disabled={!dataSel || !horaSel}
          style={{ ...botaoPrimarioStyle, marginTop: 24, opacity: (!dataSel || !horaSel) ? 0.5 : 1 }}>
          Continuar <FiChevronRight size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </button>
      </div>
    </div>
  );

  if (etapa === 'dados') return (
    <EtapaDados
      header={header}
      servicoSel={servicoSel!}
      profissionalSel={profissionalSel!}
      dataSel={dataSel}
      horaSel={horaSel}
      clienteNome={clienteNome} setClienteNome={setClienteNome}
      clienteTel={clienteTel} setClienteTel={setClienteTel}
      clienteEmail={clienteEmail} setClienteEmail={setClienteEmail}
      enviando={enviando}
      erroEnvio={erroEnvio}
      onBack={() => setEtapa('dataHora')}
      onConfirmar={confirmarAgendamento}
    />
  );

  return null;
}
