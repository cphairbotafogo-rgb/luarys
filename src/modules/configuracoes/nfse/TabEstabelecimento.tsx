'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiExternalLink, FiAlertCircle } from 'react-icons/fi';

interface Dados {
  nome_fantasia: string;
  cnpj: string;
  razao_social: string;
  inscricao_municipal: string;
  codigo_ibge: string;
  cnae: string;
}

export function TabEstabelecimento({ perfil }: { perfil: any }) {
  const [dados, setDados] = useState<Dados>({
    nome_fantasia: '', cnpj: '', razao_social: '',
    inscricao_municipal: '', codigo_ibge: '', cnae: '',
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    supabase
      .from('saloes')
      .select('nome_fantasia, cnpj, razao_social, inscricao_municipal, codigo_ibge, cnae')
      .eq('id', perfil.salao_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDados({
          nome_fantasia:      data.nome_fantasia      || '',
          cnpj:               data.cnpj               || '',
          razao_social:       data.razao_social        || '',
          inscricao_municipal: data.inscricao_municipal || '',
          codigo_ibge:        data.codigo_ibge         || '',
          cnae:               data.cnae                || '',
        });
        setCarregando(false);
      });
  }, [perfil?.salao_id]);

  const camposFaltando = [
    !dados.cnpj              && 'CNPJ',
    !dados.razao_social      && 'Razão Social',
    !dados.inscricao_municipal && 'Inscrição Municipal',
    !dados.codigo_ibge       && 'Código IBGE',
  ].filter(Boolean) as string[];

  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.textLight,
    textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 5,
  };
  const campo: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: RAIO_MD,
    border: `1px solid ${C.border}`, fontSize: 13, background: C.bg,
    color: C.textMain, fontWeight: 600, boxSizing: 'border-box',
  };

  if (carregando) return <p style={{ color: C.textLight, padding: 16 }}>Carregando...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 620 }}>

      {/* AVISO: dados são de Configurações */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: RAIO_XL, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#1E40AF', lineHeight: 1.6 }}>
          Estes dados são compartilhados com <strong>Configurações → Dados da Empresa</strong>.
          Para corrigir algum campo, edite diretamente em Configurações — o NFS-e usa automaticamente a versão mais recente.
        </p>
        <button
          onClick={() => { window.location.hash = 'configuracoes'; }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <FiExternalLink size={13} /> Editar em Configurações
        </button>
      </div>

      {/* ALERTA: campos obrigatórios faltando */}
      {camposFaltando.length > 0 && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: RAIO_XL, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <FiAlertCircle size={16} color="#C2410C" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#9A3412', lineHeight: 1.6 }}>
            <strong>Campos obrigatórios para emissão de NFS-e:</strong> {camposFaltando.join(', ')}.
            Preencha em Configurações antes de emitir.
          </p>
        </div>
      )}

      {/* CAMPOS (somente leitura) */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>Dados do Estabelecimento</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Nome Fantasia</label>
              <div style={campo}>{dados.nome_fantasia || <span style={{ color: C.textLight }}>—</span>}</div>
            </div>
            <div>
              <label style={lbl}>CNPJ</label>
              <div style={{ ...campo, fontFamily: 'monospace' }}>{dados.cnpj || <span style={{ color: C.danger }}>Não informado</span>}</div>
            </div>
          </div>

          <div>
            <label style={lbl}>Razão Social</label>
            <div style={campo}>{dados.razao_social || <span style={{ color: C.danger }}>Não informado</span>}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Inscrição Municipal</label>
              <div style={{ ...campo, fontFamily: 'monospace' }}>{dados.inscricao_municipal || <span style={{ color: C.danger }}>Não informado</span>}</div>
            </div>
            <div>
              <label style={lbl}>Código IBGE do Município</label>
              <div style={{ ...campo, fontFamily: 'monospace' }}>{dados.codigo_ibge || <span style={{ color: C.danger }}>Não informado</span>}</div>
            </div>
          </div>

          <div>
            <label style={lbl}>CNAE</label>
            <div style={{ ...campo, fontFamily: 'monospace' }}>
              {dados.cnae || <span style={{ color: C.textLight }}>Não informado — preencha em Configurações</span>}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>
              9602501 — cabeleireiros · 9602502 — estética corporal · 9602503 — podólogos
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
