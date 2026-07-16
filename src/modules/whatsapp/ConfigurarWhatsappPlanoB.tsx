'use client';

/**
 * ConfigurarWhatsappPlanoB — EXCLUSIVO PLANO B ("Gestão Meta")
 *
 * Permite que o salão (ou o suporte da Luarys) cole as credenciais do sub-WABA
 * próprio do salão. O token DEVE ser de System User permanente — tokens temporários
 * expiram em 24h ou 60 dias sem aviso e quebram o envio silenciosamente.
 *
 * O token nunca trafega para o frontend após salvo: a API devolve apenas
 * waba_id, phone_number_id e status — sem o token.
 *
 * Exibir na aba "Central de Comunicação" quando plano = 'gestao_meta'.
 */

import { useState, useEffect } from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiCheckCircle, FiAlertTriangle, FiEye, FiEyeOff, FiExternalLink } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';

interface ConfigAtual {
  plano: string;
  waba_id: string | null;
  phone_number_id: string | null;
  ativo: boolean;
  provisionado_em: string | null;
}

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: C.textLight,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  display: 'block', marginBottom: 6,
};
const inputSt: React.CSSProperties = {
  padding: '10px 14px', borderRadius: RAIO_MD,
  border: `1px solid ${C.borderMid}`, width: '100%',
  boxSizing: 'border-box', fontSize: 13, color: C.textMain,
  background: C.bgCard, outlineColor: C.sidebarBg, fontFamily: 'monospace',
};

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <div style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
        background: C.sidebarBg, color: '#fff', fontSize: 12, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {n}
      </div>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: C.textMain }}>{titulo}</p>
        <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

