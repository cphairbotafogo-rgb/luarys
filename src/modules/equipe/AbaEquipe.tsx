'use client'
/**
 * src/modules/equipe/AbaEquipe.tsx
 *
 * Shell da tela de Gestão de Equipe: estado, carga de dados do Supabase,
 * handlers de negócio, e a grid de colaboradores. Os 4 modais (Colaborador,
 * Adiantamento, Funções, Limite de Plano) foram extraídos para
 * src/modules/equipe/modal/, e o painel de permissões granulares está em
 * src/modules/equipe/PainelPermissoesGranulares.tsx — dividido a partir de
 * um arquivo único de ~710 linhas, seguindo o padrão de divisão do Luarys.
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { RAIO_XS, RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { confirmarAcaoGlobal } from "@/components/ConfirmacaoGlobal";
import { Card } from "@/components/ui";
import {
  FiPlus, FiDollarSign, FiInfo, FiSlash,
} from "react-icons/fi";
import { ModalColaborador } from "./modal/ModalColaborador";
import { ModalAdiantamento } from "./modal/ModalAdiantamento";
import { ModalFuncoes } from "./modal/ModalFuncoes";
import { ModalLimitePlano } from "./modal/ModalLimitePlano";

export function AbaEquipe({ perfil }: any) {
  const toast = useToast();
  // ─── ESTADOS PRINCIPAIS E CONEXÕES ───
  const [profissionaisReais, setProfissionaisReais] = useState<any[]>([]);
  const [servicosDb, setServicosDb] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [abaModal, setAbaModal] = useState("pessoais");
  const [novaArea, setNovaArea] = useState("");

  const [listaFuncoes, setListaFuncoes] = useState<any[]>([]);
  const [modalFuncoesAberto, setModalFuncoesAberto] = useState(false);
  const [novaFuncaoTexto, setNovaFuncaoTexto] = useState("");
  const [subindoFoto, setSubindoFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // MODAL: Adiantamento Salarial
  const [modalAdiantamentoAberto, setModalAdiantamentoAberto] = useState(false);
  const diaDeHoje = new Date().toISOString().split('T')[0];
  const [formAdiantamento, setFormAdiantamento] = useState({ profissional_nome: '', profissional_id: '', valor: '', data: diaDeHoje, observacao: '' });
  const [processandoAdiantamento, setProcessandoAdiantamento] = useState(false);

  // PLANO: limite de profissionais produtivos+ativos
  const [infoPlano, setInfoPlano] = useState<{ limite: number | null; acessoTotal: boolean }>({ limite: null, acessoTotal: false });
  // PIN do dono — libera permissões confidenciais no cadastro de profissional
  const [pinGerente, setPinGerente] = useState<string | null>(null);
  const [modalLimiteAberto, setModalLimiteAberto] = useState(false);
  const [mensagemLimite, setMensagemLimite] = useState('');

  // FORMULÁRIO BASE
  const formVazio = {
    nome: '', apelido: '', cpf: '', rg: '', estadoCivil: '', telefone: '', email: '', genero: '', nascimento: '',
    senhaAcesso: '', foto_url: '', exibir_na_agenda: true, ativo: true,
    especialidades: [], comissoes: {}, comissao_produtos: 0, permite_comissao_produtos: false,

    folha_pagamento: {
      salario_base: '', quebra_caixa: '', insalubridade: '', bonificacao: '', salario_familia: '',
      vale_transporte: { tipo: 'Não Possui', desconto_tipo: 'Porcentagem', valor_desconto: 0 },
      vale_alimentacao: { tipo: 'Não Possui', desconto_tipo: 'Valor', valor_desconto: 0 },
      plano_saude: { tipo: 'Não Possui', desconto_tipo: 'Valor', valor_desconto: 0 },
      inss: '', irrf: '', desconto_faltas: ''
    },

    horarios: {
      Segunda: { ativo: false, entrada: '09:00', saida: '18:00', almocoEntrada: '12:00', almocoSaida: '13:00' },
      Terça: { ativo: true, entrada: '09:00', saida: '18:00', almocoEntrada: '12:00', almocoSaida: '13:00' },
      Quarta: { ativo: true, entrada: '09:00', saida: '18:00', almocoEntrada: '12:00', almocoSaida: '13:00' },
      Quinta: { ativo: true, entrada: '09:00', saida: '18:00', almocoEntrada: '12:00', almocoSaida: '13:00' },
      Sexta: { ativo: true, entrada: '09:00', saida: '18:00', almocoEntrada: '12:00', almocoSaida: '13:00' },
      Sábado: { ativo: true, entrada: '09:00', saida: '14:00', almocoEntrada: '12:00', almocoSaida: '13:00' },
      Domingo: { ativo: false, entrada: '09:00', saida: '12:00', almocoEntrada: '12:00', almocoSaida: '13:00' }
    },
    banco: { banco: '', agencia: '', conta: '', tipoConta: 'Corrente', tipoPix: 'CPF/CNPJ', chavePix: '' },
    contrato: { tipo: 'Profissional Parceiro (Lei 13.352/2016)', funcao: '', admissao: '', ctps: '', serieCtps: '', pis: '', razaoSocial: '', cnpj: '', inscricaoMunicipal: '', inicioContrato: '' },
    endereco: { cep: '', tipoLogradouro: 'Rua', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' },
    permissoes: { perfil_acesso: 'Sem Acesso', acesso_sistema: false, ver_dashboard: false, ver_financeiro: false, fazer_estorno: false, aplicar_desconto: false, editar_equipe: false, ver_propria_agenda: false, criar_proprio_agendamento: false, editar_valores_proprio_agendamento: false, ver_proprio_faturamento: false, bloquear_proprio_horario: false }
  };
  const [form, setForm] = useState<any>(formVazio);

  // ─── CARGA DE DADOS DO BANCO ───
  async function carregarDados() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const [resProfissionais, resServicos, resSalao] = await Promise.all([
      supabase.from('profissionais').select('*').eq('salao_id', perfil.salao_id).order('nome'),
      supabase.from('servicos').select('id, nome_servico, categoria, setor, comissao_padrao').eq('salao_id', perfil.salao_id).order('categoria').order('nome_servico'),
      supabase.from('saloes').select('limite_profissionais, acesso_total, pin_gerente').eq('id', perfil.salao_id).maybeSingle()
    ]);
    if (resProfissionais.data) setProfissionaisReais(resProfissionais.data);
    if (resServicos.data) setServicosDb(resServicos.data);
    if (resSalao.data) {
      setInfoPlano({ limite: resSalao.data.limite_profissionais ?? null, acessoTotal: !!resSalao.data.acesso_total });
      setPinGerente(resSalao.data.pin_gerente || null);
    }
    setCarregando(false);
  }

  async function carregarFuncoes() {
    const { data } = await supabase.from('funcoes').select('*').order('nome', { ascending: true });
    if (data) setListaFuncoes(data);
  }

  useEffect(() => { carregarDados(); carregarFuncoes(); }, [perfil]);

  // ─── HANDLERS AUXILIARES DE OPERAÇÃO ───
  async function handleUploadFoto(e: any) {
    const file = e.target.files?.[0];
    if (!file || !perfil?.salao_id) return;
    if (file.size > 2 * 1024 * 1024) { toast.aviso("Imagem muito grande. Máximo 2MB."); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.aviso("Envie apenas imagens JPG, PNG ou WebP."); return; }
    try {
      setSubindoFoto(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${perfil.salao_id}/profissionais/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setForm((prev: any) => ({ ...prev, foto_url: data.publicUrl }));
    } catch (error: any) { toast.erro("Erro na foto: " + error.message); } finally { setSubindoFoto(false); }
  }

  function abrirNovo() { setEditandoId(null); setForm(formVazio); setAbaModal("pessoais"); setNovaArea(""); setModalAberto(true); }

  function abrirEdicao(prof: any) {
    setEditandoId(prof.id);
    const extras = prof.perfil_avancado || {};
    const horariosCarregados = extras.horarios || formVazio.horarios;
    const horariosComAlmoco: any = {};
    for (let dia in formVazio.horarios) { horariosComAlmoco[dia] = { ...formVazio.horarios[dia as keyof typeof formVazio.horarios], ...(horariosCarregados[dia] || {}) }; }

    setForm({
      nome: prof.nome || '', apelido: extras.apelido || '', cpf: extras.cpf || '', rg: extras.rg || '', estadoCivil: extras.estadoCivil || '',
      telefone: extras.telefone || '', email: prof.perfil_avancado?.email || prof.email || '',
      emailAuth: prof.email_auth || prof.perfil_avancado?.email || '', // email real do Auth (não editável)
      genero: extras.genero || '', nascimento: extras.nascimento || '',
      senhaAcesso: '', foto_url: prof.foto_url || '',
      temEmailAuth: !!(prof.email_auth || prof.perfil_avancado?.email || prof.email),
      exibir_na_agenda: prof.produtivo !== undefined && prof.produtivo !== null ? prof.produtivo : (extras.exibir_na_agenda !== undefined ? extras.exibir_na_agenda : true),
      ativo: prof.ativo !== false,
      folha_pagamento: { ...formVazio.folha_pagamento, ...(extras.folha_pagamento || {}) },
      especialidades: prof.especialidades || [], comissoes: prof.servicos_comissoes || {},
      comissao_produtos: prof.comissao_produtos || 0,
      permite_comissao_produtos: !!prof.permite_comissao_produtos,
      horarios: horariosComAlmoco, banco: { ...formVazio.banco, ...(extras.banco || {}) },
      contrato: { ...formVazio.contrato, ...(extras.contrato || {}), cnpj: prof.cnpj_mei || extras.contrato?.cnpj || '', inscricaoMunicipal: prof.inscricao_municipal || extras.contrato?.inscricaoMunicipal || '' },
      endereco: { ...formVazio.endereco, ...(extras.endereco || {}) },
      permissoes: { ...formVazio.permissoes, ...(prof.permissoes || {}) }
    });
    setAbaModal("pessoais"); setNovaArea(""); setModalAberto(true);
  }

  async function lancarAdiantamento(e: any) {
    e.preventDefault();
    if (!formAdiantamento.valor || Number(formAdiantamento.valor) <= 0) { toast.aviso("Informe um valor válido."); return; }
    setProcessandoAdiantamento(true);
    try {
      const valor = parseFloat(formAdiantamento.valor);
      const dataVenc = formAdiantamento.data;
      const { error } = await supabase.from('despesas').insert([{
        salao_id: perfil.salao_id,
        categoria: 'Adiantamento Salarial (Vale)',
        descricao: `Vale: ${formAdiantamento.profissional_nome}${formAdiantamento.observacao ? ' — ' + formAdiantamento.observacao : ''}`,
        tipo_custo: 'variavel',
        valor,
        data_vencimento: dataVenc,
        status: 'Pago',
        data_pagamento: dataVenc,
        forma_pagamento: 'Dinheiro',
      }]);
      if (error) throw error;
      // Abatimento automático nas comissões do profissional
      if (formAdiantamento.profissional_id) {
        await supabase.from('comissao_extras').insert([{
          salao_id: perfil.salao_id,
          profissional_id: formAdiantamento.profissional_id,
          tipo: 'desconto',
          descricao: `Desconto de vale (${new Date().toLocaleDateString('pt-BR')})`,
          valor,
        }]);
      }
      toast.sucesso(`Vale lançado no valor de ${brl(valor)}!`);
      setModalAdiantamentoAberto(false);
    } catch (err: any) { toast.erro("Erro ao lançar adiantamento: " + err.message); } finally { setProcessandoAdiantamento(false); }
  }

  // ─── TRATADORES DE EVENTO DO CADASTRO DETALHADO ───
  function handleAddArea(e: any) { if (e.key === 'Enter') { e.preventDefault(); const areaVal = novaArea.trim(); if (areaVal && !form.especialidades.includes(areaVal)) { setForm({ ...form, especialidades: [...form.especialidades, areaVal] }); } setNovaArea(""); } }
  function removerArea(areaParaRemover: any) { setForm({ ...form, especialidades: form.especialidades.filter((a: any) => a !== areaParaRemover) }); }
  // Recebe o serviço inteiro (não só o id) para poder usar comissao_padrao
  // como sugestão inicial ao habilitar — antes sempre zerava, obrigando o
  // dono a digitar manualmente toda vez que habilitava o mesmo serviço para
  // um profissional diferente.
  function toggleServico(servico: any, ligado: any) {
    setForm((prev: any) => {
      const novasComissoes = { ...prev.comissoes };
      if (ligado) {
        novasComissoes[servico.id] = servico.comissao_padrao ?? 0;
      } else {
        delete novasComissoes[servico.id];
      }
      return { ...prev, comissoes: novasComissoes };
    });
  }
  function atualizarComissao(servicoId: any, valor: any) { setForm((prev: any) => ({ ...prev, comissoes: { ...prev.comissoes, [servicoId]: parseFloat(valor) || 0 } })); }
  function atualizarHorario(dia: any, campo: any, valor: any) { setForm({ ...form, horarios: { ...form.horarios, [dia]: { ...form.horarios[dia], [campo]: valor } } }); }

  function alterarPerfilAcessoGeral(perfilSelecionado: any) {
    let novasPermissoes = { ...form.permissoes, perfil_acesso: perfilSelecionado };
    if (perfilSelecionado === "Administrador") { novasPermissoes = { perfil_acesso: "Administrador", acesso_sistema: true, ver_dashboard: true, ver_financeiro: true, fazer_estorno: true, aplicar_desconto: true, editar_equipe: true, ver_propria_agenda: true, criar_proprio_agendamento: true, editar_valores_proprio_agendamento: true, ver_proprio_faturamento: true, bloquear_proprio_horario: true }; }
    else if (perfilSelecionado === "Recepcionista") { novasPermissoes = { perfil_acesso: "Recepcionista", acesso_sistema: true, ver_dashboard: false, ver_financeiro: true, fazer_estorno: false, aplicar_desconto: true, editar_equipe: false, ver_propria_agenda: true, criar_proprio_agendamento: true, editar_valores_proprio_agendamento: false, ver_proprio_faturamento: false, bloquear_proprio_horario: true }; }
    else if (perfilSelecionado === "Profissional Parceiro") { novasPermissoes = { perfil_acesso: "Profissional Parceiro", acesso_sistema: true, ver_dashboard: false, ver_financeiro: false, fazer_estorno: false, aplicar_desconto: false, editar_equipe: false, ver_propria_agenda: true, criar_proprio_agendamento: true, editar_valores_proprio_agendamento: false, ver_proprio_faturamento: true, bloquear_proprio_horario: false }; }
    else if (perfilSelecionado === "Sem Acesso") { novasPermissoes = { perfil_acesso: "Sem Acesso", acesso_sistema: false, ver_dashboard: false, ver_financeiro: false, fazer_estorno: false, aplicar_desconto: false, editar_equipe: false, ver_propria_agenda: false, criar_proprio_agendamento: false, editar_valores_proprio_agendamento: false, ver_proprio_faturamento: false, bloquear_proprio_horario: false }; }
    setForm({ ...form, permissoes: novasPermissoes });
  }

  function togglePermissaoIndividual(campo: any) { setForm({ ...form, permissoes: { ...form.permissoes, [campo]: !form.permissoes[campo], perfil_acesso: "Personalizado" } }); }

  // Clonagem de permissões (catálogo novo): copia o objeto `permissoes`
  // completo de outro profissional já cadastrado, marcando como Personalizado.
  function copiarPermissoesDe(profissionalId: any) {
    const origem: any = profissionaisReais.find((p: any) => p.id === profissionalId);
    if (!origem) return;
    setForm({ ...form, permissoes: { ...(origem.permissoes || {}), perfil_acesso: "Personalizado" } });
    toast.sucesso(`Permissões copiadas de ${origem.nome}.`);
  }

  async function handleDeletar() {
    const ok = await confirmarAcaoGlobal({
      titulo: 'Remover este profissional definitivamente?',
      descricao: 'O histórico de atendimentos e comissões será preservado, mas o acesso ao sistema será revogado.',
      rotuloCta: 'Remover',
    });
    if (ok) { const { error } = await supabase.from('profissionais').delete().eq('id', editandoId); if (!error) fecharEAtualizar("Removido com sucesso!"); else toast.erro("Erro ao remover: " + error.message); }
  }
  async function adicionarNovaFuncaoDB() { const nomeLimpo = novaFuncaoTexto.trim(); if (!nomeLimpo) return; if (listaFuncoes.find((f: any) => f.nome.toLowerCase() === nomeLimpo.toLowerCase())) { toast.aviso("Esta função já está cadastrada."); return; } const { data, error } = await supabase.from('funcoes').insert([{ nome: nomeLimpo }]).select().single(); if (data && !error) { setListaFuncoes([...listaFuncoes, data].sort((a: any, b: any) => a.nome.localeCompare(b.nome))); setNovaFuncaoTexto(""); } }
  async function deletarFuncaoDB(id: any) {
    const ok = await confirmarAcaoGlobal({ titulo: 'Apagar função do catálogo?', rotuloCta: 'Apagar' });
    if (ok) { const { error } = await supabase.from('funcoes').delete().eq('id', id); if (!error) setListaFuncoes(listaFuncoes.filter((f: any) => f.id !== id)); }
  }

  async function salvarProfissional() {
    if (!form.nome || !form.cpf) { toast.aviso("Nome e CPF são obrigatórios."); setAbaModal("pessoais"); return; }
    if (!editandoId && (!form.email || !form.senhaAcesso)) { toast.aviso("E-mail e senha são obrigatórios para novos cadastros."); setAbaModal("pessoais"); return; }
    if (form.senhaAcesso && form.senhaAcesso !== form.confirmSenha) { toast.aviso("As senhas não coincidem. Verifique o campo de confirmação."); setAbaModal("pessoais"); return; }

    const dados = {
      nome: form.nome, especialidades: form.especialidades, servicos_comissoes: form.comissoes, comissao_produtos: form.comissao_produtos,
      cnpj_mei: form.contrato.cnpj, inscricao_municipal: form.contrato.inscricaoMunicipal, permissoes: form.permissoes, foto_url: form.foto_url,
      ativo: form.ativo, produtivo: form.exibir_na_agenda, permite_comissao_produtos: form.permite_comissao_produtos,
      perfil_avancado: { apelido: form.apelido, cpf: form.cpf, rg: form.rg, estadoCivil: form.estadoCivil, telefone: form.telefone, email: form.email, genero: form.genero, nascimento: form.nascimento, exibir_na_agenda: form.exibir_na_agenda, folha_pagamento: form.folha_pagamento, horarios: form.horarios, banco: form.banco, contrato: form.contrato, endereco: form.endereco }
    };

    if (editandoId) {
      try {
        if (form.senhaAcesso && form.senhaAcesso.trim() !== '') {
          if (form.senhaAcesso.trim().length < 6) { toast.aviso("A senha deve ter no mínimo 6 caracteres."); return; }
          const { data: { session } } = await supabase.auth.getSession();
          const respostaSenha = await fetch('/api/criar-profissional', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ password: form.senhaAcesso, idExistente: editandoId }) });
          if (!respostaSenha.ok) throw new Error("Erro ao resetar a senha na API.");
        }
        const { error } = await supabase.from('profissionais').update(dados).eq('id', editandoId);
        if (error) throw error;
        fecharEAtualizar("Dados atualizados com sucesso!");
      } catch (err: any) { tratarErroSalvar(err.message); }
    } else {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const resposta = await fetch('/api/criar-profissional', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ email: form.email, password: form.senhaAcesso, dadosProfissional: { ...dados, salao_id: perfil.salao_id } }) });
        const resultado = await resposta.json();
        if (!resposta.ok) throw new Error(resultado.error || "Erro na API.");
        fecharEAtualizar("Profissional cadastrado com sucesso!");
      } catch (error: any) { tratarErroSalvar(error.message); }
    }
  }

  // Diferencia o erro de limite de profissionais (do trigger no Supabase) de erros genéricos
  function tratarErroSalvar(mensagem: string) {
    if (mensagem && mensagem.includes('LIMITE_PROFISSIONAIS_EXCEDIDO')) {
      const partes = mensagem.split('LIMITE_PROFISSIONAIS_EXCEDIDO:');
      setMensagemLimite((partes[1] || mensagem).trim());
      setModalLimiteAberto(true);
      return;
    }
    toast.erro("Erro: " + mensagem);
  }

  function fecharEAtualizar(mensagem: any) { if(mensagem) toast.sucesso(mensagem); setModalAberto(false); carregarDados(); }

  if (carregando) return <div className="flex h-full w-full items-center justify-center font-bold text-sm" style={{ color: C.textLight }}>A carregar equipe técnica... ⏳</div>;

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: C.bg }}>

      {/* HEADER TELA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.sidebarBg }}>Gestão de Equipe & RH</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Fichas cadastrais avançadas, departamento pessoal e controle de autonomias.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {!infoPlano.acessoTotal && infoPlano.limite !== null && (
            <div title="Apenas profissionais ativos e produtivos (com agenda) contam para o limite do plano." style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: C.textMuted, background: C.bg, padding: "8px 14px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}` }}>
              <FiInfo size={14} />
              {profissionaisReais.filter((p: any) => p.ativo !== false && p.produtivo !== false).length} de {infoPlano.limite} vagas usadas
            </div>
          )}
          <button onClick={abrirNovo} style={{ background: C.sidebarBg, color: C.bgCard, border: "none", padding: "12px 20px", borderRadius: RAIO_MD, fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <FiPlus size={16} /> Novo Colaborador
          </button>
        </div>
      </div>

      {/* GRID DE COLABORADORES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 20 }}>
        {profissionaisReais.length === 0 && <p style={{ color: C.textMuted, fontSize: 13, fontStyle: "italic" }}>Nenhum profissional cadastrado.</p>}
        {profissionaisReais.map((p: any) => (
          <Card key={p.id} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, background: C.bgCard }}>

            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {p.foto_url ? (
                <img src={p.foto_url} style={{ width: 56, height: 56, borderRadius: RAIO_MD, objectFit: "cover", border: `1px solid ${C.border}` }} alt="Foto" />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: RAIO_MD, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: C.textMuted }}>
                  {p.nome?.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: C.sidebarBg }}>
                  {p.nome} {p.perfil_avancado?.apelido && <span style={{ color: C.textLight, fontSize: 12, fontWeight: 500 }}>({p.perfil_avancado.apelido})</span>}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
                  {p.perfil_avancado?.contrato?.funcao ? `${p.perfil_avancado.contrato.funcao}` : 'Geral'} · <span style={{ fontSize: 11, color: C.textLight }}>{p.perfil_avancado?.contrato?.tipo?.split('(')[0] || "Vínculo Direto"}</span>
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {p.ativo === false && <span style={{ fontSize: 10, fontWeight: 700, background: C.bg, color: C.textLight, padding: "3px 8px", borderRadius: RAIO_XS, border: `1px solid ${C.borderMid}`, display: "flex", alignItems: "center", gap: 4 }}><FiSlash size={10} /> INATIVO</span>}
              {p.perfil_avancado?.exibir_na_agenda === false && <span style={{ fontSize: 10, fontWeight: 700, background: C.dangerBg, color: C.dangerText, padding: "3px 8px", borderRadius: RAIO_XS, border: "1px solid #FCA5A5" }}>OCULTO DA AGENDA</span>}
              {p.permissoes?.perfil_acesso === "Administrador" && <span style={{ fontSize: 10, fontWeight: 700, background: C.bg, color: C.sidebarBg, padding: "3px 8px", borderRadius: RAIO_XS, border: `1px solid ${C.borderMid}` }}>ADMINISTRADOR</span>}
            </div>

            <div style={{ background: C.bg, padding: "12px 16px", borderRadius: RAIO_MD, fontSize: 12, color: C.textMain, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, border: `1px solid ${C.border}` }}>
              <div><span style={{ color: C.textMuted, fontWeight: 600, display: "block", fontSize: 11, marginBottom: 2 }}>CONTATO</span>{p.perfil_avancado?.telefone || "—"}</div>
              <div><span style={{ color: C.textMuted, fontWeight: 600, display: "block", fontSize: 11, marginBottom: 2 }}>LOGIN</span><span style={{ wordBreak: "break-all" }}>{p.perfil_avancado?.email || p.email}</span></div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => abrirEdicao(p)} style={{ flex: 1, padding: "10px 0", background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Editar Ficha</button>
              <button
                onClick={() => { setFormAdiantamento({ ...formAdiantamento, profissional_nome: p.nome, profissional_id: p.id, valor: '', observacao: '' }); setModalAdiantamentoAberto(true); }}
                style={{ background: "#F4F8F5", color: "#047857", border: "1px solid #A7F3D0", borderRadius: RAIO_MD, fontWeight: 600, padding: "0 16px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
              >
                <FiDollarSign size={14} /> Lançar Vale
              </button>
            </div>

          </Card>
        ))}
      </div>

      {modalAdiantamentoAberto && (
        <ModalAdiantamento
          formAdiantamento={formAdiantamento} setFormAdiantamento={setFormAdiantamento}
          processandoAdiantamento={processandoAdiantamento} lancarAdiantamento={lancarAdiantamento}
          onClose={() => setModalAdiantamentoAberto(false)}
        />
      )}

      {modalAberto && (
        <ModalColaborador
          form={form} setForm={setForm} editandoId={editandoId} abaModal={abaModal} setAbaModal={setAbaModal}
          fileInputRef={fileInputRef} handleUploadFoto={handleUploadFoto} subindoFoto={subindoFoto}
          servicosDb={servicosDb} novaArea={novaArea} setNovaArea={setNovaArea}
          handleAddArea={handleAddArea} removerArea={removerArea} toggleServico={toggleServico} atualizarComissao={atualizarComissao}
          atualizarHorario={atualizarHorario}
          listaFuncoes={listaFuncoes} setModalFuncoesAberto={setModalFuncoesAberto}
          alterarPerfilAcessoGeral={alterarPerfilAcessoGeral} togglePermissaoIndividual={togglePermissaoIndividual}
          profissionaisReais={profissionaisReais} copiarPermissoesDe={copiarPermissoesDe} pinDono={pinGerente}
          salvarProfissional={salvarProfissional} handleDeletar={handleDeletar}
          onClose={() => setModalAberto(false)}
        />
      )}

      {modalFuncoesAberto && (
        <ModalFuncoes
          listaFuncoes={listaFuncoes} novaFuncaoTexto={novaFuncaoTexto} setNovaFuncaoTexto={setNovaFuncaoTexto}
          adicionarNovaFuncaoDB={adicionarNovaFuncaoDB} deletarFuncaoDB={deletarFuncaoDB}
          onClose={() => setModalFuncoesAberto(false)}
        />
      )}

      {modalLimiteAberto && (
        <ModalLimitePlano
          mensagemLimite={mensagemLimite}
          onClose={() => setModalLimiteAberto(false)}
          onUpgrade={() => { setModalLimiteAberto(false); window.location.hash = 'configuracoes'; }}
        />
      )}
    </div>
  );
}