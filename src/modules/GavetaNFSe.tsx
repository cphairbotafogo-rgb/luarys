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
  // Codigo municipal tambem e corrigivel aqui: cada item da LC 116 tem o seu no
  // municipio, e a rejeicao E0314 vem justamente dele estar errado para aquele
  // servico — nao adianta so acertar o nacional.
  const [codigoMunCorrecao, setCodigoMunCorrecao] = useState('');
  const [corrigindo, setCorrigindo] = useState(false);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [progressoLote, setProgressoLote] = useState('');
  // Prazo de cancelamento configurado pelo salao (config_fiscal). Null = sem
  // aviso: nao ha padrao seguro, o prazo varia por prefeitura.
  const [prazoCancelamentoDias, setPrazoCancelamentoDias] = useState<number | null>(null);
  // Janela de emissao configurada pelo salao. Null = sem aviso.
  const [prazoEmissaoDias, setPrazoEmissaoDias] = useState<number | null>(null);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    buscarNotasPendentes();
  }, [perfil]);

  async function buscarNotasPendentes() {
    if (!perfil?.salao_id) return;
    const { data, error } = await supabase
      .from('notas_fiscais')
      .select('id, cliente_nome, cliente_cpf, descricao_servico, valor, status, numero_nota, storage_path_pdf, mensagem_erro, data_emissao, data_movimentacao, item_lista_servico')
      .eq('salao_id', perfil.salao_id)
      // 'Emitida' entra na lista para a nota nao sumir depois de transmitida —
      // era o unico caminho para o PDF e o XML dela, e o usuario ficava sem.
      // Os status legados da migracao ('Emitido', 'AUTORIZADA') tambem entram,
      // senao essas notas ficam invisiveis no sistema.
      .in('status', ['Não Emitido', 'Pendente', 'Erro', 'Emitida', 'Emitido', 'AUTORIZADA', 'Dispensada'])
      .order('data_emissao', { ascending: false });
    if (error) toast.erro('Erro ao buscar notas: ' + error.message);
    if (data) setNotasPendentes(data);

    const { data: cfgSalao } = await supabase
      .from('saloes').select('config_fiscal').eq('id', perfil.salao_id).maybeSingle();
    const prazo = Number(cfgSalao?.config_fiscal?.prazo_cancelamento_dias);
    setPrazoCancelamentoDias(Number.isFinite(prazo) && prazo > 0 ? prazo : null);
    const prazoEmi = Number(cfgSalao?.config_fiscal?.prazo_emissao_dias);
    setPrazoEmissaoDias(Number.isFinite(prazoEmi) && prazoEmi > 0 ? prazoEmi : null);
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

  /**
   * Dispensada: servico sem receita (pacote ja pago, cortesia, avaliacao). Fica
   * visivel para nao sumir do historico, mas nao e pendencia — nao ha nota a
   * emitir, e a prefeitura recusaria de qualquer forma.
   */
  const dispensada = (status: string | null | undefined) => status === 'Dispensada';

  /** Nao esta esperando nenhuma acao do salao. */
  const semPendencia = (status: string | null | undefined) => jaEmitida(status) || dispensada(status);

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
  const semCodigoFiscal = notasFiltradasBase.filter(n => !semPendencia(n.status) && !n.item_lista_servico).length;
  const comCodigoInvalido = notasFiltradasBase.filter(n => !semPendencia(n.status) && codigoInvalido(n)).length;

  const toggleNota = (id: string) => {
    setNotasSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selecionarTodas = () => {
    const elegiveisIds = notasFiltradas.filter(n => podeTransmitir(n.status)).map(n => n.id);
    const todasSelecionadas = elegiveisIds.length > 0 && elegiveisIds.every(id => notasSelecionadas.includes(id));
    setNotasSelecionadas(todasSelecionadas ? [] : elegiveisIds);
  };

  /**
   * Cancela uma NFS-e ja emitida na prefeitura.
   *
   * Ate aqui isso so existia embutido no estorno da venda (Financeiro), entao
   * cancelar uma nota emitida por engano — sem querer desfazer a venda —
   * simplesmente nao tinha caminho.
   *
   * O cancelamento tem prazo legal, que varia por municipio. Vencido o prazo a
   * prefeitura recusa e o caminho passa a ser nota de substituicao, com o
   * contador. Por isso o erro do provedor e mostrado na integra: e ele que diz
   * se o problema foi prazo, e nao adianta o sistema adivinhar.
   */
  /**
   * Baixa num zip os XMLs do mes — o pacote que o contador pede toda virada de
   * mes. Sem isto so havia download nota a nota, inviavel com centenas delas.
   */
  async function exportarXmlDoMes() {
    const hoje = new Date();
    const ref = window.prompt(
      'Exportar os XML das notas emitidas em qual mês?\n\nInforme no formato MM/AAAA:',
      `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`,
    );
    if (!ref) return;
    const [mesStr, anoStr] = ref.split('/');
    const mes = Number(mesStr), ano = Number(anoStr);
    if (!(mes >= 1 && mes <= 12) || !(ano >= 2020)) {
      toast.aviso('Período inválido. Use MM/AAAA — ex: 08/2026.');
      return;
    }

    setExportando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.erro('Sessão expirada.'); return; }
      const resp = await fetch(`/api/nfse/exportar-xml?mes=${mes}&ano=${ano}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        toast.aviso(json?.erro || 'Não foi possível exportar.');
        return;
      }
      // Baixa via blob para o navegador respeitar o Content-Disposition mesmo
      // com o header de autorizacao (link direto nao carrega o token).
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NFSe-${ano}-${String(mes).padStart(2, '0')}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.sucesso('Download iniciado.');
    } catch (e: any) {
      toast.erro('Erro ao exportar: ' + e.message);
    } finally {
      setExportando(false);
    }
  }

  async function cancelarNota(nota: any) {
    // Aviso preventivo, nunca bloqueio. Se o salao configurou o prazo da sua
    // prefeitura, avisamos quando ja passou — mas deixamos tentar assim mesmo,
    // porque existem excecoes (processo administrativo) e porque quem decide de
    // verdade e a prefeitura no momento da tentativa, nao a nossa conta de dias.
    let avisoPrazo = '';
    if (prazoCancelamentoDias && nota.data_emissao) {
      const dias = Math.floor((Date.now() - new Date(nota.data_emissao).getTime()) / 86400000);
      if (dias > prazoCancelamentoDias) {
        avisoPrazo =
          `

ATENÇÃO: esta nota foi emitida há ${dias} dias, acima do prazo de ` +
          `${prazoCancelamentoDias} dias configurado para a sua prefeitura. O cancelamento ` +
          'automático provavelmente será recusado — nesse caso, o caminho é nota de ' +
          'substituição ou processo administrativo, com seu contador. Você pode tentar mesmo assim.';
      }
    }

    const justificativa = window.prompt(
      `Cancelar a NFS-e nº ${nota.numero_nota ?? ''} de ${nota.cliente_nome}?` + avisoPrazo + '\n\n' +
      'Descreva o motivo (mínimo 15 caracteres — exigência da prefeitura):',
      '',
    );
    if (justificativa === null) return;
    if (justificativa.trim().length < 15) {
      toast.aviso('A justificativa precisa ter pelo menos 15 caracteres.');
      return;
    }

    setCancelandoId(nota.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.erro('Sessão expirada.'); return; }
      const resp = await fetch(`/api/nfse/cancelar/${nota.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ justificativa: justificativa.trim() }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.sucesso === false) {
        toast.erro(json?.erro || 'A prefeitura recusou o cancelamento.', 12000);
        return;
      }
      toast.sucesso('NFS-e cancelada na prefeitura.');
      await buscarNotasPendentes();
    } catch (e: any) {
      toast.erro('Erro de conexão: ' + e.message);
    } finally {
      setCancelandoId(null);
    }
  }

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
        body: JSON.stringify({
          nota_ids: notasSelecionadas,
          item_lista_servico: codigo,
          codigo_tributacao_municipio: codigoMunCorrecao.trim() || undefined,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) { toast.erro(json.erro || 'Erro ao corrigir.'); return; }
      toast.sucesso(`${json.atualizadas} nota(s) corrigida(s) para ${codigo}.`);
      if (json.aviso) toast.aviso(json.aviso);
      setCodigoCorrecao('');
      setCodigoMunCorrecao('');
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

    // Aviso de competencia: o ISS e devido no mes da prestacao do servico, entao
    // transmitir hoje uma nota de meses atras joga aquela receita na competencia
    // errada — e, num lote grande, concentra meses de faturamento num mes so.
    // Confirmacao, nunca bloqueio: fechamento retroativo legitimo acontece.
    if (prazoEmissaoDias) {
      const atrasadas = notasSelecionadas
        .map(id => notasPendentes.find(n => n.id === id))
        .filter((n): n is NonNullable<typeof n> => {
          const ref = n?.data_movimentacao || n?.data_emissao;
          if (!n || !ref) return false;
          return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000) > prazoEmissaoDias;
        });

      if (atrasadas.length > 0) {
        const ok = window.confirm(
          `${atrasadas.length} das ${notasSelecionadas.length} nota(s) selecionadas são mais antigas ` +
          `que ${prazoEmissaoDias} dias.\n\n` +
          'O ISS é devido no mês da prestação do serviço. Emitir agora joga essa receita na ' +
          'competência atual, o que pode divergir da sua escrituração.\n\n' +
          'Transmitir mesmo assim?'
        );
        if (!ok) return;
      }
    }

    setProcessandoLote(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.erro('Sessão expirada. Faça login novamente.'); return; }
      // A rota processa um lote por chamada e devolve o que sobrou. Percorremos
      // os lotes aqui, para o usuário poder selecionar o período inteiro sem
      // precisar fatiar a seleção na mão — o corte é problema nosso, não dele.
      let fila: string[] = [...notasSelecionadas];
      const total = fila.length;
      let emitidas = 0, pendentes = 0, erros = 0, jaFeitas = 0;

      while (fila.length > 0) {
        const resp = await fetch('/api/nfse/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ nota_ids: fila }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          toast.erro(json.erro || 'Erro ao transmitir notas.');
          break;
        }
        const resultados: Record<string, any> = json.resultados || {};
        emitidas  += Object.values(resultados).filter((r: any) => r.status === 'Emitida').length;
        pendentes += Object.values(resultados).filter((r: any) => r.status === 'Pendente').length;
        erros     += Object.values(resultados).filter((r: any) => r.status === 'Erro').length;

        jaFeitas += Number(json.processadas) || Object.keys(resultados).length;
        const proximos: string[] = Array.isArray(json.restantes) ? json.restantes : [];

        // Progresso só quando há mais de um lote — em transmissão pequena o
        // aviso seria ruído.
        if (proximos.length > 0) {
          toast.info(`Transmitindo... ${jaFeitas} de ${total}`, 3000);
          setProgressoLote(`${jaFeitas}/${total}`);
        }

        // Trava de segurança: se a rota parar de reduzir a fila, aborta em vez
        // de repetir o mesmo lote para sempre.
        if (proximos.length >= fila.length) {
          toast.erro('A transmissão não avançou — interrompida para não repetir notas.');
          break;
        }
        fila = proximos;
      }

      setProgressoLote('');
      if (emitidas > 0) toast.sucesso(`${emitidas} nota(s) emitida(s) com sucesso!`);
      if (pendentes > 0) toast.aviso(`${pendentes} nota(s) em processamento na prefeitura.`);
      if (erros > 0) toast.erro(`${erros} nota(s) com erro — verifique as configurações fiscais.`);
      setNotasSelecionadas([]);
      await buscarNotasPendentes();
    } catch (e: any) { toast.erro('Erro de conexão: ' + e.message); }
    finally { setProcessandoLote(false); setProgressoLote(''); }
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
          {notasPendentes.filter(n => !semPendencia(n.status)).length > 0 && <span style={{ background: abaAtiva === 'pendentes' ? C.bgCard : C.sidebarBg, color: abaAtiva === 'pendentes' ? C.sidebarBg : C.bgCard, padding: "2px 8px", borderRadius: RAIO_XL, fontSize: 10 }}>{notasPendentes.filter(n => !semPendencia(n.status)).length}</span>}
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, whiteSpace: "nowrap" }}>Munic.:</span>
                    <input
                      value={codigoMunCorrecao}
                      onChange={e => setCodigoMunCorrecao(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="005"
                      title="Código de tributação do município. Cada item da LC 116 tem o seu — deixe vazio para não alterar."
                      style={{ width: 62, padding: "6px 8px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontFamily: "monospace" }} />
                    <button onClick={aplicarCorrecaoCodigo} disabled={corrigindo || !codigoCorrecao}
                      style={{ background: codigoCorrecao ? C.sidebarBg : C.borderMid, color: "#fff", border: "none", padding: "7px 12px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 800, cursor: (corrigindo || !codigoCorrecao) ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                      {corrigindo ? 'Aplicando...' : `Aplicar (${notasSelecionadas.length})`}
                    </button>
                  </div>
                )}
                <button onClick={exportarXmlDoMes} disabled={exportando}
                  title="Baixar num zip os XML das notas emitidas no mês — o pacote que o contador pede"
                  style={{ background: C.bgCard, color: C.sidebarBg, border: `1px solid ${C.borderMid}`, padding: "12px 16px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: exportando ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", opacity: exportando ? 0.6 : 1, whiteSpace: "nowrap" }}>
                  <FiExternalLink size={14} /> {exportando ? 'Gerando...' : 'XML do mês'}
                </button>
                <button onClick={dispararLoteSelecionado} disabled={processandoLote || notasSelecionadas.length === 0}
                  style={{ background: notasSelecionadas.length > 0 ? C.sidebarBg : C.borderMid, color: "#fff", border: "none", padding: "12px 20px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: (processandoLote || notasSelecionadas.length === 0) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", transition: "0.2s", opacity: (processandoLote || notasSelecionadas.length === 0) ? 0.65 : 1 }}>
                  {processandoLote ? <><FiSend size={16} /> Transmitindo{progressoLote ? ` ${progressoLote}` : '...'}</> : <><FiSend size={16} /> Transmitir {notasSelecionadas.length > 0 ? `(${notasSelecionadas.length})` : 'Selecionadas'}</>}
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
                            {jaEmitida(nota.status) && (
                              <button onClick={e => { e.stopPropagation(); cancelarNota(nota); }} disabled={cancelandoId === nota.id}
                                title="Cancelar esta nota na prefeitura"
                                style={{ background: "none", border: "none", padding: 0, cursor: cancelandoId === nota.id ? "wait" : "pointer", color: C.danger, display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700 }}>
                                <FiX size={11} /> {cancelandoId === nota.id ? 'Cancelando...' : 'Cancelar'}
                              </button>
                            )}
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