export function ConfigurarWhatsappPlanoB() {
  const toast = useToast();

  const [config, setConfig]           = useState<ConfigAtual | null>(null);
  const [carregando, setCarregando]   = useState(true);
  const [salvando, setSalvando]       = useState(false);

  const [token, setToken]             = useState('');
  const [phoneId, setPhoneId]         = useState('');
  const [wabaId, setWabaId]           = useState('');
  const [mostrarToken, setMostrarToken] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setCarregando(false); return; }

      const res = await fetch('/api/whatsapp/config-plano-b', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setConfig(await res.json());
      setCarregando(false);
    }
    carregar();
  }, []);

  async function salvar() {
    if (!token.trim() || !phoneId.trim() || !wabaId.trim()) {
      toast.aviso('Preencha todos os campos antes de salvar.');
      return;
    }
    setSalvando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const res = await fetch('/api/whatsapp/config-plano-b', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, phone_number_id: phoneId, waba_id: wabaId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any).erro || `Erro ${res.status}`);
      }

      toast.sucesso('Credenciais salvas com segurança. WhatsApp Plano B ativo.');
      setToken(''); // Limpa o campo — token não deve ficar visível após salvo
      setConfig({ plano: 'gestao_meta', waba_id: wabaId, phone_number_id: phoneId, ativo: true, provisionado_em: new Date().toISOString() });
    } catch (e: any) {
      toast.erro('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return (
    <div style={{ padding: 24, color: C.textLight, fontSize: 13 }}>Carregando...</div>
  );

  return (
    <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 24 }}>

      {/* Cabeçalho Plano B */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            WhatsApp — Plano B (Gestão Meta)
          </h3>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: '#15803D', background: '#DCFCE7' }}>
            Exclusivo Plano B
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
          Seu salão usa a própria conta WhatsApp Business (WABA). A Meta te cobra diretamente — o Luarys cobra apenas a mensalidade de gestão. Configure aqui as credenciais do seu sub-WABA.
        </p>
      </div>

      {/* Status atual */}
      {config?.waba_id && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: RAIO_MD,
          padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <FiCheckCircle size={16} color="#15803D" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#15803D' }}>Conectado</p>
            <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>
              WABA ID: <code style={{ fontFamily: 'monospace' }}>{config.waba_id}</code><br />
              Phone Number ID: <code style={{ fontFamily: 'monospace' }}>{config.phone_number_id}</code><br />
              Configurado em: {config.provisionado_em ? new Date(config.provisionado_em).toLocaleString('pt-BR') : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Aviso token permanente */}
      <div style={{
        background: '#FFF7ED', border: '1px solid #FDE68A', borderRadius: RAIO_MD,
        padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <FiAlertTriangle size={16} color="#C97B3D" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
          <strong>Obrigatório: token de System User permanente.</strong> Tokens temporários expiram em 24h ou 60 dias sem aviso e quebram o envio silenciosamente. Siga o passo a passo abaixo para gerar o token correto.
        </p>
      </div>

      {/* Passo a passo */}
      <div style={{ background: C.bg, borderRadius: RAIO_MD, padding: 16, marginBottom: 24 }}>
        <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Como obter as credenciais
        </p>

        <Passo n={1} titulo="Crie um App no Meta for Developers">
          Acesse{' '}
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener" style={{ color: C.sidebarBg }}>
            developers.facebook.com/apps <FiExternalLink size={11} style={{ verticalAlign: 'middle' }} />
          </a>{' '}
          → "Criar app" → tipo <strong>Business</strong> → associe ao seu portfólio de negócios Meta.
        </Passo>

        <Passo n={2} titulo="Configure o produto WhatsApp no app">
          Dentro do app → "Adicionar produto" → <strong>WhatsApp</strong> → "Configurar". Na aba "Introdução", a Meta já cria automaticamente um número de teste — anote o <strong>Phone Number ID</strong> e o <strong>WhatsApp Business Account ID (WABA ID)</strong> exibidos nessa tela.
        </Passo>

        <Passo n={3} titulo='Gere o token de System User permanente (passo crítico)'>
          No <strong>Meta Business Suite</strong> (business.facebook.com) do salão:<br />
          1. Menu lateral → <strong>Configurações</strong> → <strong>Usuários</strong> → <strong>Usuários do sistema</strong><br />
          2. Clique em "Adicionar" → crie um usuário com função <strong>Administrador</strong><br />
          3. Selecione o usuário criado → clique em <strong>"Gerar token"</strong><br />
          4. Selecione o <strong>app Luarys</strong> e as permissões: <code>whatsapp_business_messaging</code>, <code>whatsapp_business_management</code><br />
          5. Em <strong>"Expiração do token"</strong>: selecione <strong>Nunca</strong> (token permanente)<br />
          6. Copie o token gerado — ele só é exibido uma vez.
        </Passo>

        <Passo n={4} titulo="Cole as credenciais abaixo e salve">
          Token + Phone Number ID + WABA ID. O token é criptografado antes de ser salvo — não fica visível após confirmar.
        </Passo>
      </div>

      {/* Formulário */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelSt}>WABA ID (WhatsApp Business Account ID)</label>
          <input
            type="text"
            value={wabaId}
            onChange={e => setWabaId(e.target.value)}
            placeholder="Ex: 123456789012345"
            style={inputSt}
          />
        </div>

        <div>
          <label style={labelSt}>Phone Number ID</label>
          <input
            type="text"
            value={phoneId}
            onChange={e => setPhoneId(e.target.value)}
            placeholder="Ex: 987654321098765"
            style={inputSt}
          />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>
            Encontrado em: Meta for Developers → seu app → WhatsApp → Configuração → "De"
          </p>
        </div>

        <div>
          <label style={labelSt}>Token de System User permanente</label>
          <div style={{ position: 'relative' }}>
            <input
              type={mostrarToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="EAAxxxxxx... (token permanente, não o temporário da tela inicial)"
              style={{ ...inputSt, paddingRight: 42 }}
            />
            <button
              type="button"
              onClick={() => setMostrarToken(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex' }}
            >
              {mostrarToken ? <FiEyeOff size={15} /> : <FiEye size={15} />}
            </button>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#C97B3D', fontWeight: 600 }}>
            Nunca cole o token temporário da aba "Introdução" do app. Use somente o token gerado via Usuários do Sistema com expiração "Nunca".
          </p>
        </div>

        <button
          onClick={salvar}
          disabled={salvando || !token.trim() || !phoneId.trim() || !wabaId.trim()}
          style={{
            padding: '11px 24px', borderRadius: RAIO_MD, border: 'none',
            background: (salvando || !token.trim() || !phoneId.trim() || !wabaId.trim()) ? C.borderMid : C.sidebarBg,
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: (salvando || !token.trim() || !phoneId.trim() || !wabaId.trim()) ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          {salvando ? 'Salvando...' : config?.waba_id ? 'Atualizar credenciais' : 'Salvar e ativar Plano B'}
        </button>
      </div>
    </div>
  );
}
