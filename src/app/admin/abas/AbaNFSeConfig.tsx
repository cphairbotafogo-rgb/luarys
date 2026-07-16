'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD } from "@/lib/estiloGlobal";
import { Card } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { FiFileText, FiSave, FiEye, FiEyeOff, FiUserPlus, FiCheckCircle } from "react-icons/fi";
import { GavetaFiscalSaloes } from "./GavetaFiscalSaloes";

export function AbaNFSeConfig() {
  const toast = useToast();
  const [cnpj, setCnpj]               = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [im, setIm]                   = useState('');
  const [ibge, setIbge]               = useState('');
  const [regime, setRegime]           = useState('Simples Nacional');
  const [aliquota, setAliquota]       = useState('2.00');
  const [codServ, setCodServ]         = useState('01.07');
  const [provedor, setProvedor]       = useState('focusnfe');
  const [tokenFocus, setTokenFocus]   = useState('');
  const [tokenBrasil, setTokenBrasil] = useState('');
  const [ambiente, setAmbiente]       = useState('sandbox');
  const [modo, setModo]               = useState('manual');
  const [verToken, setVerToken]       = useState(false);
  const [carregando, setCarregando]   = useState(true);
  const [salvando, setSalvando]       = useState(false);

  // Cadastro de salão na Brasil NFe (multi-tenant)
  const [saloes, setSaloes]                     = useState<any[]>([]);
  const [salaoRegistroId, setSalaoRegistroId]   = useState('');
  const [registrando, setRegistrando]           = useState(false);
  const [ultimoRegistrado, setUltimoRegistrado] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('plataforma_nfse_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('saloes').select('id, nome_fantasia, razao_social, cnpj').order('nome_fantasia', { ascending: true }),
    ]).then(([{ data }, { data: listaSaloes }]) => {
      if (data) {
        setCnpj(data.cnpj ?? '');
        setRazaoSocial(data.razao_social ?? '');
        setIm(data.inscricao_municipal ?? '');
        setIbge(data.codigo_ibge ?? '');
        setRegime(data.regime_tributario ?? 'Simples Nacional');
        setAliquota(String(data.aliquota_padrao ?? '2.00'));
        setCodServ(data.item_lista_servico ?? '01.07');
        setProvedor(data.provedor ?? 'focusnfe');
        setTokenFocus(data.token_focus ?? '');
        setTokenBrasil(data.token_brasilnfe ?? '');
        setAmbiente(data.ambiente ?? 'sandbox');
        setModo(data.modo_emissao ?? 'manual');
      }
      setSaloes(listaSaloes ?? []);
      setCarregando(false);
    });
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      const { error } = await supabase.from('plataforma_nfse_config').upsert({
        id: 1,
        cnpj: cnpj.replace(/\D/g, ''),
        razao_social: razaoSocial.trim() || null,
        inscricao_municipal: im.trim() || null,
        codigo_ibge: ibge.trim() || null,
        regime_tributario: regime,
        aliquota_padrao: parseFloat(aliquota) || 2.00,
        item_lista_servico: codServ.trim() || '01.07',
        provedor,
        token_focus: tokenFocus.trim() || null,
        token_brasilnfe: tokenBrasil.trim() || null,
        ambiente,
        modo_emissao: modo,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (error) throw error;
      toast.sucesso('Dados da Luarys (NFS-e) salvos!');
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  const labelSt: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 5 };
  const inputSt: React.CSSProperties = { padding: '10px 12px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, width: '100%', boxSizing: 'border-box', fontSize: 13, color: C.textMain, fontWeight: 500 };
  const radSt = (ativo: boolean): React.CSSProperties => ({
    flex: 1, padding: '9px 12px', borderRadius: RAIO_MD,
    border: `2px solid ${ativo ? C.sidebarBg : C.borderMid}`,
    background: ativo ? C.sidebarBg : '#fff',
    color: ativo ? '#fff' : C.textMuted,
    fontWeight: 700, fontSize: 12, cursor: 'pointer',
  });

  async function registrarSalaoNaBrasilNFe() {
    if (!salaoRegistroId) { toast.erro('Selecione um salão.'); return; }
    if (!tokenBrasil.trim()) { toast.erro('Salve o UserToken Brasil NFe antes de registrar salões.'); return; }

    setRegistrando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch('/api/admin/brasilnfe/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ salao_id: salaoRegistroId }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.erro || `HTTP ${resp.status}`);

      const nomeSalao = saloes.find(s => s.id === salaoRegistroId)?.nome_fantasia || salaoRegistroId;
      setUltimoRegistrado(nomeSalao);
      setSalaoRegistroId('');
      toast.sucesso(json.mensagem || 'Salão registrado com sucesso!');
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    } finally {
      setRegistrando(false);
    }
  }

  const tokenAtivo = provedor === 'focusnfe' ? tokenFocus : tokenBrasil;
  const configurado = !!(cnpj && ibge && tokenAtivo);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiFileText size={20} /> NFS-e Luarys — Prestadora
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
          Dados da Luarys como prestadora de serviços SaaS — usados na emissão de NFS-e para os salões clientes (aba Notas Fiscais).
        </p>
      </div>

      <Card style={{ padding: 24, maxWidth: 700 }}>
        {carregando ? (
          <p style={{ color: C.textLight, fontSize: 13 }}>Carregando...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Dados empresariais */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelSt}>CNPJ da Luarys</label>
                <input style={inputSt} value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label style={labelSt}>Razão Social</label>
                <input style={inputSt} value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} placeholder="Luarys Tecnologia Ltda" />
              </div>
              <div>
                <label style={labelSt}>Inscrição Municipal</label>
                <input style={inputSt} value={im} onChange={e => setIm(e.target.value)} placeholder="123456" />
              </div>
              <div>
                <label style={labelSt}>Código IBGE do Município</label>
                <input style={inputSt} value={ibge} onChange={e => setIbge(e.target.value)} placeholder="Ex: 3550308 (São Paulo)" />
              </div>
            </div>

            {/* Fiscal */}
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
                <label style={labelSt}>Código LC 116 (Serviço SaaS)</label>
                <input style={inputSt} value={codServ} onChange={e => setCodServ(e.target.value)} placeholder="01.07" />
                <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textMuted }}>Padrão para SaaS / software: 01.07</p>
              </div>
            </div>

            {/* Provedor NFS-e */}
            <div>
              <label style={labelSt}>Provedor NFS-e</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={radSt(provedor === 'focusnfe')} onClick={() => setProvedor('focusnfe')}>Focus NFe</button>
                <button style={radSt(provedor === 'brasilnfe')} onClick={() => setProvedor('brasilnfe')}>Brasil NFe</button>
              </div>
            </div>

            {provedor === 'focusnfe' && (
              <div>
                <label style={labelSt}>Token Focus NFe — Conta Luarys</label>
                <div style={{ position: 'relative' }}>
                  <input type={verToken ? 'text' : 'password'} style={{ ...inputSt, paddingRight: 40, fontFamily: 'monospace' }}
                    value={tokenFocus} onChange={e => setTokenFocus(e.target.value)}
                    placeholder={tokenFocus ? '•••••• (configurado)' : 'Cole o token aqui...'} />
                  <button type="button" onClick={() => setVerToken(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.textLight, cursor: 'pointer', display: 'flex' }}>
                    {verToken ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {provedor === 'brasilnfe' && (
              <div>
                <label style={labelSt}>UserToken Brasil NFe — Conta Master Luarys</label>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: C.textMuted }}>
                  Token da conta <strong>Luarys</strong> na Brasil NFe (UserToken). Usado para registrar CNPJs de salões
                  e obter um CompanyToken exclusivo por cliente.
                </p>
                <div style={{ position: 'relative' }}>
                  <input type={verToken ? 'text' : 'password'} style={{ ...inputSt, paddingRight: 40, fontFamily: 'monospace' }}
                    value={tokenBrasil} onChange={e => setTokenBrasil(e.target.value)}
                    placeholder={tokenBrasil ? '•••••• (configurado)' : 'Cole o UserToken aqui...'} />
                  <button type="button" onClick={() => setVerToken(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.textLight, cursor: 'pointer', display: 'flex' }}>
                    {verToken ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {/* Ambiente + Modo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelSt}>Ambiente</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={radSt(ambiente === 'sandbox')} onClick={() => setAmbiente('sandbox')}>Sandbox</button>
                  <button style={radSt(ambiente === 'producao')} onClick={() => setAmbiente('producao')}>Produção</button>
                </div>
              </div>
              <div>
                <label style={labelSt}>Emissão</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={radSt(modo === 'manual')} onClick={() => setModo('manual')}>Manual</button>
                  <button style={radSt(modo === 'automatico')} onClick={() => setModo('automatico')}>Automático</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <button onClick={salvar} disabled={salvando}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: salvando ? C.borderMid : C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: salvando ? 'not-allowed' : 'pointer' }}>
                <FiSave size={14} /> {salvando ? 'Salvando...' : 'Salvar Dados da Luarys'}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Ativação fiscal por salão — A1 + token */}
      {provedor === 'brasilnfe' && !carregando && <GavetaFiscalSaloes />}

      {/* Cadastro de salão na Brasil NFe (multi-tenant) */}
      {provedor === 'brasilnfe' && !carregando && (
        <>
          <div style={{ marginTop: 32, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiUserPlus size={17} /> Registrar Salão na Brasil NFe
            </h2>
            <p style={{ color: C.textMuted, fontSize: 13, marginTop: 6 }}>
              Cada salão precisa ter seu CNPJ registrado na Brasil NFe para receber um CompanyToken exclusivo.
              Após o registro, o salão poderá emitir NFS-e sem configurar nada manualmente.
            </p>
          </div>
          <Card style={{ padding: 24, maxWidth: 700 }}>
            {ultimoRegistrado && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: RAIO_MD, background: '#F0FDF4', border: '1px solid #BBF7D0', marginBottom: 16 }}>
                <FiCheckCircle size={16} color="#15803D" />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#15803D' }}>
                  {ultimoRegistrado} registrado com sucesso!
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={labelSt}>Selecione o salão</label>
                <select
                  value={salaoRegistroId}
                  onChange={e => setSalaoRegistroId(e.target.value)}
                  style={{ ...inputSt }}
                >
                  <option value="">Escolha um salão...</option>
                  {saloes.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nome_fantasia || s.razao_social} {s.cnpj ? `— ${s.cnpj}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={registrarSalaoNaBrasilNFe}
                disabled={registrando || !salaoRegistroId}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: (registrando || !salaoRegistroId) ? C.borderMid : '#16A34A', color: '#fff', border: 'none', borderRadius: RAIO_MD, fontSize: 12, fontWeight: 800, cursor: (registrando || !salaoRegistroId) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <FiUserPlus size={14} /> {registrando ? 'Registrando...' : 'Cadastrar CNPJ'}
              </button>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11, color: C.textMuted }}>
              O salão deve ter CNPJ cadastrado em Dados da Empresa. O UserToken acima deve estar salvo.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
