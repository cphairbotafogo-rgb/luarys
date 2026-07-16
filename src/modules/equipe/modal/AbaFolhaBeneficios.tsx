'use client'
/**
 * src/modules/equipe/modal/AbaFolhaBeneficios.tsx
 * Aba de folha de pagamento, comissão sobre produtos e benefícios corporativos.
 */
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { inputStyle, labelStyle, switchStyle, switchCircleStyle } from "./estilosCompartilhados";

function BlocoBeneficio({ label, nomeObj, form, setForm }: any) {
  const benef = form.folha_pagamento[nomeObj];
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <label style={{ ...labelStyle, margin: 0, fontSize: 11, color: C.sidebarBg }}>{label}</label>
        <select style={{ ...inputStyle, width: "auto", padding: "6px 12px", fontSize: 12, fontWeight: 600 }} value={benef.tipo} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, [nomeObj]: { ...benef, tipo: e.target.value } } })}>
          <option value="Não Possui">Não Possui</option>
          <option value="Integral">Integral (Sem Desconto)</option>
          <option value="Parcial">Parcial (Coparticipação)</option>
        </select>
      </div>
      {benef.tipo === 'Parcial' && (
        <div style={{ display: "flex", gap: 12, background: C.bg, padding: 12, borderRadius: RAIO_MD, border: `1px dashed ${C.borderMid}`, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Tipo de Desconto</label>
            <select style={inputStyle} value={benef.desconto_tipo} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, [nomeObj]: { ...benef, desconto_tipo: e.target.value } } })}>
              <option value="Porcentagem">% do Salário</option>
              <option value="Valor">Valor Fixo (R$)</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Valor / Alíquota</label>
            <input type="number" style={inputStyle} placeholder={benef.desconto_tipo === 'Valor' ? "R$ 0,00" : "%"} value={benef.valor_desconto} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, [nomeObj]: { ...benef, valor_desconto: e.target.value } } })} />
          </div>
        </div>
      )}
    </div>
  );
}

export function AbaFolhaBeneficios({ form, setForm }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#F4F8F5", padding: 20, borderRadius: RAIO_XL, border: "1px solid #E8F0EA" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 11, color: "#047857", fontWeight: 700, textTransform: "uppercase" }}>Revenda de Produtos</h4>
            <div title="Por padrão, ninguém recebe comissão por venda de produtos. Ative aqui para liberar — útil para recepção/administrativos que também vendem produtos no balcão." style={switchStyle(form.permite_comissao_produtos)} onClick={() => setForm({ ...form, permite_comissao_produtos: !form.permite_comissao_produtos })}>
              <span style={switchCircleStyle(form.permite_comissao_produtos)}></span>
            </div>
          </div>
          <label style={labelStyle}>Comissão sobre Produtos (%)</label>
          <input type="number" step="0.1" min="0" max="100" style={inputStyle} disabled={!form.permite_comissao_produtos} value={form.comissao_produtos} onChange={e => setForm({ ...form, comissao_produtos: parseFloat(e.target.value) || 0 })} />
          {!form.permite_comissao_produtos && <p style={{ margin: "8px 0 0", fontSize: 11, color: C.textLight, fontStyle: "italic" }}>Desativado: este profissional não recebe comissão por venda de produtos.</p>}
        </div>

        <div style={{ background: "#FDF8E7", padding: 20, borderRadius: RAIO_XL, border: "1px solid #FDE68A" }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 11, color: "#B45309", fontWeight: 700, textTransform: "uppercase" }}>Riscos e Adicionais</h4>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Insalubridade (R$)</label><input type="number" style={inputStyle} value={form.folha_pagamento.insalubridade} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, insalubridade: e.target.value } })} /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Quebra de Caixa (R$)</label><input type="number" style={inputStyle} value={form.folha_pagamento.quebra_caixa} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, quebra_caixa: e.target.value } })} /></div>
          </div>
        </div>
      </div>

      <div>
        <h4 style={{ margin: "0 0 16px", fontSize: 12, color: C.sidebarBg, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, textTransform: "uppercase" }}>Benefícios Corporativos</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <BlocoBeneficio label="Vale Transporte" nomeObj="vale_transporte" form={form} setForm={setForm} />
          <BlocoBeneficio label="Vale Alimentação / Refeição" nomeObj="vale_alimentacao" form={form} setForm={setForm} />
          <BlocoBeneficio label="Plano de Saúde / Odontológico" nomeObj="plano_saude" form={form} setForm={setForm} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ background: C.bg, padding: 20, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 11, color: C.textMain, fontWeight: 700, textTransform: "uppercase" }}>Ganhos Adicionais</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><label style={labelStyle}>Bonificação / Prêmios Fixos (R$)</label><input type="number" style={inputStyle} value={form.folha_pagamento.bonificacao} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, bonificacao: e.target.value } })} /></div>
            <div><label style={labelStyle}>Salário Família (R$)</label><input type="number" style={inputStyle} value={form.folha_pagamento.salario_familia} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, salario_familia: e.target.value } })} /></div>
          </div>
        </div>

        <div style={{ background: C.dangerBg, padding: 20, borderRadius: RAIO_XL, border: "1px solid #FECACA" }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 11, color: C.danger, fontWeight: 700, textTransform: "uppercase" }}>Deduções e Retenções Oficiais</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={labelStyle}>INSS (R$)</label><input type="number" style={inputStyle} value={form.folha_pagamento.inss} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, inss: e.target.value } })} /></div>
              <div><label style={labelStyle}>IRRF (R$)</label><input type="number" style={inputStyle} value={form.folha_pagamento.irrf} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, irrf: e.target.value } })} /></div>
            </div>
            <div><label style={labelStyle}>Faltas e Atrasos Consolidados (R$)</label><input type="number" style={inputStyle} value={form.folha_pagamento.desconto_faltas} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, desconto_faltas: e.target.value } })} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
