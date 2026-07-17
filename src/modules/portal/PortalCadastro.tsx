'use client'
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import {
  FONTE_CORPO, cardPremium, eyebrow,
  fileteDourado, tituloSecao, botaoPrimario, inputPadrao, labelPadrao,
} from "./estiloPortal";
import { AnimacaoLogo } from '@/app/AnimacaoLogo';
import { RAIO_MD, RAIO_LG } from "@/lib/estiloGlobal";

function TelaMensagem({ titulo, texto, corBotao = C.sidebarBg, textoBotao, onBotao }: any) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONTE_CORPO }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <AnimacaoLogo compacto />
        <div style={{ ...fileteDourado, marginTop: 14 }} />
      </div>
      <div style={{ ...cardPremium, width: "100%", maxWidth: 440, padding: "40px 32px", textAlign: "center" }}>
        <h1 style={{ ...tituloSecao, margin: "0 0 12px" }}>{titulo}</h1>
        <p style={{ margin: "0 0 28px", fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>{texto}</p>
        {textoBotao && (
          <button onClick={onBotao} className="transition-all hover:opacity-95 shadow-sm" style={{ ...botaoPrimario, background: corBotao }}>
            {textoBotao}
          </button>
        )}
      </div>
    </div>
  );
}

export function PortalCadastro({ onCadastroConcluido, irParaLogin }: any) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarEndereco, setMostrarEndereco] = useState(false);
  const [cadastrado, setCadastrado] = useState(false);
  const [dados, setDados] = useState({
    nome_completo: '',
    email: '',
    telefone_whatsapp: '',
    cpf: '',
    senha: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
  });

  async function cadastrar(e: any) {
    e.preventDefault();
    if (!dados.nome_completo.trim() || !dados.email.trim() || !dados.telefone_whatsapp.trim() || !dados.senha) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }
    if (dados.senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setSalvando(true);
    setErro('');

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: dados.email.trim().toLowerCase(),
      password: dados.senha,
    });

    if (authError || !authData.user) {
      setErro(authError?.message || "Erro ao criar conta. Tente novamente.");
      setSalvando(false);
      return;
    }

    const userId = authData.user.id;

    const { error: perfilError } = await supabase.from('usuarios_portal').insert([{
      id: userId,
      nome_completo: dados.nome_completo.trim(),
      email: dados.email.trim().toLowerCase(),
      telefone_whatsapp: dados.telefone_whatsapp.trim(),
      cpf: dados.cpf.trim() || null,
    }]);

    if (mostrarEndereco && (dados.endereco || dados.bairro || dados.cidade)) {
      try {
        sessionStorage.setItem('eleva_endereco_pendente', JSON.stringify({
          endereco: dados.endereco.trim(),
          bairro: dados.bairro.trim(),
          cidade: dados.cidade.trim(),
          estado: dados.estado.trim(),
        }));
      } catch { /* ignora */ }
    }

    if (perfilError) {
      setErro("Conta criada, mas erro ao salvar perfil. Entre em contato com o suporte.");
      setSalvando(false);
      return;
    }

    setCadastrado(true);
    setSalvando(false);
    onCadastroConcluido({ id: userId });
  }

  if (cadastrado) {
    return (
      <TelaMensagem
        titulo="Conta criada com sucesso!"
        texto="Agora escolha o salão que deseja visitar para fazer o seu primeiro agendamento."
        corBotao={C.success}
        textoBotao="Escolher um Salão"
        onBotao={irParaLogin}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONTE_CORPO }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <AnimacaoLogo compacto />
        <div style={{ ...fileteDourado, marginTop: 14 }} />
      </div>

      <div style={{ ...cardPremium, width: "100%", maxWidth: 440, padding: "40px 32px" }}>
        <p style={{ ...eyebrow, textAlign: "center", margin: 0 }}>Crie a sua conta</p>
        <h1 style={tituloSecao}>Criar minha conta</h1>
        <p style={{ margin: "0 0 28px", fontSize: 13, color: C.textLight, textAlign: "center" }}>Preencha os seus dados para continuar</p>

        <form onSubmit={cadastrar} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelPadrao}>Nome Completo *</label>
            <input type="text" value={dados.nome_completo} onChange={e => setDados({ ...dados, nome_completo: e.target.value })} required placeholder="Seu nome completo" style={inputPadrao} />
          </div>
          <div>
            <label style={labelPadrao}>E-mail *</label>
            <input type="email" value={dados.email} onChange={e => setDados({ ...dados, email: e.target.value })} required placeholder="seu@email.com" style={inputPadrao} />
          </div>
          <div>
            <label style={labelPadrao}>WhatsApp *</label>
            <input type="tel" value={dados.telefone_whatsapp} onChange={e => setDados({ ...dados, telefone_whatsapp: e.target.value })} required placeholder="(11) 99999-9999" style={inputPadrao} />
          </div>
          <div>
            <label style={labelPadrao}>CPF</label>
            <input type="text" value={dados.cpf} onChange={e => setDados({ ...dados, cpf: e.target.value })} placeholder="000.000.000-00 (opcional)" style={inputPadrao} />
          </div>
          <div>
            <label style={labelPadrao}>Senha *</label>
            <input type="password" value={dados.senha} onChange={e => setDados({ ...dados, senha: e.target.value })} required placeholder="Mínimo 6 caracteres" style={inputPadrao} />
          </div>

          <button type="button" onClick={() => setMostrarEndereco(!mostrarEndereco)} className="transition-all hover:opacity-70" style={{ background: "none", border: "none", color: C.sidebarBg, fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", padding: 0, textDecoration: "underline" }}>
            {mostrarEndereco ? "- Ocultar endereço" : "+ Adicionar endereço (opcional)"}
          </button>

          {mostrarEndereco && (
            <>
              <div>
                <label style={labelPadrao}>Endereço (Rua, Nº)</label>
                <input type="text" value={dados.endereco} onChange={e => setDados({ ...dados, endereco: e.target.value })} placeholder="Rua das Flores, 123" style={inputPadrao} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelPadrao}>Bairro</label>
                  <input type="text" value={dados.bairro} onChange={e => setDados({ ...dados, bairro: e.target.value })} style={inputPadrao} />
                </div>
                <div>
                  <label style={labelPadrao}>Cidade</label>
                  <input type="text" value={dados.cidade} onChange={e => setDados({ ...dados, cidade: e.target.value })} style={inputPadrao} />
                </div>
              </div>
              <div>
                <label style={labelPadrao}>Estado</label>
                <input type="text" value={dados.estado} onChange={e => setDados({ ...dados, estado: e.target.value })} maxLength={2} placeholder="SP" style={inputPadrao} />
              </div>
            </>
          )}

          {erro && (
            <div style={{ background: C.dangerBg, borderRadius: RAIO_LG, padding: "12px 16px", border: `1px solid ${C.danger}20` }}>
              <p style={{ margin: 0, color: C.dangerText, fontSize: 12, fontWeight: 600 }}>{erro}</p>
              <button type="button" onClick={() => setErro('')} style={{ marginTop: 8, background: "none", border: `1px solid ${C.sidebarBg}`, color: C.sidebarBg, padding: "6px 12px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Fechar</button>
            </div>
          )}

          <button type="submit" disabled={salvando} className="transition-all hover:opacity-95 shadow-sm" style={{ ...botaoPrimario, marginTop: 8, background: salvando ? C.borderMid : C.sidebarBg, cursor: salvando ? "not-allowed" : "pointer" }}>
            {salvando ? "A criar conta..." : "Criar Conta Grátis"}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: C.textMuted, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
          Já tenho conta.{" "}
          <span onClick={irParaLogin} className="transition-all hover:opacity-70" style={{ color: C.sidebarBg, fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>Fazer login</span>
        </p>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: C.textLight, letterSpacing: "0.3px" }}>Desenvolvido por <span style={{ color: C.douradoEleva, fontWeight: 700 }}>Luarys</span></p>
    </div>
  );
}
