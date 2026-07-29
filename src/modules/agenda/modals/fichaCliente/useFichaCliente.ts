// src/modules/agenda/modals/fichaCliente/useFichaCliente.ts
//
// Estado e regras de negócio da ficha unificada de cliente (usada pela Agenda
// e pelo CRM — antes eram dois modais/modelos de dados diferentes).
//
// Duas tabelas por trás de UM cliente:
//   clientes      → identidade (nome, documento, contato, endereço). Tem
//                   salao_id histórico — sempre preenchido ao criar, porque
//                   a busca de cliente da Agenda filtra por ele.
//   crm_clientes  → overlay por unidade (ativo/observações/anamnese/
//                   notificações/etiquetas). Pode não existir ainda para
//                   clientes legados — criado na hora de salvar, se faltar.
//
// Bug histórico corrigido aqui: o ModalFichaCliente antigo lia/gravava
// ativo/observações/anamnese direto em `clientes` (não em crm_clientes),
// então uma edição feita pela Agenda podia não aparecer no CRM e vice-versa.
'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

const FORM_VAZIO = {
  nome_completo: '', tipo_cliente: 'PF', cpf: '', cnpj: '',
  nascimento: '', genero: '',
  telefones: [] as any[],
  email: '', instagram: '', como_conheceu: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', pais: 'Brasil',
  etiquetas: [] as any[], observacoes: '',
  aceita_notificacoes: true, aceita_campanhas: true,
  anamnese: {} as Record<string, string>,
  foto_url: '',
  ativo: true,
};

// Parse robusto do telefone_whatsapp legado (mesmo algoritmo já usado em
// useAbaCRM.ts) — semeia o array de telefones quando o cliente ainda não
// tem nenhum cadastrado no formato novo.
function parseTelefoneLegado(bruto: string) {
  const v = (bruto || '').trim();
  let ddi = '+55';
  let resto = '';
  if (v.startsWith('+') && v.includes(' ')) {
    const partes = v.split(' ');
    ddi = partes[0] || '+55';
    resto = partes.slice(1).join('').replace(/\D/g, '');
  } else if (v) {
    let dig = v.replace(/\D/g, '');
    if (dig.length > 11 && dig.startsWith('55')) dig = dig.slice(2);
    resto = dig;
  }
  return { ddi, ddd: resto.slice(0, 2), numero: resto.slice(2) };
}

function montarTelefoneWhatsapp(telefones: any[]): string {
  const principal = telefones?.[0];
  if (!principal) return '';
  const ddi = principal.ddi || '+55';
  const numero = `${principal.ddd || ''}${principal.numero || ''}`.replace(/\D/g, '');
  return numero ? `${ddi} ${numero}` : '';
}

function parseAnamnese(bruta: string | null | undefined): Record<string, string> {
  if (!bruta) return {};
  try {
    const obj = JSON.parse(bruta);
    return obj && typeof obj === 'object' ? obj : { geral: String(bruta) };
  } catch {
    return { geral: bruta }; // texto livre legado (versão antiga do modal do CRM)
  }
}

