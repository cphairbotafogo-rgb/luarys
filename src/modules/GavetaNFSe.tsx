'use client'
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { inputAdmin, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from "@/components/Toast";
import { FiShield, FiList, FiSettings, FiCheckSquare, FiSend, FiRefreshCw, FiLoader, FiAlertTriangle, FiX, FiExternalLink } from "react-icons/fi";
import { useGuardModulo } from "@/lib/useGuardModulo";
import { BloqueioModulo } from "@/components/BloqueioModulo";
import { ConfiguracaoNFSe } from "@/modules/configuracoes/nfse";
import { lc116Invalido, lc116Valido } from "@/lib/nfse/lc116";

export function GavetaNFSe({ perfil }: any) {
  const toast = useToast();
  const liberado = useGuardModulo(perfil?.salao_id, 'nfse');
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'pendentes' | 'config'>('pendentes');

  // Notas
  const [notasPendentes, setNotasPendentes] = useState<any[]>([]);
  const [notasSelecionadas, setNotasSelecionadas] = useState<string[]>([]);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [verificandoPendentes, setVerificandoPendentes] = useState(false);
  const [novasEmitidas, setNovasEmitidas] = useState(0);
  const buscarNotasPendentesRef = useRef<() => void>(() => {});

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  // '' = todas | 'sem' = sem código LC 116 | 'invalido' = código fora do formato
  const [filtroCodigo, setFiltroCodigo] = useState<'' | 'sem' | 'invalido'>('');
  const [busca, setBusca] = useState('');
  // Correcao de codigo direto nesta tela: antes era preciso sair para
  // Servicos -> Edicao Rapida Fiscal, o que nao resolve as notas ja criadas e
  // e impossivel quando o servico foi excluido do catalogo.
  const [codigoCorrecao, setCodigoCorrecao] = useState('');
  const [corrigindo, setCorrigindo] = useState(false);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    buscarNotasPendentes();
  }, [perfil]);

  async function buscarNotasPendentes() {
    if (!perfil?.salao_id) return;
    const { data, error } = await supabase
      .from('notas_fiscais')
      .select('id, cliente_nome, cliente_cpf, descricao_servico, valor, status, numero_nota, storage_path_pdf, mensagem_erro, data_emissao, item_lista_servico')
      .eq('salao_id', perfil.salao_id)
      // 'Emitida' entra na lista para a nota nao sumir depois de transmitida —
      // era o unico caminho para o PDF e o XML dela, e o usuario ficava sem.
      // Os status legados da migracao ('Emitido', 'AUTORIZADA') tambem entram,
      // senao essas notas ficam invisiveis no sistema.
      .in('status', ['Não Emitido', 'Pendente', 'Erro', 'Emitida', 'Emitido', 'AUTORIZADA'])
      .order('data_emissao', { ascending: false });
    if (error) toast.erro('Erro ao buscar notas: ' + error.message);
    if (data) setNotasPendentes(data);
    setCarregando(false);
  }

  buscarNotasPendentesRef.current = buscarNotasPendentes;

  useEffect(() => {
    if (!perfil?.salao_id) return;
    const canal = supabase.channel(`nfse-${perfil.salao_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notas_fiscais', filter: `salao_id=eq.${perfil.salao_id}` }, (payload) => {
        const nova = payload.new as any;
        const anterior = payload.old as any;
        if (anterior.status === nova.status) return;
        if (nova.status === 'Emitida') {
          const num = nova.numero_nota ? ` nº ${nova.numero_nota}` : '';
          toast.sucesso(`NFS-e${num} emitida — ${nova.cliente_nome}`, 8000);
          setNovasEmitidas(n => n + 1);
          buscarNotasPendentesRef.current();
        }
        if (nova.status === 'Erro') {
          const motivo = nova.mensagem_erro ? `: ${nova.mensagem_erro}` : '.';
          toast.erro(`Erro na NFS-e de ${nova.cliente_nome}${motivo}`, 10000);
          buscarNotasPendentesRef.current();
        }
      }).subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [perfil?.salao_id]);

  async function abrirPdf(notaId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { toast.erro('Sessão expirada.'); return; }
    try {
      const resp = await fetch(`/api/nfse/arquivo/${notaId}?tipo=nfse&arquivo=pdf`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const json = await resp.json();
      if (!resp.ok) { toast.erro(json.erro || 'Erro ao abrir o PDF.'); return; }
      window.open(json.url, '_blank');
    } catch (e: any) { toast.erro('Erro de conexão: ' + e.message); }
  }

  async function verificarStatusPendentes() {
    const pendentes = notasPendentes.filter(n => n.status === 'Pendente');
    if (pendentes.length === 0) { toast.aviso('Não há notas em processamento no momento.'); return; }
    setVerificandoPendentes(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { toast.erro('Sessão expirada.'); setVerificandoPendentes(false); return; }
    let emitidas = 0, erros = 0;
    for (const nota of pendentes) {
      try {
        const resp = await fetch(`/api/nfse/consultar/${nota.id}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        // A rota devolve o ResultadoEmissao cru do adaptador ('autorizado'/'processando'/'erro'),
        // não os status em pt-BR da coluna notas_fiscais.status ('Emitida'/'Erro') — bug pré-existente
        // que fazia esses contadores nunca incrementarem, mesmo com a prefeitura respondendo.
        if (resp.ok) { const json = await resp.json(); if (json.status === 'autorizado') emitidas++; if (json.status === 'erro') erros++; }
      } catch { /* permanece Pendente */ }
    }
    setVerificandoPendentes(false);
    await buscarNotasPendentes();
    if (emitidas > 0) toast.sucesso(`${emitidas} nota(s) confirmada(s) pela prefeitura!`);
    else if (erros > 0) toast.erro(`${erros} nota(s) rejeitada(s) pela prefeitura.`);
    else toast.info(`${pendentes.length} nota(s) ainda em processamento.`);
  }

  // Nota rejeitada tem de poder ser retransmitida depois de corrigida — antes
  // so 'Não Emitido' era selecionavel, entao uma recusa da prefeitura virava
  // beco sem saida: nao dava para cancelar nem reenviar. 'Pendente' fica de
  // fora de proposito: ja esta em processamento na prefeitura e reenviar
  // duplicaria a nota.
  const podeTransmitir = (status: string | null | undefined) =>
    status === 'Não Emitido' || status === 'Erro';

  /** Ja emitida: nao entra na contagem de pendencias nem pode ser retransmitida. */
  const jaEmitida = (status: string | null | undefined) =>
    status === 'Emitida' || status === 'Emitido' || status === 'AUTORIZADA';

  // Declarados aqui, acima do primeiro uso: como sao const, usa-los antes da
  // linha de declaracao estoura ReferenceError em runtime (temporal dead zone)
  // mesmo com o tsc passando, porque a chamada acontece dentro de callback.

  // Filtro client-side (status + texto + período)
  const normalizar = (s: string) => (s || '').toLowerCase();
  const notasFiltradasBase = notasPendentes.filter(n => {
    // O filtro 'Emitida' cobre tambem os status legados da migracao, senao a
    // nota emitida antes do sistema atual nao apareceria em lugar nenhum.
    if (filtroStatus === 'Emitida' ? !jaEmitida(n.status) : (filtroStatus && n.status !== filtroStatus)) return false;
    if (busca) {
      const b = normalizar(busca);
      if (!normalizar(n.cliente_nome).includes(b) && !normalizar(n.descricao_servico).includes(b)) return false;
    }
    if (dataInicio && n.data_emissao && n.data_emissao.slice(0, 10) < dataInicio) return false;
    if (dataFim && n.data_emissao && n.data_emissao.slice(0, 10) > dataFim) return false;
    return true;
  });

  // O campo item_lista_servico tem de levar o código da LC 116 ("06.01"): dois
  // dígitos, ponto, dois dígitos. O fechamento de conta vinha gravando ali o NBS
  // do serviço ("126021000", 9 dígitos), que é outra taxonomia — a prefeitura
  // recusa no schema ("cTribNac ... Pattern constraint failed"). Por isso não
  // basta checar se o campo está vazio: preenchido com o código errado é PIOR
  // que vazio, porque vazio cai no padrão 06.01 e passa.
  const codigoInvalido = (n: typeof notasPendentes[number]) => lc116Invalido(n.item_lista_servico);

  const notasFiltradas = filtroCodigo === 'sem'
    ? notasFiltradasBase.filter(n => !n.item_lista_servico)
    : filtroCodigo === 'invalido'
      ? notasFiltradasBase.filter(codigoInvalido)
      : notasFiltradasBase;

  const valorPeriodo = notasFiltradas.reduce((s, n) => s + Number(n.valor || 0), 0);
  const valorSelecionado = notasSelecionadas.reduce((s, id) => s + Number(notasPendentes.find(n => n.id === id)?.valor || 0), 0);
  // Contagens sempre sobre a base, senão filtrar pelo aviso zeraria o próprio aviso.
  // Avisos de codigo so valem para nota que ainda vai ser transmitida.
  const semCodigoFiscal = notasFiltradasBase.filter(n => !jaEmitida(n.status) && !n.item_lista_servico).length;
  const comCodigoInvalido = notasFiltradasBase.filter(n => !jaEmitida(n.status) && codigoInvalido(n)).length;

  const toggleNota = (id: string) => {
    setNotasSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selecionarTodas = () => {
    const elegiveisIds = notasFiltradas.filter(n => podeTransmitir(n.status)).map(n => n.id);
    const todasSelecionadas = elegiveisIds.length > 0 && elegiveisIds.every(id => notasSelecionadas.includes(id));
    setNotasSelecionadas(todasSelecionadas ? [] : elegiveisIds);
  };

  async function aplicarCorrecaoCodigo() {
    const codigo = codigoCorrecao.trim();
    if (notasSelecionadas.length === 0) { toast.aviso('Selecione as notas a corrigir.'); return; }
    if (!lc116Valido(codigo)) {
      toast.aviso('Código inválido. São 6 dígitos, sem ponto — ex: 060101.');
      return;
    }
    setCorrigindo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.erro('Sessão expirada.'); return; }
      const resp = await fetch('/api/nfse/corrigir-codigo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ nota_ids: notasSelecionadas, item_lista_servico: codigo }),
      });
      const json = await resp.json();
      if (!resp.ok) { toast.erro(json.erro || 'Erro ao corrigir.'); return; }
      toast.sucesso(`${json.atualizadas} nota(s) corrigida(s) para ${codigo}.`);
      if (json.aviso) toast.aviso(json.aviso);
      setCodigoCorrecao('');
      await buscarNotasPendentes();
    } catch (e: any) {
      toast.erro('Erro de conexão: ' + e.message);
    } finally {
      setCorrigindo(false);
    }
  }

  const dispararLoteSelecionado = async () => {
    if (notasSelecionadas.length === 0) { toast.aviso('Selecione ao menos uma nota.'); return; }

    // Trava antes de enviar: código fora do formato da LC 116 é recusa certa na
    // prefeitura. Antes o lote seguia, a nota voltava como "Erro" e o usuário só
    // descobria depois — e, num lote grande, uma nota ruim sujava o resultado
    // inteiro. Bloqueia o lote todo e mostra quais corrigir.
    const invalidas = notasSelecionadas
      .map(id => notasPendentes.find(n => n.id === id))
      .filter((n): n is NonNullable<typeof n> => !!n && codigoInvalido(n));

    if (invalidas.length > 0) {
      const nomes = invalidas.slice(0, 3).map(n => n.cliente_nome).join(', ');
      const resto = invalidas.length > 3 ? ` e mais ${invalidas.length - 3}` : '';
      toast.erro(
        `${invalidas.length} nota(s) com código fiscal inválido (${nomes}${resto}). ` +
        'Nada foi enviado. Corrija o código em Serviços → Edição Rápida Fiscal.'
      );
      setFiltroCodigo('invalido');
      return;
    }

    setProcessandoLote(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.erro('Sessão expirada. Faça login novamente.'); return; }
      const resp = await fetch('/api/nfse/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ nota_ids: notasSelecionadas }),
      });
      const json = await resp.json();
      if (!resp.ok) { toast.erro(json.erro || 'Erro ao transmitir notas.'); return; }
      const resultados: Record<string, any> = json.resultados || {};
      const emitidas = Object.values(resultados).filter((r: any) => r.status === 'Emitida').length;
      const pendentes = Object.values(resultados).filter((r: any) => r.status === 'Pendente').length;
      const erros = Object.values(resultados).filter((r: any) => r.status === 'Erro').length;
      if (emitidas > 0) toast.sucesso(`${emitidas} nota(s) emitida(s) com sucesso!`);
      if (pendentes > 0) toast.aviso(`${pendentes} nota(s) em processamento na prefeitura.`);
      if (erros > 0) toast.erro(`${erros} nota(s) com erro — verifique as configurações fiscais.`);
      setNotasSelecionadas([]);
      await buscarNotasPendentes();
    } catch (e: any) { toast.erro('Erro de conexão: ' + e.message); }
    finally { setProcessandoLote(false); }
  };

