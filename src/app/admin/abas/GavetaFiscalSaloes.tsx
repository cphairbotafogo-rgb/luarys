'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/constants';
import { RAIO_MD, RAIO_XL } from '@/lib/estiloGlobal';
import { useToast } from '@/components/Toast';
import {
  FiDownload, FiCheckCircle, FiClock,
  FiKey, FiEye, FiEyeOff, FiRefreshCw, FiHash, FiAlertTriangle,
} from 'react-icons/fi';

interface Numeracao {
  TipoAmbiente: number; ModeloDocumento: number; Serie: string;
  Numero: number; Padrao: boolean;
  modelo_nome: string; ambiente_nome: string;
}

type StatusFiscal = 'inativo' | 'pendente_a1' | 'a1_recebido' | 'processando' | 'ativo';

const BADGE: Record<StatusFiscal, { texto: string; cor: string; bg: string }> = {
  inativo:      { texto: 'Inativo',      cor: '#64748B', bg: '#F1F5F9' },
  pendente_a1:  { texto: 'A1 Pendente',  cor: '#B45309', bg: '#FEF3C7' },
  a1_recebido:  { texto: 'A1 Recebido',  cor: '#1D4ED8', bg: '#DBEAFE' },
  processando:  { texto: 'Processando',  cor: '#7C3AED', bg: '#EDE9FE' },
  ativo:        { texto: 'Ativo',        cor: '#15803D', bg: '#DCFCE7' },
};

interface ConfigFiscal { nfse_ativo: boolean; nfce_ativo: boolean }

/**
 * Numeração fiscal por empresa + ambiente + modelo + série, lida da Brasil NFe.
 *
 * Existe porque a numeração de produção de um salão novo começa em 1. Se o CNPJ
 * já emitiu por outro sistema, a primeira nota pelo Luarys repete número já
 * autorizado. Aqui só se VÊ e se ajusta com confirmação — quem define o número
 * responde por ele.
 */

interface Salao {
  id: string;
  nome_fantasia: string | null;
  razao_social: string | null;
  cnpj: string | null;
  status_fiscal: StatusFiscal;
  a1_path: string | null;
  a1_enviado_em: string | null;
  token_nfse_salao: string | null;
  config_fiscal: { brasilnfe_company_token?: string } | null;
  nfe_config_empresa: ConfigFiscal | ConfigFiscal[] | null;
}

interface ModalToken {
  salaoId: string;
  nome: string;
  tokenAtual: string;
  tokenJaCadastrado: boolean;
  nfseAtual: boolean;
  nfceAtual: boolean;
}

