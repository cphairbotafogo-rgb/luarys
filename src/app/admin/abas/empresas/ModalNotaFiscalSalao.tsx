'use client'
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_2XL } from "@/lib/estiloGlobal";
import { FiX, FiFileText, FiEye, FiEyeOff } from "react-icons/fi";
import { useToast } from "@/components/Toast";

export function ModalNotaFiscalSalao({ salao, onClose, onSaved }: {
  salao: any; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const cf = salao.config_fiscal ?? {};

  const [provedor, setProvedor]     = useState<string>(cf.provedor_nfse ?? 'focusnfe');
  const [tokenFocus, setTokenFocus] = useState<string>(cf.focus_nfe_token ?? '');
  const [tokenBrasil, setTokenBrasil] = useState<string>(cf.brasilnfe_token ?? '');
  const [ambiente, setAmbiente]     = useState<string>(cf.ambiente_nfse ?? 'sandbox');
  const [modo, setModo]             = useState<string>(cf.modo_emissao ?? 'manual');
  const [regime, setRegime]         = useState<string>(cf.regime_tributario ?? 'Simples Nacional');
  const [aliquota, setAliquota]     = useState<string>(String(cf.aliquota_padrao ?? '2.00'));
  const [codigoServ, setCodigoServ] = useState<string>(cf.item_lista_servico ?? '06.01');
  const [liberado, setLiberado]     = useState<boolean>(!!salao.modulo_fiscal_liberado);
  const [verToken, setVerToken]     = useState(false);
  const [salvando, setSalvando]     = useState(false);

  const labelSt: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 5 };
  const inputSt: React.CSSProperties = { padding: '10px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, width: '100%', boxSizing: 'border-box', fontSize: 13, color: C.textMain };
  const radBtnSt = (ativo: boolean): React.CSSProperties => ({
    flex: 1, padding: '9px 12px', borderRadius: RAIO_MD,
    border: `2px solid ${ativo ? C.sidebarBg : C.borderMid}`,
    background: ativo ? C.sidebarBg : '#fff',
    color: ativo ? '#fff' : C.textMuted,
    fontWeight: 700, fontSize: 12, cursor: 'pointer',
  });

  async function salvar() {
    setSalvando(true);
    try {
      const configFiscalNova = {
        ...cf,
        provedor_nfse: provedor,
        focus_nfe_token: tokenFocus.trim() || null,
        brasilnfe_token: tokenBrasil.trim() || null,
        ambiente_nfse: ambiente,
        modo_emissao: modo,
        regime_tributario: regime,
        aliquota_padrao: aliquota,
        item_lista_servico: codigoServ.trim(),
      };
      const { error } = await supabase.from('saloes').update({
        config_fiscal: configFiscalNova,
        modulo_fiscal_liberado: liberado,
      }).eq('id', salao.id);
      if (error) throw error;
      toast.sucesso('Configuração NFS-e salva!');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>

        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: C.bgCard, zIndex: 1 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.textMain, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiFileText size={16} color={C.sidebarBg} /> Configuração NFS-e
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{salao.nome_fantasia || salao.razao_social}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}><FiX size={20} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: liberado ? '#F0FDF4' : '#FFF7ED', borderRadius: RAIO_MD, padding: '12px 16px', border: `1px solid ${liberado ? '#BBF7D0' : '#FED7AA'}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: liberado ? '#15803D' : '#B45309' }}>
                Módulo Fiscal {liberado ? 'Liberado' : 'Bloqueado'}
              </div>
              <div style={{ fontSize: 11, color: liberado ? '#166534' : '#92400E', marginTop: 2 }}>
                {liberado ? 'Salão pode emitir NFS-e.' : 'Ative para habilitar emissão neste salão.'}
              </div>
            </div>
            <button
              onClick={() => setLiberado(v => !v)}
              style={{ padding: '8px 16px', borderRadius: RAIO_MD, border: 'none', background: liberado ? '#15803D' : '#D1D5DB', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
            >
              {liberado ? 'Liberado ✓' : 'Liberar'}
            </button>
          </div>

          <div>
            <label style={labelSt}>Provedor NFS-e</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={radBtnSt(provedor === 'focusnfe')} onClick={() => setProvedor('focusnfe')}>Focus NFe</button>
              <button style={radBtnSt(provedor === 'brasilnfe')} onClick={() => setProvedor('brasilnfe')}>Brasil NFe</button>
            </div>
          </div>

          {provedor === 'focusnfe' && (
            <div>
              <label style={labelSt}>Token de Acesso — Focus NFe</label>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: C.textMuted }}>focusnfe.com.br → Painel → API → Token de Acesso</p>
              <div style={{ position: 'relative' }}>
                <input
                  type={verToken ? 'text' : 'password'}
                  style={{ ...inputSt, paddingRight: 40, fontFamily: 'monospace' }}
                  value={tokenFocus}
                  onChange={e => setTokenFocus(e.target.value)}
                  placeholder={tokenFocus ? '•••••• (configurado)' : 'Cole o token aqui...'}
                />
                <button type="button" onClick={() => setVerToken(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.textLight, cursor: 'pointer', display: 'flex' }}>
                  {verToken ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>
          )}

          {provedor === 'brasilnfe' && (
            <div>
              <label style={labelSt}>Token de Acesso — Brasil NFe</label>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: C.textMuted }}>brasilnfe.com.br → Painel → Configurações → API</p>
              <div style={{ position: 'relative' }}>
                <input
                  type={verToken ? 'text' : 'password'}
                  style={{ ...inputSt, paddingRight: 40, fontFamily: 'monospace' }}
                  value={tokenBrasil}
                  onChange={e => setTokenBrasil(e.target.value)}
                  placeholder={tokenBrasil ? '•••••• (configurado)' : 'Cole o token aqui...'}
                />
                <button type="button" onClick={() => setVerToken(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.textLight, cursor: 'pointer', display: 'flex' }}>
                  {verToken ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelSt}>Ambiente</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={radBtnSt(ambiente === 'sandbox')} onClick={() => setAmbiente('sandbox')}>Sandbox</button>
                <button style={radBtnSt(ambiente === 'producao')} onClick={() => setAmbiente('producao')}>Produção</button>
              </div>
            </div>
            <div>
              <label style={labelSt}>Emissão</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={radBtnSt(modo === 'manual')} onClick={() => setModo('manual')}>Manual</button>
                <button style={radBtnSt(modo === 'automatico')} onClick={() => setModo('automatico')}>Automático</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>Regime Tributário</label>
              <select style={inputSt} value={regime} onChange={e => setRegime(e.target.value)}>
                <option value="Simples Nacional">Simples Nacional</option>
                <option value="MEI">MEI</option>
                <option value="Lucro Presumido">Lucro Presumido</option>
                <option value="Lucro Real">Lucro Real</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>Alíquota ISS (%)</label>
              <input type="number" min={0} max={5} step={0.01} style={inputSt} value={aliquota} onChange={e => setAliquota(e.target.value)} placeholder="2.00" />
            </div>
            <div style={{ gridColumn: '2 / -1' }}>
              <label style={labelSt}>Código LC 116 (item_lista_servico)</label>
              <input style={inputSt} value={codigoServ} onChange={e => setCodigoServ(e.target.value)} placeholder="06.01" />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textMuted }}>Padrão para salões de beleza: 06.01</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            <button onClick={onClose} style={{ padding: '10px 16px', background: 'none', border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: C.textMuted }}>
              Fechar
            </button>
            <button
              onClick={salvar} disabled={salvando}
              style={{ flex: 1, padding: '10px 24px', background: salvando ? C.borderMid : C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: salvando ? 'not-allowed' : 'pointer' }}
            >
              {salvando ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