export function useFichaCliente(clienteId: string | null, perfil: any, onSalvo?: () => void, onClose?: () => void) {
  const toast = useToast();
  const [formCliente, setFormClienteState] = useState<any>({ ...FORM_VAZIO });
  const [crmId, setCrmId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(!!clienteId);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [etiquetasDb, setEtiquetasDb] = useState<any[]>([]);
  const [clienteConflito, setClienteConflito] = useState<any>(null);
  const [historicoAgendamentos, setHistoricoAgendamentos] = useState<any[]>([]);
  const [comprasProdutos, setComprasProdutos] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  function setFormCliente(next: any) { setFormClienteState(next); }
  function set(campo: string, valor: any) { setFormClienteState((f: any) => ({ ...f, [campo]: valor })); }
  function setAnamnese(campo: string, valor: string) {
    setFormClienteState((f: any) => ({ ...f, anamnese: { ...(f.anamnese || {}), [campo]: valor } }));
  }
  function toggleEtiqueta(tag: any) {
    setFormClienteState((f: any) => {
      const atuais: any[] = f.etiquetas || [];
      const existe = atuais.find((t: any) => t.id === tag.id);
      return { ...f, etiquetas: existe ? atuais.filter((t: any) => t.id !== tag.id) : [...atuais, tag] };
    });
  }

  async function criarEtiqueta(nome: string, cor: string) {
    if (!nome.trim() || !perfil?.salao_id) return;
    const { data, error } = await supabase.from('etiquetas').insert([{ nome: nome.trim(), cor, salao_id: perfil.salao_id }]).select('*').single();
    if (error) { toast.erro('Erro ao criar etiqueta: ' + error.message); return; }
    setEtiquetasDb((prev: any[]) => [...prev, data]);
    setFormClienteState((f: any) => ({ ...f, etiquetas: [...(f.etiquetas || []), data] }));
  }

  async function carregarEtiquetas() {
    if (!perfil?.salao_id) return;
    const { data, error } = await supabase.from('etiquetas').select('*').eq('salao_id', perfil.salao_id).order('nome');
    if (error) { console.error('[useFichaCliente] Erro ao buscar etiquetas:', error.message); return; }
    setEtiquetasDb(data || []);
  }

  // Etiquetas gerenciadas em outro lugar (renomear/recolorir/excluir) podem ter
  // mudado o próprio cliente aberto — recarrega os dois juntos.
  async function atualizarAposGerenciarEtiquetas() {
    await carregarEtiquetas();
    if (clienteId) await carregarCliente(clienteId);
  }

  useEffect(() => { carregarEtiquetas(); }, [perfil?.salao_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!clienteId || !perfil?.salao_id) {
      setFormClienteState({ ...FORM_VAZIO });
      setCrmId(null);
      setHistoricoAgendamentos([]);
      setComprasProdutos([]);
      setCarregando(false);
      return;
    }
    carregarCliente(clienteId);
    carregarHistorico(clienteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, perfil?.salao_id]);

  async function carregarCliente(id: string) {
    setCarregando(true);
    const [resCli, resCrm] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).maybeSingle(),
      supabase.from('crm_clientes').select('*').eq('cliente_id', id).eq('salao_id', perfil.salao_id).maybeSingle(),
    ]);
    if (resCli.error) console.error('[useFichaCliente] Erro ao buscar cliente:', resCli.error.message);
    if (resCrm.error) console.error('[useFichaCliente] Erro ao buscar crm_clientes:', resCrm.error.message);

    const c = resCli.data;
    if (!c) { setCarregando(false); return; }
    const crm = resCrm.data;
    setCrmId(crm?.id || null);

    let telefones = Array.isArray(c.telefones) && c.telefones.length > 0 ? c.telefones : [];
    if (telefones.length === 0 && c.telefone_whatsapp) {
      const p = parseTelefoneLegado(c.telefone_whatsapp);
      telefones = [{ ddi: p.ddi, ddd: p.ddd, numero: p.numero, tipo: 'Celular' }];
    }

    setFormClienteState({
      id: c.id,
      nome_completo: c.nome_completo || '',
      tipo_cliente: c.tipo_cliente || 'PF',
      cpf: c.cpf || '', cnpj: c.cnpj || '',
      nascimento: c.nascimento || '', genero: c.genero || '',
      telefones,
      email: c.email || '', instagram: c.instagram || '', como_conheceu: c.como_conheceu || '',
      cep: c.cep || '', logradouro: c.logradouro || '', numero: c.numero || '', complemento: c.complemento || '',
      bairro: c.bairro || '', cidade: c.cidade || '', estado: c.estado || '', pais: c.pais || 'Brasil',
      etiquetas: crm?.etiquetas || [],
      observacoes: crm?.observacoes || '',
      aceita_notificacoes: crm?.aceita_notificacoes !== false,
      aceita_campanhas: crm?.aceita_campanhas !== false,
      anamnese: parseAnamnese(crm?.anamnese ?? c.anamnese),
      foto_url: c.foto_url || '',
      ativo: crm ? crm.ativo !== false : true,
      created_at: c.created_at,
    });
    setCarregando(false);
  }

  async function carregarHistorico(clienteIdGlobal: string) {
    setCarregandoHistorico(true);
    const [resAgs, resCompras] = await Promise.all([
      supabase.from('agendamentos')
        .select('id, data, inicio, status, valor_final, servicos(nome_servico)')
        .eq('salao_id', perfil.salao_id).eq('cliente_id', clienteIdGlobal)
        .order('data', { ascending: false }),
      supabase.from('caixa_transacoes')
        .select('id, data_hora, valor_total, forma_pagamento, itens')
        .eq('salao_id', perfil.salao_id).eq('cliente_id', clienteIdGlobal)
        .not('itens', 'is', null).order('data_hora', { ascending: false }).limit(100),
    ]);
    if (resAgs.error) console.error('[useFichaCliente] Erro ao buscar histórico de agendamentos:', resAgs.error.message);
    if (resCompras.error) console.error('[useFichaCliente] Erro ao buscar compras:', resCompras.error.message);
    setHistoricoAgendamentos(resAgs.data || []);
    setComprasProdutos(resCompras.data || []);
    setCarregandoHistorico(false);
  }

  async function handleUploadFoto(e: any) {
    const file = e.target.files?.[0];
    if (!file || !perfil?.salao_id) return;
    if (file.size > 2 * 1024 * 1024) { toast.aviso('Foto muito grande. Máximo 2MB.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.aviso('Envie apenas imagens JPG, PNG ou WebP.'); return; }
    const ext = file.name.split('.').pop();
    const path = `avatares/${perfil.salao_id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('clientes-fotos').upload(path, file, { upsert: true });
    if (error) { toast.erro('Erro ao enviar foto: ' + error.message); return; }
    const { data } = supabase.storage.from('clientes-fotos').getPublicUrl(path);
    set('foto_url', data.publicUrl);
  }

  function montarDadosGlobais() {
    return {
      nome_completo: formCliente.nome_completo,
      telefone_whatsapp: montarTelefoneWhatsapp(formCliente.telefones),
      telefones: formCliente.telefones || [],
      tipo_cliente: formCliente.tipo_cliente || 'PF',
      cpf: formCliente.tipo_cliente === 'PJ' ? null : (formCliente.cpf || null),
      cnpj: formCliente.tipo_cliente === 'PJ' ? (formCliente.cnpj || null) : null,
      nascimento: formCliente.nascimento || null,
      genero: formCliente.genero || null,
      email: formCliente.email || null,
      instagram: formCliente.instagram || null,
      como_conheceu: formCliente.como_conheceu || null,
      cep: formCliente.cep || null, logradouro: formCliente.logradouro || null,
      numero: formCliente.numero || null, complemento: formCliente.complemento || null,
      bairro: formCliente.bairro || null, cidade: formCliente.cidade || null,
      estado: formCliente.estado || null, pais: formCliente.pais || 'Brasil',
      foto_url: formCliente.foto_url || null,
    };
  }

  function montarDadosLocais() {
    return {
      etiquetas: formCliente.etiquetas || [],
      observacoes: formCliente.observacoes || null,
      aceita_notificacoes: formCliente.aceita_notificacoes !== false,
      aceita_campanhas: formCliente.aceita_campanhas !== false,
      anamnese: JSON.stringify(formCliente.anamnese || {}),
      ativo: formCliente.ativo !== false,
    };
  }

  async function salvar() {
    if (!formCliente.nome_completo?.trim()) { toast.aviso('Nome é obrigatório.'); return; }
    setSalvando(true);
    try {
      const dadosGlobais = montarDadosGlobais();
      const dadosLocais = montarDadosLocais();

      if (!formCliente.id) {
        // Novo cliente — checa duplicata dentro do MESMO salão antes de criar
        // (CPF/CNPJ, e-mail ou telefone), pra não gerar registro repetido.
        const doc = dadosGlobais.tipo_cliente === 'PJ' ? dadosGlobais.cnpj : dadosGlobais.cpf;
        let qDup = supabase.from('clientes').select('id, nome_completo').eq('salao_id', perfil.salao_id);
        if (doc) qDup = qDup.or(`cpf.eq.${doc},cnpj.eq.${doc}`);
        else if (dadosGlobais.email) qDup = qDup.eq('email', dadosGlobais.email);
        else if (dadosGlobais.telefone_whatsapp) qDup = qDup.eq('telefone_whatsapp', dadosGlobais.telefone_whatsapp);
        else qDup = null as any;

        const { data: existente } = qDup ? await qDup.maybeSingle() : { data: null };
        if (existente) {
          const { data: vinculo } = await supabase.from('crm_clientes').select('id').eq('cliente_id', existente.id).eq('salao_id', perfil.salao_id).maybeSingle();
          if (vinculo) { setClienteConflito(existente); setSalvando(false); return; }
          const { error: erroVinculo } = await supabase.from('crm_clientes').insert([{ cliente_id: existente.id, salao_id: perfil.salao_id, ...dadosLocais }]);
          if (erroVinculo) throw erroVinculo;
          toast.sucesso('Cliente já existente vinculado a esta unidade!');
          onSalvo?.(); onClose?.(); setSalvando(false); return;
        }

        const { data: novo, error: erroCriar } = await supabase.from('clientes')
          .insert([{ ...dadosGlobais, salao_id: perfil.salao_id }]).select('id').single();
        if (erroCriar) throw erroCriar;
        const { error: erroCrm } = await supabase.from('crm_clientes').insert([{ cliente_id: novo.id, salao_id: perfil.salao_id, ...dadosLocais }]);
        if (erroCrm) throw erroCrm;
        toast.sucesso('Cliente cadastrado com sucesso!');
      } else {
        const { error: erroGlobal } = await supabase.from('clientes').update(dadosGlobais).eq('id', formCliente.id);
        if (erroGlobal) throw erroGlobal;

        if (crmId) {
          const { error: erroLocal } = await supabase.from('crm_clientes').update(dadosLocais).eq('id', crmId);
          if (erroLocal) throw erroLocal;
        } else {
          // Cliente legado sem vínculo ainda nesta unidade — cria agora.
          const { error: erroLocal } = await supabase.from('crm_clientes').insert([{ cliente_id: formCliente.id, salao_id: perfil.salao_id, ...dadosLocais }]);
          if (erroLocal) throw erroLocal;
        }

        // Propaga o nome atualizado pros agendamentos existentes (mesmo
        // comportamento de antes) — só o texto denormalizado da agenda.
        const { error: erroProp } = await supabase.from('agendamentos')
          .update({ cliente_nome: dadosGlobais.nome_completo })
          .eq('cliente_id', formCliente.id).eq('salao_id', perfil.salao_id);
        if (erroProp) console.error('[useFichaCliente] Erro ao propagar nome nos agendamentos:', erroProp.message);

        toast.sucesso('Ficha salva com sucesso!');
      }
      onSalvo?.();
      onClose?.();
    } catch (err: any) {
      console.error('[useFichaCliente] Erro ao salvar:', err.message);
      toast.erro('Não foi possível salvar a ficha: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarArquivado() {
    if (!formCliente.id) return;
    const novoAtivo = !formCliente.ativo;
    if (crmId) {
      const { error } = await supabase.from('crm_clientes').update({ ativo: novoAtivo }).eq('id', crmId);
      if (error) { toast.erro('Erro ao alterar status: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('crm_clientes').insert([{ cliente_id: formCliente.id, salao_id: perfil.salao_id, ativo: novoAtivo }]);
      if (error) { toast.erro('Erro ao alterar status: ' + error.message); return; }
    }
    set('ativo', novoAtivo);
    toast.sucesso(novoAtivo ? 'Cliente reativado nesta unidade!' : 'Cliente arquivado nesta unidade.');
    onSalvo?.();
  }

  async function buscarCep(cep: string) {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFormClienteState((f: any) => ({
          ...f, cep: limpo,
          logradouro: data.logradouro || f.logradouro,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
        }));
      }
    } catch (erro) {
      console.error('[useFichaCliente] Erro ao buscar CEP:', erro);
    } finally {
      setBuscandoCep(false);
    }
  }

  return {
    formCliente, setFormCliente, set, setAnamnese, toggleEtiqueta, criarEtiqueta,
    crmId, carregando, salvando, buscandoCep, etiquetasDb,
    clienteConflito, setClienteConflito,
    historicoAgendamentos, comprasProdutos, carregandoHistorico,
    handleUploadFoto, salvar, alternarArquivado, buscarCep,
    atualizarAposGerenciarEtiquetas,
    editarClienteConflito: (c: any) => { setClienteConflito(null); carregarCliente(c.id); carregarHistorico(c.id); },
  };
}
