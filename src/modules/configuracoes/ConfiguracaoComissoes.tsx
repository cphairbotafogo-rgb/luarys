'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { Card } from "@/components/ui";
import { FiSave, FiPercent, FiTrendingUp, FiCreditCard } from "react-icons/fi";

type Nomenclatura = 'comissao' | 'salario';
type CustoOp = 'nao_descontar' | 'antes' | 'depois';
type TaxaOpModo = 'nao_descontar' | 'proporcional' | 'total' | 'metade' | 'personalizado';

const OPCOES_CUSTO_OP: { value: CustoOp; label: string; desc: string }[] = [
  {
    value: 'nao_descontar',
    label: 'Não descontar o custo operacional',
    desc: 'A comissão incide sobre o valor total do serviço. Comportamento padrão.',
  },
  {
    value: 'antes',
    label: 'Descontar ANTES do cálculo',
    desc: 'Base de cálculo: (Valor do serviço − Custo operacional) × % da comissão.',
  },
  {
    value: 'depois',
    label: 'Descontar APÓS o cálculo',
    desc: 'A comissão é calculada sobre o valor total e depois o custo é abatido: (Valor × %) − Custo operacional.',
  },
];

export function ConfiguracaoComissoes({ perfil }: any) {
  const toast = useToast();
  const [salvando, setSalvando] = useState(false);
  const [nomenclatura, setNomenclatura] = useState<Nomenclatura>('comissao');
  const [custoOp, setCustoOp] = useState<CustoOp>('nao_descontar');
  const [taxaOpModo, setTaxaOpModo] = useState<TaxaOpModo>('nao_descontar');
  const [taxaOpPercentual, setTaxaOpPercentual] = useState<string>('0');

  useEffect(() => {
    if (!perfil?.salao_id) return;
    supabase
      .from('saloes')
      .select('config_comissao_nomenclatura, config_comissao_custo_op, config_comissao_taxa_op_modo, config_comissao_taxa_op_percentual')
      .eq('id', perfil.salao_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.config_comissao_nomenclatura) setNomenclatura(data.config_comissao_nomenclatura);
        if (data?.config_comissao_custo_op) setCustoOp(data.config_comissao_custo_op);
        if (data?.config_comissao_taxa_op_modo) setTaxaOpModo(data.config_comissao_taxa_op_modo);
        if (data?.config_comissao_taxa_op_percentual != null) setTaxaOpPercentual(String(data.config_comissao_taxa_op_percentual));
      });
  }, [perfil?.salao_id]);

  async function salvar() {
    if (!perfil?.salao_id) return;
    setSalvando(true);
    const { error } = await supabase
      .from('saloes')
      .update({
        config_comissao_nomenclatura: nomenclatura,
        config_comissao_custo_op: custoOp,
        config_comissao_taxa_op_modo: taxaOpModo,
        config_comissao_taxa_op_percentual: Number(taxaOpPercentual) || 0,
      })
      .eq('id', perfil.salao_id);
    setSalvando(false);
    if (error) toast.erro("Erro ao salvar: " + error.message);
    else toast.sucesso("Configurações de comissão salvas!");
  }

  const labelStyle: React.CSSProperties = {
    margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: C.textMuted,
    display: "block", textTransform: "uppercase", letterSpacing: "0.5px",
  };

  const secaoTitulo = (icone: React.ReactNode, titulo: string, descricao: string) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
      <div style={{ background: `${C.sidebarBg}12`, padding: 10, borderRadius: RAIO_LG, color: C.sidebarBg, flexShrink: 0 }}>
        {icone}
      </div>
      <div>
        <h4 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.sidebarBg }}>
          {titulo}
        </h4>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{descricao}</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── NOMENCLATURA ── */}
      <Card className="shadow-sm" style={{ padding: 32, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.sidebarBg}` }}>
        {secaoTitulo(<FiPercent size={20} />, "Definição da Nomenclatura",
          "Escolha como os valores pagos aos profissionais são chamados nos relatórios e na interface.")}

        <div style={{ display: "flex", gap: 20 }}>
          {(['comissao', 'salario'] as Nomenclatura[]).map(v => (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "12px 20px", borderRadius: RAIO_MD, border: `2px solid ${nomenclatura === v ? C.sidebarBg : C.borderMid}`, background: nomenclatura === v ? `${C.sidebarBg}08` : C.bgCard, transition: "all 0.15s" }}>
              <input
                type="radio"
                name="nomenclatura"
                value={v}
                checked={nomenclatura === v}
                onChange={() => setNomenclatura(v)}
                style={{ accentColor: C.sidebarBg, width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: nomenclatura === v ? C.sidebarBg : C.textMain }}>
                {v === 'comissao' ? 'Comissão' : 'Salário'}
              </span>
            </label>
          ))}
        </div>
      </Card>

      {/* ── CUSTO OPERACIONAL ── */}
      <Card className="shadow-sm" style={{ padding: 32, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.sidebarBg}` }}>
        {secaoTitulo(<FiTrendingUp size={20} />, "Desconto dos Custos Operacionais",
          "Define se o custo operacional configurado em cada serviço deve ser considerado no cálculo da comissão.")}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {OPCOES_CUSTO_OP.map(op => (
            <label key={op.value} onClick={() => setCustoOp(op.value)} style={{ display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer", padding: "14px 18px", borderRadius: RAIO_LG, border: `2px solid ${custoOp === op.value ? C.sidebarBg : C.borderMid}`, background: custoOp === op.value ? `${C.sidebarBg}08` : C.bgCard, transition: "all 0.15s" }}>
              <input
                type="radio"
                name="custo_op"
                value={op.value}
                checked={custoOp === op.value}
                onChange={() => setCustoOp(op.value)}
                style={{ accentColor: C.sidebarBg, width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
              />
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: custoOp === op.value ? C.sidebarBg : C.textMain }}>{op.label}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{op.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* ── TAXA DA OPERADORA ── */}
      <Card className="shadow-sm" style={{ padding: 32, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, borderTop: `4px solid ${C.sidebarBg}` }}>
        {secaoTitulo(<FiCreditCard size={20} />, "Desconto da Taxa da Operadora",
          "Define se a taxa cobrada pela maquininha de cartão deve ser descontada da comissão do profissional.")}

        {/* Aviso com link para Taxas de Cartão */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: `${C.sidebarBg}08`, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "12px 16px", marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>
            <strong style={{ color: C.sidebarBg }}>Os percentuais por bandeira e PIX</strong> são definidos na aba <strong>Taxas de Cartão</strong>.
          </p>
          <button
            onClick={() => {
              const btn = document.querySelector<HTMLButtonElement>('[data-gaveta="taxas"]');
              if (btn) btn.click();
            }}
            style={{ flexShrink: 0, marginLeft: 16, padding: "6px 14px", background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            <FiCreditCard size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Ir para Taxas de Cartão
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          {([['nao_descontar', 'Não descontar'], ['proporcional', 'Descontar']] as [TaxaOpModo, string][]).map(([v, label]) => (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "12px 20px", borderRadius: RAIO_MD, border: `2px solid ${(v === 'nao_descontar' ? taxaOpModo === 'nao_descontar' : taxaOpModo !== 'nao_descontar') ? C.sidebarBg : C.borderMid}`, background: (v === 'nao_descontar' ? taxaOpModo === 'nao_descontar' : taxaOpModo !== 'nao_descontar') ? `${C.sidebarBg}08` : C.bgCard, transition: "all 0.15s" }}>
              <input
                type="radio"
                name="taxa-op-toggle"
                checked={v === 'nao_descontar' ? taxaOpModo === 'nao_descontar' : taxaOpModo !== 'nao_descontar'}
                onChange={() => setTaxaOpModo(v === 'nao_descontar' ? 'nao_descontar' : 'proporcional')}
                style={{ accentColor: C.sidebarBg, width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: (v === 'nao_descontar' ? taxaOpModo === 'nao_descontar' : taxaOpModo !== 'nao_descontar') ? C.sidebarBg : C.textMain }}>{label}</span>
            </label>
          ))}
        </div>

        {taxaOpModo !== 'nao_descontar' && (
          <div>
            <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Forma de repasse do desconto:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                ['proporcional', 'Proporcional ao % de comissão', 'Se o profissional tem 30% de comissão, ele paga 30% da taxa da maquininha.'],
                ['total',        '100% da taxa da operadora',      'O profissional absorve toda a taxa cobrada pela maquininha no serviço.'],
                ['metade',       '50% da taxa da operadora',       'O custo da taxa é dividido meio a meio entre salão e profissional.'],
                ['personalizado','Percentual personalizado',        'Defina exatamente qual % da taxa o profissional deve assumir.'],
              ] as [TaxaOpModo, string, string][]).map(([v, label, desc]) => (
                <label key={v} onClick={() => setTaxaOpModo(v)} style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", padding: "12px 16px", borderRadius: RAIO_MD, border: `2px solid ${taxaOpModo === v ? C.sidebarBg : C.borderMid}`, background: taxaOpModo === v ? `${C.sidebarBg}08` : C.bgCard, transition: "all 0.15s" }}>
                  <input type="radio" name="taxa-op-modo" checked={taxaOpModo === v} onChange={() => setTaxaOpModo(v)} style={{ accentColor: C.sidebarBg, width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: taxaOpModo === v ? C.sidebarBg : C.textMain }}>{label}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: C.textMuted }}>{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {taxaOpModo === 'personalizado' && (
              <div style={{ marginTop: 16, maxWidth: 240 }}>
                <label style={labelStyle}>Percentual da taxa assumido pelo profissional (%)</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="number" min="0" max="100" step="0.1"
                    value={taxaOpPercentual}
                    onChange={e => setTaxaOpPercentual(e.target.value)}
                    style={{ padding: "10px 36px 10px 14px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, width: "100%", boxSizing: "border-box" as const, fontSize: 14, fontWeight: 700, color: C.textMain, outlineColor: C.sidebarBg }}
                  />
                  <span style={{ position: "absolute" as const, right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.textMuted, fontWeight: 700 }}>%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── SALVAR ── */}
      <div>
        <button
          onClick={salvar}
          disabled={salvando}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 40px", background: salvando ? C.borderMid : C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 700, fontSize: 14, cursor: salvando ? "not-allowed" : "pointer", fontFamily: "var(--font-title)", letterSpacing: "0.5px" }}
        >
          <FiSave size={16} />
          {salvando ? "Salvando..." : "Salvar Configurações"}
        </button>
      </div>
    </div>
  );
}
