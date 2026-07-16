'use client'
import { C } from '@/lib/constants';
import { FiSearch, FiRefreshCw } from 'react-icons/fi';
import { RAIO_SM, RAIO_MD, RAIO_LG, cardAdmin, inputAdmin, labelPadrao } from '@/lib/estiloGlobal';
import { brl } from '../tipos';
import { Tooltip } from '../componentes';

export function PainelServico({ calc }: any) {
  const {
    config, form, setForm,
    modoServico, modoParceiro, setModoParceiro, ativarModoServico,
    servicos, buscaServico, setBuscaServico, dropdownAberto, setDropdownAberto,
    setServicoId, setServicoSelecionado,
    servicoSelecionado, carregarServicos, selecionarServico, carregandoServicos,
    setores, resultado,
  } = calc;

  return (
    <div style={{ ...cardAdmin, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>Serviço a calcular</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: C.bg, borderRadius: RAIO_MD, padding: 3 }}>
            {([['Manual', false], ['Buscar do sistema', true]] as const).map(([label, val]) => (
              <button key={String(val)} onClick={() => ativarModoServico(val)}
                style={{ padding: '6px 14px', borderRadius: RAIO_SM, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: modoServico === val ? C.bgCard : 'transparent', color: modoServico === val ? C.sidebarBg : C.textMuted,
                  boxShadow: modoServico === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', background: C.bg, borderRadius: RAIO_MD, padding: 3 }}>
            {([['Comissionado', false], ['Parceiro (Lei 13.352)', true]] as const).map(([label, val]) => (
              <button key={String(val)} onClick={() => setModoParceiro(val)}
                style={{ padding: '6px 14px', borderRadius: RAIO_SM, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: modoParceiro === val ? (val ? '#7C3AED' : C.sidebarBg) : 'transparent',
                  color: modoParceiro === val ? '#fff' : C.textMuted,
                  boxShadow: modoParceiro === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {modoParceiro && (
        <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: RAIO_LG, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#5B21B6' }}>
          <strong>Lei do Salão Parceiro (13.352/2016):</strong> o profissional é MEI/PJ. O salão paga imposto <strong>apenas sobre sua própria cota-parte</strong> — economia tributária real.
        </div>
      )}

      {modoServico && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <label style={labelPadrao}>Buscar serviço ({servicos.length} cadastrados)</label>
            {!carregandoServicos && servicos.length === 0 && (
              <button onClick={carregarServicos} style={{ fontSize: 11, color: C.sidebarBg, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <FiRefreshCw size={11} /> Tentar novamente
              </button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <FiSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textLight, pointerEvents: 'none', zIndex: 1 }} />
            <input type="text"
              placeholder={carregandoServicos ? 'Carregando...' : servicos.length === 0 ? 'Nenhum serviço cadastrado' : 'Digite o nome do serviço...'}
              disabled={carregandoServicos || servicos.length === 0}
              value={buscaServico}
              onChange={e => { setBuscaServico(e.target.value); setDropdownAberto(true); setServicoId(''); setServicoSelecionado(null); }}
              onFocus={() => setDropdownAberto(true)}
              onBlur={() => setTimeout(() => setDropdownAberto(false), 150)}
              style={{ ...inputAdmin, paddingLeft: 36 }}
            />
            {dropdownAberto && !carregandoServicos && (() => {
              const termo = buscaServico.toLowerCase().trim();
              const filtrados = servicos.filter((s: any) => !termo || s.nome_servico?.toLowerCase().includes(termo) || s.categoria?.toLowerCase().includes(termo));
              if (filtrados.length === 0) return (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: '0 0 8px 8px', padding: '12px 16px', fontSize: 12, color: C.textLight }}>
                  Nenhum serviço encontrado
                </div>
              );
              const grupos: Record<string, any[]> = {};
              filtrados.forEach((s: any) => { const c = s.categoria || 'Geral'; if (!grupos[c]) grupos[c] = []; grupos[c].push(s); });
              return (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: '0 0 8px 8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto' }}>
                  {Object.entries(grupos).map(([cat, itens]) => (
                    <div key={cat}>
                      <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', background: C.bg, borderTop: `1px solid ${C.border}` }}>{cat}</div>
                      {itens.map((s: any) => (
                        <div key={s.id} onMouseDown={() => selecionarServico(s)}
                          style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F0F9FF')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <span style={{ color: C.textMain, fontWeight: 500 }}>{s.nome_servico}</span>
                          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.textLight }}>
                            <span>{s.duracao_minutos || 60} min</span>
                            <span style={{ fontWeight: 700, color: C.textMuted }}>{brl(s.preco_padrao || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          {servicoSelecionado && (
            <div style={{ marginTop: 10, background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span><span style={{ color: C.textMuted }}>Preço atual: </span><strong>{brl(servicoSelecionado.preco_padrao || 0)}</strong></span>
              <span><span style={{ color: C.textMuted }}>Duração: </span><strong>{servicoSelecionado.duracao_minutos || 60} min</strong></span>
              <span><span style={{ color: C.textMuted }}>Custo insumos: </span><strong>{brl(servicoSelecionado.custo || 0)}</strong></span>
              {servicoSelecionado.comissaoMedia !== null && servicoSelecionado.comissaoMedia !== undefined && (
                <span>
                  <span style={{ color: C.textMuted }}>Comissão real deste serviço: </span>
                  <strong>{Math.round(servicoSelecionado.comissaoMedia)}%</strong>
                  {servicoSelecionado.taxasDoServico?.length > 1 && (
                    <span style={{ color: C.textLight }}> (média de {servicoSelecionado.taxasDoServico.length} profissionais)</span>
                  )}
                </span>
              )}
            </div>
          )}
          {servicoSelecionado && servicoSelecionado.comissaoMedia === null && (
            <p style={{ marginTop: 6, fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>
              Nenhum profissional tem comissão configurada para este serviço — usando o valor manual abaixo.
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
        {config.modoHoras === 'categoria' && (
          <div>
            <label style={labelPadrao}>Setor do serviço<Tooltip texto="Define quais horas/mês entram no cálculo de custo fixo deste serviço. Mesma lista de funções cadastradas em Minha Equipe." /></label>
            <input type="text" list="setores-precificacao" style={inputAdmin} value={form.categoria || ''}
              onChange={e => setForm({ ...form, categoria: e.target.value })}
              placeholder="ex: Cabeleireiro" disabled={modoServico && !!servicoSelecionado} />
            <datalist id="setores-precificacao">
              {setores.map((s: any) => <option key={s.id} value={s.nome} />)}
            </datalist>
          </div>
        )}
        <div>
          <label style={labelPadrao}>Duração (min)<Tooltip texto="Tempo total: aplicação + tempo de ação do produto + lavagem + finalização." /></label>
          <input type="number" min={1} style={inputAdmin} value={form.duracaoMin} onChange={e => setForm({ ...form, duracaoMin: Number(e.target.value) })} />
        </div>
        <div>
          <label style={labelPadrao}>Custo de insumos (R$)<Tooltip texto="Custo dos produtos usados (pó, oxidante, shampoo, ampolas). Fracione por grama/ml." /></label>
          <input type="number" min={0} step={0.01} style={inputAdmin} value={form.custoInsumos} onChange={e => setForm({ ...form, custoInsumos: Number(e.target.value) })} />
        </div>
        {modoParceiro ? (
          <div>
            <label style={labelPadrao}>Cota-parte do parceiro (%)<Tooltip texto="% que vai para o MEI/PJ. O salão fica com o restante e paga imposto só sobre sua parte." /></label>
            <input type="number" min={1} max={99} style={inputAdmin} value={form.cotaParteParceiro} onChange={e => setForm({ ...form, cotaParteParceiro: Number(e.target.value) })} />
            {resultado && <div style={{ marginTop: 4, fontSize: 11, color: '#7C3AED' }}>Parceiro: {brl(resultado.comissaoValor)} · Salão: {brl(resultado.cotaParteSalaoValor || 0)}</div>}
          </div>
        ) : (
          <div>
            <label style={labelPadrao}>
              Comissão (%)
              <Tooltip texto={modoServico
                ? "Preenchido com a média real configurada para ESTE serviço. Você pode editar para simular outro cenário."
                : "% pago ao profissional. Acima de 45% sobre o bruto pode inviabilizar o serviço."} />
            </label>
            <input type="number" min={0} max={100} style={inputAdmin} value={form.percentComissao} onChange={e => setForm({ ...form, percentComissao: Number(e.target.value) })} />
            {modoServico && servicoSelecionado?.taxasDoServico?.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 10, color: C.textLight }}>
                {servicoSelecionado.taxasDoServico.map((p: any) => `${p.nome.split(' ')[0]}: ${p.taxa}%`).join(' · ')}
              </div>
            )}
          </div>
        )}
        <div>
          <label style={labelPadrao}>Margem de lucro (%)<Tooltip texto="Lucro limpo do salão depois de pagar tudo. Mínimo recomendado: 15%." /></label>
          <input type="number" min={0} max={80} style={inputAdmin} value={form.margemDesejada} onChange={e => setForm({ ...form, margemDesejada: Number(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}
