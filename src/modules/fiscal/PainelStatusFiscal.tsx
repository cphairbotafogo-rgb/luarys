'use client';

import { useState, useRef } from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiFileText, FiCheckCircle, FiAlertTriangle, FiUpload, FiEye, FiEyeOff } from 'react-icons/fi';
import { useStatusFiscal } from './useStatusFiscal';
import { supabase } from '@/lib/supabase';
import { certificadoPrecisaAtencao } from './tipos_fiscal';
import type { StatusCertificado } from './tipos_fiscal';

const LABEL_CERTIFICADO: Record<StatusCertificado, string> = {
  pendente:  'Envie seu certificado A1 para começar a emitir notas.',
  enviado:   'Recebido — aguardando validação junto ao provedor.',
  valido:    '',
  expirado:  'Expirado — envie um certificado atualizado.',
  invalido:  'Não foi possível validar — verifique o arquivo enviado.',
};

function BadgeModulo({ nome, ativo }: { nome: string; ativo: boolean }) {
  return (
    <div style={{ background: '#fff', borderRadius: RAIO_MD, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>{nome}</span>
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
        color:       ativo ? '#15803D' : C.textLight,
        background:  ativo ? '#DCFCE7' : C.bg,
      }}>
        {ativo ? 'Ativo' : 'Não contratado'}
      </span>
    </div>
  );
}

/**
 * Painel de status fiscal do salão (NFS-e / NFC-e / certificado A1).
 * Exibir na aba Configurações do salão.
 * Substituirá TabCertificadoA1.tsx quando a migração para nfe_config_empresa estiver concluída.
 */
export function PainelStatusFiscal() {
  const toast = useToast();
  const { status, carregando, erro, recarregar } = useStatusFiscal();

  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo]           = useState<File | null>(null);
  const [senha, setSenha]               = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando]         = useState(false);

  async function enviarCertificado() {
    if (!arquivo || !senha.trim()) {
      toast.aviso('Selecione o arquivo e informe a senha do certificado.');
      return;
    }

    const ext = arquivo.name.split('.').pop()?.toLowerCase();
    if (!['pfx', 'p12'].includes(ext ?? '')) {
      toast.erro('Formato inválido. Envie .pfx ou .p12.');
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      toast.erro('Arquivo muito grande. Máximo 5 MB.');
      return;
    }

    setEnviando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const form = new FormData();
      form.append('certificado', arquivo);
      form.append('senha', senha);

      const res  = await fetch('/api/fiscal/upload-a1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || `Erro ${res.status}`);

      setArquivo(null);
      setSenha('');
      toast.sucesso(json.ativado
        ? 'Certificado validado e módulo fiscal ativado!'
        : 'Certificado recebido. Aguardando validação.');
      await recarregar();
    } catch (e: any) {
      toast.erro('Erro ao enviar: ' + e.message);
    } finally {
      setEnviando(false);
    }
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
    background: C.bgCard, outlineColor: C.sidebarBg,
  };

  if (carregando) {
    return (
      <div style={{ padding: 24, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
        <p style={{ color: C.textLight, fontSize: 13 }}>Carregando status fiscal...</p>
      </div>
    );
  }

  if (erro || !status) {
    return (
      <div style={{ padding: 24, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
        <p style={{ color: C.textMuted, fontSize: 13 }}>
          {erro ?? 'Nenhum módulo fiscal configurado ainda para este salão.'}
        </p>
      </div>
    );
  }

  const alertaCertificado = certificadoPrecisaAtencao(status.certificadoStatus);
  const emHomologacao     = status.ambiente === 'homologacao';

  return (
    <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, padding: 24 }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiFileText size={18} color={C.sidebarBg} />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Emissão Fiscal
          </h3>
        </div>
        {emHomologacao && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: '#B45309', background: '#FEF3C7' }}>
            Ambiente de testes
          </span>
        )}
      </div>

      <p style={{ margin: '0 0 16px', fontSize: 12, color: C.textMuted }}>CNPJ: {status.cnpj}</p>

      {/* Módulos ativos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <BadgeModulo nome="NFS-e (serviços / agendamentos)" ativo={status.nfseAtivo} />
        <BadgeModulo nome="NFC-e (balcão / Vitrine de Produtos)" ativo={status.nfceAtivo} />
      </div>

      {/* Status do certificado */}
      <div style={{
        borderRadius: RAIO_MD, padding: '14px 16px',
        background: alertaCertificado ? '#FFF7ED' : '#F0FDF4',
        border: `1px solid ${alertaCertificado ? '#FDE68A' : '#BBF7D0'}`,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        {alertaCertificado
          ? <FiAlertTriangle size={16} color="#C97B3D" style={{ flexShrink: 0, marginTop: 2 }} />
          : <FiCheckCircle  size={16} color="#15803D" style={{ flexShrink: 0, marginTop: 2 }} />
        }
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: C.textMain }}>Certificado digital A1</p>
          <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>
            {status.certificadoStatus === 'valido'
              ? `Válido até ${status.certificadoValidade ? new Date(status.certificadoValidade.replace(/-/g, '/')).toLocaleDateString('pt-BR') : '—'}`
              : LABEL_CERTIFICADO[status.certificadoStatus]
            }
          </p>

          {/* Formulário de upload — exibido quando certificado precisa de atenção */}
          {alertaCertificado && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                ref={inputRef}
                type="file"
                accept=".pfx,.p12"
                style={{ display: 'none' }}
                onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              />
              <div>
                <label style={labelSt}>Arquivo do certificado (.pfx ou .p12)</label>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: RAIO_MD,
                    border: `2px dashed ${arquivo ? C.sidebarBg : C.borderMid}`,
                    background: arquivo ? C.sidebarBg + '08' : '#fff',
                    cursor: 'pointer', fontSize: 12, color: arquivo ? C.sidebarBg : C.textMuted,
                    fontWeight: 600, textAlign: 'left',
                  }}
                >
                  <FiUpload size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  {arquivo ? arquivo.name : 'Clique para selecionar…'}
                </button>
              </div>

              <div>
                <label style={labelSt}>Senha do certificado</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="Senha do arquivo A1"
                    style={{ ...inputSt, paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex' }}
                  >
                    {mostrarSenha ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>

              <button
                onClick={enviarCertificado}
                disabled={enviando || !arquivo || !senha.trim()}
                style={{
                  padding: '10px 20px', borderRadius: RAIO_MD, border: 'none',
                  background: (enviando || !arquivo || !senha.trim()) ? C.borderMid : C.sidebarBg,
                  color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: (enviando || !arquivo || !senha.trim()) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                }}
              >
                <FiUpload size={13} /> {enviando ? 'Enviando...' : 'Enviar certificado'}
              </button>
            </div>
          )}
        </div>
      </div>

      {emHomologacao && (
        <p style={{ margin: '12px 0 0', fontSize: 11, color: C.textLight, lineHeight: 1.6 }}>
          Este CNPJ está em ambiente de testes (homologação) — as notas emitidas aqui não têm valor fiscal.
          A ativação em produção acontece após a validação do certificado.
        </p>
      )}
    </div>
  );
}
