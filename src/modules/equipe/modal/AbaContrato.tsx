'use client'
/**
 * src/modules/equipe/modal/AbaContrato.tsx
 * Aba de vínculo de trabalho, dados de admissão e repasse bancário.
 */
import { FiInfo, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import { C } from "@/lib/constants";
import { RAIO_XL, RAIO_MD } from "@/lib/estiloGlobal";
import { labelStyle, inputStyle } from "./estilosCompartilhados";

function BannerFiscal({ tipo, cnpj }: { tipo: string; cnpj: string }) {
  const temCnpj = (cnpj || '').replace(/\D/g, '').length === 14;

  if (tipo.includes('Parceiro') && temCnpj) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: RAIO_MD, padding: '10px 14px' }}>
        <FiCheckCircle size={14} color="#15803D" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
          <strong>Regime ótimo (Lei 13.352/2016 + CNPJ).</strong> A cota-parte deste profissional é excluída da sua receita bruta no Simples Nacional — você tributa apenas a parte do salão. O profissional deve emitir NFS-e ao salão pelo valor da cota mensal.
        </p>
      </div>
    );
  }

  if (tipo.includes('Parceiro') && !temCnpj) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: RAIO_MD, padding: '10px 14px' }}>
        <FiAlertTriangle size={14} color="#B45309" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
          <strong>Parceiro sem CNPJ —</strong> o salão tributa o valor <em>total</em> como receita bruta, sem dedução da cota do profissional. Preencha o CNPJ/MEI do parceiro para ativar a dedução (Resolução CGSN 140/2018). Sem CNPJ, também é necessário emitir RPA e reter INSS 11% sobre cada repasse.
        </p>
      </div>
    );
  }

  if (tipo === 'CLT') {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: RAIO_MD, padding: '10px 14px' }}>
        <FiInfo size={14} color="#1D4ED8" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 12, color: '#1E40AF', lineHeight: 1.6 }}>
          <strong>Regime CLT.</strong> Salário, FGTS e encargos são gerenciados via eSocial/Folha de Pagamento. Os valores da folha não entram na receita bruta do Simples Nacional.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: RAIO_MD, padding: '10px 14px' }}>
      <FiInfo size={14} color="#6D28D9" style={{ marginTop: 2, flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 12, color: '#4C1D95', lineHeight: 1.6 }}>
        <strong>Prestador PJ / Sócio.</strong> Deve emitir NFS-e ou RPS ao salão por cada repasse. Sem retenção de INSS pelo salão quando o prestador for optante do Simples Nacional.
      </p>
    </div>
  );
}

