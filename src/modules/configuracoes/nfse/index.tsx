'use client'
import { useState } from 'react';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { FiFileText, FiSettings, FiInfo, FiSend, FiBook, FiMessageCircle } from 'react-icons/fi';
import { TabEstabelecimento }    from './TabEstabelecimento';
import { TabConfiguracoes }      from './TabConfiguracoes';
import { TabInformacoesFiscais } from './TabInformacoesFiscais';
import { TabCertificadoA1 }      from './TabCertificadoA1';
import type { TabNFSe } from './tipos';

interface Props {
  perfil: any;
  onEmitirNotas?: () => void;
}

export function ConfiguracaoNFSe({ perfil, onEmitirNotas }: Props) {
  const [aba, setAba] = useState<TabNFSe>('estabelecimento');

  const tabBtn = (id: TabNFSe, label: string, Icon: React.ElementType) => (
    <button
      key={id}
      onClick={() => setAba(id)}
      style={{
        padding: '10px 20px',
        background:   aba === id ? C.sidebarBg : 'transparent',
        color:        aba === id ? '#fff' : C.textLight,
        border:       'none',
        borderRadius: RAIO_MD,
        fontWeight:   800,
        fontSize:     13,
        cursor:       'pointer',
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        transition:   'all 0.2s',
      }}
    >
      <Icon size={15} /> {label}
    </button>
  );

  const acaoBtnSt = (primario?: boolean): React.CSSProperties => ({
    display:      'flex',
    alignItems:   'center',
    gap:          7,
    padding:      '9px 16px',
    background:   primario ? C.sidebarBg : 'transparent',
    color:        primario ? '#fff' : C.textMuted,
    border:       primario ? 'none' : `1px solid ${C.borderMid}`,
    borderRadius: RAIO_MD,
    fontWeight:   700,
    fontSize:     12,
    cursor:       'pointer',
    whiteSpace:   'nowrap',
  });

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase' }}>
            <FiFileText size={20} /> Configuração NFS-e
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>
            Configure seus dados fiscais e parâmetros de emissão de nota fiscal de serviço.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button style={acaoBtnSt(true)} onClick={onEmitirNotas}>
            <FiSend size={14} /> Emitir notas
          </button>
          <button style={acaoBtnSt()} onClick={() => window.open('https://luarys.com.br/docs/nfse', '_blank')}>
            <FiBook size={14} /> Guia de configuração
          </button>
          <button style={acaoBtnSt()} onClick={() => window.open('https://wa.me/5511999999999?text=Preciso+de+ajuda+com+a+configuração+de+NFS-e', '_blank')}>
            <FiMessageCircle size={14} /> Fale conosco
          </button>
        </div>
      </div>

      {/* ABAS */}
      <div style={{ background: C.bgCard, padding: 6, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, marginBottom: 24, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {tabBtn('estabelecimento', 'Dados do Estabelecimento', FiFileText)}
        {tabBtn('configuracoes',   'Configurações da Nota',    FiSettings)}
        {tabBtn('informacoes',     'Informações Fiscais',       FiInfo)}
        {tabBtn('certificado',     'Certificado A1',            FiSettings)}
      </div>

      {aba === 'estabelecimento' && <TabEstabelecimento perfil={perfil} />}
      {aba === 'configuracoes'   && <TabConfiguracoes   perfil={perfil} />}
      {aba === 'informacoes'     && <TabInformacoesFiscais perfil={perfil} />}
      {aba === 'certificado'     && <TabCertificadoA1 perfil={perfil} />}
    </div>
  );
}
