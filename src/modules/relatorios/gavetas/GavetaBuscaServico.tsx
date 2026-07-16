'use client'
import { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { InputData } from '@/components/InputData';
import { RAIO_MD, RAIO_XL, RAIO_SM } from '@/lib/estiloGlobal';
import { FiUser, FiSearch, FiCalendar, FiClock, FiX, FiLoader } from 'react-icons/fi';

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  const [a, m, dd] = d.split('T')[0].split('-');
  return `${dd}/${m}/${a}`;
}

function corDias(dias: number) {
  if (dias > 90) return { cor: '#EF4444', bg: '#FEE2E2' };
  if (dias > 45) return { cor: '#D97706', bg: '#FEF3C7' };
  return { cor: '#10B981', bg: '#D1FAE5' };
}

function hoje() { return new Date().toISOString().split('T')[0]; }
function dataHaPeriodo(anos = 2) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anos);
  return d.toISOString().split('T')[0];
}

export function GavetaBuscaServico({ perfil, dados }: any) {
  const [dataInicio, setDataInicio] = useState(dataHaPeriodo(2));
  const [dataFim, setDataFim]       = useState(hoje());
  const [servicoId, setServicoId]       = useState('');
  const [buscaServico, setBuscaServico] = useState('');
  const [dropdownServicoAberto, setDropdownServicoAberto] = useState(false);
  const refBuscaServico = useRef<HTMLDivElement>(null);
  const [buscaNome, setBuscaNome]   = useState('');
  const [resultado, setResultado]   = useState<any[]>([]);
  const [buscando, setBuscando]     = useState(false);
  const [executado, setExecutado]   = useState(false);
  const [ordenarPor, setOrdenarPor] = useState<'diasSemVir' | 'visitas' | 'ultimaVisita'>('diasSemVir');

  // Fonte 1: agendamentos têm join servicos embutido → popula instantaneamente
  const servicosDosAgs = useMemo(() => {
    const mapa: Record<string, any> = {};
    (dados?.agendamentos || []).forEach((ag: any) => {
      if (!ag.servico_id) return;
      const s = ag.servicos as any;
      if (!s?.nome_servico) return;
      if (!mapa[ag.servico_id]) {
        mapa[ag.servico_id] = { id: ag.servico_id, nome_servico: s.nome_servico, categoria: s.categoria || '' };
      }
    });
    return Object.values(mapa);
  }, [dados?.agendamentos]);

  const [servicosQuery, setServicosQuery] = useState<any[]>([]);
  const [carregandoServs, setCarregandoServs] = useState(false);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    setCarregandoServs(true);
    supabase
      .from('servicos')
      .select('id, nome_servico, categoria')
      .eq('salao_id', perfil.salao_id)
      .order('nome_servico')
      .limit(500)
      .then(({ data, error }) => {
        if (error) console.error('[GavetaBuscaServico] query servicos:', error.message);
        setServicosQuery(data || []);
        setCarregandoServs(false);
      });
  }, [perfil?.salao_id]);

  const servicos = useMemo(() => {
    if (servicosQuery.length > 0) return servicosQuery;
    return [...servicosDosAgs].sort((a: any, b: any) =>
      (a.nome_servico || '').localeCompare(b.nome_servico || '', 'pt-BR')
    );
  }, [servicosQuery, servicosDosAgs]);

  const servicosFiltrados = useMemo(() => {
    if (!buscaServico.trim()) return servicos;
    const term = buscaServico.toLowerCase();
    return servicos.filter((s: any) =>
      (s.nome_servico || '').toLowerCase().includes(term) ||
      (s.categoria || '').toLowerCase().includes(term)
    );
  }, [servicos, buscaServico]);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (refBuscaServico.current && !refBuscaServico.current.contains(e.target as Node)) {
        setDropdownServicoAberto(false);
      }
    }
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  const presets = [
    { label: 'Este mês',   fn: () => { const d = new Date(); setDataInicio(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]); setDataFim(hoje()); } },
    { label: 'Este ano',   fn: () => { setDataInicio(`${new Date().getFullYear()}-01-01`); setDataFim(hoje()); } },
    { label: 'Último ano', fn: () => { setDataInicio(dataHaPeriodo(1)); setDataFim(hoje()); } },
    { label: '2 anos',     fn: () => { setDataInicio(dataHaPeriodo(2)); setDataFim(hoje()); } },
    { label: 'Tudo',       fn: () => { setDataInicio('2018-01-01'); setDataFim(hoje()); } },
  ];

  async function buscar() {
    if (!servicoId || !perfil?.salao_id) return;
    setBuscando(true);
    setResultado([]);
    setExecutado(false);

    const { data, error } = await supabase
      .from('agendamentos')
      .select('cliente_id, cliente_nome, data')
      .eq('salao_id', perfil.salao_id)
      .eq('servico_id', servicoId)
      .eq('status', 'Finalizado')
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: false })
      .limit(5000);

    if (error) {
      console.error('[GavetaBuscaServico] buscar:', error.message);
      setBuscando(false);
      return;
    }

    const hojeStr = new Date().toISOString().split('T')[0];
    const mapa: Record<string, any> = {};

    (data || []).forEach((ag: any) => {
      const nome = ag.cliente_nome || '—';
      const id   = ag.cliente_id   || nome;
      const d    = (ag.data || '').split('T')[0];
      if (!mapa[id]) {
        mapa[id] = { nome, ultimaVisita: d, primeiraVisita: d, visitas: 0 };
      }
      mapa[id].visitas++;
      if (d > mapa[id].ultimaVisita)   mapa[id].ultimaVisita   = d;
      if (d < mapa[id].primeiraVisita) mapa[id].primeiraVisita = d;
    });

    const lista = Object.values(mapa).map((c: any) => ({
      ...c,
      diasSemVir: Math.floor(
        (new Date(hojeStr).getTime() - new Date(c.ultimaVisita).getTime()) / 86_400_000
      ),
    }));

    setResultado(lista);
    setBuscando(false);
    setExecutado(true);
  }

  const listaExibida = useMemo(() => {
    const filtrada = buscaNome
      ? resultado.filter(c => c.nome.toLowerCase().includes(buscaNome.toLowerCase()))
      : resultado;

    return [...filtrada].sort((a, b) => {
      if (ordenarPor === 'diasSemVir')    return b.diasSemVir - a.diasSemVir;
      if (ordenarPor === 'visitas')       return b.visitas    - a.visitas;
      return b.ultimaVisita.localeCompare(a.ultimaVisita);
    });
  }, [resultado, buscaNome, ordenarPor]);

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', borderRadius: RAIO_MD,
    border: `1px solid ${C.borderMid}`, fontSize: 13,
    color: C.textMain, background: C.bgCard, fontWeight: 500,
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 700,
    color: C.textLight, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.5px',
  };
  const thStyle: React.CSSProperties = {
    padding: '11px 16px', fontSize: 10, fontWeight: 700, color: C.textLight,
    textTransform: 'uppercase', background: C.bg, borderBottom: `1px solid ${C.borderMid}`,
    textAlign: 'left', whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '12px 16px', fontSize: 13, borderBottom: `1px solid ${C.border}`,
  };
  const btnPreset: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${C.borderMid}`,
    color: C.textMain, borderRadius: 20, padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  };
  const btnOrdem = (ativo: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
    border: `1px solid ${ativo ? C.sidebarBg : C.borderMid}`,
    background: ativo ? C.sidebarBg : 'transparent',
    color: ativo ? '#fff' : C.textMain, cursor: 'pointer',
  });

  const dropdownCarregando = carregandoServs && servicos.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 24, flexShrink: 0 }}>
        <div style={{ background: C.sidebarBg, padding: 12, borderRadius: RAIO_XL, color: '#fff', flexShrink: 0 }}>
          <FiUser size={24} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Clientes por Serviço Realizado
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>
            Encontre clientes que realizaram um serviço e veja há quantos dias não retornam.
          </p>
        </div>
      </div>

      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '20px 24px', marginBottom: 24, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 220, position: 'relative' }} ref={refBuscaServico}>
            <label style={labelStyle}>Serviço</label>
            {dropdownCarregando ? (
              <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, color: C.textMuted }}>
                <FiLoader size={13} /> Carregando serviços...
              </div>
            ) : (
              <>
                <div style={{ position: 'relative' }}>
                  <FiSearch size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.textLight, pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Digite para buscar um serviço..."
                    value={buscaServico}
                    onChange={e => {
                      setBuscaServico(e.target.value);
                      setServicoId('');
                      setDropdownServicoAberto(true);
                    }}
                    onFocus={() => setDropdownServicoAberto(true)}
                    style={{ ...inputStyle, width: '100%', paddingLeft: 32, paddingRight: servicoId ? 32 : 12 }}
                  />
                  {(buscaServico || servicoId) && (
                    <button
                      onClick={() => { setServicoId(''); setBuscaServico(''); setDropdownServicoAberto(false); }}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex' }}
                    >
                      <FiX size={13} />
                    </button>
                  )}
                </div>
                {dropdownServicoAberto && servicosFiltrados.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: C.bgCard, border: `1px solid ${C.borderMid}`,
                    borderRadius: RAIO_MD, marginTop: 4,
                    maxHeight: 240, overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  }}>
                    {servicosFiltrados.map((s: any) => (
                      <button
                        key={s.id}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setServicoId(s.id);
                          setBuscaServico(s.nome_servico + (s.categoria ? ` (${s.categoria})` : ''));
                          setDropdownServicoAberto(false);
                        }}
                        style={{
                          width: '100%', textAlign: 'left', padding: '9px 14px',
                          border: 'none', borderBottom: `1px solid ${C.border}`,
                          background: s.id === servicoId ? `${C.sidebarBg}18` : 'transparent',
                          color: C.textMain, fontSize: 13, cursor: 'pointer', display: 'block',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{s.nome_servico}</span>
                        {s.categoria && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>{s.categoria}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {dropdownServicoAberto && servicosFiltrados.length === 0 && buscaServico.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: C.bgCard, border: `1px solid ${C.borderMid}`,
                    borderRadius: RAIO_MD, marginTop: 4, padding: '12px 14px',
                    fontSize: 12, color: C.textMuted,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  }}>
                    Nenhum serviço encontrado para "{buscaServico}".
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label style={labelStyle}><FiCalendar size={11} style={{ display: 'inline', marginRight: 4 }} />De</label>
            <InputData value={dataInicio} onChange={setDataInicio} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Até</label>
            <InputData value={dataFim} onChange={setDataFim} style={inputStyle} />
          </div>
          <button
            onClick={buscar}
            disabled={!servicoId || buscando}
            style={{
              padding: '10px 22px', borderRadius: RAIO_MD, border: 'none',
              background: !servicoId || buscando ? C.borderMid : C.sidebarBg,
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: !servicoId || buscando ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            }}
          >
            {buscando
              ? <><FiLoader size={14} /> Buscando...</>
              : <><FiSearch size={14} /> Buscar</>
            }
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.textLight, fontWeight: 600 }}>Atalhos de período:</span>
          {presets.map(p => (
            <button key={p.label} onClick={p.fn} style={btnPreset}>{p.label}</button>
          ))}
        </div>

        {!carregandoServs && servicosQuery.length === 0 && servicosDosAgs.length > 0 && (
          <p style={{ margin: '10px 0 0', fontSize: 11, color: C.textMuted }}>
            Exibindo serviços do período carregado ({servicosDosAgs.length} encontrados). Para ver todos os serviços do salão, recarregue a página.
          </p>
        )}
      </div>

      {buscando && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}>
          <FiLoader size={32} color={C.borderMid} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13, margin: 0 }}>Buscando clientes...</p>
        </div>
      )}

      {!buscando && !executado && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}>
          <FiSearch size={36} color={C.borderMid} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13, margin: 0 }}>
            Selecione um serviço e clique em <strong>Buscar</strong> para ver os clientes.
          </p>
        </div>
      )}

      {!buscando && executado && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${C.borderMid}`, background: C.bg, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 300 }}>
              <FiSearch size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.textLight, pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Filtrar por nome..."
                value={buscaNome}
                onChange={e => setBuscaNome(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 32, width: '100%' }}
              />
              {buscaNome && (
                <button onClick={() => setBuscaNome('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex' }}>
                  <FiX size={13} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.textLight, fontWeight: 600, marginRight: 2 }}>Ordenar:</span>
              <button style={btnOrdem(ordenarPor === 'diasSemVir')}   onClick={() => setOrdenarPor('diasSemVir')}>Mais tempo sem vir</button>
              <button style={btnOrdem(ordenarPor === 'visitas')}      onClick={() => setOrdenarPor('visitas')}>Mais visitas</button>
              <button style={btnOrdem(ordenarPor === 'ultimaVisita')} onClick={() => setOrdenarPor('ultimaVisita')}>Última visita</button>
            </div>

            <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted, fontWeight: 600, flexShrink: 0 }}>
              {listaExibida.length} cliente{listaExibida.length !== 1 ? 's' : ''}
            </span>
          </div>

          {listaExibida.length === 0 && (
            <p style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13, margin: 0 }}>
              Nenhum cliente realizou este serviço no período selecionado.
            </p>
          )}

          {listaExibida.length > 0 && (
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 48, textAlign: 'center' }}>#</th>
                    <th style={thStyle}>Cliente</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Primeira Visita</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Última Visita</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Vezes no período</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>
                      <FiClock size={11} style={{ display: 'inline', marginRight: 4 }} />Dias sem vir
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {listaExibida.map((c, i) => {
                    const { cor, bg } = corDias(c.diasSemVir);
                    return (
                      <tr key={c.nome + i} style={{ background: i % 2 === 0 ? 'transparent' : `${C.bg}99` }}>
                        <td style={{ ...tdStyle, textAlign: 'center', color: C.textLight, fontWeight: 700, fontSize: 12 }}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: C.textMain }}>{c.nome}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: C.textMuted, fontSize: 12 }}>{fmt(c.primeiraVisita)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: C.textMuted, fontSize: 12 }}>{fmt(c.ultimaVisita)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: C.textMain }}>{c.visitas}×</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, color: cor, padding: '4px 12px', borderRadius: RAIO_SM, fontSize: 12, fontWeight: 700 }}>
                            <FiClock size={11} /> {c.diasSemVir} dias
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
