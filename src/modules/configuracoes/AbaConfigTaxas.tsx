'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_XL, RAIO_SM } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { FiSave, FiCreditCard, FiPercent, FiSettings, FiPlus, FiTrash2 } from "react-icons/fi";

const BANDEIRAS_PADRAO = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard'];
type TipoBandeira = 'credito' | 'debito' | 'ambas';

function inicializarBandeira(existing: any = {}) {
  const b: any = {
    _ativo: existing._ativo !== undefined ? existing._ativo : true,
    _tipo:  (existing._tipo  as TipoBandeira) || 'ambas',
    debito: existing.debito  || "0.00",
  };
  for (let i = 1; i <= 12; i++) b[`cred_${i}`] = existing[`cred_${i}`] || "0.00";
  return b;
}

export function AbaConfigTaxas({ perfil }: any) {
  const toast = useToast();
  const [salvando,   setSalvando]   = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [maxParcelas, setMaxParcelas] = useState(12);
  const [taxaPix,     setTaxaPix]     = useState<string>("0.00");
  const [taxas,       setTaxas]       = useState<any>({});
  const [bandeiraAtiva, setBandeiraAtiva] = useState('');

  // Nova bandeira
  const [mostraForm, setMostraForm] = useState(false);
  const [nomeNova,   setNomeNova]   = useState('');
  const [tipoNova,   setTipoNova]   = useState<TipoBandeira>('ambas');

  useEffect(() => { carregarConfiguracoes(); }, [perfil]);

  async function carregarConfiguracoes() {
    if (!perfil?.salao_id) return;
    try {
      const { data } = await supabase
        .from('config_taxas')
        .select('max_parcelas, taxa_pix, taxas_cartoes')
        .eq('salao_id', perfil.salao_id)
        .maybeSingle();

      if (data) {
        setMaxParcelas(data.max_parcelas || 12);
        setTaxaPix(data.taxa_pix?.toString() || "0.00");
        const raw  = data.taxas_cartoes || {};
        const keys = Object.keys(raw).length > 0 ? Object.keys(raw) : BANDEIRAS_PADRAO;
        const init: any = {};
        keys.forEach(b => { init[b] = inicializarBandeira(raw[b]); });
        setTaxas(init);
        setBandeiraAtiva(keys[0]);
      } else {
        const init: any = {};
        BANDEIRAS_PADRAO.forEach(b => { init[b] = inicializarBandeira(); });
        setTaxas(init);
        setBandeiraAtiva(BANDEIRAS_PADRAO[0]);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error("Erro ao carregar taxas:", err);
    } finally {
      setCarregando(false);
    }
  }

  async function salvarConfiguracoes() {
    setSalvando(true);
    try {
      const payload = {
        salao_id:      perfil.salao_id,
        max_parcelas:  maxParcelas,
        taxa_pix:      parseFloat(taxaPix) || 0,
        taxas_cartoes: taxas,
      };
      const { data, error } = await supabase.from('config_taxas').update(payload).eq('salao_id', perfil.salao_id).select();
      if (error || data?.length === 0) {
        const { error: insertError } = await supabase.from('config_taxas').insert([payload]);
        if (insertError) throw insertError;
      }
      toast.sucesso('Configurações salvas com sucesso!');
    } catch (err: any) {
      toast.erro("Erro ao salvar configurações: " + err.message);
    } finally {
      setSalvando(false);
    }
  }

  const handleTaxaChange = (bandeira: string, campo: string, valor: any) => {
    setTaxas((prev: any) => ({
      ...prev,
      [bandeira]: { ...prev[bandeira], [campo]: valor }
    }));
  };

  function confirmarNovaBandeira() {
    const nome = nomeNova.trim();
    if (!nome) return;
    if (taxas[nome]) { toast.aviso('Já existe uma bandeira com esse nome.'); return; }
    setTaxas((prev: any) => ({ ...prev, [nome]: inicializarBandeira({ _tipo: tipoNova }) }));
    setBandeiraAtiva(nome);
    setNomeNova('');
    setTipoNova('ambas');
    setMostraForm(false);
  }

  function removerBandeira(nome: string) {
    setTaxas((prev: any) => { const n = { ...prev }; delete n[nome]; return n; });
    const restantes = Object.keys(taxas).filter(b => b !== nome);
    setBandeiraAtiva(restantes[0] || '');
  }

  // ─── ESTILOS ───
  const inputStyle   = { padding:"10px 12px", borderRadius:8, border:`1px solid ${C.borderMid}`, width:"100%", outlineColor: C.sidebarBg, fontSize: 14, color: C.textMain, fontWeight: 700, textAlign: "right" as const };
  const labelStyle   = { margin:"0 0 6px", fontSize:11, fontWeight:800, color:C.textMuted, display:"block", textTransform: "uppercase" as const };
  const inputPercent = { ...inputStyle, paddingRight: 32 };
  const percentIcon  = { position: "absolute" as const, right: 14, top: "50%", transform: "translateY(-50%)", color: C.textLight, fontWeight: 700 };
  const tabStyle = (ativa: boolean) => ({
    padding: "10px 16px", background: ativa ? C.sidebarBg : "transparent",
    color: ativa ? "#fff" : C.textMuted, border: "none",
    borderBottom: ativa ? "none" : `2px solid transparent`,
    fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "0.2s",
    borderRadius: ativa ? "8px 8px 0 0" : 0,
    display: "flex", alignItems: "center", gap: 6,
  });

  const bandeiras = Object.keys(taxas);

  if (carregando) return <div style={{ padding: 40, color: C.textLight, fontWeight: 700 }}>Carregando configurações de taxas...</div>;

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }} className="font-body">

      {/* ─── CABEÇALHO ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h2 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 10 }}>
            <FiPercent size={24} /> Taxas e Parcelamentos
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.textMuted, fontWeight: 500 }}>
            Configure as taxas cobradas pela sua maquininha para o cálculo correto do lucro líquido.
          </p>
        </div>
        <button
          onClick={salvarConfiguracoes}
          disabled={salvando}
          style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "12px 24px", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 800, cursor: salvando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", transition: "0.2s" }}
        >
          {salvando ? "Salvando..." : <><FiSave size={18} /> Salvar Alterações</>}
        </button>
      </div>

      {/* ─── CONFIGURAÇÕES GERAIS ─── */}
      <div style={{ background: C.bgCard, padding: 24, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, marginBottom: 32 }}>
        <h3 className="font-title uppercase tracking-widest" style={{ margin: "0 0 20px", fontSize: 13, fontWeight: 800, color: C.textMain, display: "flex", alignItems: "center", gap: 8 }}>
          <FiSettings size={16} /> Configurações Gerais
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <label style={labelStyle}>Limite Máximo de Parcelas Permitido</label>
            <select style={{...inputStyle, textAlign: "left", cursor: "pointer"}} value={maxParcelas} onChange={e => setMaxParcelas(Number(e.target.value))}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => (
                <option key={num} value={num}>Permitir parcelar em até {num}x</option>
              ))}
            </select>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: C.textLight }}>O caixa não deixará parcelar acima deste limite.</p>
          </div>
          <div>
            <label style={labelStyle}>Taxa do PIX (%)</label>
            <div style={{ position: "relative" }}>
              <input type="number" step="0.01" style={inputPercent} value={taxaPix} onChange={e => setTaxaPix(e.target.value)} />
              <span style={percentIcon}>%</span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: C.textLight }}>Caso sua maquininha ou banco cobre tarifa por Pix.</p>
          </div>
        </div>
      </div>

      {/* ─── TABELA DE TAXAS POR BANDEIRA ─── */}
      <div style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.borderMid}`, background: C.bg }}>
          <h3 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.textMain, display: "flex", alignItems: "center", gap: 8 }}>
            <FiCreditCard size={16} /> Taxas de Cartão (Por Bandeira e Parcela)
          </h3>
        </div>

        {/* Abas das Bandeiras */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.sidebarBg}`, padding: "16px 16px 0", background: C.bg, flexWrap: "wrap", gap: 4, alignItems: "flex-end" }}>
          {bandeiras.map(b => {
            const ativo = taxas[b]?._ativo !== false;
            return (
              <button key={b} onClick={() => setBandeiraAtiva(b)} style={tabStyle(bandeiraAtiva === b)}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: ativo ? "#22C55E" : "#CBD5E1", flexShrink: 0 }} />
                {b}
              </button>
            );
          })}
          <button
            onClick={() => { setMostraForm(true); setNomeNova(''); setTipoNova('ambas'); }}
            style={{ padding: "8px 14px", background: "transparent", border: `1.5px dashed ${C.borderMid}`, borderRadius: "8px 8px 0 0", color: C.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
          >
            <FiPlus size={14} /> Nova
          </button>
        </div>

        {/* Formulário de nova bandeira */}
        {mostraForm && (
          <div style={{ padding: "14px 24px", background: "#F0FDF4", borderBottom: `1px solid #BBF7D0`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              autoFocus
              placeholder="Nome da bandeira (ex: Nubank)"
              value={nomeNova}
              onChange={e => setNomeNova(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmarNovaBandeira()}
              style={{ padding: "8px 12px", borderRadius: RAIO_SM, border: `1px solid #86EFAC`, fontSize: 13, fontWeight: 700, outline: "none", minWidth: 220 }}
            />
            <select
              value={tipoNova}
              onChange={e => setTipoNova(e.target.value as TipoBandeira)}
              style={{ padding: "8px 12px", borderRadius: RAIO_SM, border: `1px solid #86EFAC`, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              <option value="ambas">Crédito e Débito</option>
              <option value="credito">Apenas Crédito</option>
              <option value="debito">Apenas Débito</option>
            </select>
            <button onClick={confirmarNovaBandeira} style={{ padding: "8px 16px", background: "#22C55E", color: "#fff", border: "none", borderRadius: RAIO_SM, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Adicionar</button>
            <button onClick={() => setMostraForm(false)} style={{ padding: "8px 12px", background: "transparent", color: C.textMuted, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_SM, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
          </div>
        )}

        {/* Painel da Bandeira Ativa */}
        {bandeiraAtiva && taxas[bandeiraAtiva] && (
          <div style={{ padding: 32 }}>

            {/* Header: tipo + ativo toggle + remover */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottom: `1px dashed ${C.borderMid}`, flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.textMain }}>{bandeiraAtiva}</span>

                {/* Tipo */}
                <div style={{ display: "flex", gap: 4 }}>
                  {([['ambas', 'Créd + Déb'], ['credito', 'Só Crédito'], ['debito', 'Só Débito']] as [TipoBandeira, string][]).map(([t, label]) => {
                    const sel = (taxas[bandeiraAtiva]?._tipo || 'ambas') === t;
                    return (
                      <button key={t} onClick={() => handleTaxaChange(bandeiraAtiva, '_tipo', t)}
                        style={{ padding: "5px 10px", borderRadius: RAIO_SM, border: `1.5px solid ${sel ? C.sidebarBg : C.borderMid}`, background: sel ? `${C.sidebarBg}18` : 'transparent', color: sel ? C.sidebarBg : C.textMuted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}
                      >{label}</button>
                    );
                  })}
                </div>

                {/* Ativo toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, color: C.textMuted }}>
                  <input
                    type="checkbox"
                    checked={taxas[bandeiraAtiva]?._ativo !== false}
                    onChange={e => handleTaxaChange(bandeiraAtiva, '_ativo', e.target.checked)}
                    style={{ accentColor: "#22C55E", width: 15, height: 15 }}
                  />
                  Ativa no fechamento de caixa
                </label>
              </div>

              <button
                onClick={() => removerBandeira(bandeiraAtiva)}
                style={{ background: "none", border: `1px solid ${C.danger}`, color: C.danger, padding: "6px 12px", borderRadius: RAIO_SM, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700 }}
              >
                <FiTrash2 size={13} /> Remover Bandeira
              </button>
            </div>

            {/* Débito */}
            <div style={{ marginBottom: 24, width: "30%" }}>
              <label style={labelStyle}>Débito (%) — {bandeiraAtiva}</label>
              <div style={{ position: "relative" }}>
                <input type="number" step="0.01" style={inputPercent} value={taxas[bandeiraAtiva]?.debito || ""} onChange={e => handleTaxaChange(bandeiraAtiva, 'debito', e.target.value)} />
                <span style={percentIcon}>%</span>
              </div>
            </div>

            <hr style={{ border: "none", borderTop: `1px dashed ${C.borderMid}`, margin: "0 0 24px" }} />
            <h4 style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 800, color: C.textMuted, textTransform: "uppercase" }}>Crédito (Até {maxParcelas}x)</h4>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {Array.from({ length: maxParcelas }, (_, i) => i + 1).map(num => (
                <div key={num}>
                  <label style={labelStyle}>{num}x {num === 1 ? 'à Vista' : 'Parcelado'} (%)</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      step="0.01"
                      style={{...inputPercent, borderColor: num === 1 ? C.borderMid : "#E2E8F0"}}
                      value={taxas[bandeiraAtiva]?.[`cred_${num}`] || ""}
                      onChange={e => handleTaxaChange(bandeiraAtiva, `cred_${num}`, e.target.value)}
                    />
                    <span style={percentIcon}>%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
