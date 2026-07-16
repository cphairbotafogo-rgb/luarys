'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { inputAdmin, RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import { FiCheckCircle, FiAlertCircle, FiSave, FiEye, FiEyeOff, FiClock, FiLock, FiUploadCloud } from 'react-icons/fi';

export function ConfiguracaoNotaFiscal({ perfil }: any) {
  const toast = useToast();
  const [carregando, setCarregando]         = useState(true);
  const [salvando, setSalvando]             = useState(false);
  const [mostrarToken, setMostrarToken]     = useState(false);

  // Dados do salão
  const [cnpj, setCnpj]                             = useState('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('');
  const [codigoIbge, setCodigoIbge]                 = useState('');

  // Config fiscal
  const [provedor, setProvedor]           = useState<'focusnfe' | 'brasilnfe'>('focusnfe');
  const [tokenFocus, setTokenFocus]       = useState('');
  const [brasilNFeCadastrado, setBrasilNFeCadastrado] = useState(false);
  const [brasilNFeCadastradoEm, setBrasilNFeCadastradoEm] = useState('');
  const [aliquota, setAliquota]           = useState('2.00');
  const [regime, setRegime]               = useState('Simples Nacional');

  // Certificado A1 (Brasil NFe)
  const [certArquivo, setCertArquivo]         = useState<File | null>(null);
  const [certSenha, setCertSenha]             = useState('');
  const [certInstalado, setCertInstalado]     = useState(false);
  const [certDataInstalacao, setCertDataInstalacao] = useState('');
  const [instalandoCert, setInstalandoCert]   = useState(false);

  useEffect(() => {
    if (!perfil?.salao_id) return;
    Promise.all([
      supabase.from('saloes').select('cnpj, inscricao_municipal, codigo_ibge, config_fiscal').eq('id', perfil.salao_id).maybeSingle(),
      supabase.from('configuracoes_nfce_produtos').select('cert_info').eq('salao_id', perfil.salao_id).maybeSingle(),
    ]).then(([{ data }, { data: certData }]) => {
      if (!data) return;
      setCnpj(data.cnpj || '');
      setInscricaoMunicipal(data.inscricao_municipal || '');
      setCodigoIbge(data.codigo_ibge || '');
      const cf = data.config_fiscal || {};
      setProvedor(cf.provedor_nfse || 'focusnfe');
      setTokenFocus(cf.focus_nfe_token || '');
      setBrasilNFeCadastrado(!!cf.brasilnfe_company_token);
      setBrasilNFeCadastradoEm(cf.brasilnfe_cadastrado_em || '');
      setAliquota(String(cf.aliquota_padrao || '2.00'));
      setRegime(cf.regime_tributario || 'Simples Nacional');
      // Certificado A1
      const ci = certData?.cert_info;
      if (ci?.instalado && ci?.provedor === 'brasilnfe') {
        setCertInstalado(true);
        setCertDataInstalacao(ci.data_instalacao || '');
      }
      setCarregando(false);
    });
  }, [perfil?.salao_id]);

  async function salvar() {
    if (!perfil?.salao_id) return;
    if (!codigoIbge.trim() || codigoIbge.replace(/\D/g, '').length < 6) {
      toast.erro('Código IBGE inválido — deve ter 7 dígitos (ex: 3550308 para São Paulo).');
      return;
    }
    setSalvando(true);

    const { data: atual } = await supabase
      .from('saloes')
      .select('config_fiscal')
      .eq('id', perfil.salao_id)
      .maybeSingle();

    const configFiscalAtual = atual?.config_fiscal || {};

    const configFiscalNova: Record<string, any> = {
      ...configFiscalAtual,
      provedor_nfse:     provedor,
      aliquota_padrao:   aliquota,
      regime_tributario: regime,
    };
    if (tokenFocus.trim()) configFiscalNova.focus_nfe_token = tokenFocus.trim();
    // brasilnfe_company_token é gerenciado exclusivamente pelo admin via /api/admin/brasilnfe/cadastrar

    const { error } = await supabase
      .from('saloes')
      .update({
        inscricao_municipal: inscricaoMunicipal.trim() || null,
        codigo_ibge:         codigoIbge.replace(/\D/g, '') || null,
        config_fiscal:       configFiscalNova,
      })
      .eq('id', perfil.salao_id);

    if (error) toast.erro('Erro ao salvar: ' + error.message);
    else toast.sucesso('Configuração de nota fiscal salva!');
    setSalvando(false);
  }

  async function instalarCertificado() {
    if (!certArquivo) { toast.erro('Selecione o arquivo .pfx do certificado A1.'); return; }
    if (!certSenha.trim()) { toast.erro('Informe a senha do certificado.'); return; }
    setInstalandoCert(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append('arquivo', certArquivo);
      fd.append('senha', certSenha);
      fd.append('provedor', 'brasilnfe');
      const resp = await fetch('/api/nfce/upload-certificado', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: fd,
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.erro || `HTTP ${resp.status}`);
      setCertInstalado(true);
      setCertDataInstalacao(new Date().toISOString());
      setCertArquivo(null);
      setCertSenha('');
      toast.sucesso('Certificado A1 instalado com sucesso!');
    } catch (e: any) {
      toast.erro('Erro ao instalar certificado: ' + e.message);
    } finally {
      setInstalandoCert(false);
    }
  }

  if (carregando) return <p style={{ color: C.textLight, padding: 16 }}>Carregando...</p>;

  // Para Brasil NFe: precisa de CNPJ registrado + certificado A1 instalado
  const pronto = provedor === 'focusnfe'
    ? !!tokenFocus.trim()
    : (brasilNFeCadastrado && certInstalado);
  const configurado = pronto && !!codigoIbge.trim() && !!cnpj.trim();

  const labelSt: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.textLight,
    textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 5,
  };
  const radBtnSt = (ativo: boolean): React.CSSProperties => ({
    flex: 1, padding: '9px 12px', borderRadius: RAIO_MD,
    border: `2px solid ${ativo ? C.sidebarBg : C.borderMid}`,
    background: ativo ? C.sidebarBg : '#fff',
    color: ativo ? '#fff' : C.textMuted,
    fontWeight: 700, fontSize: 12, cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>

      {/* STATUS */}
      <div style={{ background: configurado ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${configurado ? '#BBF7D0' : '#FED7AA'}`, borderRadius: RAIO_XL, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {configurado ? <FiCheckCircle size={20} color="#15803D" style={{ flexShrink: 0, marginTop: 1 }} /> : <FiAlertCircle size={20} color="#C2410C" style={{ flexShrink: 0, marginTop: 1 }} />}
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: configurado ? '#15803D' : '#C2410C' }}>
            {configurado ? 'Pronto para emitir NFS-e' : 'Configuração incompleta — preencha todos os campos abaixo'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: configurado ? '#166534' : '#9A3412', lineHeight: 1.5 }}>
            {configurado
              ? `Notas emitidas sob CNPJ ${cnpj} via ${provedor === 'focusnfe' ? 'Focus NFe' : 'Brasil NFe'}.`
              : 'A nota fiscal será emitida com a identificação do SEU estabelecimento (CNPJ, Inscrição Municipal e Código IBGE são obrigatórios).'}
          </p>
        </div>
      </div>

      {/* IDENTIFICAÇÃO DO PRESTADOR */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 24 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>Identificação do Estabelecimento</h3>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
          Estes dados identificam o <strong>seu negócio</strong> como prestador de serviço em todas as notas emitidas. O CNPJ vem do seu cadastro inicial.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelSt}>CNPJ do Estabelecimento</label>
            <input
              value={cnpj}
              disabled
              style={{ ...inputAdmin, background: C.bg, color: C.textMuted, fontFamily: 'monospace' }}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>Informado no cadastro. Para alterar, entre em contato com o suporte.</p>
          </div>

          <div>
            <label style={labelSt}>Inscrição Municipal</label>
            <input
              placeholder="Ex: 1234567-8"
              value={inscricaoMunicipal}
              onChange={e => setInscricaoMunicipal(e.target.value)}
              style={{ ...inputAdmin, fontFamily: 'monospace' }}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>Número de inscrição na prefeitura da sua cidade. Encontre no alvará ou portal da prefeitura.</p>
          </div>

          <div>
            <label style={labelSt}>Código IBGE do Município <span style={{ color: '#DC2626' }}>*</span></label>
            <input
              placeholder="Ex: 3550308 (São Paulo)"
              value={codigoIbge}
              onChange={e => setCodigoIbge(e.target.value.replace(/\D/g, '').slice(0, 7))}
              style={{ ...inputAdmin, fontFamily: 'monospace', border: `1px solid ${codigoIbge.length >= 7 ? C.borderMid : '#FCA5A5'}` }}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>7 dígitos. Consulte em: <strong>ibge.gov.br/cidades</strong> ou peça ao seu contador.</p>
          </div>
        </div>
      </div>

      {/* PROVEDOR E TOKEN */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 24 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>Provedor de Transmissão</h3>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
          {provedor === 'focusnfe'
            ? <>O provedor transmite a nota para a prefeitura usando <strong>o token da SUA conta</strong> — crie uma conta no site do provedor com seu CNPJ.</>
            : <>Na Brasil NFe o <strong>Luarys gerencia a integração</strong> em seu nome (modelo multi-tenant). Você só precisa enviar seu Certificado A1.</>
          }
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelSt}>Provedor</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={radBtnSt(provedor === 'focusnfe')} onClick={() => setProvedor('focusnfe')}>Focus NFe</button>
              <button style={radBtnSt(provedor === 'brasilnfe')} onClick={() => setProvedor('brasilnfe')}>Brasil NFe</button>
            </div>
          </div>

          {provedor === 'focusnfe' ? (
            <div>
              <label style={labelSt}>Token de Acesso — Focus NFe</label>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: C.textMuted }}>
                Crie sua conta em <strong>focusnfe.com.br</strong> com o CNPJ do seu estabelecimento → Painel → API → Token de Acesso.
              </p>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarToken ? 'text' : 'password'}
                  placeholder={tokenFocus ? '•••••••• (configurado — cole novamente para alterar)' : 'Cole o token aqui...'}
                  value={tokenFocus}
                  onChange={e => setTokenFocus(e.target.value)}
                  style={{ ...inputAdmin, paddingRight: 44, fontFamily: 'monospace' }}
                />
                <button type="button" onClick={() => setMostrarToken(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.textLight, cursor: 'pointer', display: 'flex' }}>
                  {mostrarToken ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>
          ) : (
            /* Brasil NFe: modelo multi-tenant — o token é gerenciado pelo Luarys, não pelo salão */
            <div style={{
              borderRadius: RAIO_MD,
              border: `1px solid ${brasilNFeCadastrado ? '#BBF7D0' : '#FED7AA'}`,
              background: brasilNFeCadastrado ? '#F0FDF4' : '#FFF7ED',
              padding: '14px 16px',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              {brasilNFeCadastrado
                ? <FiCheckCircle size={18} color="#15803D" style={{ flexShrink: 0, marginTop: 1 }} />
                : <FiClock size={18} color="#C2410C" style={{ flexShrink: 0, marginTop: 1 }} />
              }
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: brasilNFeCadastrado ? '#15803D' : '#C2410C' }}>
                  {brasilNFeCadastrado ? 'CNPJ registrado na Brasil NFe' : 'Cadastro pendente'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: brasilNFeCadastrado ? '#166534' : '#9A3412', lineHeight: 1.5 }}>
                  {brasilNFeCadastrado
                    ? `Integração ativa${brasilNFeCadastradoEm ? ` desde ${new Date(brasilNFeCadastradoEm).toLocaleDateString('pt-BR')}` : ''}. O Luarys gerencia a autenticação com a Brasil NFe — nenhum token manual é necessário.`
                    : 'O Luarys precisa registrar seu CNPJ na Brasil NFe para ativar a emissão. Entre em contato com o suporte para concluir o cadastro.'
                  }
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelSt}>Regime Tributário</label>
              <select value={regime} onChange={e => setRegime(e.target.value)} style={{ ...inputAdmin }}>
                <option value="Simples Nacional">Simples Nacional</option>
                <option value="MEI">MEI</option>
                <option value="Lucro Presumido">Lucro Presumido</option>
                <option value="Lucro Real">Lucro Real</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>Alíquota ISS (%)</label>
              <input
                type="number" min={0} max={5} step={0.01}
                value={aliquota}
                onChange={e => setAliquota(e.target.value)}
                placeholder="2.00"
                style={{ ...inputAdmin }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>Padrão para salões: 2% (confirme com seu contador).</p>
            </div>
          </div>
        </div>
      </div>

      {/* CERTIFICADO A1 — Brasil NFe (Passo 2, aparece após o CNPJ ser registrado) */}
      {provedor === 'brasilnfe' && brasilNFeCadastrado && (
        <div style={{ background: C.bgCard, border: `1px solid ${certInstalado ? '#BBF7D0' : C.border}`, borderRadius: RAIO_XL, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <FiLock size={16} color={certInstalado ? '#15803D' : C.sidebarBg} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: certInstalado ? '#15803D' : C.sidebarBg }}>
              Certificado Digital A1 {certInstalado ? '— Instalado' : '— Obrigatório'}
            </h3>
          </div>
          <p style={{ margin: '0 0 18px', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
            O certificado A1 (.pfx) é necessário para assinar digitalmente as notas fiscais emitidas em seu nome.
            Ele é enviado diretamente à Brasil NFe — o Luarys não armazena o arquivo localmente.
          </p>

          {certInstalado && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: RAIO_MD, background: '#F0FDF4', border: '1px solid #BBF7D0', marginBottom: 16 }}>
              <FiCheckCircle size={15} color="#15803D" />
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#15803D' }}>
                Certificado instalado em {certDataInstalacao ? new Date(certDataInstalacao).toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelSt}>Arquivo do Certificado (.pfx)</label>
              <input
                type="file" accept=".pfx,.p12"
                onChange={e => setCertArquivo(e.target.files?.[0] ?? null)}
                style={{ fontSize: 13, color: C.textMuted, display: 'block', width: '100%' }}
              />
              {certArquivo && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textLight }}>Selecionado: {certArquivo.name}</p>
              )}
            </div>
            <div>
              <label style={labelSt}>Senha do Certificado</label>
              <input
                type="password"
                value={certSenha}
                onChange={e => setCertSenha(e.target.value)}
                placeholder="••••••••"
                style={{ ...inputAdmin }}
              />
            </div>
            <div>
              <button
                onClick={instalarCertificado}
                disabled={instalandoCert || !certArquivo}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: (instalandoCert || !certArquivo) ? C.borderMid : C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontWeight: 800, fontSize: 12, cursor: (instalandoCert || !certArquivo) ? 'not-allowed' : 'pointer' }}
              >
                <FiUploadCloud size={15} />
                {instalandoCert ? 'Enviando certificado...' : certInstalado ? 'Atualizar Certificado' : 'Instalar Certificado A1'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={salvar}
          disabled={salvando}
          style={{ background: C.sidebarBg, color: '#fff', border: 'none', padding: '12px 32px', borderRadius: RAIO_MD, fontWeight: 800, fontSize: 13, cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: salvando ? 0.7 : 1 }}
        >
          <FiSave size={15} /> {salvando ? 'Salvando...' : 'Salvar Configuração'}
        </button>
      </div>
    </div>
  );
}
