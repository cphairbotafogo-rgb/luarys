'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiSave, FiSearch } from 'react-icons/fi';

type StatusAssinatura = 'trial' | 'ativo' | 'suspenso' | 'cancelado';

interface SalaoRow {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  plano_chave: string | null;
  status_assinatura: StatusAssinatura | null;
  assinatura_inicio: string | null;
  assinatura_fim: string | null;
  valor_mensalidade: number | null;
  trial_expiracao: string | null;
}

const STATUS_CORES: Record<StatusAssinatura, string> = {
  trial:     '#6366F1',
  ativo:     '#10B981',
  suspenso:  '#F59E0B',
  cancelado: '#EF4444',
};

export function AbaAssinaturas() {
  const toast = useToast();
  const [saloes, setSaloes]     = useState<SalaoRow[]>([]);
  const [planos, setPlanos]     = useState<any[]>([]);
  const [busca, setBusca]       = useState('');
  const [editando, setEditando] = useState<SalaoRow | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [formPlano,  setFormPlano]  = useState('');
  const [formStatus, setFormStatus] = useState<StatusAssinatura>('trial');
  const [formInicio, setFormInicio] = useState('');
  const [formFim,    setFormFim]    = useState('');
  const [formValor,  setFormValor]  = useState('');

  useEffect(() => { carregar(); carregarPlanos(); }, []);

  async function carregarPlanos() {
    const { data } = await supabase
      .from('planos')
      .select('chave, nome, preco_mensal')
      .eq('ativo', true)
      .order('ordem');
    if (data) setPlanos(data);
  }

  async function carregar() {
    const { data } = await supabase
      .from('saloes')
      .select('id, nome_fantasia, razao_social, cnpj, plano_chave, status_assinatura, assinatura_inicio, assinatura_fim, valor_mensalidade, trial_expiracao')
      .order('nome_fantasia', { ascending: true });
    if (data) setSaloes(data as SalaoRow[]);
  }

  function abrirEdicao(s: SalaoRow) {
    setEditando(s);
    setFormPlano(s.plano_chave ?? '');
    setFormStatus(s.status_assinatura ?? 'trial');
    setFormInicio(s.assinatura_inicio ? s.assinatura_inicio.slice(0, 10) : '');
    setFormFim(s.assinatura_fim ? s.assinatura_fim.slice(0, 10) : '');
    const precoPlano = planos.find(p => p.chave === s.plano_chave)?.preco_mensal ?? '';
    setFormValor(String(s.valor_mensalidade ?? precoPlano));
  }

  async function salvar() {
    if (!editando) return;
    setSalvando(true);
    try {
      const update: Record<string, any> = {
        plano_chave:        formPlano || null,
        status_assinatura:  formStatus,
        assinatura_inicio:  formInicio || null,
        assinatura_fim:     formFim    || null,
        valor_mensalidade:  formValor ? Number(formValor) : null,
      };
      // Ao reativar manualmente, zera o aviso para o próximo ciclo funcionar
      if (formStatus === 'ativo') {
        update.plano_aviso_enviado_em = null;
      }
      const { error } = await supabase.from('saloes').update(update).eq('id', editando.id);
      if (error) throw error;
      toast.sucesso('Assinatura atualizada!');
      setEditando(null);
      await carregar();
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  const filtrados = saloes.filter(s => {
    const q = busca.toLowerCase();
    return !q || (s.nome_fantasia || '').toLowerCase().includes(q) || (s.cnpj || '').includes(q);
  });

  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 5 };
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: C.bgCard, boxSizing: 'border-box' };

  const resumo = planos.map(p => ({
    plano: p,
    total: saloes.filter(s => s.plano_chave === p.chave).length,
  }));
  const semPlano = saloes.filter(s => !s.plano_chave).length;

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: 1 }}>Assinaturas & Planos</h2>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: C.textMuted }}>Gerencie o plano de cada salão, status de pagamento e datas de vigência.</p>

      {/* RESUMO POR PLANO */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {resumo.map(({ plano, total }) => (
          <div key={plano.chave} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '14px 18px', minWidth: 140 }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.sidebarBg }}>{total}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: C.textMuted }}>{plano.nome}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textLight }}>
              R$ {Number(plano.preco_mensal || 0).toFixed(0)}/mês × {total} = <strong>R$ {(Number(plano.preco_mensal || 0) * total).toLocaleString('pt-BR')}</strong>
            </p>
          </div>
        ))}
        {semPlano > 0 && (
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '14px 18px', minWidth: 140 }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.textLight }}>{semPlano}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: C.textMuted }}>Sem plano</p>
          </div>
        )}
      </div>

      {/* BUSCA + TABELA */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'center' }}>
          <FiSearch size={15} color={C.textLight} />
          <input
            placeholder="Buscar salão por nome ou CNPJ..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 13, color: C.textMain, flex: 1, background: 'transparent' }}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: C.bg }}>
              <tr>
                {['Estabelecimento', 'CNPJ', 'Plano', 'Status', 'Validade', 'Mensalidade', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(s => {
                const plano  = planos.find(p => p.chave === s.plano_chave);
                const status = (s.status_assinatura ?? 'trial') as StatusAssinatura;
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: C.textMain }}>{s.nome_fantasia || s.razao_social || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'monospace', color: C.textMuted }}>{s.cnpj || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: C.sidebarBg + '22', color: C.sidebarBg }}>
                        {plano?.nome ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: STATUS_CORES[status] + '22', color: STATUS_CORES[status] }}>
                        {status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: C.textMuted }}>
                      {s.assinatura_fim
                        ? new Date(s.assinatura_fim).toLocaleDateString('pt-BR')
                        : s.trial_expiracao
                          ? `Trial até ${new Date(s.trial_expiracao).toLocaleDateString('pt-BR')}`
                          : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: C.textMain }}>
                      {s.valor_mensalidade ? `R$ ${Number(s.valor_mensalidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => abrirEdicao(s)} style={{ padding: '6px 14px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: C.textLight, fontSize: 13 }}>Nenhum salão encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDIÇÃO */}
      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: 28, width: 440, maxWidth: '95vw' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>{editando.nome_fantasia || editando.razao_social}</h3>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: C.textMuted, fontFamily: 'monospace' }}>{editando.cnpj}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Plano</label>
                <select style={inp} value={formPlano} onChange={e => {
                  setFormPlano(e.target.value);
                  const p = planos.find(pl => pl.chave === e.target.value);
                  if (p) setFormValor(String(p.preco_mensal ?? ''));
                }}>
                  <option value="">— Sem plano —</option>
                  {planos.map(p => (
                    <option key={p.chave} value={p.chave}>
                      {p.nome} — R$ {Number(p.preco_mensal || 0).toFixed(0)}/mês
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={inp} value={formStatus} onChange={e => setFormStatus(e.target.value as StatusAssinatura)}>
                  <option value="trial">Trial</option>
                  <option value="ativo">Ativo</option>
                  <option value="suspenso">Suspenso</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Início da assinatura</label>
                  <input type="date" style={inp} value={formInicio} onChange={e => setFormInicio(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Próxima cobrança / Expira em</label>
                  <input type="date" style={inp} value={formFim} onChange={e => setFormFim(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={lbl}>Valor cobrado (R$/mês)</label>
                <input
                  type="number" min={0} step={0.01} style={inp}
                  value={formValor}
                  onChange={e => setFormValor(e.target.value)}
                  placeholder={String(planos.find(p => p.chave === formPlano)?.preco_mensal ?? '')}
                />
                <p style={{ margin: '3px 0 0', fontSize: 11, color: C.textLight }}>
                  Padrão do plano: R$ {Number(planos.find(p => p.chave === formPlano)?.preco_mensal || 0).toFixed(2)}/mês. Ajuste para descontos ou acordos especiais.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditando(null)} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 13, color: C.textMuted, cursor: 'pointer', fontWeight: 700 }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '10px 24px', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 13, fontWeight: 800, cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: salvando ? 0.7 : 1 }}>
                <FiSave size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
