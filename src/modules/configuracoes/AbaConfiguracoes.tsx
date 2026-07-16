'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_XL, RAIO_2XL, RAIO_LG, overlayModal, containerModal, inputAdmin, labelPadrao } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { Btn, Card, Avatar } from "@/components/ui";
import { ConfiguracaoFinanceira } from "./ConfiguracaoFinanceira";
import { ExportacaoContabil } from "./ExportacaoContabil";
import { AbaConfigTaxas } from "./AbaConfigTaxas";
import { AbaMeuPlano } from "./AbaMeuPlano";
import { ConfiguracaoComissoes } from "./ConfiguracaoComissoes";
import { DiasExcepcionais } from "./DiasExcepcionais";
import { GavetaFidelidade } from "./GavetaFidelidade";
import { PainelClubeAssinaturas } from "@/modules/fidelidade/clube/PainelClubeAssinaturas";
import { GavetaDocumentos } from "./GavetaDocumentos";
import { useGuardModulo } from "@/lib/useGuardModulo";
import { BloqueioModulo } from "@/components/BloqueioModulo";
import {
  FiBriefcase, FiClock, FiDollarSign, FiFileText, FiUser, FiLock,
  FiMapPin, FiSave, FiTrash2, FiCheckCircle, FiX, FiPercent, FiMessageSquare, FiCreditCard, FiTrendingUp, FiGift, FiStar, FiShoppingBag
} from "react-icons/fi";
import { ConfigVitrine } from "@/modules/portal/vitrine/ConfigVitrine";
import { GavetaPromocoesVitrine } from "./GavetaPromocoesVitrine";

