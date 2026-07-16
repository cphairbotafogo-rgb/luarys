'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { FiMessageCircle, FiSave } from "react-icons/fi";

export function AbaWhatsappConfig() {
  const toast = useToast();
  const [provedor, setProvedor] = useState('meta');
  const [token, setToken]       = useState('');
  const [phoneId, setPhoneId]   = useState('');
  const [wabaId, setWabaId]     = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando]     = useState(false);
  const [configurado, setConfigurado] = useState(false);

  useEffect(() => {
    supabase.from('plataforma_whatsapp_config')
      .select('provedor, token, phone_number_id, waba_id')
      .eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProvedor(data.provedor || 'meta');
          setToken(data.token || '');
          setPhoneId(data.phone_number_id || '');
          setWabaId(data.waba_id || '');
          setConfigurado(!!(data.token && data.phone_number_id));
        }
        setCarregando(false);
      });
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      const { error } = await supabase.from('plataforma_whatsapp_config').upsert({
        id: 1, provedor,
        token: token || null,
        phone_number_id: phoneId || null,
        waba_id: wabaId || null,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (error) throw error;
      setConfigurado(!!(token && phoneId));
      toast.sucesso('Configuração WhatsApp Luarys salva!');
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  const labelSt: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 5 };
  const inputSt: React.CSSProperties = { padding: '10px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, width: '100%', boxSizing: 'border-box', fontSize: 13, color: C.textMain, fontWeight: 500 };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiMessageCircle size={20} /> WhatsApp Luarys
          </h2>
          {!carregando && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              color: configurado ? '#16A34A' : '#B45309',
              background: configurado ? '#F0FDF4' : '#FFFBEB',
            }}>
              {configurado ? 'Configurado' : 'Pendente'}
            </span>
          )}
        </div>
        <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>
          Credenciais da conta Meta da Luarys. Todos os salões enviam pelo mesmo número — somente a cota por salão muda.
        </p>
      </div>

      <Card style={{ padding: 24, maxWidth: 700 }}>
        {carregando ? (
          <p style={{ color: C.textLight, fontSize: 13 }}>Carregando...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={labelSt}>Provedor</label>
              <select style={inputSt} value={provedor} onChange={e => setProvedor(e.target.value)}>
                <option value="meta">WhatsApp Oficial (Meta / Facebook)</option>
                <option value="zapi">Z-API (Não Oficial)</option>
                <option value="evolution">Evolution API (Não Oficial)</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>{provedor === 'meta' ? 'Permanent Token (EAAI...)' : provedor === 'zapi' ? 'Client Token' : 'Global API Key'}</label>
              <input type="password" style={inputSt} value={token} onChange={e => setToken(e.target.value)}
                placeholder={token ? '•••••••••••••••• (configurado)' : 'Cole o token aqui...'} />
            </div>
            <div>
              <label style={labelSt}>{provedor === 'meta' ? 'Phone Number ID' : provedor === 'zapi' ? 'Instance ID' : 'Instance Name'}</label>
              <input style={inputSt} value={phoneId} onChange={e => setPhoneId(e.target.value)} placeholder="Ex: 123456789012345" />
            </div>
            {provedor === 'meta' && (
              <div>
                <label style={labelSt}>WABA ID (WhatsApp Business Account ID)</label>
                <input style={inputSt} value={wabaId} onChange={e => setWabaId(e.target.value)} placeholder="Ex: 987654321098765" />
              </div>
            )}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <button onClick={salvar} disabled={salvando}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: salvando ? C.borderMid : C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: salvando ? 'not-allowed' : 'pointer' }}>
                <FiSave size={14} /> {salvando ? 'Salvando...' : 'Salvar Configuração'}
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