export function AbaContrato({ form, setForm, listaFuncoes, setModalFuncoesAberto }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h4 style={{ margin: "0 0 16px", fontSize: 12, color: C.sidebarBg, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, textTransform: "uppercase" }}>Vínculo de Trabalho</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>Regime Jurídico / Contratual</label>
            <select style={inputStyle} value={form.contrato.tipo} onChange={e => setForm({ ...form, contrato: { ...form.contrato, tipo: e.target.value } })}>
              <option value="Profissional Parceiro (Lei 13.352/2016)">Profissional Parceiro (Lei 13.352/2016)</option>
              <option value="CLT">CLT (Funcionário Registrado)</option>
              <option value="Prestador de Serviço (PJ/MEI)">Prestador de Serviço (PJ Comum)</option>
              <option value="Sociedade">Sociedade / Cotista</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
              <label style={{ ...labelStyle, margin: 0 }}>Função Corporativa</label>
              <button type="button" onClick={() => setModalFuncoesAberto(true)} style={{ background: "none", border: "none", color: C.sidebarBg, fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Ajustar Catálogo</button>
            </div>
            <input list="funcoes-list" value={form.contrato.funcao || ""} onChange={(e) => setForm({ ...form, contrato: { ...form.contrato, funcao: e.target.value } })} style={inputStyle} placeholder="Selecione..." />
            <datalist id="funcoes-list">{listaFuncoes.map((f: any) => <option key={f.id} value={f.nome}>{f.nome}</option>)}</datalist>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <BannerFiscal tipo={form.contrato.tipo} cnpj={form.contrato.cnpj || ''} />
        </div>
      </div>
      <div style={{ background: C.bg, padding: 20, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div><label style={labelStyle}>Data de Admissão / Início</label><input type="date" style={inputStyle} value={form.contrato.admissao || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, admissao: e.target.value } })} /></div>
          <div><label style={labelStyle}>Vencimento Base Mensal (R$)</label><input type="number" min="0" style={inputStyle} placeholder="Ex: 2200,00" value={form.folha_pagamento?.salario_base || ""} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, salario_base: e.target.value } })} /></div>
        </div>
        {form.contrato?.tipo === "CLT" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div><label style={labelStyle}>Nº CTPS</label><input style={inputStyle} value={form.contrato.ctps || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, ctps: e.target.value } })} /></div>
            <div><label style={labelStyle}>Série Carteira</label><input style={inputStyle} value={form.contrato.serieCtps || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, serieCtps: e.target.value } })} /></div>
            <div><label style={labelStyle}>PIS / PASEP</label><input style={inputStyle} value={form.contrato.pis || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, pis: e.target.value } })} /></div>
          </div>
        ) : null}
        {(form.contrato.tipo.includes("PJ") || form.contrato.tipo.includes("Parceiro") || form.contrato.tipo === "Sociedade") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div><label style={labelStyle}>Razão Social da Empresa</label><input style={inputStyle} placeholder="Nome Empresarial" value={form.contrato.razaoSocial || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, razaoSocial: e.target.value } })} /></div>
              <div><label style={labelStyle}>CNPJ / MEI Vinculado</label><input style={inputStyle} placeholder="00.000.000/0000-00" value={form.contrato.cnpj || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, cnpj: e.target.value } })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div><label style={labelStyle}>Inscrição Municipal</label><input style={inputStyle} value={form.contrato.inscricaoMunicipal || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, inscricaoMunicipal: e.target.value } })} /></div>
              <div></div>
            </div>
          </div>
        )}
      </div>
      <div>
        <h4 style={{ margin: "0 0 16px", fontSize: 12, color: C.sidebarBg, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, textTransform: "uppercase" }}>Repasse Bancário</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Instituição Bancária</label><input style={inputStyle} placeholder="Ex: Itaú" value={form.banco.banco || ""} onChange={e => setForm({ ...form, banco: { ...form.banco, banco: e.target.value } })} /></div>
            <div><label style={labelStyle}>Agência</label><input style={inputStyle} placeholder="0000" value={form.banco.agencia || ""} onChange={e => setForm({ ...form, banco: { ...form.banco, agencia: e.target.value } })} /></div>
            <div><label style={labelStyle}>Conta com Dígito</label><input style={inputStyle} placeholder="00000-0" value={form.banco.conta || ""} onChange={e => setForm({ ...form, banco: { ...form.banco, conta: e.target.value } })} /></div>
            <div><label style={labelStyle}>Tipo</label><select style={inputStyle} value={form.banco.tipoConta || "Corrente"} onChange={e => setForm({ ...form, banco: { ...form.banco, tipoConta: e.target.value } })}><option value="Corrente">Corrente</option><option value="Poupança">Poupança</option></select></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: 12 }}>
            <div><label style={labelStyle}>Chave Pix Tipo</label><select style={inputStyle} value={form.banco.tipoPix || ""} onChange={e => setForm({ ...form, banco: { ...form.banco, tipoPix: e.target.value } })}><option value="CPF/CNPJ">CPF / CNPJ</option><option value="Celular">Celular</option><option value="E-mail">E-mail</option><option value="Chave Aleatória">Chave Aleatória</option></select></div>
            <div><label style={labelStyle}>Chave Pix</label><input style={inputStyle} value={form.banco.chavePix || ""} onChange={e => setForm({ ...form, banco: { ...form.banco, chavePix: e.target.value } })} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
