// src/modules/crm/useAbaCRM.ts
// Hook central do módulo CRM.
// Concentra: fetches, estado de lista/modal, salvar, upload, status e handlers de ação.
'use client'
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

export { DDIS as LISTA_DDIS } from '@/lib/ddis';

const FORM_VAZIO = {
  nome: '', ddi: '+55', telefone: '', email: '', genero: '', cpf: '',
  nascimento: '', instagram: '', como_conheceu: '', observacoes: '',
  notificacoes: true, campanhas: true, ativo: true, foto_url: '', anamnese: '',
};

const POR_PAGINA = 50;

export function useAbaCRM(perfil: any) {
  const toast = useToast();

  // ── Lista ───────────────────────────────────────────────────────────────────
  const [busca, setBusca]                 = useState('');
  const [abaLista, setAbaLista]           = useState('ativos');
  const [pagina, setPagina]               = useState(0);
  const [sel, setSel]                     = useState<any>(null);
  const [clientesReais, setClientesReais] = useState<any[]>([]);
  const [resultadosBusca, setResultadosBusca] = useState<any[] | null>(null);
  const [carregando, setCarregando]       = useState(true);
  const [msgZapPadrao, setMsgZapPadrao]   = useState('Olá {nome_do_cliente}, tudo bem?');

  // ── Modal ───────────────────────────────────────────────────────────────────
  const [modalAberto, setModalAberto]               = useState(false);
  const [editandoIdGlobal, setEditandoIdGlobal]     = useState<string | null>(null);
  const [editandoCrmId, setEditandoCrmId]           = useState<string | null>(null);
  const [clienteConflito, setClienteConflito]       = useState<any>(null);
  const [abaModal, setAbaModal]                     = useState('dados');
  const [subindoFoto, setSubindoFoto]               = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [historicoAgendamentos, setHistoricoAgendamentos] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico]     = useState(false);
  const [comprasProdutos, setComprasProdutos]             = useState<any[]>([]);
  const [form, setForm]                             = useState({ ...FORM_VAZIO });

  // Stats calculados ao vivo a partir dos agendamentos (não dependem dos campos desnormalizados)
  const [statsCliente, setStatsCliente] = useState<{ ultima_visita: string | null; total_visitas: number; total_gasto: number } | null>(null);

  // ── Carregar clientes ───────────────────────────────────────────────────────
  async function carregarClientes() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const [resCrm, resCli, resSalao] = await Promise.all([
      supabase.from('crm_clientes').select(`
        id, ativo, observacoes, anamnese, aceita_notificacoes, aceita_campanhas,
        total_gasto, total_visitas, data_ultima_visita, created_at,
        clientes (
          id, nome_completo, telefone_whatsapp, email, cpf, foto_url,
          genero, nascimento, instagram, como_conheceu, telefones, aceita_marketing
        )
      `).eq('salao_id', perfil.salao_id).order('created_at', { ascending: false }).limit(5000),
      // Todos os clientes do salão — inclui os SEM vínculo crm_clientes (legados/importados),
      // que antes sumiam da lista/busca do CRM.
      supabase.from('clientes')
        .select('id, nome_completo, telefone_whatsapp, email, cpf, foto_url, genero, nascimento, instagram, como_conheceu, telefones, aceita_marketing, created_at, total_gasto, total_visitas, data_ultima_visita')
        .eq('salao_id', perfil.salao_id).limit(10000),
      supabase.from('saloes').select('msg_whatsapp').eq('id', perfil.salao_id).maybeSingle(),
    ]);
    if (resSalao.data?.msg_whatsapp) setMsgZapPadrao(resSalao.data.msg_whatsapp);

    const vistos = new Set<string>();
    const lista = (resCrm.data || []).map((crm: any) => {
      if (crm.clientes?.id) vistos.add(crm.clientes.id);
      return {
        _crm_id:            crm.id,
        _global_id:         crm.clientes?.id,
        id:                 crm.clientes?.id,
        nome_completo:      crm.clientes?.nome_completo,
        telefone_whatsapp:  crm.clientes?.telefone_whatsapp,
        email:              crm.clientes?.email,
        cpf:                crm.clientes?.cpf,
        foto_url:           crm.clientes?.foto_url,
        genero:             crm.clientes?.genero,
        nascimento:         crm.clientes?.nascimento,
        instagram:          crm.clientes?.instagram,
        como_conheceu:      crm.clientes?.como_conheceu,
        telefones:          crm.clientes?.telefones,
        ativo:              crm.ativo,
        observacoes:        crm.observacoes,
        anamnese:           crm.anamnese,
        aceita_notificacoes: crm.aceita_notificacoes,
        aceita_campanhas:   crm.aceita_campanhas,
        aceita_marketing:   crm.clientes?.aceita_marketing ?? true,
        total_gasto:        crm.total_gasto,
        total_visitas:      crm.total_visitas,
        data_ultima_visita: crm.data_ultima_visita,
        created_at:         crm.created_at,
      };
    });

    // Clientes do salão que ainda não têm vínculo crm_clientes → entram na lista com
    // dados padrão (ativos). Ao editar/salvar, o vínculo é criado.
    const extras = (resCli.data || [])
      .filter((c: any) => c.id && !vistos.has(c.id))
      .map((c: any) => ({
        _crm_id: null, _global_id: c.id, id: c.id,
        nome_completo: c.nome_completo, telefone_whatsapp: c.telefone_whatsapp,
        email: c.email, cpf: c.cpf, foto_url: c.foto_url, genero: c.genero,
        nascimento: c.nascimento, instagram: c.instagram, como_conheceu: c.como_conheceu,
        telefones: c.telefones, ativo: true, observacoes: '', anamnese: '',
        aceita_notificacoes: true, aceita_campanhas: true, aceita_marketing: c.aceita_marketing ?? true,
        total_gasto: c.total_gasto || 0, total_visitas: c.total_visitas || 0,
        data_ultima_visita: c.data_ultima_visita || null, created_at: c.created_at,
      }));

    setClientesReais([...lista, ...extras]);
    setCarregando(false);
  }

  useEffect(() => { carregarClientes(); }, [perfil]);

  // ── Stats ao vivo do cliente selecionado ────────────────────────────────────
  useEffect(() => {
    const clienteId = sel?._global_id || sel?.id;
    if (!clienteId || !perfil?.salao_id) { setStatsCliente(null); return; }
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('data, valor_final, status')
        .eq('salao_id', perfil.salao_id)
        .eq('cliente_id', clienteId)
        .eq('status', 'Finalizado');
      if (!ativo || !data) return;
      const datas   = data.map((a: any) => a.data).filter(Boolean).sort().reverse();
      const total   = data.reduce((s: number, a: any) => s + Number(a.valor_final || 0), 0);
      setStatsCliente({ ultima_visita: datas[0] ?? null, total_visitas: data.length, total_gasto: total });
    })();
    return () => { ativo = false; };
  }, [sel, perfil?.salao_id]);

  // ── Histórico ───────────────────────────────────────────────────────────────
  async function carregarHistorico(clienteIdGlobal: string) {
    if (!clienteIdGlobal) return;
    setCarregandoHistorico(true);
    const [resAgs, resCompras] = await Promise.all([
      supabase.from('agendamentos')
        .select('id, data, inicio, status, valor_final, servicos(nome_servico)')
        .eq('salao_id', perfil.salao_id)
        .eq('cliente_id', clienteIdGlobal)
        .order('data', { ascending: false }),
      // Compras de produtos (venda de balcão) vinculadas a este cliente
      supabase.from('caixa_transacoes')
        .select('id, data_hora, valor_total, forma_pagamento, itens')
        .eq('salao_id', perfil.salao_id)
        .eq('cliente_id', clienteIdGlobal)
        .not('itens', 'is', null)
        .order('data_hora', { ascending: false })
        .limit(100),
    ]);
    if (resAgs.data) setHistoricoAgendamentos(resAgs.data);
    setComprasProdutos(resCompras.data || []);
    setCarregandoHistorico(false);
  }

  // ── Upload de foto ──────────────────────────────────────────────────────────
  async function handleUploadFoto(e: any) {
    const file = e.target.files?.[0];
    if (!file || !perfil?.salao_id) return;
    if (file.size > 2 * 1024 * 1024) { toast.aviso('Foto muito grande. Máximo 2MB.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.aviso('Envie apenas imagens JPG, PNG ou WebP.'); return; }
    setSubindoFoto(true);
    const ext  = file.name.split('.').pop();
    const path = `avatares/${perfil.salao_id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('clientes-fotos').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('clientes-fotos').getPublicUrl(path);
      setForm(f => ({ ...f, foto_url: data.publicUrl }));
    }
    setSubindoFoto(false);
  }

  // ── Alternar status ─────────────────────────────────────────────────────────
  async function handleAlternarStatusCliente() {
    if (!editandoCrmId) return;
    const { error } = await supabase.from('crm_clientes').update({ ativo: !form.ativo }).eq('id', editandoCrmId);
    if (!error) fecharEAtualizar('');
    else toast.erro('Erro ao alterar status: ' + error.message);
  }

  // ── Salvar cliente ──────────────────────────────────────────────────────────
  async function salvarCliente() {
    if (!form.nome || !form.telefone) { toast.aviso('Nome e telefone são obrigatórios.'); return; }
    const cpfLimpo         = form.cpf.replace(/\D/g, '');
    const telefoneCompleto = `${form.ddi} ${form.telefone.trim()}`;
    const dadosGlobais = {
      nome_completo: form.nome, telefone_whatsapp: telefoneCompleto,
      email: form.email || null, cpf: cpfLimpo || null, foto_url: form.foto_url || null,
      genero: form.genero || null, nascimento: form.nascimento || null,
      instagram: form.instagram || null, como_conheceu: form.como_conheceu || null,
    };
    const dadosLocais = {
      observacoes: form.observacoes || null, anamnese: form.anamnese || null,
      aceita_notificacoes: form.notificacoes, aceita_campanhas: form.campanhas, ativo: form.ativo,
    };
    try {
      if (!editandoIdGlobal) {
        // Verificar duplicata
        let qDup = supabase.from('clientes').select('id, nome_completo');
        if (cpfLimpo && form.email) qDup = qDup.or(`cpf.eq.${cpfLimpo},email.eq.${form.email}`);
        else if (cpfLimpo)  qDup = qDup.eq('cpf', cpfLimpo);
        else if (form.email) qDup = qDup.eq('email', form.email);
        else qDup = qDup.eq('telefone_whatsapp', telefoneCompleto);

        const { data: existente } = await qDup.maybeSingle();
        if (existente) {
          const { data: vinculo } = await supabase.from('crm_clientes').select('id').eq('cliente_id', existente.id).eq('salao_id', perfil.salao_id).maybeSingle();
          if (vinculo) { setClienteConflito(existente); return; }
          const { error } = await supabase.from('crm_clientes').insert([{ cliente_id: existente.id, salao_id: perfil.salao_id, ...dadosLocais }]);
          if (error) throw error;
          fecharEAtualizar('Cliente vinculado a esta unidade com sucesso!'); return;
        }
        const { data: novo, error: erroG } = await supabase.from('clientes').insert([dadosGlobais]).select('id').single();
        if (erroG) throw erroG;
        const { error: erroC } = await supabase.from('crm_clientes').insert([{ cliente_id: novo.id, salao_id: perfil.salao_id, ...dadosLocais }]);
        if (erroC) throw erroC;
      } else {
        const { error: erroG } = await supabase.from('clientes').update(dadosGlobais).eq('id', editandoIdGlobal);
        if (erroG) throw erroG;
        if (editandoCrmId) {
          const { error: erroC } = await supabase.from('crm_clientes').update(dadosLocais).eq('id', editandoCrmId);
          if (erroC) throw erroC;
        }
      }
      fecharEAtualizar('Ficha salva com sucesso!');
    } catch (err: any) { toast.erro('Erro ao gravar: ' + err.message); }
  }

  // ── Helpers de UI ───────────────────────────────────────────────────────────
  function fecharEAtualizar(m: string) {
    if (m) toast.info(m);
    setModalAberto(false); setClienteConflito(null);
    setForm({ ...FORM_VAZIO }); setEditandoIdGlobal(null); setEditandoCrmId(null);
    carregarClientes();
  }

  function abrirNovoCliente() {
    setForm({ ...FORM_VAZIO }); setEditandoIdGlobal(null); setEditandoCrmId(null);
    setAbaModal('dados'); setModalAberto(true);
  }

  function abrirEdicao(c: any) {
    // Parse robusto do telefone: aceita tanto o formato canônico "+55 21999999999"
    // (cadastro manual) quanto o CRU da importação "96981198434" / "5596981198434"
    // (sem prefixo/espaço). Antes, o split(' ') jogava o número inteiro no ddi e
    // deixava o campo vazio nas fichas de clientes importados.
    const bruto = (c.telefone_whatsapp || '').trim();
    let ddi = '+55';
    let telefone = '';
    if (bruto.startsWith('+') && bruto.includes(' ')) {
      const partes = bruto.split(' ');
      ddi = partes[0] || '+55';
      telefone = partes.slice(1).join(' ').trim();
    } else if (bruto) {
      let dig = bruto.replace(/\D/g, '');
      if (dig.length > 11 && dig.startsWith('55')) dig = dig.slice(2); // remove DDI 55 embutido
      telefone = dig;
    }
    setForm({
      nome: c.nome_completo || '', ddi, telefone,
      email: c.email || '', genero: c.genero || '', cpf: c.cpf || '',
      nascimento: c.nascimento || '', instagram: c.instagram || '',
      como_conheceu: c.como_conheceu || '', observacoes: c.observacoes || '',
      notificacoes: c.aceita_notificacoes !== false, campanhas: c.aceita_campanhas !== false,
      ativo: c.ativo !== false, foto_url: c.foto_url || '', anamnese: c.anamnese || '',
    });
    setEditandoIdGlobal(c._global_id || c.id);
    setEditandoCrmId(c._crm_id || null);
    setHistoricoAgendamentos([]);
    setComprasProdutos([]);
    carregarHistorico(c._global_id || c.id);
    setAbaModal('dados'); setModalAberto(true);
  }

  function abrirWhatsApp(e: any, c: any) {
    e.stopPropagation();
    if (!c.telefone_whatsapp) { toast.aviso('Cliente sem telefone cadastrado.'); return; }
    const num  = c.telefone_whatsapp.replace(/\D/g, '');
    const nome = c.nome_completo?.split(' ')[0] || 'Cliente';
    // No CRM não há contexto de agendamento; remove linhas com variáveis de agendamento não preenchidas
    let mensagem = msgZapPadrao
      .replace(/\{nome_do_cliente\}/g, nome)
      .replace(/.*\{data\}.*\n?/g, '')
      .replace(/.*\{horario\}.*\n?/g, '')
      .replace(/.*\{servico\}.*\n?/g, '')
      .replace(/.*\{profissional\}.*\n?/g, '')
      .replace(/\{nome_salao\}/g, '');
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(mensagem)}`, '_blank');
  }

  function abrirAgendamento(e: any, c: any) {
    e.stopPropagation();
    localStorage.setItem('eleva_prefill_agendamento', JSON.stringify({ id: c._global_id || c.id, nome_completo: c.nome_completo, telefone_whatsapp: c.telefone_whatsapp }));
    window.location.hash = '#agendamento';
  }

  // BUSCA NO SERVIDOR — consulta o banco direto ao digitar (>= 2 chars), achando
  // qualquer cliente do salão, independente do total (o load inicial é limitado).
  useEffect(() => {
    const termo = busca.trim().replace(/[,()%]/g, '');
    if (termo.length < 2 || !perfil?.salao_id) { setResultadosBusca(null); return; }
    const timer = setTimeout(async () => {
      const { data: cli } = await supabase.from('clientes')
        .select('id, nome_completo, telefone_whatsapp, email, cpf, foto_url, genero, nascimento, instagram, como_conheceu, telefones, created_at, total_gasto, total_visitas, data_ultima_visita')
        .eq('salao_id', perfil.salao_id)
        .or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,telefone_whatsapp.ilike.%${termo}%`)
        .order('nome_completo').limit(80);
      const ids = (cli || []).map((c: any) => c.id);
      const crmMap: Record<string, any> = {};
      if (ids.length) {
        const { data: crmRows } = await supabase.from('crm_clientes')
          .select('id, cliente_id, ativo, observacoes, anamnese, aceita_notificacoes, aceita_campanhas, total_gasto, total_visitas, data_ultima_visita')
          .eq('salao_id', perfil.salao_id).in('cliente_id', ids);
        (crmRows || []).forEach((cr: any) => { crmMap[cr.cliente_id] = cr; });
      }
      setResultadosBusca((cli || []).map((c: any) => {
        const cr = crmMap[c.id] || {};
        return {
          _crm_id: cr.id || null, _global_id: c.id, id: c.id,
          nome_completo: c.nome_completo, telefone_whatsapp: c.telefone_whatsapp,
          email: c.email, cpf: c.cpf, foto_url: c.foto_url, genero: c.genero,
          nascimento: c.nascimento, instagram: c.instagram, como_conheceu: c.como_conheceu,
          telefones: c.telefones, ativo: cr.ativo !== false,
          observacoes: cr.observacoes || '', anamnese: cr.anamnese || '',
          aceita_notificacoes: cr.aceita_notificacoes !== false, aceita_campanhas: cr.aceita_campanhas !== false,
          total_gasto: cr.total_gasto ?? c.total_gasto ?? 0, total_visitas: cr.total_visitas ?? c.total_visitas ?? 0,
          data_ultima_visita: cr.data_ultima_visita ?? c.data_ultima_visita, created_at: c.created_at,
        };
      }));
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, perfil?.salao_id]);

  // Lista filtrada — usa os resultados do servidor quando a busca está ativa.
  const buscaServidorAtiva = resultadosBusca !== null;
  const lista = (buscaServidorAtiva ? resultadosBusca! : clientesReais).filter(c => {
    const isAtivo = c.ativo !== false;
    if (abaLista === 'ativos'     && !isAtivo) return false;
    if (abaLista === 'arquivados' &&  isAtivo) return false;
    if (!buscaServidorAtiva) {
      // Busca curta (< 2 chars) ou sem busca: filtro local no que já foi carregado.
      const ok = !busca.trim() || c.nome_completo?.toLowerCase().includes(busca.toLowerCase()) || c.telefone_whatsapp?.includes(busca) || c.cpf?.includes(busca);
      if (!ok) return false;
    }
    return true;
  }).sort((a, b) =>
    // Ordem alfabética por nome (ignora maiúsculas/acentos — padrão pt-BR).
    (a.nome_completo || '').localeCompare(b.nome_completo || '', 'pt-BR', { sensitivity: 'base' })
  );

  // Reseta página ao mudar busca ou aba
  useEffect(() => { setPagina(0); }, [busca, abaLista]);

  const totalPaginas   = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const listaPaginada  = lista.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  return {
    busca, setBusca, abaLista, setAbaLista, sel, setSel,
    clientesReais, lista, listaPaginada, carregando,
    pagina, setPagina, totalPaginas, POR_PAGINA,
    modalAberto, setModalAberto,
    editandoIdGlobal, editandoCrmId, clienteConflito, setClienteConflito,
    abaModal, setAbaModal, subindoFoto, fileInputRef,
    historicoAgendamentos, carregandoHistorico, comprasProdutos,
    form, setForm,
    statsCliente,
    carregarClientes, handleUploadFoto, handleAlternarStatusCliente,
    salvarCliente, fecharEAtualizar, abrirNovoCliente, abrirEdicao,
    abrirWhatsApp, abrirAgendamento,
  };
}
