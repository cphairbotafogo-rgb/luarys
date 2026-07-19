'use client'
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { useToast } from "@/components/Toast";
import { FONTE_CORPO, FONTE_TITULO, fileteDourado, labelPadrao } from "./estiloPortal";
import { AnimacaoLogo } from '@/app/AnimacaoLogo';
import { RAIO_LG, RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { FiEye, FiEyeOff } from 'react-icons/fi';

const D = C.douradoEleva;

function mascaraTel(v: string): string {
  const comPlus = v.trimStart().startsWith('+');
  let d = v.replace(/\D/g, '');
  let prefix = '';
  if (d.startsWith('55') && (comPlus || d.length > 11)) {
    prefix = '+55 ';
    d = d.slice(2);
  }
  d = d.slice(0, 11);
  if (!d) return prefix ? '+55' : '';
  if (d.length <= 10) {
    const ddd = d.slice(0, 2);
    const p1  = d.slice(2, 6);
    const p2  = d.slice(6, 10);
    if (!ddd) return prefix ? '+55' : '';
    return prefix + '(' + ddd + (p1 ? ') ' + p1 : '') + (p2 ? '-' + p2 : '');
  }
  return prefix + d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
}

const inputBase = {
  width: '100%', padding: '13px 14px',
  borderRadius: RAIO_LG, border: `1.5px solid ${C.borderMid}`,
  fontSize: 14, outlineColor: D, color: C.textMain,
  backgroundColor: '#FAFAF9', boxSizing: 'border-box' as const,
  fontFamily: FONTE_CORPO,
};

const ANIM = `
  @keyframes fadeUpPortal {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

function Topo() {
  return (
    <>
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 320, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center top, ${D}18 0%, transparent 65%)`,
      }} />
      <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative', animation: 'fadeUpPortal 0.5s ease-out both' }}>
        <AnimacaoLogo compacto />
        <div style={{ ...fileteDourado, marginTop: 14 }} />
      </div>
    </>
  );
}

function TelaMensagem({ titulo, texto, corBotao = C.sidebarBg, textoBotao, onBotao }: any) {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FAFAF9 0%, #F2EEE4 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: FONTE_CORPO, position: 'relative' }}>
      <Topo />
      <div style={{ width: '100%', maxWidth: 480, background: '#FFFFFF', borderRadius: RAIO_XL, boxShadow: '0 4px 40px -8px rgba(44,54,67,0.13), 0 1px 4px rgba(44,54,67,0.06)', padding: '40px 32px', textAlign: 'center', animation: 'fadeUpPortal 0.5s 0.08s ease-out both' }}>
        <h1 style={{ fontFamily: FONTE_TITULO, margin: '0 0 12px', fontSize: 24, fontWeight: 900, color: C.sidebarBg }}>{titulo}</h1>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>{texto}</p>
        {textoBotao && (
          <button onClick={onBotao} style={{ width: '100%', padding: '13px 20px', background: corBotao, color: '#fff', border: 'none', borderRadius: RAIO_LG, fontWeight: 800, fontSize: 14, fontFamily: FONTE_TITULO, cursor: 'pointer' }}>
            {textoBotao}
          </button>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: ANIM }} />
    </div>
  );
}

