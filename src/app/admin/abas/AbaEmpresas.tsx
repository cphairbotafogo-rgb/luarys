'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { FiSearch, FiPackage } from "react-icons/fi";
import { thStyle, tdStyle, ToggleBtn, PrecoInput } from "../shared";
import { ModalPacoteWpp } from "./empresas/ModalPacoteWpp";
import { ModalNotaFiscalSalao } from "./empresas/ModalNotaFiscalSalao";
import { ModalModulosSalao } from "./empresas/ModalModulosSalao";

export function AbaEmpresas() {
  const [saloes, setSaloes] = useState<any[]>([]);
  const [planos, setPlanos] = useState<any[]>([]);
  const [pacotesWpp, setPacotesWpp] = useState<Record<string, any>>({});
  const [busca, setBusca] = useState('');
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [modalModulosSalao, setModalModulosSalao] = useState<any | null>(null);
  const [modalPacoteWpp, setModalPacoteWpp] = useState<any | null>(null);
  const [modalNFSeSalao, setModalNFSeSalao] = useState<any | null>(null);
  const [contModulos, setContModulos] = useState<Record<string, number>>({});

  useEffect(() => {
    carregarSaloes();
    carregarPlanos();
  }, []);

  async function carregarSaloes() {
    const { data, error } = await supabase
      .from('saloes')
      .select('id, nome_fantasia, razao_social, cnpj, acesso_total, modulo_fiscal_liberado, vitrine_liberada, limite_profissionais, limite_notas_mes, plano_chave, preco_legado, config_fiscal, trial_expiracao')
      .order('nome_fantasia', { ascending: true });

    if (error) {
      // Fallback sem colunas novas caso migration pendente
      const { data: fallback } = await supabase
        .from('saloes')
        .select('id, nome_fantasia, razao_social, cnpj, acesso_total, modulo_fiscal_liberado, vitrine_liberada, plano_chave, preco_legado, config_fiscal, trial_expiracao')
        .order('nome_fantasia', { ascending: true });
      if (fallback) setSaloes(fallback);
      return;
    }

    if (data) {
      setSaloes(data);
      if (data.length === 0) return;

      const [resPacotes, resModulos] = await Promise.all([
        supabase.from('salao_whatsapp_pacote').select('salao_id, tipo, limite_mes, creditos_saldo, ativo').in('salao_id', data.map(s => s.id)),
        supabase.from('salao_modulos').select('salao_id, modulo_chave').eq('ativo', true).in('salao_id', data.map(s => s.id)),
      ]);

      if (resPacotes.data) {
        const mapa: Record<string, any> = {};
        resPacotes.data.forEach(p => { mapa[p.salao_id] = p; });
        setPacotesWpp(mapa);
      }
      if (resModulos.data) {
        const cont: Record<string, number> = {};
        resModulos.data.forEach(m => { cont[m.salao_id] = (cont[m.salao_id] || 0) + 1; });
        setContModulos(cont);
      }
    }
  }

  async function carregarPlanos() {
    const { data } = await supabase.from('planos').select('chave, nome, ordem').order('ordem');
    if (data) setPlanos(data);
  }

  async function salvarPlanoSalao(salao: any, novoPlanoChave: string) {
    setSalvandoId(`${salao.id}-plano`);
    const planoAnterior = salao.plano_chave || null;
    const planoNovo = novoPlanoChave || null;
    const { error } = await supabase.from('saloes').update({ plano_chave: planoNovo }).eq('id', salao.id);
    if (!error) {
      setSaloes(prev => prev.map(s => s.id === salao.id ? { ...s, plano_chave: planoNovo } : s));
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('salao_planos_historico').insert({
        salao_id: salao.id, plano_anterior: planoAnterior, plano_novo: planoNovo, alterado_por: user?.id ?? null,
      });
    }
    setSalvandoId(null);
  }

  async function salvarPrecoLegado(salao: any, valor: string) {
    const novoValor = valor.trim() === '' ? null : Math.max(0, parseFloat(valor.replace(',', '.')) || 0);
    setSaloes(prev => prev.map(s => s.id === salao.id ? { ...s, preco_legado: novoValor } : s));
    setSalvandoId(`${salao.id}-preco_legado`);
    const { error } = await supabase.from('saloes').update({ preco_legado: novoValor }).eq('id', salao.id);
    if (error) setSaloes(prev => prev.map(s => s.id === salao.id ? { ...s, preco_legado: salao.preco_legado } : s));
    setSalvandoId(null);
  }

  async function alternarFlag(salao: any, campo: 'acesso_total' | 'modulo_fiscal_liberado' | 'vitrine_liberada') {
    setSalvandoId(`${salao.id}-${campo}`);
    const novoValor = !salao[campo];
    const { error } = await supabase.from('saloes').update({ [campo]: novoValor }).eq('id', salao.id);
    if (!error) setSaloes(prev => prev.map(s => s.id === salao.id ? { ...s, [campo]: novoValor } : s));
    setSalvandoId(null);
  }

  async function salvarLimiteProfissionais(salao: any, valor: string) {
    const novoValor = valor.trim() === '' ? null : Math.max(0, parseInt(valor, 10) || 0);
    setSaloes(prev => prev.map(s => s.id === salao.id ? { ...s, limite_profissionais: novoValor } : s));
    setSalvandoId(`${salao.id}-limite_profissionais`);
    const { error } = await supabase.from('saloes').update({ limite_profissionais: novoValor }).eq('id', salao.id);
    if (error) setSaloes(prev => prev.map(s => s.id === salao.id ? { ...s, limite_profissionais: salao.limite_profissionais } : s));
    setSalvandoId(null);
  }

  async function salvarLimiteNotas(salao: any, valor: string) {
    const novoValor = valor.trim() === '' ? 150 : Math.max(0, parseInt(valor, 10) || 150);
    setSaloes(prev => prev.map(s => s.id === salao.id ? { ...s, limite_notas_mes: novoValor } : s));
    setSalvandoId(`${salao.id}-limite_notas_mes`);
    const { error } = await supabase.from('saloes').update({ limite_notas_mes: novoValor }).eq('id', salao.id);
    if (error) setSaloes(prev => prev.map(s => s.id === salao.id ? { ...s, limite_notas_mes: salao.limite_notas_mes } : s));
    setSalvandoId(null);
  }

  function labelPacoteWpp(pacote: any): { texto: string; cor: string; bg: string } {
    if (!pacote?.ativo) return { texto: 'Sem pacote', cor: C.textMuted, bg: '#F8F9FA' };
    if (pacote.tipo === 'mensal') return { texto: `${pacote.limite_mes ?? '?'}/mês`, cor: '#16A34A', bg: '#F0FDF4' };
    return { texto: `${pacote.creditos_saldo ?? 0} créd.`, cor: '#2563EB', bg: '#EFF6FF' };
  }

  const saloesFiltrados = saloes.filter(s => {
    if (!busca) return true;
    const termoLimpo = busca.toLowerCase().replace(/[.\-/\s]/g, '');
    const cnpjLimpo = (s.cnpj || '').replace(/[.\-/\s]/g, '');
    return (s.nome_fantasia || '').toLowerCase().includes(busca.toLowerCase())
      || (s.razao_social || '').toLowerCase().includes(busca.toLowerCase())
      || cnpjLimpo.includes(termoLimpo);
  });

  return (
    <>
      {modalModulosSalao && (
        <ModalModulosSalao salao={modalModulosSalao} onClose={() => setModalModulosSalao(null)} />
      )}
      {modalPacoteWpp && (
        <ModalPacoteWpp
          salao={modalPacoteWpp}
          pacoteAtual={pacotesWpp[modalPacoteWpp.id]}
          onClose={() => setModalPacoteWpp(null)}
          onSaved={carregarSaloes}
        />
      )}
      {modalNFSeSalao && (
        <ModalNotaFiscalSalao
          salao={modalNFSeSalao}
          onClose={() => setModalNFSeSalao(null)}
          onSaved={carregarSaloes}
        />
      )}

      <Card style={{ marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <FiSearch style={{ position: 'absolute', left: 14, top: 14, color: C.textLight }} />
          <input
            style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
            placeholder="Buscar por nome ou CNPJ..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1300, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <th style={{ ...thStyle, minWidth: 160 }}>Salão</th>
                <th style={{ ...thStyle, minWidth: 140 }}>CNPJ</th>
                <th style={{ ...thStyle, minWidth: 80 }}>Trial</th>
                <th style={{ ...thStyle, minWidth: 120 }}>Plano</th>
                <th style={{ ...thStyle, textAlign: 'right', minWidth: 100 }}>Preço Custom</th>
                <th style={{ ...thStyle, minWidth: 160 }}>WhatsApp</th>
                <th style={{ ...thStyle, textAlign: 'right', minWidth: 100 }}>Profis.</th>
                <th style={{ ...thStyle, textAlign: 'right', minWidth: 80 }}>Notas/mês</th>
                <th style={{ ...thStyle, textAlign: 'center', minWidth: 100 }}>Módulos</th>
                <th style={{ ...thStyle, minWidth: 160 }}>NFS-e</th>
                <th style={{ ...thStyle, textAlign: 'center', minWidth: 80 }}>Vitrine</th>
                <th style={{ ...thStyle, textAlign: 'right', minWidth: 90 }}>Acesso Total</th>
              </tr>
            </thead>
            <tbody>
              {saloesFiltrados.map(s => {
                const pacote = pacotesWpp[s.id];
                const { texto, cor, bg } = labelPacoteWpp(pacote);
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700, color: C.textMain }}>{s.nome_fantasia || s.razao_social || '(sem nome)'}</div>
                      {s.nome_fantasia && s.razao_social && (
                        <div style={{ fontSize: 11, color: C.textLight }}>{s.razao_social}</div>
                      )}
                    </td>
                    <td style={tdStyle}>{s.cnpj || '—'}</td>
                    <td style={tdStyle}>
                      {(() => {
                        if (!s.trial_expiracao) return <span style={{ fontSize: 11, color: C.textLight }}>—</span>;
                        const exp = new Date(s.trial_expiracao);
                        const diasRestantes = Math.ceil((exp.getTime() - Date.now()) / 86400000);
                        if (s.plano_chave || s.acesso_total) return <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 700 }}>Convertido</span>;
                        if (diasRestantes > 0) return <span style={{ fontSize: 11, fontWeight: 700, color: diasRestantes <= 2 ? '#B45309' : '#2563EB' }}>{diasRestantes}d restante{diasRestantes !== 1 ? 's' : ''}</span>;
                        return <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>Expirado</span>;
                      })()}
                    </td>
                    <td style={tdStyle}>
                      <select
                        value={s.plano_chave || ''}
                        onChange={(e) => salvarPlanoSalao(s, e.target.value)}
                        disabled={salvandoId === `${s.id}-plano`}
                        style={{ padding: '6px 8px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontWeight: 700, color: C.textMain, opacity: salvandoId === `${s.id}-plano` ? 0.6 : 1 }}
                      >
                        <option value="">—</option>
                        {planos.map(p => <option key={p.chave} value={p.chave}>{p.nome}</option>)}
                      </select>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {s.plano_chave === 'enterprise' ? (
                        <PrecoInput valor={s.preco_legado} carregando={salvandoId === `${s.id}-preco_legado`} onSalvar={(v) => salvarPrecoLegado(s, v)} />
                      ) : (
                        <span style={{ fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>{s.preco_legado != null ? `R$ ${Number(s.preco_legado).toFixed(2)}` : 'Padrão'}</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cor, background: bg, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                          {texto}
                        </span>
                        <button
                          onClick={() => setModalPacoteWpp(s)}
                          style={{ fontSize: 11, fontWeight: 700, color: C.sidebarBg, background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '3px 8px', cursor: 'pointer' }}
                        >
                          {pacote?.ativo ? 'Editar' : 'Contratar'}
                        </button>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {s.acesso_total ? (
                        <span style={{ fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>Sem limite</span>
                      ) : (
                        <input
                          type="number" min={0} placeholder="Sem limite"
                          defaultValue={s.limite_profissionais ?? ''}
                          onBlur={(e) => salvarLimiteProfissionais(s, e.target.value)}
                          disabled={salvandoId === `${s.id}-limite_profissionais`}
                          style={{ width: 80, padding: '6px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, textAlign: 'right', fontWeight: 700, color: C.textMain, opacity: salvandoId === `${s.id}-limite_profissionais` ? 0.6 : 1 }}
                        />
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {s.acesso_total ? (
                        <span style={{ fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>Ilimitado</span>
                      ) : (
                        <input
                          type="number" min={0} placeholder="150"
                          defaultValue={s.limite_notas_mes ?? 150}
                          onBlur={(e) => salvarLimiteNotas(s, e.target.value)}
                          disabled={salvandoId === `${s.id}-limite_notas_mes`}
                          style={{ width: 70, padding: '6px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, textAlign: 'right', fontWeight: 700, color: C.textMain, opacity: salvandoId === `${s.id}-limite_notas_mes` ? 0.6 : 1 }}
                        />
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        onClick={() => setModalModulosSalao(s)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: contModulos[s.id] ? '#EFF6FF' : '#F8F9FA', color: contModulos[s.id] ? '#2563EB' : C.textMuted, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        <FiPackage size={12} />
                        {contModulos[s.id] ? `${contModulos[s.id]} ativo${contModulos[s.id] > 1 ? 's' : ''}` : 'Nenhum'}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                          color: s.modulo_fiscal_liberado && s.config_fiscal?.focus_nfe_token ? '#16A34A' : s.modulo_fiscal_liberado ? '#B45309' : C.textMuted,
                          background: s.modulo_fiscal_liberado && s.config_fiscal?.focus_nfe_token ? '#F0FDF4' : s.modulo_fiscal_liberado ? '#FFFBEB' : '#F8F9FA',
                        }}>
                          {s.modulo_fiscal_liberado && (s.config_fiscal?.focus_nfe_token || s.config_fiscal?.brasilnfe_token)
                            ? `✓ ${s.config_fiscal?.provedor_nfse === 'brasilnfe' ? 'Brasil NFe' : 'Focus NFe'}`
                            : s.modulo_fiscal_liberado ? 'Sem token' : 'Inativo'}
                        </span>
                        <button
                          onClick={() => setModalNFSeSalao(s)}
                          style={{ fontSize: 11, fontWeight: 700, color: C.sidebarBg, background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: '3px 8px', cursor: 'pointer' }}
                        >
                          Config
                        </button>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <ToggleBtn ativo={!!s.vitrine_liberada} carregando={salvandoId === `${s.id}-vitrine_liberada`} onClick={() => alternarFlag(s, 'vitrine_liberada')} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <ToggleBtn ativo={!!s.acesso_total} carregando={salvandoId === `${s.id}-acesso_total`} onClick={() => alternarFlag(s, 'acesso_total')} />
                    </td>
                  </tr>
                );
              })}
              {saloesFiltrados.length === 0 && (
                <tr><td colSpan={12} style={{ ...tdStyle, textAlign: 'center', color: C.textLight, fontStyle: 'italic' }}>Nenhum salão encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
