'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_LG, RAIO_2XL } from '@/lib/estiloGlobal';

interface Props {
  perfil: { salao_id: string; id: string; isDono: boolean };
}

export function ModalAceiteContrato({ perfil }: Props) {
  const [contrato, setContrato] = useState<{ id: number; titulo: string; conteudo: string; versao: number } | null>(null);
  const [aceitando, setAceitando] = useState(false);
  const [aceito, setAceito] = useState(false);
  const [concordou, setConcordou] = useState(false);
  const [concordouDPA, setConcordouDPA] = useState(false);

  useEffect(() => {
    if (!perfil.isDono) return; // Apenas donos precisam aceitar
    verificarContrato();
  }, [perfil.salao_id]);

  async function verificarContrato() {
    // Busca contrato ativo
    const { data: doc } = await supabase
      .from('plataforma_documentos')
      .select('id, titulo, conteudo, versao')
      .eq('tipo', 'contrato')
      .eq('ativo', true)
      .maybeSingle();

    if (!doc) return; // Sem contrato publicado = sem gate

    // Verifica se este salão já aceitou esta versão
    const { data: aceiteExistente } = await supabase
      .from('aceites_contrato')
      .select('id')
      .eq('salao_id', perfil.salao_id)
      .eq('documento_id', doc.id)
      .eq('versao_aceita', doc.versao)
      .maybeSingle();

    if (!aceiteExistente) {
      setContrato(doc);
    }
  }

  async function registrarAceite() {
    if (!contrato || !concordou) return;
    setAceitando(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/aceite-contrato', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        salao_id: perfil.salao_id,
        usuario_id: perfil.id,
        documento_id: contrato.id,
        versao_aceita: contrato.versao,
        concordou_dpa: concordouDPA,
      }),
    });

    if (res.ok) {
      setAceito(true);
      setTimeout(() => setContrato(null), 400);
    }
    setAceitando(false);
  }

  if (!contrato) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9990,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: C.bgCard, borderRadius: RAIO_2XL, width: '100%', maxWidth: 680,
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '24px 28px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
            Atualização de Contrato — v{contrato.versao}
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.sidebarBg }}>{contrato.titulo}</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: C.textMuted }}>
            Uma nova versão do contrato foi publicada. Leia com atenção e aceite para continuar usando o sistema.
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          <div style={{
            fontSize: 13, color: C.textMain, lineHeight: 1.75,
            whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif',
          }}>
            {contrato.conteudo}
          </div>
        </div>

        <div style={{ padding: '18px 28px 24px', borderTop: `1px solid ${C.border}`, background: '#FAFAFA' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
            <input
              type='checkbox'
              checked={concordou}
              onChange={e => setConcordou(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, cursor: 'pointer', accentColor: C.sidebarBg }}
            />
            <span style={{ fontSize: 13, color: C.textMain, lineHeight: 1.5 }}>
              Li e concordo com os termos do contrato acima (versão {contrato.versao}).
              Declaro que tenho poderes para assinar em nome do estabelecimento.
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
            <input
              type='checkbox'
              checked={concordouDPA}
              onChange={e => setConcordouDPA(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, cursor: 'pointer', accentColor: C.sidebarBg }}
            />
            <span style={{ fontSize: 13, color: C.textMain, lineHeight: 1.5 }}>
              Autorizo o Luarys a tratar dados pessoais dos clientes do meu salão como operador, conforme o{' '}
              <a href="/dpa" target="_blank" rel="noopener noreferrer" style={{ color: C.sidebarBg, fontWeight: 700, textDecoration: 'underline' }}>
                Contrato de Tratamento de Dados (CTD)
              </a>{' '}
              e a LGPD (Lei 13.709/2018).
            </span>
          </label>

          <button
            onClick={registrarAceite}
            disabled={!concordou || !concordouDPA || aceitando || aceito}
            style={{
              width: '100%', padding: '14px', borderRadius: RAIO_LG, border: 'none',
              background: concordou && concordouDPA && !aceito ? C.sidebarBg : C.border,
              color: '#fff', fontSize: 14, fontWeight: 800, cursor: concordou && concordouDPA && !aceito ? 'pointer' : 'not-allowed',
              letterSpacing: '0.5px', transition: 'background 0.2s',
            }}
          >
            {aceito ? 'Aceito! Carregando...' : aceitando ? 'Registrando...' : 'Aceitar e continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}
