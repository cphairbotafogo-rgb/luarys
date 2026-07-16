'use client'
/**
 * src/modules/fidelidade/ExtratoCliente.tsx
 *
 * Saldo de pontos + histórico + ação de resgate, pensado para ser embutido
 * dentro de ModalFichaCliente.tsx (ou onde quer que o dono veja o perfil
 * completo de um cliente específico). Não é uma aba própria — fidelidade é
 * sobre UM cliente, então vive dentro da ficha dele, não numa tela separada.
 *
 * Uso:
 *   import { ExtratoCliente } from '@/modules/fidelidade/ExtratoCliente';
 *   <ExtratoCliente perfil={perfil} clienteId={cliente.id} />
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { FiZap, FiGift, FiClock, FiCheck, FiDollarSign } from 'react-icons/fi';
import { RAIO_MD, RAIO_SM, RAIO_XL, RAIO_LG, cardAdmin } from '@/lib/estiloGlobal';
import {
  type ConfigFidelidade, type PremioFidelidade, type TransacaoFidelidade,
  carregarConfig, carregarPremios, carregarSaldoCliente, carregarExtratoCliente,
  resgatarPremio, resgatarCreditoValor,
  brl, formatarPontos,
} from './tipos';

export function ExtratoCliente({ perfil, clienteId }: { perfil: any; clienteId: string }) {
  const [ativo, setAtivo] = useState(false);
  const [configFid, setConfigFid] = useState<ConfigFidelidade | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [premios, setPremios] = useState<PremioFidelidade[]>([]);
  const [extrato, setExtrato] = useState<TransacaoFidelidade[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [premioEscolhido, setPremioEscolhido] = useState<PremioFidelidade | null>(null);
  const [profissionalId, setProfissionalId] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [hora, setHora] = useState('10:00');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [pontosDesconto, setPontosDesconto] = useState('');
  const [resgatandoValor, setResgatandoValor] = useState(false);
  const [sucessoValor, setSucessoValor] = useState('');

  useEffect(() => {
    if (perfil?.salao_id && clienteId) carregarTudo();
  }, [perfil?.salao_id, clienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function carregarTudo() {
    setCarregando(true);
    const [config, prem, saldoAtual, ext, { data: profs }] = await Promise.all([
      carregarConfig(perfil.salao_id),
      carregarPremios(perfil.salao_id),
      carregarSaldoCliente(perfil.salao_id, clienteId),
      carregarExtratoCliente(perfil.salao_id, clienteId),
      supabase.from('profissionais').select('id, nome').eq('salao_id', perfil.salao_id).eq('ativo', true),
    ]);
    setAtivo(!!config?.ativo);
    setConfigFid(config);
    setPremios(prem.filter(p => p.ativo));
    setSaldo(saldoAtual);
    setExtrato(ext);
    setProfissionais(profs || []);
    setCarregando(false);
  }

  async function confirmarResgateValor() {
    const pts = parseInt(pontosDesconto, 10);
    if (!pts || pts <= 0) return;
    setResgatandoValor(true);
    setSucessoValor('');

    const { valorReais, erro: erroResgate } = await resgatarCreditoValor(perfil.salao_id, clienteId, pts);

    setResgatandoValor(false);
    if (erroResgate) {
      setErro(erroResgate);
    } else {
      setPontosDesconto('');
      setSucessoValor(`${brl(valorReais!)} de desconto registrado. Aplique no fechamento da conta.`);
      carregarTudo();
    }
  }

  function abrirResgate(p: PremioFidelidade) {
    setPremioEscolhido(p);
    setErro('');
    setSucesso('');
    setProfissionalId(profissionais[0]?.id || '');
  }

  async function confirmarResgate() {
    if (!premioEscolhido || !profissionalId) return;
    setResgatando(premioEscolhido.id);
    setErro('');

    const { erro: erroResgate } = await resgatarPremio({
      salaoId: perfil.salao_id,
      clienteId,
      premioId: premioEscolhido.id,
      profissionalId,
      data,
      inicio: hora,
    });

    if (erroResgate) {
      setErro(erroResgate);
    } else {
      setSucesso(`Prêmio resgatado! Agendamento criado para ${data} às ${hora}.`);
      setPremioEscolhido(null);
      carregarTudo();
    }
    setResgatando(null);
  }

  if (carregando) return <div style={{ padding: 20, textAlign: 'center', color: C.textMuted, fontSize: 12 }}>Carregando fidelidade...</div>;

  if (!ativo) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: C.textLight, fontSize: 12, fontStyle: 'italic' }}>
        Programa de fidelidade desativado. Ative em Configurações → Fidelidade.
      </div>
    );
  }

  return (
    <div style={{ ...cardAdmin, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.textMain, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FiZap size={14} color={C.douradoEleva} /> Fidelidade
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, color: C.douradoEleva }}>{formatarPontos(saldo)} pts</span>
      </div>

      {sucesso && (
        <div style={{ background: C.successBg, color: C.successText, borderRadius: RAIO_MD, padding: '8px 12px', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FiCheck size={12} /> {sucesso}
        </div>
      )}

      {/* Prêmios disponíveis */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', margin: '0 0 8px' }}>Prêmios disponíveis</p>
        {premios.length === 0 ? (
          <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic' }}>Nenhum prêmio cadastrado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {premios.map(p => {
              const podeResgatar = saldo >= p.custo_pontos;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: RAIO_MD, background: podeResgatar ? '#FFFBEB' : C.bg }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textMain, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FiGift size={12} color={podeResgatar ? C.douradoEleva : C.textLight} /> {p.nome}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>{p.custo_pontos} pts</span>
                    <button onClick={() => abrirResgate(p)} disabled={!podeResgatar}
                      style={{ padding: '4px 10px', borderRadius: RAIO_SM, border: 'none', fontSize: 11, fontWeight: 700, cursor: podeResgatar ? 'pointer' : 'not-allowed', background: podeResgatar ? C.douradoEleva : C.borderMid, color: podeResgatar ? '#fff' : C.textLight }}>
                      Resgatar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal inline de confirmação de resgate */}
      {premioEscolhido && (
        <div style={{ background: C.bg, borderRadius: RAIO_LG, padding: 14, marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.textMain, margin: '0 0 10px' }}>
            Resgatar "{premioEscolhido.nome}" — agendar para quando?
          </p>
          {erro && <p style={{ fontSize: 11, color: C.dangerText, marginBottom: 8 }}>{erro}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <select value={profissionalId} onChange={e => setProfissionalId(e.target.value)} style={{ padding: '7px 10px', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, fontSize: 12 }}>
              {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ padding: '7px 10px', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, fontSize: 12 }} />
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={{ padding: '7px 10px', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, fontSize: 12 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPremioEscolhido(null)} style={{ padding: '7px 14px', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={confirmarResgate} disabled={resgatando === premioEscolhido.id || !profissionalId}
              style={{ padding: '7px 14px', borderRadius: RAIO_SM, border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {resgatando === premioEscolhido.id ? 'Confirmando...' : 'Confirmar resgate'}
            </button>
          </div>
        </div>
      )}

      {/* Desconto em reais */}
      {configFid?.permite_desconto_valor && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <FiDollarSign size={10} /> Desconto em reais
          </p>
          <div style={{ background: C.bg, borderRadius: RAIO_MD, padding: '10px 12px' }}>
            <p style={{ fontSize: 11, color: C.textMuted, margin: '0 0 8px' }}>
              Cada ponto vale <strong>{brl(configFid.valor_por_ponto)}</strong>. Saldo disponível: <strong>{formatarPontos(saldo)} pts = {brl(saldo * configFid.valor_por_ponto)}</strong>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="number" min={1} max={saldo} placeholder="Pontos a usar"
                value={pontosDesconto}
                onChange={e => { setPontosDesconto(e.target.value); setSucessoValor(''); setErro(''); }}
                style={{ padding: '6px 10px', borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, fontSize: 12, width: 120 }}
              />
              {pontosDesconto && parseInt(pontosDesconto) > 0 && (
                <span style={{ fontSize: 12, color: C.douradoEleva, fontWeight: 700 }}>
                  = {brl(parseInt(pontosDesconto) * configFid.valor_por_ponto)}
                </span>
              )}
              <button
                onClick={confirmarResgateValor}
                disabled={resgatandoValor || !pontosDesconto || parseInt(pontosDesconto) <= 0 || parseInt(pontosDesconto) > saldo}
                style={{ padding: '6px 12px', borderRadius: RAIO_SM, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: C.sidebarBg, color: '#fff', opacity: (!pontosDesconto || parseInt(pontosDesconto) <= 0 || parseInt(pontosDesconto) > saldo) ? 0.5 : 1 }}
              >
                {resgatandoValor ? 'Registrando...' : 'Registrar desconto'}
              </button>
            </div>
            {sucessoValor && (
              <div style={{ marginTop: 8, background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: RAIO_SM, padding: '6px 10px', fontSize: 11, color: '#15803D', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiCheck size={11} /> {sucessoValor}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Histórico */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', margin: '0 0 8px' }}>Histórico</p>
        {extrato.length === 0 ? (
          <p style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic' }}>Sem movimentações ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
            {extrato.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FiClock size={10} /> {t.descricao || t.tipo}
                </span>
                <span style={{ fontWeight: 700, color: t.pontos >= 0 ? C.success : C.dangerText }}>
                  {t.pontos >= 0 ? '+' : ''}{formatarPontos(t.pontos)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