export function PortalCadastro({ onCadastroConcluido, irParaLogin }: any) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarEndereco, setMostrarEndereco] = useState(false);
  const [cadastrado, setCadastrado] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [dados, setDados] = useState({
    nome_completo: '', email: '', telefone_whatsapp: '',
    cpf: '', senha: '', endereco: '', bairro: '', cidade: '', estado: '',
  });

  async function cadastrar(e: any) {
    e.preventDefault();
    if (!dados.nome_completo.trim() || !dados.email.trim() || !dados.telefone_whatsapp.trim() || !dados.senha) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    if (dados.senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return; }
    setSalvando(true);
    setErro('');

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: dados.email.trim().toLowerCase(),
      password: dados.senha,
    });

    if (authError || !authData.user) {
      setErro(authError?.message || 'Erro ao criar conta. Tente novamente.');
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
          endereco: dados.endereco.trim(), bairro: dados.bairro.trim(),
          cidade: dados.cidade.trim(), estado: dados.estado.trim(),
        }));
      } catch { /* ignora */ }
    }

    if (perfilError) {
      setErro('Conta criada, mas erro ao salvar perfil. Entre em contato com o suporte.');
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FAFAF9 0%, #F2EEE4 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: FONTE_CORPO, position: 'relative' }}>
      <Topo />

      <div style={{ width: '100%', maxWidth: 480, background: '#FFFFFF', borderRadius: RAIO_XL, boxShadow: '0 4px 40px -8px rgba(44,54,67,0.13), 0 1px 4px rgba(44,54,67,0.06)', padding: '40px 32px', animation: 'fadeUpPortal 0.5s 0.08s ease-out both' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: D }}>Crie a sua conta</p>
          <h1 style={{ fontFamily: FONTE_TITULO, margin: '0 0 8px', fontSize: 26, fontWeight: 900, color: C.sidebarBg, letterSpacing: '-0.5px' }}>Criar minha conta</h1>
          <p style={{ margin: 0, fontSize: 13, color: C.textLight }}>Preencha os seus dados para continuar</p>
        </div>

        <form onSubmit={cadastrar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelPadrao}>Nome Completo *</label>
            <input type="text" value={dados.nome_completo} onChange={e => setDados({ ...dados, nome_completo: e.target.value })} required placeholder="Seu nome completo" style={inputBase} />
          </div>
          <div>
            <label style={labelPadrao}>E-mail *</label>
            <input type="email" value={dados.email} onChange={e => setDados({ ...dados, email: e.target.value })} required placeholder="seu@email.com" style={inputBase} />
          </div>
          <div>
            <label style={labelPadrao}>WhatsApp *</label>
            <input type="tel" value={dados.telefone_whatsapp} onChange={e => setDados({ ...dados, telefone_whatsapp: mascaraTel(e.target.value) })} required placeholder="(11) 99999-9999" style={inputBase} />
          </div>
          <div>
            <label style={labelPadrao}>CPF</label>
            <input type="text" value={dados.cpf} onChange={e => setDados({ ...dados, cpf: e.target.value })} placeholder="000.000.000-00 (opcional)" style={inputBase} />
          </div>
          <div>
            <label style={labelPadrao}>Senha *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={dados.senha}
                onChange={e => setDados({ ...dados, senha: e.target.value })}
                required
                placeholder="Mínimo 6 caracteres"
                style={{ ...inputBase, paddingRight: 46 }}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', padding: 0 }}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <button type="button" onClick={() => setMostrarEndereco(!mostrarEndereco)} style={{ background: 'none', border: 'none', color: D, fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left', padding: 0, textDecoration: 'underline' }}>
            {mostrarEndereco ? '- Ocultar endereço' : '+ Adicionar endereço (opcional)'}
          </button>

          {mostrarEndereco && (
            <>
              <div>
                <label style={labelPadrao}>Endereço (Rua, Nº)</label>
                <input type="text" value={dados.endereco} onChange={e => setDados({ ...dados, endereco: e.target.value })} placeholder="Rua das Flores, 123" style={inputBase} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelPadrao}>Bairro</label>
                  <input type="text" value={dados.bairro} onChange={e => setDados({ ...dados, bairro: e.target.value })} style={inputBase} />
                </div>
                <div>
                  <label style={labelPadrao}>Cidade</label>
                  <input type="text" value={dados.cidade} onChange={e => setDados({ ...dados, cidade: e.target.value })} style={inputBase} />
                </div>
              </div>
              <div>
                <label style={labelPadrao}>Estado</label>
                <input type="text" value={dados.estado} onChange={e => setDados({ ...dados, estado: e.target.value })} maxLength={2} placeholder="SP" style={inputBase} />
              </div>
            </>
          )}

          {erro && (
            <div style={{ background: C.dangerBg, borderRadius: RAIO_LG, padding: '12px 16px', border: `1px solid ${C.danger}20` }}>
              <p style={{ margin: 0, color: C.dangerText, fontSize: 12, fontWeight: 600 }}>{erro}</p>
              <button type="button" onClick={() => setErro('')} style={{ marginTop: 8, background: 'none', border: `1px solid ${C.sidebarBg}`, color: C.sidebarBg, padding: '6px 12px', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Fechar</button>
            </div>
          )}

          <button type="submit" disabled={salvando} style={{ width: '100%', padding: '13px 20px', marginTop: 8, background: salvando ? C.borderMid : C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_LG, fontWeight: 800, fontSize: 14, fontFamily: FONTE_TITULO, cursor: salvando ? 'not-allowed' : 'pointer' }}>
            {salvando ? 'A criar conta...' : 'Criar Conta Grátis'}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: C.textMuted, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
          Já tenho conta.{' '}
          <span onClick={irParaLogin} style={{ color: D, fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>Fazer login</span>
        </p>
      </div>

      <p style={{ marginTop: 28, fontSize: 12, color: C.textLight, letterSpacing: '0.3px', animation: 'fadeUpPortal 0.5s 0.2s ease-out both' }}>
        Desenvolvido por <span style={{ color: D, fontWeight: 700 }}>Luarys</span>
      </p>

      <style dangerouslySetInnerHTML={{ __html: ANIM }} />
    </div>
  );
}
