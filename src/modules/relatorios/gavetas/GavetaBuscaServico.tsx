'use client'
import { C } from '@/lib/constants';
import { InputData } from '@/components/InputData';
import { RAIO_MD, RAIO_XL, RAIO_SM } from '@/lib/estiloGlobal';
import { FiUser, FiSearch, FiCalendar, FiClock, FiX, FiLoader } from 'react-icons/fi';
import { useBuscaServico, fmt, corDias } from './useBuscaServico';

export function GavetaBuscaServico({ perfil, dados }: any) {
  const b = useBuscaServico(perfil, dados);

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
          <div style={{ flex: 2, minWidth: 220, position: 'relative' }} ref={b.refBuscaServico}>
            <label style={labelStyle}>Serviço</label>
            {b.dropdownCarregando ? (
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
                    value={b.buscaServico}
                    onChange={e => {
                      b.setBuscaServico(e.target.value);
                      b.setServicoId('');
                      b.setDropdownServicoAberto(true);
                    }}
                    onFocus={() => b.setDropdownServicoAberto(true)}
                    style={{ ...inputStyle, width: '100%', paddingLeft: 32, paddingRight: b.servicoId ? 32 : 12 }}
                  />
                  {(b.buscaServico || b.servicoId) && (
                    <button
                      onClick={() => { b.setServicoId(''); b.setBuscaServico(''); b.setDropdownServicoAberto(false); }}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex' }}
                    >
                      <FiX size={13} />
                    </button>
                  )}
                </div>
                {b.dropdownServicoAberto && b.servicosFiltrados.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: C.bgCard, border: `1px solid ${C.borderMid}`,
                    borderRadius: RAIO_MD, marginTop: 4,
                    maxHeight: 240, overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  }}>
                    {b.servicosFiltrados.map((s: any) => (
                      <button
                        key={s.id}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          b.setServicoId(s.id);
                          b.setBuscaServico(s.nome_servico + (s.categoria ? ` (${s.categoria})` : ''));
                          b.setDropdownServicoAberto(false);
                        }}
                        style={{
                          width: '100%', textAlign: 'left', padding: '9px 14px',
                          border: 'none', borderBottom: `1px solid ${C.border}`,
                          background: s.id === b.servicoId ? `${C.sidebarBg}18` : 'transparent',
                          color: C.textMain, fontSize: 13, cursor: 'pointer', display: 'block',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{s.nome_servico}</span>
                        {s.categoria && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>{s.categoria}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {b.dropdownServicoAberto && b.servicosFiltrados.length === 0 && b.buscaServico.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: C.bgCard, border: `1px solid ${C.borderMid}`,
                    borderRadius: RAIO_MD, marginTop: 4, padding: '12px 14px',
                    fontSize: 12, color: C.textMuted,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  }}>
                    Nenhum serviço encontrado para &quot;{b.buscaServico}&quot;.
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label style={labelStyle}><FiCalendar size={11} style={{ display: 'inline', marginRight: 4 }} />De</label>
            <InputData value={b.dataInicio} onChange={b.setDataInicio} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Até</label>
            <InputData value={b.dataFim} onChange={b.setDataFim} style={inputStyle} />
          </div>
          <button
            onClick={b.buscar}
            disabled={!b.servicoId || b.buscando}
            style={{
              padding: '10px 22px', borderRadius: RAIO_MD, border: 'none',
              background: !b.servicoId || b.buscando ? C.borderMid : C.sidebarBg,
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: !b.servicoId || b.buscando ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            }}
          >
            {b.buscando
              ? <><FiLoader size={14} /> Buscando...</>
              : <><FiSearch size={14} /> Buscar</>
            }
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.textLight, fontWeight: 600 }}>Atalhos de período:</span>
          {b.presets.map(p => (
            <button key={p.label} onClick={p.fn} style={btnPreset}>{p.label}</button>
          ))}
        </div>

        {!b.carregandoServs && b.servicosQuery.length === 0 && b.servicosDosAgs.length > 0 && (
          <p style={{ margin: '10px 0 0', fontSize: 11, color: C.textMuted }}>
            Exibindo serviços do período carregado ({b.servicosDosAgs.length} encontrados). Para ver todos os serviços do salão, recarregue a página.
          </p>
        )}
      </div>

      {b.buscando && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}>
          <FiLoader size={32} color={C.borderMid} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13, margin: 0 }}>Buscando clientes...</p>
        </div>
      )}

      {!b.buscando && !b.executado && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}>
          <FiSearch size={36} color={C.borderMid} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13, margin: 0 }}>
            Selecione um serviço e clique em <strong>Buscar</strong> para ver os clientes.
          </p>
        </div>
      )}

      {!b.buscando && b.executado && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${C.borderMid}`, background: C.bg, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 300 }}>
              <FiSearch size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.textLight, pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Filtrar por nome..."
                value={b.buscaNome}
                onChange={e => b.setBuscaNome(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 32, width: '100%' }}
              />
              {b.buscaNome && (
                <button onClick={() => b.setBuscaNome('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex' }}>
                  <FiX size={13} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.textLight, fontWeight: 600, marginRight: 2 }}>Ordenar:</span>
              <button style={btnOrdem(b.ordenarPor === 'diasSemVir')}   onClick={() => b.setOrdenarPor('diasSemVir')}>Mais tempo sem vir</button>
              <button style={btnOrdem(b.ordenarPor === 'visitas')}      onClick={() => b.setOrdenarPor('visitas')}>Mais visitas</button>
              <button style={btnOrdem(b.ordenarPor === 'ultimaVisita')} onClick={() => b.setOrdenarPor('ultimaVisita')}>Última visita</button>
            </div>

            <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted, fontWeight: 600, flexShrink: 0 }}>
              {b.listaExibida.length} cliente{b.listaExibida.length !== 1 ? 's' : ''}
            </span>
          </div>

          {b.listaExibida.length === 0 && (
            <p style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13, margin: 0 }}>
              Nenhum cliente realizou este serviço no período selecionado.
            </p>
          )}

          {b.listaExibida.length > 0 && (
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
                  {b.listaExibida.map((c, i) => {
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