const inputStyle = { ...inputAdmin };
  const tabButtonStyle = (ativa: boolean) => ({ padding: "12px 24px", background: ativa ? C.sidebarBg : "transparent", color: ativa ? "#fff" : C.textLight, border: "none", borderRadius: RAIO_MD, fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8 });
  const statusPillStyle = (ativo: boolean, cor: string) => ({ padding: "7px 14px", background: ativo ? cor : C.bg, color: ativo ? "#fff" : C.textMuted, border: `1px solid ${ativo ? cor : C.borderMid}`, borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "0.2s" });

  if (liberado === null) return <div style={{ padding: 40, color: C.textLight, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><FiLoader className="animate-spin" size={16} /> Verificando acesso...</div>;
  if (!liberado) return <BloqueioModulo salaoId={perfil?.salao_id} moduloChave="nfse" nome="NFS-e — Nota Fiscal de Serviço" descricao="Emita NFS-e automaticamente ao fechar a conta, sem papel e sem retrabalho." preco={49.90} itens={['Emissão automática ou em lote', 'Integração direta com a Brasil NFe', 'Consulta de status em tempo real', 'Histórico de notas emitidas', 'Cancelamento online']} />;
  if (carregando) return <div style={{ padding: 40, color: C.textLight, fontWeight: 700 }}>A sincronizar painel fiscal...</div>;

  return (
    <div style={{ animation: "fadeIn 0.2s ease-out", paddingBottom: 40 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase" }}>
            <FiShield size={20} /> Central de Emissão NFS-e
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>Gestão de notas fiscais de serviço, processamento em lote e configurações da prefeitura.</p>
        </div>
      </div>

      <div style={{ background: C.bgCard, padding: 8, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, marginBottom: 24, display: "flex", gap: 8 }}>
        <button style={tabButtonStyle(abaAtiva === 'pendentes')} onClick={() => setAbaAtiva('pendentes')}>
          <FiList size={16} /> Pendentes para Emissão
          {notasPendentes.filter(n => !jaEmitida(n.status)).length > 0 && <span style={{ background: abaAtiva === 'pendentes' ? C.bgCard : C.sidebarBg, color: abaAtiva === 'pendentes' ? C.sidebarBg : C.bgCard, padding: "2px 8px", borderRadius: RAIO_XL, fontSize: 10 }}>{notasPendentes.filter(n => !jaEmitida(n.status)).length}</span>}
        </button>
        <button style={tabButtonStyle(abaAtiva === 'config')} onClick={() => setAbaAtiva('config')}>
          <FiSettings size={16} /> Configurações Tributárias
        </button>
      </div>

      {/* ─── ABA 1: NOTAS PENDENTES ─── */}
      {abaAtiva === 'pendentes' && (
        <div>

          {/* ── Filtros ── */}
          <div style={{ background: C.bgCard, padding: "16px 20px", borderRadius: RAIO_XL, border: `1px solid ${C.border}`, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              {/* Período */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Período</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ ...inputStyle, width: 140, padding: "8px 10px" }} />
                  <span style={{ fontSize: 11, color: C.textLight }}>até</span>
                  <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ ...inputStyle, width: 140, padding: "8px 10px" }} />
                </div>
              </div>
              {/* Status */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Status</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setFiltroStatus(filtroStatus === 'Não Emitido' ? '' : 'Não Emitido')} style={statusPillStyle(filtroStatus === 'Não Emitido', C.sidebarBg)}>Não Emitido</button>
                  <button onClick={() => setFiltroStatus(filtroStatus === 'Pendente' ? '' : 'Pendente')} style={statusPillStyle(filtroStatus === 'Pendente', '#D97706')}>Processando</button>
                  <button onClick={() => setFiltroStatus(filtroStatus === 'Erro' ? '' : 'Erro')} style={statusPillStyle(filtroStatus === 'Erro', '#EF4444')}>Rejeitado</button>
                  <button onClick={() => setFiltroStatus(filtroStatus === 'Emitida' ? '' : 'Emitida')} style={statusPillStyle(filtroStatus === 'Emitida', '#16A34A')}>Emitida</button>
                </div>
              </div>
              {/* Busca */}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginBottom: 6 }}>Cliente ou Serviço</div>
                <div style={{ position: "relative" }}>
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou serviço..." style={{ ...inputStyle, width: "100%", paddingRight: busca ? 32 : undefined }} />
                  {busca && <button onClick={() => setBusca('')} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex" }}><FiX size={14} /></button>}
                </div>
              </div>
              {/* Limpar */}
              {(dataInicio || dataFim || filtroStatus || busca) && (
                <button onClick={() => { setDataInicio(''); setDataFim(''); setFiltroStatus(''); setBusca(''); }} style={{ background: "none", color: C.textMuted, border: `1px solid ${C.borderMid}`, padding: "8px 14px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" }}>
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {/* ── Totais ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12, marginBottom: 16 }}>
            {[
              { label: "Total no período", value: String(notasFiltradas.length) + " nota(s)" },
              { label: "Valor no período", value: brl(valorPeriodo) },
              { label: "Selecionadas", value: String(notasSelecionadas.length) + " nota(s)" },
              { label: "Valor selecionado", value: brl(valorSelecionado) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: C.bgCard, padding: "12px 16px", borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.sidebarBg, marginTop: 4 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── Avisos de código fiscal — clicáveis, filtram a lista abaixo ──
              O aviso de código INVÁLIDO vem primeiro por ser o problema grave:
              essas notas são recusadas pela prefeitura. O de código ausente é
              apenas informativo (cai no padrão 06.01 e é aceito). */}
          {comCodigoInvalido > 0 && (
            <button
              onClick={() => setFiltroCodigo(filtroCodigo === 'invalido' ? '' : 'invalido')}
              title="Clique para ver apenas estas notas"
              style={{ width: "100%", textAlign: "left", cursor: "pointer", background: filtroCodigo === 'invalido' ? "#FCA5A5" : "#FEE2E2", border: `1px solid ${filtroCodigo === 'invalido' ? "#B91C1C" : "#EF4444"}`, borderRadius: RAIO_MD, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <FiAlertTriangle size={16} color="#B91C1C" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#7F1D1D", fontWeight: 700 }}>
                {comCodigoInvalido} nota(s) com código fiscal fora do formato da LC 116 — serão <u>recusadas</u> pela prefeitura. O código correto tem o formato 06.01.
                {' '}<u>{filtroCodigo === 'invalido' ? 'Mostrando só estas — clique para ver todas.' : 'Clique para ver quais são.'}</u>
              </span>
            </button>
          )}

          {semCodigoFiscal > 0 && (
            <button
              onClick={() => setFiltroCodigo(filtroCodigo === 'sem' ? '' : 'sem')}
              title="Clique para ver apenas estas notas"
              style={{ width: "100%", textAlign: "left", cursor: "pointer", background: filtroCodigo === 'sem' ? "#FDE68A" : "#FEF3C7", border: `1px solid ${filtroCodigo === 'sem' ? "#B45309" : "#F59E0B"}`, borderRadius: RAIO_MD, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <FiAlertTriangle size={16} color="#D97706" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                {semCodigoFiscal} nota(s) sem código fiscal (LC 116) — serão emitidas com o código padrão 06.01. Configure o código por serviço em Serviços → Edição Rápida Fiscal.
                {' '}<u>{filtroCodigo === 'sem' ? 'Mostrando só estas — clique para ver todas.' : 'Clique para ver quais são.'}</u>
              </span>
            </button>
          )}

          {/* ── Tabela + header de ação ── */}
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", background: C.bg, borderBottom: `1px solid ${C.borderMid}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8 }}>
                  <FiCheckSquare size={18} /> Seleção de Lote
                  {novasEmitidas > 0 && <span style={{ background: C.success, color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20 }}>{novasEmitidas} nova(s)</span>}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>
                  {"Selecione as notas para emitir em lote ou aguarde o modo automático ao fechar conta."}
                </p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {notasPendentes.some(n => n.status === 'Pendente') && (
                  <button onClick={verificarStatusPendentes} disabled={verificandoPendentes} title="Consultar situação das notas em processamento na prefeitura"
                    style={{ background: C.bgCard, color: C.sidebarBg, border: `1px solid ${C.borderMid}`, padding: "12px 16px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: verificandoPendentes ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", opacity: verificandoPendentes ? 0.6 : 1 }}>
                    <FiRefreshCw size={14} style={{ animation: verificandoPendentes ? "spin 1s linear infinite" : "none" }} />
                    {verificandoPendentes ? "Consultando..." : "Verificar Status"}
                  </button>
                )}
                {notasSelecionadas.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "6px 10px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, whiteSpace: "nowrap" }}>Corrigir código:</span>
                    <input
                      list="lc116-sugestoes"
                      value={codigoCorrecao}
                      onChange={e => setCodigoCorrecao(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="060101"
                      style={{ width: 92, padding: "6px 8px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontFamily: "monospace" }} />
                    <datalist id="lc116-sugestoes">
                      <option value="060101">Cabeleireiros, barbeiros, manicuros, pedicuros</option>
                      <option value="060201">Esteticistas, tratamento de pele, depilação</option>
                    </datalist>
                    <button onClick={aplicarCorrecaoCodigo} disabled={corrigindo || !codigoCorrecao}
                      style={{ background: codigoCorrecao ? C.sidebarBg : C.borderMid, color: "#fff", border: "none", padding: "7px 12px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 800, cursor: (corrigindo || !codigoCorrecao) ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                      {corrigindo ? 'Aplicando...' : `Aplicar (${notasSelecionadas.length})`}
                    </button>
                  </div>
                )}
                <button onClick={dispararLoteSelecionado} disabled={processandoLote || notasSelecionadas.length === 0}
                  style={{ background: notasSelecionadas.length > 0 ? C.sidebarBg : C.borderMid, color: "#fff", border: "none", padding: "12px 20px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: (processandoLote || notasSelecionadas.length === 0) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", transition: "0.2s", opacity: (processandoLote || notasSelecionadas.length === 0) ? 0.65 : 1 }}>
                  {processandoLote ? <><FiSend size={16} /> Transmitindo...</> : <><FiSend size={16} /> Transmitir {notasSelecionadas.length > 0 ? `(${notasSelecionadas.length})` : 'Selecionadas'}</>}
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto", maxHeight: "500px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead style={{ position: "sticky", top: 0, background: C.bgCard, zIndex: 1, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                  <tr>
                    <th style={{ padding: "14px 20px", width: 40 }}>
                      <input type="checkbox"
                        onChange={selecionarTodas}
                        checked={notasFiltradas.filter(n => podeTransmitir(n.status)).length > 0 && notasFiltradas.filter(n => podeTransmitir(n.status)).every(n => notasSelecionadas.includes(n.id))}
                        style={{ accentColor: C.sidebarBg, width: 16, height: 16, cursor: "pointer" }} />
                    </th>
                    {(['Movimentação','Cliente','Serviços Realizados','Status','Cód. Fiscal'] as const).map(h => (
                      <th key={h} style={{ padding: "14px 0", fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>{h}</th>
                    ))}
                    <th style={{ padding: "14px 20px", fontSize: 10, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", textAlign: "right" }}>Valor (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {notasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: C.textMuted, fontSize: 13, fontWeight: 500 }}>
                        {notasPendentes.length === 0
                          ? "Nenhuma nota pendente de emissão no momento."
                          : "Nenhuma nota encontrada para os filtros selecionados."}
                      </td>
                    </tr>
                  ) : notasFiltradas.map((nota) => {
                    const dataMovimentacao = nota.data_emissao
                      ? new Date(nota.data_emissao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '—';
                    const temCodigoFiscal = !!nota.item_lista_servico;
                    return (
                      <tr key={nota.id} onClick={() => podeTransmitir(nota.status) && toggleNota(nota.id)}
                        style={{ borderBottom: `1px solid ${C.border}`, cursor: podeTransmitir(nota.status) ? "pointer" : "default", background: notasSelecionadas.includes(nota.id) ? "#F0FDF4" : "transparent", transition: "0.2s" }}>
                        <td style={{ padding: "14px 20px" }}>
                          {podeTransmitir(nota.status) && <input type="checkbox" checked={notasSelecionadas.includes(nota.id)} readOnly style={{ accentColor: "#10B981", width: 16, height: 16, cursor: "pointer" }} />}
                        </td>
                        <td style={{ padding: "14px 0", fontSize: 11, color: C.textLight, whiteSpace: "nowrap" }}>{dataMovimentacao}</td>
                        <td style={{ padding: "14px 0" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>{nota.cliente_nome}</div>
                          {nota.cliente_cpf && <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>CPF: {nota.cliente_cpf}</div>}
                        </td>
                        <td style={{ padding: "14px 0", fontSize: 12, color: C.textMain, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nota.descricao_servico}</td>
                        <td style={{ padding: "14px 0" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 800, background: nota.status === 'Erro' ? "#FEE2E2" : nota.status === 'Pendente' ? "#FEF9C3" : jaEmitida(nota.status) ? "#DCFCE7" : "#F1F5F9", color: nota.status === 'Erro' ? C.danger : nota.status === 'Pendente' ? "#92400E" : jaEmitida(nota.status) ? "#166534" : C.textMuted, display: "inline-block" }}>
                              {nota.status}
                            </span>
                            {nota.storage_path_pdf && <button onClick={e => { e.stopPropagation(); abrirPdf(nota.id); }} title="Abrir PDF da nota" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.sidebarBg, display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}><FiExternalLink size={11} /> PDF</button>}
                            {nota.status === 'Erro' && nota.mensagem_erro && <p style={{ margin: 0, fontSize: 10, color: C.danger, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={nota.mensagem_erro}>{nota.mensagem_erro}</p>}
                          </div>
                        </td>
                        <td style={{ padding: "14px 0" }}>
                          {/* Verde só quando o código está no formato da LC 116.
                              Preenchido mas fora do formato aparece em vermelho:
                              antes vinha verde e passava a impressão de estar
                              certo, quando é justamente o que a prefeitura
                              recusa. */}
                          {codigoInvalido(nota)
                            ? <span title={`Código inválido para a LC 116: ${nota.item_lista_servico} — o formato esperado é 06.01`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: "#B91C1C" }}><FiAlertTriangle size={12} /> {nota.item_lista_servico}</span>
                            : temCodigoFiscal
                              ? <span title={`Código LC 116: ${nota.item_lista_servico}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#4F9D6E" }}><FiShield size={12} /> {nota.item_lista_servico}</span>
                              : <span title="Sem código fiscal — usando padrão 06.01" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#D97706" }}><FiAlertTriangle size={12} /> Padrão</span>
                          }
                        </td>
                        <td style={{ padding: "14px 20px", textAlign: "right", fontWeight: 800, color: C.textMain }}>{brl(Number(nota.valor) || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── ABA 2: CONFIGURAÇÕES FISCAIS ─── */}
      {abaAtiva === 'config' && (
        <ConfiguracaoNFSe perfil={perfil} onEmitirNotas={() => setAbaAtiva('pendentes')} />
      )}
    </div>
  );
}