export function GavetaFiscalSaloes() {
  const toast = useToast();
  const [saloes, setSaloes]         = useState<Salao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro]         = useState<StatusFiscal | 'todos'>('todos');
  const [modalToken, setModalToken] = useState<ModalToken | null>(null);
  const [novoToken, setNovoToken]   = useState('');
  const [ativarNfse, setAtivarNfse] = useState(true);
  const [ativarNfce, setAtivarNfce] = useState(false);
  const [verToken, setVerToken]     = useState(false);
  const [salvandoToken, setSalvandoToken] = useState(false);
  const [baixando, setBaixando]     = useState<string | null>(null);
  // Numeração aberta por salão (null = painel fechado).
  const [numSalao, setNumSalao]     = useState<string | null>(null);
  const [numeracoes, setNumeracoes] = useState<Numeracao[]>([]);
  const [numCarregando, setNumCarregando] = useState(false);
  const [numSalvando, setNumSalvando]     = useState('');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('saloes')
      .select('id, nome_fantasia, razao_social, cnpj, status_fiscal, a1_path, a1_enviado_em, token_nfse_salao, config_fiscal, nfe_config_empresa(nfse_ativo, nfce_ativo)')
      .not('status_fiscal', 'eq', 'inativo')
      .order('a1_enviado_em', { ascending: false });
    setSaloes((data ?? []) as Salao[]);
    setCarregando(false);
  }

  async function verNumeracao(salaoId: string) {
    if (numSalao === salaoId) { setNumSalao(null); return; }
    setNumSalao(salaoId);
    setNumeracoes([]);
    setNumCarregando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`/api/admin/brasilnfe/numeracao?salao_id=${salaoId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const j = await r.json();
      if (!r.ok) { toast.erro(j.erro || 'Não foi possível consultar a numeração.'); setNumSalao(null); return; }
      setNumeracoes(j.numeracoes || []);
    } catch (e: any) {
      toast.erro('Erro de conexão: ' + e.message);
      setNumSalao(null);
    } finally { setNumCarregando(false); }
  }

  async function salvarNumeracao(salaoId: string, n: Numeracao, novo: number) {
    const chave = `${n.TipoAmbiente}-${n.ModeloDocumento}-${n.Serie}`;
    // Confirmação explícita: número igual ou inferior a um já autorizado gera
    // rejeição por duplicidade na SEFAZ, e isso não tem desfazer.
    const ok = window.confirm(
      `Alterar a numeração de ${n.modelo_nome} (${n.ambiente_nome}, série ${n.Serie}) de ${n.Numero} para ${novo}?

` +
      'Número igual ou inferior a um já autorizado causa rejeição por duplicidade. ' +
      'Confirme com quem responde pela emissão antes de seguir.',
    );
    if (!ok) return;

    setNumSalvando(chave);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/admin/brasilnfe/numeracao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          salao_id: salaoId, tipo_ambiente: n.TipoAmbiente, modelo_documento: n.ModeloDocumento,
          serie: n.Serie, numero: novo, padrao: n.Padrao, confirmo: true,
        }),
      });
      const j = await r.json();
      if (!r.ok) { toast.erro(j.erro || 'A Brasil NFe recusou a alteração.', 10000); return; }
      toast.sucesso(`${n.modelo_nome} (${n.ambiente_nome}) agora começa em ${novo}.`);
      setNumeracoes(ns => ns.map(x => (x.TipoAmbiente === n.TipoAmbiente && x.ModeloDocumento === n.ModeloDocumento && x.Serie === n.Serie ? { ...x, Numero: novo } : x)));
    } catch (e: any) {
      toast.erro('Erro de conexão: ' + e.message);
    } finally { setNumSalvando(''); }
  }

  async function atualizarStatus(salaoId: string, status: StatusFiscal) {
    const { error } = await supabase.from('saloes').update({ status_fiscal: status }).eq('id', salaoId);
    if (error) { toast.erro('Erro ao atualizar status.'); return; }
    setSaloes(prev => prev.map(s => s.id === salaoId ? { ...s, status_fiscal: status } : s));
    toast.sucesso('Status atualizado!');
  }

  async function baixarA1(salao: Salao) {
    if (!salao.a1_path) { toast.aviso('Nenhum A1 encontrado para este salão.'); return; }
    setBaixando(salao.id);
    try {
      const { data, error } = await supabase.storage.from('certificados-a1').download(salao.a1_path);
      if (error || !data) throw error ?? new Error('Arquivo não encontrado.');
      const url  = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href  = url;
      link.download = `a1_${(salao.nome_fantasia ?? salao.id).replace(/\s+/g, '_')}.pfx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.erro('Erro ao baixar: ' + e.message);
    } finally {
      setBaixando(null);
    }
  }

  function abrirModal(s: Salao) {
    const cfg = Array.isArray(s.nfe_config_empresa) ? s.nfe_config_empresa[0] : s.nfe_config_empresa;
    const tokenAutomatico = s.config_fiscal?.brasilnfe_company_token || s.token_nfse_salao || '';
    setModalToken({
      salaoId: s.id,
      nome: s.nome_fantasia || s.razao_social || s.id,
      tokenAtual: tokenAutomatico,
      tokenJaCadastrado: !!tokenAutomatico,
      nfseAtual: cfg?.nfse_ativo ?? false,
      nfceAtual: cfg?.nfce_ativo ?? false,
    });
    setNovoToken('');
    setAtivarNfse(cfg?.nfse_ativo ?? true);
    setAtivarNfce(cfg?.nfce_ativo ?? false);
  }

  async function salvarToken() {
    if (!modalToken) return;
    if (!ativarNfse && !ativarNfce) {
      toast.aviso('Selecione pelo menos um módulo para ativar (NFS-e ou NFC-e).');
      return;
    }
    if (!modalToken.tokenJaCadastrado && !novoToken.trim()) {
      toast.aviso('Cole o CompanyToken — este salão ainda não foi cadastrado automaticamente na Brasil NFe.');
      return;
    }
    setSalvandoToken(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const res = await fetch('/api/admin/brasilnfe/ativar-modulo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          salao_id: modalToken.salaoId,
          nfse: ativarNfse,
          nfce: ativarNfce,
          company_token: novoToken.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || `Erro ${res.status}`);

      setSaloes(prev => prev.map(s => s.id === modalToken.salaoId
        ? { ...s, token_nfse_salao: novoToken.trim() || s.token_nfse_salao, status_fiscal: 'ativo', nfe_config_empresa: { nfse_ativo: ativarNfse, nfce_ativo: ativarNfce } }
        : s
      ));
      toast.sucesso(`Módulos fiscais atualizados para ${modalToken.nome}!`);
      setModalToken(null);
      setNovoToken('');
    } catch (e: any) {
      toast.erro('Erro: ' + e.message);
    } finally {
      setSalvandoToken(false);
    }
  }

  const filtrados = filtro === 'todos' ? saloes : saloes.filter(s => s.status_fiscal === filtro);

  const labelSt: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.5px' };
  const btnSt = (cor: string, disabled?: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
    borderRadius: RAIO_MD, border: 'none', background: disabled ? C.borderMid : cor,
    color: '#fff', fontSize: 11, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
  });
  const moduloBadge = (ativo: boolean, nome: string) => (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      color: ativo ? '#15803D' : '#64748B',
      background: ativo ? '#DCFCE7' : '#F1F5F9',
    }}>{nome}</span>
  );

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiKey size={17} /> Ativação Fiscal por Salão
          </h2>
          <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            NFS-e (serviços) e NFC-e (produtos) são módulos independentes — ative apenas o(s) contratado(s).
          </p>
        </div>
        <button onClick={carregar} style={btnSt(C.sidebarBg)}><FiRefreshCw size={12} /> Atualizar</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['todos', 'pendente_a1', 'a1_recebido', 'processando', 'ativo'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            border: filtro === f ? `2px solid ${C.sidebarBg}` : `1px solid ${C.borderMid}`,
            background: filtro === f ? C.sidebarBg : C.bgCard,
            color: filtro === f ? '#fff' : C.textMuted,
          }}>
            {f === 'todos' ? 'Todos' : BADGE[f].texto}
          </button>
        ))}
      </div>

      {carregando ? (
        <p style={{ color: C.textLight, fontSize: 13 }}>Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: C.textLight, fontSize: 13, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
          {filtro === 'todos' ? 'Nenhum salão solicitou ativação fiscal ainda.' : `Nenhum salão com status "${BADGE[filtro as StatusFiscal]?.texto}".`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(s => {
            const badge = BADGE[s.status_fiscal] ?? BADGE.inativo;
            const cfg = Array.isArray(s.nfe_config_empresa) ? s.nfe_config_empresa[0] : s.nfe_config_empresa;
            return (
              <div key={s.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.textMain }}>{s.nome_fantasia || s.razao_social || '(sem nome)'}</p>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, color: badge.cor, background: badge.bg }}>{badge.texto}</span>
                    {/* Badges de módulo separados — NFS-e e NFC-e independentes */}
                    {moduloBadge(cfg?.nfse_ativo ?? false, 'NFS-e')}
                    {moduloBadge(cfg?.nfce_ativo ?? false, 'NFC-e')}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>
                    {s.cnpj || 'CNPJ não informado'}
                    {s.a1_enviado_em && ` — A1 enviado em ${new Date(s.a1_enviado_em).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {s.a1_path && s.status_fiscal !== 'ativo' && (
                    <button onClick={() => baixarA1(s)} disabled={baixando === s.id} style={btnSt('#1D4ED8', baixando === s.id)}>
                      <FiDownload size={12} /> {baixando === s.id ? 'Baixando...' : 'Baixar A1'}
                    </button>
                  )}
                  {s.status_fiscal === 'pendente_a1' && (
                    <button onClick={() => atualizarStatus(s.id, 'a1_recebido')} style={btnSt('#B45309')}>
                      <FiCheckCircle size={12} /> Marcar Recebido
                    </button>
                  )}
                  {s.status_fiscal === 'a1_recebido' && (
                    <button onClick={() => atualizarStatus(s.id, 'processando')} style={btnSt('#7C3AED')}>
                      <FiClock size={12} /> Enviado p/ NFs
                    </button>
                  )}
                  {(s.status_fiscal === 'a1_recebido' || s.status_fiscal === 'processando' || s.status_fiscal === 'ativo') && (
                    <button onClick={() => abrirModal(s)} style={btnSt('#15803D')}>
                      <FiKey size={12} /> {s.status_fiscal === 'ativo' ? 'Editar módulos' : 'Inserir Token e Ativar'}
                    </button>
                  )}
                  {s.config_fiscal?.brasilnfe_company_token && (
                    <button onClick={() => verNumeracao(s.id)} style={btnSt('#0F766E')}>
                      <FiHash size={12} /> {numSalao === s.id ? 'Fechar numeração' : 'Numeração'}
                    </button>
                  )}
                </div>

                {/* Numeração — visível antes de virar para produção. Um salão que
                    já emitiu por outro sistema não pode recomeçar do 1. */}
                {numSalao === s.id && (
                  <div style={{ gridColumn: '1 / -1', borderTop: `1px solid ${C.border}`, paddingTop: 14, marginTop: 4 }}>
                    {numCarregando ? (
                      <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>Consultando a Brasil NFe...</p>
                    ) : numeracoes.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 12, color: C.textLight }}>Nenhuma numeração registrada para os modelos que emitimos.</p>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, padding: '8px 10px', borderRadius: RAIO_MD, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                          <FiAlertTriangle size={13} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
                          <p style={{ margin: 0, fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>
                            <strong>Número é o próximo a ser usado.</strong> Se este CNPJ já emitiu por outro sistema,
                            a numeração de produção precisa continuar de onde parou — recomeçar do 1 repete documento
                            já autorizado e a prefeitura recusa por duplicidade. Quem define o número responde por ele.
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {numeracoes.map(n => {
                            const chave = `${n.TipoAmbiente}-${n.ModeloDocumento}-${n.Serie}`;
                            const producao = n.TipoAmbiente === 1;
                            return (
                              <div key={chave} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, padding: '6px 10px', borderRadius: RAIO_MD, background: producao ? '#FEF2F2' : C.bg, border: `1px solid ${producao ? '#FECACA' : C.border}` }}>
                                <strong style={{ minWidth: 58, color: C.textMain }}>{n.modelo_nome}</strong>
                                <span style={{ minWidth: 96, color: producao ? '#B91C1C' : C.textMuted, fontWeight: producao ? 800 : 400 }}>{n.ambiente_nome}</span>
                                <span style={{ color: C.textLight }}>série {n.Serie}</span>
                                <span style={{ marginLeft: 'auto', color: C.textMuted }}>próximo nº</span>
                                <input
                                  type="number" min={1} defaultValue={n.Numero} disabled={numSalvando === chave}
                                  onKeyDown={e => { if (e.key === 'Enter') { const v = Number((e.target as HTMLInputElement).value); if (v > 0 && v !== n.Numero) salvarNumeracao(s.id, n, v); } }}
                                  onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== n.Numero) salvarNumeracao(s.id, n, v); else e.target.value = String(n.Numero); }}
                                  style={{ width: 90, padding: '4px 8px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 12, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
                                />
                                {numSalvando === chave && <span style={{ fontSize: 11, color: C.textLight }}>salvando...</span>}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: token + módulos NFS-e / NFC-e independentes */}
      {modalToken && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: C.bgCard, borderRadius: RAIO_XL, padding: 32, width: 480, maxWidth: '95vw', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>Ativação Fiscal</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: C.textMuted }}>{modalToken.nome}</p>

            {/* Token */}
            <label style={labelSt}>CompanyToken (Brasil NFe — mesmo token para NFS-e e NFC-e)</label>
            {modalToken.tokenJaCadastrado ? (
              <p style={{ margin: '8px 0 12px', fontSize: 12, color: '#15803D', fontWeight: 600 }}>
                ✓ Token já obtido automaticamente no cadastro do CNPJ — não precisa colar de novo.
                Só preencha abaixo se quiser substituí-lo.
              </p>
            ) : (
              <p style={{ margin: '8px 0 12px', fontSize: 12, color: '#B45309' }}>
                Este salão ainda não foi cadastrado automaticamente na Brasil NFe — cole o CompanyToken manualmente.
              </p>
            )}
            <div style={{ position: 'relative', marginTop: 8, marginBottom: 16 }}>
              <input
                type={verToken ? 'text' : 'password'}
                value={novoToken}
                onChange={e => setNovoToken(e.target.value)}
                placeholder={modalToken.tokenJaCadastrado ? 'Deixe vazio para manter o token atual...' : 'Cole o CompanyToken aqui...'}
                style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }}
                autoFocus
              />
              <button type="button" onClick={() => setVerToken(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex' }}>
                {verToken ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>

            {/* Módulos — seleção independente */}
            <label style={{ ...labelSt, marginBottom: 10 }}>Módulos contratados</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { key: 'nfse', label: 'NFS-e — Nota Fiscal de Serviço', sublabel: 'Emite ao finalizar agendamentos', value: ativarNfse, setter: setAtivarNfse },
                { key: 'nfce', label: 'NFC-e — Nota Fiscal de Produto', sublabel: 'Emite na venda pelo PDV / Vitrine', value: ativarNfce, setter: setAtivarNfce },
              ].map(m => (
                <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: RAIO_MD, border: `1px solid ${m.value ? '#86EFAC' : C.borderMid}`, background: m.value ? '#F0FDF4' : '#FAFAFA', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={m.value}
                    onChange={e => m.setter(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#15803D', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.textMain }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{m.sublabel}</div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalToken(null)} style={{ padding: '10px 20px', borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: 'transparent', color: C.textMuted, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={salvarToken} disabled={salvandoToken || (!ativarNfse && !ativarNfce)} style={btnSt('#15803D', salvandoToken || (!ativarNfse && !ativarNfce))}>
                <FiCheckCircle size={14} /> {salvandoToken ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
