'use client'
/**
 * src/modules/nfce/AbaHistoricoNFCe.tsx — Histórico de Cupons (NFC-e).
 * Lê o registro local de emissões (nfce_emissoes, via RLS do próprio salão)
 * e permite reconciliar as notas pendentes contra a Focus NFe.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_MD } from '@/lib/estiloGlobal';
import { FiRefreshCw, FiFileText, FiDownload, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { S, ptBR, getAuthToken } from './tipos';

type NotaEmissao = {
  id: string;
  referencia: string;
  numero: number;
  serie: string | null;
  status: 'processando' | 'autorizado' | 'erro' | 'cancelado';
  chave_acesso: string | null;
  link_danfe: string | null;
  link_xml: string | null;
  mensagem_erro: string | null;
  valor_total: number | null;
  os_numero: string | null;
  criado_em: string;
};

const ROTULO_STATUS: Record<NotaEmissao['status'], { texto: string; cor: string; fundo: string }> = {
  autorizado:  { texto: 'Autorizada',  cor: '#166534', fundo: '#F0FDF4' },
  processando: { texto: 'Processando', cor: '#92400E', fundo: '#FFFBEB' },
  erro:        { texto: 'Erro',        cor: '#991B1B', fundo: '#FEF2F2' },
  cancelado:   { texto: 'Cancelada',   cor: C.textMuted, fundo: C.bg },
};

const FILTROS: Array<{ chave: 'todas' | NotaEmissao['status']; rotulo: string }> = [
  { chave: 'todas',       rotulo: 'Todas' },
  { chave: 'autorizado',  rotulo: 'Autorizadas' },
  { chave: 'processando', rotulo: 'Processando' },
  { chave: 'erro',        rotulo: 'Com erro' },
];

export function AbaHistoricoNFCe({ salaoId, toast }: { salaoId: string; toast: (msg: string, tipo: string) => void }) {
  const [notas, setNotas] = useState<NotaEmissao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [reconciliando, setReconciliando] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | NotaEmissao['status']>('todas');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('nfce_emissoes')
      .select('id, referencia, numero, serie, status, chave_acesso, link_danfe, link_xml, mensagem_erro, valor_total, os_numero, criado_em')
      .eq('salao_id', salaoId)
      .order('criado_em', { ascending: false })
      .limit(200);
    if (error) {
      console.error('Erro ao carregar histórico de NFC-e:', error.message);
      toast('Não foi possível carregar o histórico de cupons.', 'erro');
    }
    setNotas(data || []);
    setCarregando(false);
  }, [salaoId, toast]);

  useEffect(() => { if (salaoId) carregar(); }, [salaoId, carregar]);

  const pendentes = notas.filter(n => n.status === 'processando').length;

  const reconciliar = async () => {
    setReconciliando(true);
    try {
      const token = await getAuthToken();
      const resp = await fetch('/api/nfce/reconciliar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast(json.erro || 'Falha ao atualizar as notas pendentes.', 'erro');
      } else if (json.verificadas === 0) {
        toast('Nenhuma nota pendente para atualizar.', 'sucesso');
      } else {
        toast(`${json.verificadas} verificada(s): ${json.autorizadas} autorizada(s), ${json.com_erro} com erro, ${json.ainda_processando} ainda processando.`, 'sucesso');
      }
      await carregar();
    } catch {
      toast('Falha de conexão ao atualizar as notas.', 'erro');
    } finally {
      setReconciliando(false);
    }
  };

  const visiveis = filtro === 'todas' ? notas : notas.filter(n => n.status === filtro);

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTROS.map(f => (
            <button
              key={f.chave}
              onClick={() => setFiltro(f.chave)}
              style={{
                padding: '7px 14px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${filtro === f.chave ? C.sidebarBg : C.borderMid}`,
                background: filtro === f.chave ? C.sidebarBg : C.bgCard,
                color: filtro === f.chave ? '#fff' : C.textMain,
              }}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <button
          onClick={reconciliar}
          disabled={reconciliando}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: RAIO_MD,
            border: 'none', background: C.sidebarBg, color: '#fff', fontSize: 12, fontWeight: 700,
            cursor: reconciliando ? 'wait' : 'pointer', opacity: reconciliando ? 0.7 : 1,
          }}
        >
          <FiRefreshCw className={reconciliando ? 'animate-spin' : ''} size={14} />
          {reconciliando ? 'Atualizando...' : `Atualizar pendentes${pendentes > 0 ? ` (${pendentes})` : ''}`}
        </button>
      </div>

      {carregando ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, color: C.textMuted, fontWeight: 600, fontSize: 13 }}>
          <FiLoader className="animate-spin" size={16} /> Carregando histórico...
        </div>
      ) : visiveis.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 13, fontWeight: 500 }}>
          {filtro === 'todas' ? 'Nenhum cupom emitido ainda. As notas aparecem aqui assim que forem emitidas pelo Caixa.' : 'Nenhuma nota neste filtro.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.borderMid}`, textAlign: 'left', color: C.textMuted, textTransform: 'uppercase', fontSize: 10.5, letterSpacing: 0.5 }}>
                <th style={{ padding: '10px 8px' }}>Nº / Série</th>
                <th style={{ padding: '10px 8px' }}>Emitida em</th>
                <th style={{ padding: '10px 8px' }}>O.S.</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Valor</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}>Documentos</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(n => {
                const r = ROTULO_STATUS[n.status] || ROTULO_STATUS.processando;
                return (
                  <tr key={n.id} style={{ borderBottom: `1px solid ${C.borderMid}` }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: C.textMain }}>
                      {n.numero}<span style={{ color: C.textMuted, fontWeight: 500 }}> / {n.serie || '1'}</span>
                    </td>
                    <td style={{ padding: '10px 8px', color: C.textMain }}>
                      {new Date(n.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 8px', color: C.textMuted }}>{n.os_numero || '—'}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: C.textMain }}>
                      {n.valor_total != null ? `R$ ${ptBR(n.valor_total)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: r.cor, background: r.fundo }}>
                        {n.status === 'erro' && <FiAlertCircle size={12} />}
                        {r.texto}
                      </span>
                      {n.status === 'erro' && n.mensagem_erro && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#991B1B', maxWidth: 320 }} title={n.mensagem_erro}>
                          {n.mensagem_erro.length > 90 ? `${n.mensagem_erro.slice(0, 90)}…` : n.mensagem_erro}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {n.status === 'autorizado' ? (
                        <div style={{ display: 'flex', gap: 12 }}>
                          {n.link_danfe && (
                            <a href={n.link_danfe} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.sidebarBg, fontWeight: 700, fontSize: 11.5, textDecoration: 'none' }}>
                              <FiFileText size={13} /> DANFE
                            </a>
                          )}
                          {n.link_xml && (
                            <a href={n.link_xml} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.textMuted, fontWeight: 700, fontSize: 11.5, textDecoration: 'none' }}>
                              <FiDownload size={13} /> XML
                            </a>
                          )}
                        </div>
                      ) : <span style={{ color: C.textMuted }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ margin: '16px 0 0', fontSize: 11, color: C.textMuted, fontWeight: 500 }}>
        O XML de cada nota autorizada deve permanecer disponível por 5 anos — este histórico é o registro oficial das emissões do salão.
      </p>
    </div>
  );
}
