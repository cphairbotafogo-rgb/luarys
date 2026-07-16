'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { inputAdmin, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiKey, FiCheckCircle, FiAlertCircle, FiSave, FiEye, FiEyeOff } from 'react-icons/fi';

export function ConfiguracaoAPIFiscal({ perfil }: any) {
  const toast = useToast();
  const [token, setToken] = useState('');
  const [mostrarToken, setMostrarToken] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    supabase.from('saloes').select('config_fiscal').eq('id', perfil.salao_id).maybeSingle()
      .then(({ data }) => {
        setToken(data?.config_fiscal?.focus_nfe_token || '');
        setCarregando(false);
      });
  }, [perfil?.salao_id]);

  async function salvar() {
    if (!perfil?.salao_id) return;
    setSalvando(true);
    const { data: atual } = await supabase.from('saloes').select('config_fiscal').eq('id', perfil.salao_id).maybeSingle();
    const { error } = await supabase.from('saloes').update({
      config_fiscal: { ...(atual?.config_fiscal || {}), focus_nfe_token: token.trim() },
    }).eq('id', perfil.salao_id);
    if (error) toast.erro('Erro ao salvar: ' + error.message);
    else toast.sucesso('Token salvo com sucesso!');
    setSalvando(false);
  }

  if (carregando) return <p style={{ color: C.textLight, padding: 16 }}>Carregando...</p>;

  const configurado = !!token.trim();

  return (
    <div style={{ padding: '32px 40px', maxWidth: 700 }}>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FiKey size={20} /> Configuração API — Nota Fiscal
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>
          Token de acesso ao provedor Focus NFe para emissão de NFS-e e NFC-e.
        </p>
      </div>

      {/* STATUS */}
      <div style={{ background: configurado ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${configurado ? '#BBF7D0' : '#FED7AA'}`, borderRadius: RAIO_XL, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        {configurado
          ? <FiCheckCircle size={20} color="#15803D" />
          : <FiAlertCircle size={20} color="#C2410C" />}
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: configurado ? '#15803D' : '#C2410C' }}>
            {configurado ? 'Focus NFe configurado — emissão ativa' : 'Token não configurado — emissão desativada'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: configurado ? '#166534' : '#9A3412' }}>
            {configurado
              ? 'NFS-e e NFC-e serão transmitidas via Focus NFe.'
              : 'Cole o token abaixo para ativar a emissão de notas.'}
          </p>
        </div>
      </div>

      {/* CAMPO TOKEN */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 28 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>
          Token de Acesso — Focus NFe
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
          Crie sua conta em <strong>focusnfe.com.br</strong> e acesse <strong>Painel → API → Token de Acesso</strong>.<br />
          O mesmo token serve para NFS-e e NFC-e. O ambiente (Sandbox/Produção) é configurado dentro de cada módulo.
        </p>

        <div style={{ position: 'relative' }}>
          <input
            type={mostrarToken ? 'text' : 'password'}
            placeholder="Cole o token aqui..."
            value={token}
            onChange={e => setToken(e.target.value)}
            style={{ ...inputAdmin, paddingRight: 44, fontFamily: 'monospace', fontSize: 13 }}
          />
          <button
            type="button"
            onClick={() => setMostrarToken(v => !v)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.textLight, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {mostrarToken ? <FiEyeOff size={16} /> : <FiEye size={16} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={salvar}
            disabled={salvando}
            style={{ background: C.sidebarBg, color: '#fff', border: 'none', padding: '12px 32px', borderRadius: RAIO_MD, fontWeight: 800, fontSize: 13, cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: salvando ? 0.7 : 1 }}
          >
            <FiSave size={15} /> {salvando ? 'Salvando...' : 'Salvar Token'}
          </button>
        </div>
      </div>

    </div>
  );
}
