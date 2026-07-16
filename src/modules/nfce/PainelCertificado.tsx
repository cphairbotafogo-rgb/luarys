'use client'
import { labelPadrao } from '@/lib/estiloGlobal';
import { FiLock } from 'react-icons/fi';
import { C } from '@/lib/constants';
import { S, API } from './tipos';

export function PainelCertificado({ state, dispatch, salaoId, toast }: any) {
  return (
    <div style={S.card}>
      <h3 className="font-title uppercase tracking-widest" style={{ margin: '0 0 12px', fontSize: 13, color: C.sidebarBg, fontWeight: 700 }}>
        Certificado Digital A1
      </h3>
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, lineHeight: 1.6, fontWeight: 500 }}>
        O arquivo do certificado é criptografado nativamente no servidor.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 400 }}>
        <input
          type="file" accept=".pfx"
          onChange={(e: any) => dispatch({ type: 'PATCH', p: { certArquivo: e.target.files[0], certNome: e.target.files[0]?.name } })}
          style={{ fontSize: 13, color: C.textLight, fontFamily: 'var(--font-body)' }} />

        <div>
          <label className="font-title" style={labelPadrao}>Senha do Certificado Digital</label>
          <input
            type="password" placeholder="••••••••" style={S.input}
            value={state.certSenha}
            onChange={(e: any) => dispatch({ type: 'SET', k: 'certSenha', v: e.target.value })} />
        </div>

        <div style={{ display: 'flex', marginTop: 8 }}>
          <button
            className="font-title uppercase tracking-wider transition-all hover:opacity-90 shadow-sm"
            style={{ ...S.btn(C.sidebarBg), display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}
            onClick={async () => {
              if (!state.certArquivo) { toast('Selecione o arquivo .pfx primeiro.', 'erro'); return; }
              if (!state.certSenha)   { toast('Informe a senha do certificado.', 'erro'); return; }
              const res = await API.config.uploadCertificado(state.certArquivo, state.certSenha);
              if (res.sucesso) toast('Certificado instalado com sucesso!', 'sucesso');
              else toast(res.erro || 'Erro ao instalar certificado.', 'erro');
            }}>
            <FiLock size={14} /> Instalar Certificado Digital
          </button>
        </div>

        {state.certInfo?.instalado && (
          <div style={{ marginTop: 16, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#15803D', fontWeight: 600 }}>
            ✓ Certificado instalado em {state.certInfo.data_instalacao ? new Date(state.certInfo.data_instalacao).toLocaleDateString('pt-BR') : '—'}
          </div>
        )}
      </div>
    </div>
  );
}
