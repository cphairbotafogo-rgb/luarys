'use client'
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import {
  FiUpload, FiCheckCircle, FiClock, FiAlertCircle,
  FiShield, FiInfo, FiEye, FiEyeOff,
} from 'react-icons/fi';

type StatusFiscal = 'inativo' | 'pendente_a1' | 'a1_recebido' | 'processando' | 'ativo';

const LABELS: Record<StatusFiscal, { texto: string; cor: string; bg: string; icone: React.ReactNode }> = {
  inativo:      { texto: 'Módulo Inativo',           cor: '#64748B', bg: '#F8FAFC', icone: <FiAlertCircle size={14} /> },
  pendente_a1:  { texto: 'Aguardando Processamento', cor: '#B45309', bg: '#FFFBEB', icone: <FiClock size={14} /> },
  a1_recebido:  { texto: 'Certificado Recebido',     cor: '#1D4ED8', bg: '#EFF6FF', icone: <FiShield size={14} /> },
  processando:  { texto: 'Ativando junto à NFs',     cor: '#7C3AED', bg: '#F5F3FF', icone: <FiClock size={14} /> },
  ativo:        { texto: 'Módulo Fiscal Ativo',       cor: '#15803D', bg: '#F0FDF4', icone: <FiCheckCircle size={14} /> },
};

interface Props { perfil: any }

