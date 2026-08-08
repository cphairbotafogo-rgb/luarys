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
  storage_path_danfe: string | null;
  storage_path_xml: string | null;
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

  // Mesmo princípio da tela de NFS-e: abre no mês vigente, para não despejar o
  // histórico inteiro. Aqui o status padrão continua 'todas' de propósito — a
  // NFC-e é emitida na hora da venda, então não existe fila de "por emitir";
  // esta tela é consulta, e filtrar por erro esconderia o normal.
  //
  // Data em horário local, não toISOString(): no fuso do Brasil o ISO devolve o
  // dia seguinte a partir das 21h, e o mês viraria antes da hora.
  const mesVigente = (() => {
    const h = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      inicio: iso(new Date(h.getFullYear(), h.getMonth(), 1)),
      fim: iso(new Date(h.getFullYear(), h.getMonth() + 1, 0)),
    };
  })();
  const [dataInicio, setDataInicio] = useState(mesVigente.inicio);
  const [dataFim, setDataFim] = useState(mesVigente.fim);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('nfce_emissoes')
      .select('id, referencia, numero, serie, status, chave_acesso, storage_path_danfe, storage_path_xml, mensagem_erro, valor_total, os_numero, criado_em')
      .eq('salao_id', salaoId)
      // Filtra no banco, não na tela. O `limit(200)` que existia aqui cortava em
      // silêncio: salão movimentado perdia o começo do mês sem nenhum aviso, e
      // não havia como alcançar o que ficou de fora. O teto continua, mas alto o
      // bastante para um mês inteiro, e agora é o período que manda.
      .gte('criado_em', `${dataInicio}T00:00:00`)
      .lte('criado_em', `${dataFim}T23:59:59`)
      .order('criado_em', { ascending: false })
      .limit(2000);
    if (error) {
      console.error('Erro ao carregar histórico de NFC-e:', error.message);
      toast('Não foi possível carregar o histórico de cupons.', 'erro');
    }
    setNotas(data || []);
    setCarregando(false);
  }, [salaoId, toast, dataInicio, dataFim]);

  useEffect(() => { if (salaoId) carregar(); }, [salaoId, carregar]);

  // Pendentes contam FORA do período, de propósito.
  //
  // Se contasse só o que está na lista, um cupom travado em 'processando' do mês
  // passado sumiria junto com o filtro — e é justamente o que não pode sumir:
  // cupom em processamento é venda que a SEFAZ ainda não confirmou. O botão
  // "Atualizar pendentes" tem de enxergar todos, senão ele mente que está tudo
  // certo.
  const [pendentes, setPendentes] = useState(0);
  const contarPendentes = useCallback(async () => {
    const { count } = await supabase
      .from('nfce_emissoes')
      .select('id', { count: 'exact', head: true })
      .eq('salao_id', salaoId)
      .eq('status', 'processando');
    setPendentes(count || 0);
  }, [salaoId]);
  useEffect(() => { if (salaoId) contarPendentes(); }, [salaoId, contarPendentes, notas]);

  const pendentesForaDoPeriodo = Math.max(0, pendentes - notas.filter(n => n.status === 'processando').length);

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

  const abrirArquivo = async (referencia: string, arquivo: 'danfe' | 'xml') => {
    try {
      const token = await getAuthToken();
      const resp = await fetch(`/api/nfse/arquivo/${referencia}?tipo=nfce&arquivo=${arquivo}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await resp.json();
      if (!resp.ok) { toast(json.erro || 'Erro ao abrir o arquivo.', 'erro'); return; }
      window.open(json.url, '_blank');
    } catch {
      toast('Falha de conexão ao abrir o arquivo.', 'erro');
    }
  };

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Período primeiro: é ele que define o volume da lista. Sem isto a
              tela carregava as últimas 200 e cortava em silêncio. */}
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            title="Início do período"
            style={{ padding: '6px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.textMain }} />
          <span style={{ fontSize: 12, color: C.textMuted }}>até</span>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            title="Fim do período"
            style={{ padding: '6px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, color: C.textMain }} />
          {(dataInicio !== mesVigente.inicio || dataFim !== mesVigente.fim) && (
            <button onClick={() => { setDataInicio(mesVigente.inicio); setDataFim(mesVigente.fim); }}
              title="Voltar ao mês vigente"
              style={{ padding: '6px 10px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Mês atual
            </button>
          )}
          <span style={{ width: 1, height: 22, background: C.borderMid, margin: '0 4px' }} />
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

      {/* O contador é global, a lista é do período. Sem este aviso o salão veria
          "Atualizar pendentes (3)" e nenhuma nota em processamento na tela —
          concluiria que o número está errado, quando o certo é procurar noutro
          mês. Cupom preso em processamento é venda que a SEFAZ não confirmou. */}
      {pendentesForaDoPeriodo > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 16, borderRadius: RAIO_MD, background: '#FFFBEB', border: '1px solid #FCD34D', fontSize: 12, color: '#92400E', fontWeight: 600 }}>
          <FiAlertCircle size={14} />
          {pendentesForaDoPeriodo === 1
            ? 'Há 1 cupom em processamento fora do período mostrado.'
            : `Há ${pendentesForaDoPeriodo} cupons em processamento fora do período mostrado.`}
          <button onClick={() => { setFiltro('processando'); setDataInicio('2020-01-01'); setDataFim(mesVigente.fim); }}
            style={{ background: 'none', border: 'none', padding: 0, color: '#92400E', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
            Ver todos
          </button>
        </div>
      )}

      {carregando ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, color: C.textMuted, fontWeight: 600, fontSize: 13 }}>
          <FiLoader className="animate-spin" size={16} /> Carregando histórico...
        </div>
      ) : visiveis.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 13, fontWeight: 500 }}>
          {/* "Nenhum cupom emitido ainda" mentiria agora: a lista é do período,
              e pode haver cupom em outro mês. A mensagem tem de dizer onde
              procurou, senão o salão conclui que perdeu as notas. */}
          {filtro !== 'todas'
            ? 'Nenhuma nota neste filtro. Tente "Todas" ou mude o período.'
            : (dataInicio === mesVigente.inicio && dataFim === mesVigente.fim)
              ? `Nenhum cupom em ${new Date(mesVigente.inicio + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}. Mude o período acima para ver outros meses — os cupons aparecem aqui assim que são emitidos pelo Caixa.`
              : 'Nenhum cupom no período selecionado.'}
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
                          {n.storage_path_danfe && (
                            <button onClick={() => abrirArquivo(n.referencia, 'danfe')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, color: C.sidebarBg, fontWeight: 700, fontSize: 11.5 }}>
                              <FiFileText size={13} /> DANFE
                            </button>
                          )}
                          {n.storage_path_xml && (
                            <button onClick={() => abrirArquivo(n.referencia, 'xml')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, color: C.textMuted, fontWeight: 700, fontSize: 11.5 }}>
                              <FiDownload size={13} /> XML
                            </button>
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
