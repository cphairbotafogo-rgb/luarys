'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import {
  FiPlay, FiAlertTriangle, FiClock, FiCheckCircle,
  FiRefreshCw, FiXCircle, FiPlusCircle, FiSliders,
} from 'react-icons/fi';

interface TrialRow {
  id: string;
  nome_fantasia: string | null;
  razao_social: string | null;
  email_contato: string | null;
  trial_expiracao: string;
  status_assinatura: string | null;
}

function categorizarTrial(row: TrialRow): 'expirado' | 'urgente' | 'ativo' {
  const exp = new Date(row.trial_expiracao);
  const agora = new Date();
  if (agora > exp) return 'expirado';
  if ((exp.getTime() - agora.getTime()) / 86_400_000 <= 2) return 'urgente';
  return 'ativo';
}

function diasRestantes(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  if (diff < 0) return `Expirado há ${Math.abs(Math.ceil(diff))}d`;
  if (diff < 1) return 'Expira hoje';
  return `${Math.floor(diff)}d restantes`;
}

const COR: Record<string, string> = {
  expirado: '#EF4444',
  urgente:  '#F59E0B',
  ativo:    '#10B981',
};

export function AbaSistema() {
  const toast = useToast();
  const [trials, setTrials]           = useState<TrialRow[]>([]);
  const [carregando, setCarregando]   = useState(false);
  const [rodandoCron, setRodandoCron] = useState(false);
  const [resultadoCron, setResultadoCron] = useState<any>(null);
  const [emAcao, setEmAcao]           = useState<Set<string>>(new Set());
  const [filtro, setFiltro]           = useState<'todos' | 'expirado' | 'urgente' | 'ativo'>('todos');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('saloes')
      .select('id, nome_fantasia, razao_social, email_contato, trial_expiracao, status_assinatura')
      .eq('status_assinatura', 'trial')
      .not('trial_expiracao', 'is', null)
      .order('trial_expiracao', { ascending: true });
    setTrials((data || []) as TrialRow[]);
    setCarregando(false);
  }

  async function acao(id: string, tipo: 'suspender' | 'estender' | 'ativar') {
    const chave = id + tipo;
    setEmAcao(prev => new Set([...prev, chave]));
    try {
      const update: Record<string, any> = {};
      if (tipo === 'suspender') {
        update.status_assinatura = 'suspenso';
      } else if (tipo === 'estender') {
        const salao = trials.find(t => t.id === id);
        const base  = salao?.trial_expiracao ? new Date(salao.trial_expiracao) : new Date();
        if (base < new Date()) base.setTime(Date.now()); // se já expirou, parte de hoje
        base.setDate(base.getDate() + 7);
        update.trial_expiracao = base.toISOString();
      } else if (tipo === 'ativar') {
        const renovacao = new Date();
        renovacao.setDate(renovacao.getDate() + 30);
        update.status_assinatura    = 'ativo';
        update.plano_renovacao_em   = renovacao.toISOString();
        update.plano_aviso_enviado_em = null;
      }
      const { error } = await supabase.from('saloes').update(update).eq('id', id);
      if (error) throw error;
      const msgs = { suspender: 'Acesso suspenso.', estender: 'Trial estendido +7 dias.', ativar: 'Conta ativada por 30 dias.' };
      toast.sucesso(msgs[tipo]);
      await carregar();
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    } finally {
      setEmAcao(prev => { const n = new Set(prev); n.delete(chave); return n; });
    }
  }

  async function rodarCron() {
    setRodandoCron(true);
    setResultadoCron(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/rodar-cron', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro no servidor.');
      setResultadoCron(data.resultado);
      toast.sucesso('Cron executado com sucesso!');
      await carregar();
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    } finally {
      setRodandoCron(false);
    }
  }

  const expirados = trials.filter(t => categorizarTrial(t) === 'expirado');
  const urgentes  = trials.filter(t => categorizarTrial(t) === 'urgente');
  const ativos    = trials.filter(t => categorizarTrial(t) === 'ativo');

  const filtrados = filtro === 'todos' ? trials
    : trials.filter(t => categorizarTrial(t) === filtro);

  const card = (titulo: string, valor: number, cor: string, icone: React.ReactNode) => (
    <div style={{ background: C.bgCard, border: `1.5px solid ${cor}33`, borderRadius: RAIO_XL, padding: '16px 20px', minWidth: 140, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>{icone}<span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{titulo}</span></div>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: cor }}>{valor}</p>
    </div>
  );

  const btn = (label: string, onClick: () => void, cor = C.sidebarBg, disabled = false) => (
    <button onClick={onClick} disabled={disabled} style={{ padding: '6px 12px', background: disabled ? C.borderMid : cor, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      {label}
    </button>
  );

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: 1 }}>Saúde do Sistema</h2>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: C.textMuted }}>Monitore e corrija trials, dispare o cron manualmente e acompanhe o ciclo de assinaturas.</p>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {card('Trials Expirados', expirados.length, '#EF4444', <FiXCircle size={15} color="#EF4444" />)}
        {card('Expirando em 2 dias', urgentes.length, '#F59E0B', <FiAlertTriangle size={15} color="#F59E0B" />)}
        {card('Trials Ativos', ativos.length, '#10B981', <FiCheckCircle size={15} color="#10B981" />)}
        {card('Total em Trial', trials.length, C.sidebarBg, <FiClock size={15} color={C.sidebarBg} />)}
      </div>

      {/* Cron + Configs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Cron manual */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <FiPlay size={16} color={C.sidebarBg} />
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.sidebarBg }}>Processar Vencimentos Agora</h4>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
            Dispara o cron imediatamente. O pg_cron já roda todo dia às 08h automaticamente.
          </p>
          <button
            onClick={rodarCron}
            disabled={rodandoCron}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: rodandoCron ? C.borderMid : C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: rodandoCron ? 'not-allowed' : 'pointer' }}
          >
            <FiRefreshCw size={14} style={{ animation: rodandoCron ? 'spin 1s linear infinite' : 'none' }} />
            {rodandoCron ? 'Processando...' : 'Rodar Cron Agora'}
          </button>

          {resultadoCron && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: C.bg, borderRadius: RAIO_MD, fontSize: 12, color: C.textMain, lineHeight: 1.6 }}>
              <strong>Resultado:</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
                <span style={{ color: C.textMuted }}>Trials suspensos</span><strong>{resultadoCron.trials?.bloqueados ?? 0}</strong>
                <span style={{ color: C.textMuted }}>Trials lembrete</span><strong>{resultadoCron.trials?.lembretes ?? 0}</strong>
                <span style={{ color: C.textMuted }}>Planos suspensos</span><strong>{resultadoCron.planos?.bloqueados ?? 0}</strong>
                <span style={{ color: C.textMuted }}>Planos em atraso</span><strong>{resultadoCron.planos?.avisos ?? 0}</strong>
                <span style={{ color: C.textMuted }}>Módulos suspensos</span><strong>{resultadoCron.modulos?.bloqueados ?? 0}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Configurações fixas */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <FiSliders size={16} color={C.sidebarBg} />
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.sidebarBg }}>Parâmetros do Sistema</h4>
          </div>
          {[
            ['Duração do Trial', '14 dias', 'onboarding/route.ts'],
            ['Período de Graça (planos)', '74 horas', 'processar-vencimentos/route.ts'],
            ['Lembrete Trial (antes de vencer)', '2 dias', 'processar-vencimentos/route.ts'],
            ['Lembrete Plano Mensal', '3 dias', 'processar-vencimentos/route.ts'],
            ['Lembrete Plano Anual', '30 dias', 'processar-vencimentos/route.ts'],
            ['Expiração de Sinal (portal)', '20 minutos', 'pg_cron + PortalPagamentoReserva'],
          ].map(([param, valor, arquivo]) => (
            <div key={param} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.border}`, gap: 8 }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.textMain }}>{param}</p>
                <p style={{ margin: 0, fontSize: 10, color: C.textLight }}>{arquivo}</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: C.sidebarBg, whiteSpace: 'nowrap' }}>{valor}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela de trials */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.sidebarBg, flex: 1 }}>Salões em Trial</h4>
          {(['todos', 'expirado', 'urgente', 'ativo'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: filtro === f ? C.sidebarBg : C.bg, color: filtro === f ? '#fff' : C.textMuted, border: `1px solid ${filtro === f ? C.sidebarBg : C.borderMid}` }}>
              {f === 'todos' ? `Todos (${trials.length})` : f === 'expirado' ? `Expirados (${expirados.length})` : f === 'urgente' ? `Urgentes (${urgentes.length})` : `Ativos (${ativos.length})`}
            </button>
          ))}
          <button onClick={carregar} disabled={carregando} style={{ padding: '5px 10px', background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: 'pointer', color: C.textMuted }}>
            <FiRefreshCw size={13} />
          </button>
        </div>

        {carregando ? (
          <p style={{ textAlign: 'center', padding: 32, color: C.textLight, fontSize: 13 }}>Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32, color: C.textLight, fontSize: 13 }}>Nenhum registro.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: C.bg }}>
                <tr>
                  {['Estabelecimento', 'E-mail', 'Expira em', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(t => {
                  const cat = categorizarTrial(t);
                  const cor = COR[cat];
                  const nome = t.nome_fantasia || t.razao_social || t.id;
                  return (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}`, background: cat === 'expirado' ? '#FEF2F2' : cat === 'urgente' ? '#FFFBEB' : 'transparent' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: C.textMain }}>{nome}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: C.textMuted }}>{t.email_contato || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: cor }}>{diasRestantes(t.trial_expiracao)}</span>
                        <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textLight }}>{new Date(t.trial_expiracao).toLocaleDateString('pt-BR')}</p>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: cor + '22', color: cor }}>
                          {cat === 'expirado' ? 'EXPIRADO' : cat === 'urgente' ? 'URGENTE' : 'ATIVO'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {btn('Suspender', () => acao(t.id, 'suspender'), '#EF4444', emAcao.has(t.id + 'suspender'))}
                          {btn('+7 dias', () => acao(t.id, 'estender'), '#F59E0B', emAcao.has(t.id + 'estender'))}
                          {btn('Ativar 30d', () => acao(t.id, 'ativar'), '#10B981', emAcao.has(t.id + 'ativar'))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
}