export function TabCertificadoA1({ perfil }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus]             = useState<StatusFiscal>('inativo');
  const [enviado_em, setEnviadoEm]      = useState<string | null>(null);
  const [arquivo, setArquivo]           = useState<File | null>(null);
  const [senha, setSenha]               = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando]         = useState(false);
  const [carregando, setCarregando]     = useState(true);

  useEffect(() => {
    supabase
      .from('saloes')
      .select('status_fiscal, a1_enviado_em')
      .eq('id', perfil.salao_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStatus((data.status_fiscal as StatusFiscal) || 'inativo');
          setEnviadoEm(data.a1_enviado_em);
        }
        setCarregando(false);
      });
  }, [perfil.salao_id]);

  async function enviar() {
    if (!arquivo) { toast.aviso('Selecione o arquivo .pfx ou .p12.'); return; }
    if (!senha.trim()) { toast.aviso('Informe a senha do certificado.'); return; }
    if (arquivo.size > 5 * 1024 * 1024) { toast.erro('Arquivo muito grande. Máximo 5 MB.'); return; }

    setEnviando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const form = new FormData();
      form.append('certificado', arquivo);
      form.append('senha', senha);

      const res = await fetch('/api/fiscal/upload-a1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || `Erro ${res.status}`);

      setArquivo(null);
      setSenha('');
      setEnviadoEm(new Date().toISOString());

      if (json.ativado) {
        // Cenário A: Brasil NFe respondeu de forma síncrona — módulo já ativo
        setStatus('ativo');
        toast.sucesso('Módulo fiscal ativado com sucesso!');
      } else if (json.processando) {
        // Cenário B: enviado automaticamente, aguardando resposta da Brasil NFe
        setStatus('processando');
        toast.sucesso('Certificado enviado para a NFs do Brasil. Ativação automática em andamento.');
      } else {
        // Cenário padrão: admin fará a ativação manual
        setStatus('pendente_a1');
        toast.sucesso('Certificado recebido! A equipe Luarys ativará o módulo em breve.');
      }
    } catch (e: any) {
      toast.erro('Erro ao enviar: ' + e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <p style={{ color: C.textLight, fontSize: 13 }}>Carregando...</p>;

  const info = LABELS[status];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Badge de status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: RAIO_XL, background: info.bg, border: `1px solid ${info.cor}30` }}>
        <span style={{ color: info.cor }}>{info.icone}</span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: info.cor }}>{info.texto}</p>
          {enviado_em && status !== 'inativo' && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textLight }}>
              Certificado enviado em {new Date(enviado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* Módulo ativo — estado final */}
      {status === 'ativo' && (
        <div style={{ padding: 24, borderRadius: RAIO_XL, background: '#F0FDF4', border: '1px solid #BBF7D0', textAlign: 'center' }}>
          <FiCheckCircle size={40} color="#15803D" />
          <h3 style={{ margin: '12px 0 6px', fontWeight: 800, color: '#15803D', fontSize: 15 }}>Emissão de Notas Fiscais Ativa</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>
            Seu CNPJ está registrado e o canal com NFs do Brasil está ativo.<br />
            Acesse as abas <strong>NFS-e</strong> ou <strong>NFC-e</strong> para emitir notas.
          </p>
        </div>
      )}

      {/* Aguardando processamento automático */}
      {status === 'processando' && (
        <div style={{ padding: 20, borderRadius: RAIO_XL, background: '#F5F3FF', border: '1px solid #C4B5FD' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <FiClock size={18} color="#7C3AED" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#5B21B6', fontSize: 13 }}>Seu certificado foi enviado automaticamente para a NFs do Brasil.</p>
              <p style={{ margin: 0, fontSize: 12, color: '#7C3AED', lineHeight: 1.6 }}>
                Assim que o processamento for concluído o módulo será ativado automaticamente. Prazo médio: <strong>alguns minutos</strong>. Recarregue esta página para ver a atualização.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Aguardando revisão manual pela equipe Luarys */}
      {(status === 'pendente_a1' || status === 'a1_recebido') && (
        <div style={{ padding: 20, borderRadius: RAIO_XL, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <FiClock size={18} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#92400E', fontSize: 13 }}>Seu certificado está em análise pela equipe Luarys.</p>
              <p style={{ margin: 0, fontSize: 12, color: '#B45309', lineHeight: 1.6 }}>
                Recebemos seu A1 e estamos encaminhando para a NFs do Brasil. Assim que o canal for ativado o status acima ficará verde. Prazo médio: <strong>1 dia útil</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Formulário de envio — só quando inativo */}
      {status === 'inativo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Explicação do processo */}
          <div style={{ padding: 20, borderRadius: RAIO_XL, background: C.bgCard, border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <FiInfo size={16} color={C.sidebarBg} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>Como funciona a emissão de notas pelo Luarys</p>
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.textMuted, lineHeight: 2 }}>
              <li>Você envia abaixo o certificado digital A1 do seu CNPJ (arquivo .pfx ou .p12) e a senha.</li>
              <li>A equipe Luarys encaminha o A1 para a NFs do Brasil e ativa seu canal de emissão.</li>
              <li>Assim que o canal estiver ativo você pode emitir NFS-e e NFC-e diretamente aqui.</li>
            </ol>
            <p style={{ margin: '12px 0 0', fontSize: 11, color: C.textLight, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
              🔒 Seu certificado é transmitido com criptografia (HTTPS) e armazenado com segurança. Ele é usado exclusivamente para emissão de notas fiscais em seu nome.
            </p>
          </div>

          {/* Upload do arquivo */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>
              Certificado Digital A1 (.pfx ou .p12)
            </label>
            <input
              ref={inputRef}
              type="file"
              accept=".pfx,.p12"
              style={{ display: 'none' }}
              onChange={e => setArquivo(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{
                width: '100%', padding: '32px 20px', borderRadius: RAIO_XL,
                border: `2px dashed ${arquivo ? C.sidebarBg : C.borderMid}`,
                background: arquivo ? C.sidebarBg + '08' : C.bgCard,
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              }}
            >
              <FiUpload size={24} color={arquivo ? C.sidebarBg : C.textLight} />
              <span style={{ fontSize: 13, fontWeight: 600, color: arquivo ? C.sidebarBg : C.textMuted }}>
                {arquivo ? arquivo.name : 'Clique para selecionar o arquivo'}
              </span>
              <span style={{ fontSize: 11, color: C.textLight }}>Formatos aceitos: .pfx, .p12 — Máximo 5 MB</span>
            </button>
          </div>

          {/* Senha do certificado */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>
              Senha do Certificado
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Digite a senha do arquivo A1"
                style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: C.bgCard, boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setMostrarSenha(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex' }}>
                {mostrarSenha ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <button
            onClick={enviar}
            disabled={enviando || !arquivo || !senha.trim()}
            style={{ padding: '14px', borderRadius: RAIO_MD, border: 'none', background: (enviando || !arquivo || !senha.trim()) ? C.borderMid : C.sidebarBg, color: '#fff', fontSize: 13, fontWeight: 800, cursor: (enviando || !arquivo || !senha.trim()) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <FiUpload size={15} /> {enviando ? 'Enviando...' : 'Enviar Certificado para Luarys'}
          </button>
        </div>
      )}
    </div>
  );
}
