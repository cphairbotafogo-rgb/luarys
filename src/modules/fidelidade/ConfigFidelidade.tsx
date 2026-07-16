'use client'
/**
 * src/modules/fidelidade/ConfigFidelidade.tsx
 *
 * Tela do dono: ativar o programa, definir a taxa de conversão (R$ → pontos)
 * e cadastrar o catálogo de prêmios resgatáveis. Pensada para viver dentro
 * de Configurações, junto das outras regras do salão.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { FiGift, FiPlus, FiToggleLeft, FiToggleRight, FiZap, FiDollarSign, FiSlash, FiSearch, FiX } from 'react-icons/fi';
import { RAIO_MD, RAIO_SM, RAIO_LG, RAIO_XL, inputAdmin, labelPadrao, cardAdmin } from '@/lib/estiloGlobal';
import {
  type ConfigFidelidade, type PremioFidelidade,
  carregarConfig, salvarConfig, carregarPremios, criarPremio, alternarPremioAtivo,
  brl,
} from './tipos';

export function ConfigFidelidade({ perfil }: any) {
  const [config, setConfig] = useState<ConfigFidelidade>({ salao_id: perfil?.salao_id, ativo: false, pontos_por_real: 1, permite_desconto_valor: false, valor_por_ponto: 0.01 });
  const [premios, setPremios] = useState<PremioFidelidade[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [bloqueados, setBloqueados] = useState<string[]>([]);
  const [buscaServico, setBuscaServico] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [formAberto, setFormAberto] = useState(false);
  const [novoPremio, setNovoPremio] = useState({ nome: '', servico_id: '', custo_pontos: 500, valor_real: 0 });

  useEffect(() => {
    if (perfil?.salao_id) carregarTudo();
  }, [perfil?.salao_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function carregarTudo() {
    setCarregando(true);
    const [cfg, prem, { data: servs }, { data: bloqs }] = await Promise.all([
      carregarConfig(perfil.salao_id),
      carregarPremios(perfil.salao_id),
      supabase.from('servicos').select('id, nome_servico, preco_padrao').eq('salao_id', perfil.salao_id).order('nome_servico'),
      supabase.from('fidelidade_servicos_bloqueados').select('servico_id').eq('salao_id', perfil.salao_id),
    ]);
    if (cfg) setConfig(cfg);
    setPremios(prem);
    setServicos(servs || []);
    setBloqueados((bloqs || []).map(b => b.servico_id));
    setCarregando(false);
  }

  async function toggleBloqueado(servicoId: string) {
    const estaBloqueado = bloqueados.includes(servicoId);
    if (estaBloqueado) {
      setBloqueados(prev => prev.filter(id => id !== servicoId));
      await supabase.from('fidelidade_servicos_bloqueados')
        .delete().eq('salao_id', perfil.salao_id).eq('servico_id', servicoId);
    } else {
      setBloqueados(prev => [...prev, servicoId]);
      await supabase.from('fidelidade_servicos_bloqueados')
        .insert({ salao_id: perfil.salao_id, servico_id: servicoId });
    }
  }

  async function alternarAtivo() {
    const novo = { ...config, ativo: !config.ativo };
    setConfig(novo);
    await salvarConfig(perfil.salao_id, { ativo: novo.ativo });
  }

  async function salvarTaxa(valor: number) {
    const novo = { ...config, pontos_por_real: valor };
    setConfig(novo);
    await salvarConfig(perfil.salao_id, { pontos_por_real: valor });
  }

  async function alternarDescontoValor() {
    const novo = { ...config, permite_desconto_valor: !config.permite_desconto_valor };
    setConfig(novo);
    await salvarConfig(perfil.salao_id, { permite_desconto_valor: novo.permite_desconto_valor });
  }

  async function salvarValorPorPonto(valor: number) {
    const v = Math.max(0.01, valor || 0.01);
    const novo = { ...config, valor_por_ponto: v };
    setConfig(novo);
    await salvarConfig(perfil.salao_id, { valor_por_ponto: v });
  }

  function selecionarServicoNoPremio(servicoId: string) {
    const serv = servicos.find(s => s.id === servicoId);
    setNovoPremio({ ...novoPremio, servico_id: servicoId, valor_real: serv?.preco_padrao || 0, nome: novoPremio.nome || serv?.nome_servico || '' });
  }

  async function salvarNovoPremio() {
    if (!novoPremio.nome || novoPremio.custo_pontos <= 0) return;
    await criarPremio(perfil.salao_id, novoPremio as any);
    setNovoPremio({ nome: '', servico_id: '', custo_pontos: 500, valor_real: 0 });
    setFormAberto(false);
    carregarTudo();
  }

  async function alternarPremio(p: PremioFidelidade) {
    setPremios(prev => prev.map(x => x.id === p.id ? { ...x, ativo: !x.ativo } : x));
    await alternarPremioAtivo(p.id, !p.ativo);
  }


  if (carregando) return <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Carregando...</div>;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FiGift size={18} color={C.douradoEleva} />
          <span style={{ fontSize: 14, fontWeight: 800, color: C.textMain }}>Luarys Fidelidade</span>
        </div>
        <button onClick={alternarAtivo} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: config.ativo ? C.success : C.textLight }}>
          {config.ativo ? <FiToggleRight size={26} /> : <FiToggleLeft size={26} />}
          {config.ativo ? 'Ativo' : 'Inativo'}
        </button>
      </div>

      {!config.ativo && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: RAIO_MD, padding: '10px 14px', fontSize: 12, color: '#92400E', marginBottom: 20 }}>
          O programa está desativado — clientes não acumulam pontos enquanto isso. Ative quando o catálogo de prêmios estiver pronto.
        </div>
      )}

      {/* Resgate como desconto em reais */}
      <div style={{ ...cardAdmin, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiDollarSign size={14} color={C.douradoEleva} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMain }}>Resgate como desconto em reais</div>
              <p style={{ fontSize: 11, color: C.textLight, margin: '2px 0 0' }}>
                O cliente usa pontos como desconto no valor do atendimento.
              </p>
            </div>
          </div>
          <button onClick={alternarDescontoValor} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: config.permite_desconto_valor ? C.success : C.textLight, flexShrink: 0 }}>
            {config.permite_desconto_valor ? <FiToggleRight size={26} /> : <FiToggleLeft size={26} />}
            {config.permite_desconto_valor ? 'Ativo' : 'Inativo'}
          </button>
        </div>
        {config.permite_desconto_valor && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>Cada ponto vale</span>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 700 }}>R$</span>
            <input
              type="number" min={0.01} step={0.01} value={config.valor_por_ponto}
              onChange={e => salvarValorPorPonto(parseFloat(e.target.value))}
              style={{ ...inputAdmin, width: 100 }}
            />
            <span style={{ fontSize: 11, color: C.textLight }}>
              — Ex: 100 pts = {brl(100 * config.valor_por_ponto)}
            </span>
          </div>
        )}
      </div>

      {/* Serviços sem desconto de fidelidade */}
      {config.permite_desconto_valor && (
        <div style={{ ...cardAdmin, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <FiSlash size={14} color={C.danger} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.textMain }}>Serviços sem desconto de pontos</span>
          </div>
          <p style={{ fontSize: 11, color: C.textLight, margin: '0 0 12px' }}>
            Serviços listados abaixo <strong>não</strong> aceitam abatimento por pontos. Clique sobre um para liberar.
          </p>

          {/* Chips dos serviços bloqueados */}
          {bloqueados.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {servicos.filter(s => bloqueados.includes(s.id)).map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleBloqueado(s.id)}
                  title="Clique para liberar o desconto neste serviço"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  <FiSlash size={10} /> {s.nome_servico} <FiX size={10} />
                </button>
              ))}
            </div>
          )}

          {/* Busca para adicionar serviços */}
          <div style={{ position: 'relative' }}>
            <FiSearch size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.textLight, pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Buscar serviço para bloquear..."
              value={buscaServico}
              onChange={e => setBuscaServico(e.target.value)}
              onBlur={() => setTimeout(() => setBuscaServico(''), 150)}
              style={{ ...inputAdmin, paddingLeft: 32 }}
            />
            {buscaServico.trim() && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginTop: 4, overflow: 'hidden' }}>
                {servicos
                  .filter(s => !bloqueados.includes(s.id) && s.nome_servico.toLowerCase().includes(buscaServico.toLowerCase().trim()))
                  .slice(0, 8)
                  .map(s => (
                    <button
                      key={s.id}
                      onMouseDown={() => { toggleBloqueado(s.id); setBuscaServico(''); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.textMain, cursor: 'pointer' }}
                      className="hover:bg-slate-50"
                    >
                      {s.nome_servico}
                    </button>
                  ))}
                {servicos.filter(s => !bloqueados.includes(s.id) && s.nome_servico.toLowerCase().includes(buscaServico.toLowerCase().trim())).length === 0 && (
                  <p style={{ padding: '9px 14px', fontSize: 12, color: C.textLight, fontStyle: 'italic', margin: 0 }}>Nenhum serviço encontrado.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Catálogo de prêmios */}
      <div style={{ ...cardAdmin, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textMain }}>Catálogo de prêmios</span>
          <button onClick={() => setFormAberto(!formAberto)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: RAIO_SM, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            <FiPlus size={12} /> Novo prêmio
          </button>
        </div>

        {formAberto && (
          <div style={{ background: C.bg, borderRadius: RAIO_LG, padding: 14, marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Vincular a um serviço (opcional)</label>
              <select style={inputAdmin} value={novoPremio.servico_id} onChange={e => selecionarServicoNoPremio(e.target.value)}>
                <option value="">Nenhum — prêmio livre</option>
                {servicos.map(s => <option key={s.id} value={s.id}>{s.nome_servico}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Nome do prêmio</label>
              <input type="text" style={inputAdmin} value={novoPremio.nome} onChange={e => setNovoPremio({ ...novoPremio, nome: e.target.value })} placeholder="ex: Hidratação Premium" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Custo em pontos</label>
              <input type="number" min={1} style={inputAdmin} value={novoPremio.custo_pontos} onChange={e => setNovoPremio({ ...novoPremio, custo_pontos: Number(e.target.value) })} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Valor de referência (R$)</label>
              <input type="number" min={0} step={0.01} style={inputAdmin} value={novoPremio.valor_real} onChange={e => setNovoPremio({ ...novoPremio, valor_real: Number(e.target.value) })} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setFormAberto(false)} style={{ padding: '7px 14px', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarNovoPremio} style={{ padding: '7px 14px', borderRadius: RAIO_SM, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Salvar prêmio</button>
            </div>
          </div>
        )}

        {premios.length === 0 ? (
          <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', textAlign: 'center', padding: 20 }}>Nenhum prêmio cadastrado ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {premios.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: RAIO_MD, opacity: p.ativo ? 1 : 0.5 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{p.nome}</span>
                  <span style={{ marginLeft: 10, fontSize: 11, color: C.textLight }}>Valor de referência: {brl(p.valor_real)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: C.douradoEleva }}>
                    <FiZap size={12} /> {p.custo_pontos} pts
                  </span>
                  <button onClick={() => alternarPremio(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.ativo ? C.success : C.textLight }}>
                    {p.ativo ? <FiToggleRight size={20} /> : <FiToggleLeft size={20} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