export function AbaConfiguracoes({ perfil }: any) {
  const toast = useToast();
  const noShowLiberado = useGuardModulo(perfil?.salao_id, 'no_show');
  const [carregando, setCarregando] = useState(true);
  const [gaveta, setGaveta] = useState("empresa");
  const [salvando, setSalvando] = useState(false);
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [senhaConfirmacao, setSenhaConfirmacao] = useState("");
  const [verificandoSenha, setVerificandoSenha] = useState(false);
  const [formSenha, setFormSenha] = useState({ atual: '', nova: '', confirmacao: '' });
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  
  const [cobrarSinal, setCobrarSinal] = useState(false);
  const [porcentagemSinal, setPorcentagemSinal] = useState(20);
  const [prazoSinalMinutos, setPrazoSinalMinutos] = useState(20);
  const [gatewayPagamento, setGatewayPagamento] = useState("mercadopago");
  const [tokenPagamento, setTokenPagamento] = useState("");

  const [formSalao, setFormSalao] = useState({
    nome_fantasia: '', razao_social: '', cnpj: '', telefone: '', email_contato: '', slug: '',
    inscricao_municipal: '', inscricao_estadual: '', cnae: '', codigo_ibge: '', email_fiscal: '', regime_tributario: '',
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
    sobre_nos: '', politica_cancelamento: '', instagram: '', site: ''
  });
  const [formPerfil, setFormPerfil] = useState({ nome: '', telefone: '' });

  const diasIniciais = [
    { id: 1, dia: 'Segunda-feira', ativo: true, inicio: '09:00', fim: '19:00' },
    { id: 2, dia: 'Terça-feira', ativo: true, inicio: '09:00', fim: '19:00' },
    { id: 3, dia: 'Quarta-feira', ativo: true, inicio: '09:00', fim: '19:00' },
    { id: 4, dia: 'Quinta-feira', ativo: true, inicio: '09:00', fim: '19:00' },
    { id: 5, dia: 'Sexta-feira', ativo: true, inicio: '09:00', fim: '20:00' },
    { id: 6, dia: 'Sábado', ativo: true, inicio: '09:00', fim: '18:00' },
    { id: 0, dia: 'Domingo', ativo: false, inicio: '10:00', fim: '15:00' }
  ];
  const [horarios, setHorarios] = useState(diasIniciais);

  useEffect(() => {
    async function carregarDados() {
      if (!perfil?.salao_id) return;
      setCarregando(true);
      try {
        const [resSalao, resUser] = await Promise.all([
          supabase.from('saloes').select('*').eq('id', perfil.salao_id).maybeSingle(),
          supabase.from('perfis_usuarios').select('*').eq('id', perfil.id).maybeSingle()
        ]);

        if (resSalao.data) {
          setFormSalao({
            nome_fantasia: resSalao.data.nome_fantasia || '', razao_social: resSalao.data.razao_social || '', 
            cnpj: resSalao.data.cnpj || '', telefone: resSalao.data.telefone || '', email_contato: resSalao.data.email_contato || '',
            inscricao_municipal: resSalao.data.inscricao_municipal || '', inscricao_estadual: resSalao.data.inscricao_estadual || '', cnae: resSalao.data.cnae || '',
            email_fiscal: resSalao.data.email_fiscal || '', regime_tributario: resSalao.data.regime_tributario || '',
            slug: resSalao.data.slug || '', cep: resSalao.data.cep || '', logradouro: resSalao.data.logradouro || '',
            numero: resSalao.data.numero || '', complemento: resSalao.data.complemento || '',
            bairro: resSalao.data.bairro || '', cidade: resSalao.data.cidade || '', estado: resSalao.data.estado || '',
            sobre_nos: resSalao.data.sobre_nos || '', politica_cancelamento: resSalao.data.politica_cancelamento || '',
            instagram: resSalao.data.instagram || '', site: resSalao.data.site || '', codigo_ibge: resSalao.data.codigo_ibge || '',
          });
          
          setCobrarSinal(resSalao.data.cobrar_sinal || false);
          setPorcentagemSinal(resSalao.data.porcentagem_sinal || 20);
          setPrazoSinalMinutos(resSalao.data.prazo_sinal_minutos || 20);
          setGatewayPagamento(resSalao.data.gateway_pagamento || "mercadopago");
          setTokenPagamento(resSalao.data.token_pagamento || "");

          if (resSalao.data.horarios_funcionamento) {
            try { setHorarios(typeof resSalao.data.horarios_funcionamento === 'string' ? JSON.parse(resSalao.data.horarios_funcionamento) : resSalao.data.horarios_funcionamento); } 
            catch (e) {}
          }
        }
        if (resUser.data) setFormPerfil({ nome: resUser.data.nome || '', telefone: resUser.data.telefone || '' });
      } catch (error) { if (process.env.NODE_ENV === 'development') console.error(error); }
      setCarregando(false);
    }
    carregarDados();
  }, [perfil]);

  async function buscarCep(cepDigitado: string) {
    setFormSalao({ ...formSalao, cep: cepDigitado });
    const cepLimpo = cepDigitado.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormSalao(prev => ({ ...prev, logradouro: data.logradouro || prev.logradouro, bairro: data.bairro || prev.bairro, cidade: data.localidade || prev.cidade, estado: data.uf || prev.estado }));
        }
      } catch (error) {}
    }
  }

  function solicitarSenhaDeSeguranca(e: any) {
    e.preventDefault();
    if (cobrarSinal && !tokenPagamento) { toast.aviso("Preencha o Token de Integração do banco."); return; }
    setSenhaConfirmacao(""); setModalSenhaAberto(true);
  }

  async function confirmarSenhaESalvar() {
    if (!senhaConfirmacao) { toast.aviso("Digite sua senha para confirmar."); return; }
    setVerificandoSenha(true); setSalvando(true);
    try {
      // Verifica a senha real antes de qualquer alteração
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { toast.erro("Sessão expirada. Faça login novamente."); setVerificandoSenha(false); setSalvando(false); return; }
      const { error: erroAuth } = await supabase.auth.signInWithPassword({ email: user.email, password: senhaConfirmacao });
      if (erroAuth) { toast.erro("Senha incorreta — configurações não salvas."); setVerificandoSenha(false); setSalvando(false); return; }

      if (["empresa", "horarios", "financeiro"].includes(gaveta)) {
        const payloadSalao = { 
          ...formSalao, 
          inscricao_municipal: formSalao.inscricao_municipal,
          inscricao_estadual: formSalao.inscricao_estadual,
          cnae: formSalao.cnae,
          codigo_ibge: formSalao.codigo_ibge, 
          cobrar_sinal: cobrarSinal,
          porcentagem_sinal: porcentagemSinal,
          prazo_sinal_minutos: prazoSinalMinutos,
          gateway_pagamento: gatewayPagamento, 
          token_pagamento: tokenPagamento,
          horarios_funcionamento: JSON.stringify(horarios)
        };
        const { error } = await supabase.from('saloes').update(payloadSalao).eq('id', perfil.salao_id);
        if (error) throw error;
      } else if (gaveta === "perfil") {
        const { error } = await supabase.from('perfis_usuarios').update(formPerfil).eq('id', perfil.id);
        if (error) throw error;
      }
      toast.sucesso("Configurações salvas com sucesso!");
      setModalSenhaAberto(false); setSenhaConfirmacao("");
    } catch (error: any) { toast.erro("Erro ao salvar: " + error.message); }
    setVerificandoSenha(false); setSalvando(false);
  }

  async function handleTrocarSenha(e: any) {
    e.preventDefault();
    if (formSenha.nova !== formSenha.confirmacao) { toast.aviso("As senhas não coincidem."); return; }
    if (formSenha.nova.length < 6) { toast.aviso("A senha deve ter no mínimo 6 caracteres."); return; }
    setTrocandoSenha(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Sessão não encontrada.");
      const { error: erroAuth } = await supabase.auth.signInWithPassword({ email: user.email, password: formSenha.atual });
      if (erroAuth) throw new Error("Senha atual incorreta.");
      const { error: erroUpdate } = await supabase.auth.updateUser({ password: formSenha.nova });
      if (erroUpdate) throw erroUpdate;
      toast.sucesso("Senha alterada com sucesso!");
      setFormSenha({ atual: '', nova: '', confirmacao: '' });
    } catch (error: any) { toast.erro("Erro: " + error.message); }
    setTrocandoSenha(false);
  }

  const atualizarHorario = (index: number, campo: string, valor: any) => { const novos = [...horarios]; (novos[index] as any)[campo] = valor; setHorarios(novos); };
  
  const inputStyle = inputAdmin;
  const labelStyle = labelPadrao;
  
  const tabBtnStyle = (ativa: boolean) => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "14px 20px", fontSize: 11, fontWeight: 700, cursor: "pointer", background: "none", border: "none", borderBottom: ativa ? `2px solid ${C.sidebarBg}` : "2px solid transparent", color: ativa ? C.sidebarBg : C.textLight, fontFamily: "var(--font-title)", textTransform: "uppercase" as const, letterSpacing: "0.5px", transition: "all 0.2s"
  });

  if (carregando) return <div className="flex h-full w-full items-center justify-center font-title uppercase tracking-widest font-bold text-sm" style={{ color: C.textLight }}>A carregar configurações administrativas... ⏳</div>;

  return (
    <div className="font-body" style={{ padding: 32, overflowY: "auto", flex: 1, background: C.bg, position: "relative" }}>
      
      <div style={{ marginBottom: 32 }}>
        <h2 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.sidebarBg }}>Configurações do Sistema</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Ajustes estruturais da unidade, expedientes, gateways de segurança e perfil.</p>
      </div>

      {/* 🟢 CARD EM DESTAQUE PARA A CENTRAL DE COMUNICAÇÃO 🟢 */}
      <div 
        onClick={() => window.location.hash = 'comunicacao'}
        style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 16, transition: "0.2s", marginBottom: 32, maxWidth: 900 }}
        className="hover:shadow-md hover:border-slate-400"
      >
        <div style={{ width: 48, height: 48, borderRadius: RAIO_XL, background: C.bg, color: C.sidebarBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FiMessageSquare size={24} />
        </div>
        <div>
          <h3 className="font-title" style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: C.sidebarBg }}>Central de Comunicação & Marketing</h3>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Acesse os disparos em massa, recuperação de clientes, lista de aniversariantes e crie templates.</p>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${C.borderMid}`, marginBottom: 32, flexWrap: "wrap", gap: 4, overflowX: "auto" }}>
        <button style={tabBtnStyle(gaveta === 'empresa')} onClick={() => setGaveta('empresa')}><FiBriefcase size={16} /> Dados da Empresa</button>
        <button style={tabBtnStyle(gaveta === 'horarios')} onClick={() => setGaveta('horarios')}><FiClock size={16} /> Horários</button>
        <button style={tabBtnStyle(gaveta === 'financeiro')} onClick={() => setGaveta('financeiro')}><FiDollarSign size={16} /> Financeiro</button>
        <button data-gaveta="taxas" style={tabBtnStyle(gaveta === 'taxas')} onClick={() => setGaveta('taxas')}><FiPercent size={16} /> Taxas de Cartão</button>
        <button style={tabBtnStyle(gaveta === 'comissoes')} onClick={() => setGaveta('comissoes')}><FiTrendingUp size={16} /> Comissões</button>
        <button style={tabBtnStyle(gaveta === 'contabilidade')} onClick={() => setGaveta('contabilidade')}><FiFileText size={16} /> Contabilidade</button>
        {perfil?.isDono && (
          <button style={tabBtnStyle(gaveta === 'meuplano')} onClick={() => setGaveta('meuplano')}><FiCreditCard size={16} /> Meu Plano</button>
        )}
        {perfil?.isDono && (
          <button style={tabBtnStyle(gaveta === 'fidelidade')} onClick={() => setGaveta('fidelidade')}><FiGift size={16} /> Fidelidade</button>
        )}
        {perfil?.isDono && (
          <button style={tabBtnStyle(gaveta === 'clube')} onClick={() => setGaveta('clube')}><FiStar size={16} /> Clube de Assinaturas</button>
        )}
        <button style={tabBtnStyle(gaveta === 'perfil')} onClick={() => setGaveta('perfil')}><FiUser size={16} /> Meu Perfil</button>
        <button style={tabBtnStyle(gaveta === 'seguranca')} onClick={() => setGaveta('seguranca')}><FiLock size={16} /> Segurança</button>
        <button style={tabBtnStyle(gaveta === 'documentos')} onClick={() => setGaveta('documentos')}><FiFileText size={16} /> Documentos</button>
        {perfil?.isDono && (
          <button style={tabBtnStyle(gaveta === 'vitrine')} onClick={() => setGaveta('vitrine')}><FiShoppingBag size={16} /> Vitrine</button>
        )}
      </div>

      <div style={{ maxWidth: (gaveta === 'taxas') ? 1200 : 900 }}>

        {gaveta === "taxas" && <AbaConfigTaxas perfil={perfil} />}
        {gaveta === "comissoes" && <ConfiguracaoComissoes perfil={perfil} />}
        {gaveta === "contabilidade" && <ExportacaoContabil perfil={perfil} />}
        {gaveta === "meuplano" && (perfil?.isDono ? <AbaMeuPlano perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito ao proprietário.</p>)}
        {gaveta === "fidelidade" && (perfil?.isDono ? <GavetaFidelidade perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito ao proprietário.</p>)}
        {gaveta === "clube" && (perfil?.isDono ? <PainelClubeAssinaturas perfil={perfil} /> : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito ao proprietário.</p>)}
        {gaveta === "documentos" && <GavetaDocumentos />}
        {gaveta === "vitrine" && (perfil?.isDono
          ? <><ConfigVitrine perfil={perfil} /><GavetaPromocoesVitrine perfil={perfil} /></>
          : <p style={{ color: C.danger, fontWeight: 700 }}>Acesso restrito ao proprietário.</p>
        )}

        {gaveta === "empresa" && (
          <form onSubmit={solicitarSenhaDeSeguranca} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Card className="shadow-sm" style={{ padding: 32, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.sidebarBg}` }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div><label style={labelStyle}>Nome Fantasia *</label><input style={inputStyle} required value={formSalao.nome_fantasia} onChange={e => setFormSalao({...formSalao, nome_fantasia: e.target.value})} /></div>
                <div><label style={labelStyle}>Razão Social</label><input style={inputStyle} value={formSalao.razao_social} onChange={e => setFormSalao({...formSalao, razao_social: e.target.value})} /></div>
              </div>

              <h4 className="font-title uppercase tracking-widest" style={{ margin: "24px 0 16px", fontSize: 11, fontWeight: 700, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8 }}>
                <FiFileText size={16} color={C.textLight} /> Documentação Fiscal
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
                <div><label style={labelStyle}>CNPJ</label><input style={inputStyle} value={formSalao.cnpj} onChange={e => setFormSalao({...formSalao, cnpj: e.target.value})} placeholder="00.000.000/0000-00" /></div>
                <div><label style={labelStyle}>Inscrição Municipal</label><input style={inputStyle} value={formSalao.inscricao_municipal} onChange={e => setFormSalao({...formSalao, inscricao_municipal: e.target.value})} /></div>
                <div><label style={labelStyle}>Inscrição Estadual</label><input style={inputStyle} value={formSalao.inscricao_estadual} onChange={e => setFormSalao({...formSalao, inscricao_estadual: e.target.value})} /></div>
                <div><label style={labelStyle}>Atividade / CNAE</label><input style={inputStyle} value={formSalao.cnae} onChange={e => setFormSalao({...formSalao, cnae: e.target.value})} placeholder="Ex: 9602-5/02" /></div>
                <div>
                  <label style={labelStyle}>Regime Tributário</label>
                  <select style={inputStyle} value={formSalao.regime_tributario} onChange={e => setFormSalao({...formSalao, regime_tributario: e.target.value})}>
                    <option value="">Não informado</option>
                    <option value="MEI">MEI</option>
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="Lucro Presumido">Lucro Presumido</option>
                    <option value="Lucro Real">Lucro Real</option>
                  </select>
                </div>
                <div><label style={labelStyle}>E-mail Fiscal (NFS-e)</label><input type="email" style={inputStyle} value={formSalao.email_fiscal} onChange={e => setFormSalao({...formSalao, email_fiscal: e.target.value})} placeholder="fiscal@empresa.com.br" /></div>
              </div>

              <h4 className="font-title uppercase tracking-widest" style={{ margin: "24px 0 16px", fontSize: 11, fontWeight: 700, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8 }}>
                <FiMapPin size={16} color={C.textLight} /> Contato e Endereço Operacional
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div><label style={labelStyle}>Telefone Comercial</label><input style={inputStyle} value={formSalao.telefone} onChange={e => setFormSalao({...formSalao, telefone: e.target.value})} placeholder="(00) 00000-0000" /></div>
                <div><label style={labelStyle}>E-mail de Suporte</label><input type="email" style={inputStyle} value={formSalao.email_contato} onChange={e => setFormSalao({...formSalao, email_contato: e.target.value})} placeholder="contato@empresa.com.br" /></div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1.5fr", gap: 16 }}>
                  <div><label style={labelStyle}>CEP</label><input style={inputStyle} value={formSalao.cep} onChange={e => buscarCep(e.target.value)} maxLength={9} placeholder="00000-000" /></div>
                  <div><label style={labelStyle}>Logradouro</label><input style={inputStyle} value={formSalao.logradouro} onChange={e => setFormSalao({...formSalao, logradouro: e.target.value})} /></div>
                  <div><label style={labelStyle}>Número</label><input style={inputStyle} value={formSalao.numero} onChange={e => setFormSalao({...formSalao, numero: e.target.value})} /></div>
                  <div><label style={labelStyle}>Complemento</label><input style={inputStyle} value={formSalao.complemento} onChange={e => setFormSalao({...formSalao, complemento: e.target.value})} placeholder="Loja, Sala..." /></div>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr", gap: 16 }}>
                  <div><label style={labelStyle}>Bairro</label><input style={inputStyle} value={formSalao.bairro} onChange={e => setFormSalao({...formSalao, bairro: e.target.value})} /></div>
                  <div><label style={labelStyle}>Cidade</label><input style={inputStyle} value={formSalao.cidade} onChange={e => setFormSalao({...formSalao, cidade: e.target.value})} /></div>
                  <div><label style={labelStyle}>Estado</label><input style={inputStyle} value={formSalao.estado} onChange={e => setFormSalao({...formSalao, estado: e.target.value})} placeholder="UF" maxLength={2} /></div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <label style={labelStyle}>
                    Código Município (IBGE)
                    <a href="https://www.ibge.gov.br/explica/codigos-dos-municipios.php" target="_blank" rel="noopener noreferrer" style={{ color: C.sidebarBg, marginLeft: 8, textTransform: 'none', fontWeight: 600, textDecoration: 'underline' }}>
                      (Consultar no IBGE)
                    </a>
                  </label>
                  <input style={inputStyle} value={formSalao.codigo_ibge} onChange={e => setFormSalao({...formSalao, codigo_ibge: e.target.value})} placeholder="Ex: 3304557" />
                </div>

              </div>

            </Card>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="font-title uppercase tracking-wider transition-all hover:opacity-95 shadow-sm" style={{ padding: "14px 40px", fontSize: 12, background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <FiSave size={16}/> Salvar Empresa
              </button>
            </div>
          </form>
        )}

        {gaveta === "horarios" && (
          <form onSubmit={solicitarSenhaDeSeguranca} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Card className="shadow-sm" style={{ padding: 24, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.sidebarBg}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr className="font-title uppercase tracking-widest" style={{ background: C.bg, color: C.textLight, fontSize: 10, fontWeight: 700, borderBottom: `1px solid ${C.borderMid}` }}>
                    <th style={{ padding: "12px 16px" }}>Atende</th>
                    <th style={{ padding: "12px 16px" }}>Dia Útil</th>
                    <th style={{ padding: "12px 16px" }}>Abertura</th>
                    <th style={{ padding: "12px 16px" }}>Fechamento</th>
                  </tr>
                </thead>
                <tbody>
                  {horarios.map((h, index) => (
                    <tr key={h.dia} style={{ borderBottom: `1px solid ${C.border}`, background: h.ativo ? C.bgCard : C.bg }}>
                      <td style={{ padding: "14px 16px" }}><input type="checkbox" checked={h.ativo} onChange={(e) => atualizarHorario(index, 'ativo', e.target.checked)} style={{ width: 16, height: 16, accentColor: C.sidebarBg }} /></td>
                      <td className="font-title" style={{ padding: "14px 16px", fontWeight: 700, fontSize: 13, color: h.ativo ? C.sidebarBg : C.textLight }}>{h.dia}</td>
                      <td style={{ padding: "14px 16px" }}><input type="time" disabled={!h.ativo} value={h.inicio} onChange={(e) => atualizarHorario(index, 'inicio', e.target.value)} style={{...inputStyle, padding: "8px 12px", width: 120}} /></td>
                      <td style={{ padding: "14px 16px" }}><input type="time" disabled={!h.ativo} value={h.fim} onChange={(e) => atualizarHorario(index, 'fim', e.target.value)} style={{...inputStyle, padding: "8px 12px", width: 120}} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="font-title uppercase tracking-wider transition-all hover:opacity-95 shadow-sm" style={{ padding: "14px 40px", fontSize: 12, background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <FiSave size={16}/> Salvar Horários
              </button>
            </div>

            <DiasExcepcionais perfil={perfil} />
          </form>
        )}

        {gaveta === "financeiro" && (
          noShowLiberado === false
            ? <BloqueioModulo salaoId={perfil?.salao_id} moduloChave="no_show" nome="Garantia de Reserva (No-Show)" descricao="Reduza faltas e cancelamentos de última hora cobrando uma taxa de reserva antecipada dos clientes." preco={29.90} itens={['Cobrança automática de taxa de reserva', 'Link de pagamento enviado por WhatsApp', 'Regras flexíveis por tipo de serviço', 'Cancelamento com prazo configurável', 'Relatório de taxas cobradas']} />
            : <form onSubmit={solicitarSenhaDeSeguranca} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <ConfiguracaoFinanceira cobrarSinal={cobrarSinal} setCobrarSinal={setCobrarSinal} porcentagemSinal={porcentagemSinal} setPorcentagemSinal={setPorcentagemSinal} prazoSinalMinutos={prazoSinalMinutos} setPrazoSinalMinutos={setPrazoSinalMinutos} gatewayPagamento={gatewayPagamento} setGatewayPagamento={setGatewayPagamento} tokenPagamento={tokenPagamento} setTokenPagamento={setTokenPagamento} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="font-title uppercase tracking-wider transition-all hover:opacity-95 shadow-sm" style={{ padding: "14px 40px", fontSize: 12, background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <FiSave size={16}/> Salvar Financeiro
                  </button>
                </div>
              </form>
        )}

        {gaveta === "perfil" && (
          <form onSubmit={solicitarSenhaDeSeguranca} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Card className="shadow-sm" style={{ padding: 32, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.sidebarBg}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div><label style={labelStyle}>Nome Completo</label><input style={inputStyle} required value={formPerfil.nome} onChange={e => setFormPerfil({...formPerfil, nome: e.target.value})} /></div>
                <div><label style={labelStyle}>Telefone Pessoal</label><input style={inputStyle} value={formPerfil.telefone} onChange={e => setFormPerfil({...formPerfil, telefone: e.target.value})} placeholder="(00) 00000-0000" /></div>
              </div>
            </Card>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="font-title uppercase tracking-wider transition-all hover:opacity-95 shadow-sm" style={{ padding: "14px 40px", fontSize: 12, background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <FiSave size={16}/> Salvar Perfil
              </button>
            </div>
          </form>
        )}

        {gaveta === "seguranca" && (
          <form onSubmit={handleTrocarSenha} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Card className="shadow-sm" style={{ padding: 32, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.danger}` }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div><label style={labelStyle}>Senha Atual</label><input type="password" required style={inputStyle} value={formSenha.atual} onChange={e => setFormSenha({...formSenha, atual: e.target.value})} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div><label style={labelStyle}>Nova Senha</label><input type="password" required style={inputStyle} value={formSenha.nova} onChange={e => setFormSenha({...formSenha, nova: e.target.value})} placeholder="Mínimo 6 caracteres" /></div>
                  <div><label style={labelStyle}>Confirmar Nova Senha</label><input type="password" required style={inputStyle} value={formSenha.confirmacao} onChange={e => setFormSenha({...formSenha, confirmacao: e.target.value})} /></div>
                </div>
              </div>
            </Card>
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <button type="submit" className="font-title uppercase tracking-wider transition-all hover:opacity-90 shadow-sm" style={{ background: C.danger, color: "#fff", border: "none", padding: "14px 32px", borderRadius: RAIO_MD, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                <FiLock size={14}/> {trocandoSenha ? "A atualizar..." : "Atualizar Senha"}
              </button>
            </div>
          </form>
        )}

      </div>

      {modalSenhaAberto && (
        <div style={{ ...overlayModal, zIndex: 9999 }}>
          <div style={{ ...containerModal, padding: 32, width: "100%", maxWidth: 400 }}>
            <h3 className="font-title uppercase tracking-widest" style={{ margin: "0 0 8px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, color: C.sidebarBg, fontWeight: 700 }}>
              <FiLock size={16} /> Cofre de Segurança
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 12, color: C.textMuted, textAlign: "center", fontWeight: 500 }}>Confirme a sua credencial administrativa para gravar as alterações.</p>
            
            <input type="password" style={{ ...inputStyle, padding: "14px", marginBottom: 20 }} placeholder="••••••••" value={senhaConfirmacao} onChange={e => setSenhaConfirmacao(e.target.value)} autoFocus onKeyDown={e => { if(e.key === 'Enter') confirmarSenhaESalvar(); }}/>
            
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={confirmarSenhaESalvar} className="font-title uppercase tracking-wider transition-all hover:opacity-90" style={{ flex: 2, background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {verificandoSenha ? "A validar..." : "Confirmar"}
              </button>
              <button onClick={() => setModalSenhaAberto(false)} className="transition-all hover:bg-slate-50" style={{ flex: 1, padding: "12px 0", background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}