'use client'
/**
 * src/modules/equipe/modal/AbaContrato.tsx
 * Aba de vínculo de trabalho, dados de admissão e repasse bancário.
 */
import { FiInfo, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import { C } from "@/lib/constants";
import { RAIO_XL, RAIO_MD } from "@/lib/estiloGlobal";
import { labelStyle, inputStyle } from "./estilosCompartilhados";
import { limparCnpj } from '@/lib/cnpj';
import { contratoEhParceria, pendenciasContratoParceria } from '@/lib/salaoParceiro';

function BannerFiscal({ tipo, cnpj }: { tipo: string; cnpj: string }) {
  const temCnpj = limparCnpj(cnpj).length === 14; // mantém letras — CNPJ alfanumérico

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
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
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
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16, marginBottom: 16 }}>
          <div><label style={labelStyle}>Data de Admissão / Início</label><input type="date" style={inputStyle} value={form.contrato.admissao || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, admissao: e.target.value } })} /></div>
          <div><label style={labelStyle}>Vencimento Base Mensal (R$)</label><input type="number" min="0" style={inputStyle} placeholder="Ex: 2200,00" value={form.folha_pagamento?.salario_base || ""} onChange={e => setForm({ ...form, folha_pagamento: { ...form.folha_pagamento, salario_base: e.target.value } })} /></div>
        </div>
        {form.contrato?.tipo === "CLT" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 16 }}>
            <div><label style={labelStyle}>Nº CTPS</label><input style={inputStyle} value={form.contrato.ctps || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, ctps: e.target.value } })} /></div>
            <div><label style={labelStyle}>Série Carteira</label><input style={inputStyle} value={form.contrato.serieCtps || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, serieCtps: e.target.value } })} /></div>
            <div><label style={labelStyle}>PIS / PASEP</label><input style={inputStyle} value={form.contrato.pis || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, pis: e.target.value } })} /></div>
          </div>
        ) : null}
        {(form.contrato.tipo.includes("PJ") || form.contrato.tipo.includes("Parceiro") || form.contrato.tipo === "Sociedade") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
              <div><label style={labelStyle}>Razão Social da Empresa</label><input style={inputStyle} placeholder="Nome Empresarial" value={form.contrato.razaoSocial || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, razaoSocial: e.target.value } })} /></div>
              <div><label style={labelStyle}>CNPJ / MEI Vinculado</label><input style={inputStyle} placeholder="00.000.000/0000-00" value={form.contrato.cnpj || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, cnpj: e.target.value } })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
              <div><label style={labelStyle}>Inscrição Municipal</label><input style={inputStyle} value={form.contrato.inscricaoMunicipal || ""} onChange={e => setForm({ ...form, contrato: { ...form.contrato, inscricaoMunicipal: e.target.value } })} /></div>
              <div></div>
            </div>
          </div>
        )}
      </div>
      {contratoEhParceria(form.contrato.tipo) && (() => {
        // Art. 1o-A, par. 10: sete clausulas obrigatorias, mais a homologacao
        // sindical do par. 1o. Clausula ausente e o motivo mais comum de
        // descaracterizacao da parceria em reclamacao trabalhista.
        const c = form.contrato;
        const up = (campo: string, valor: any) => setForm({ ...form, contrato: { ...c, [campo]: valor } });
        const pendencias = pendenciasContratoParceria(c);
        const check = (campo: string, rotulo: string, disp: string) => (
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: C.textMain, cursor: 'pointer' }}>
            <input type="checkbox" checked={c[campo] === true} onChange={e => up(campo, e.target.checked)} style={{ marginTop: 2, accentColor: C.sidebarBg }} />
            <span>{rotulo} <span style={{ color: C.textLight, fontSize: 11 }}>({disp})</span></span>
          </label>
        );
        return (
          <div>
            <h4 style={{ margin: "0 0 8px", fontSize: 12, color: C.sidebarBg, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, textTransform: "uppercase" }}>
              Cláusulas obrigatórias — Lei 13.352/2016
            </h4>
            <p style={{ margin: "0 0 16px", fontSize: 11, color: C.textLight, lineHeight: 1.6 }}>
              Registro do que foi pactuado. Não substitui o contrato escrito e assinado — serve para o salão
              comprovar que os requisitos da lei foram observados.
            </p>

            {pendencias.length > 0 && (
              <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: RAIO_MD, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>
                  {pendencias.length} requisito(s) ainda não registrado(s)
                </div>
                <div style={{ fontSize: 11, color: '#92400E', lineHeight: 1.7 }}>
                  {pendencias.map(p => p.rotulo).join(' · ')}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 16 }}>
                <div>
                  <label style={labelStyle}>Retenção do salão (%) *</label>
                  <input type="number" min={0} max={100} step="0.01" style={inputStyle} placeholder="Ex: 40"
                    value={c.percentualRetencao ?? ""} onChange={e => up('percentualRetencao', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Periodicidade do pagamento *</label>
                  <select style={inputStyle} value={c.periodicidadePagamento ?? ""} onChange={e => up('periodicidadePagamento', e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="Semanal">Semanal</option>
                    <option value="Quinzenal">Quinzenal</option>
                    <option value="Mensal (até o dia 20 do mês seguinte)">Mensal (até o dia 20 do mês seguinte)</option>
                    <option value="A cada atendimento">A cada atendimento</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Aviso prévio (dias) *</label>
                  <input type="number" min={30} style={inputStyle} placeholder="30"
                    value={c.avisoPrevioDias ?? ""} onChange={e => up('avisoPrevioDias', e.target.value)} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Direitos de uso dos bens e acesso ao salão *</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  placeholder="Ex: cadeira 3, secador e lavatório de uso compartilhado; acesso das 9h às 20h."
                  value={c.direitosUsoBens ?? ""} onChange={e => up('direitosUsoBens', e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {check('retencaoTributos', 'O salão retém e recolhe os tributos e contribuições do profissional', '§ 10, II')}
                {check('responsabilidadeCompartilhada', 'Responsabilidade compartilhada por manutenção, higiene e bom atendimento', '§ 10, VI')}
                {check('regularidadeFiscal', 'O profissional se obriga a manter sua inscrição fiscal regular', '§ 10, VII')}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
                <div>
                  <label style={labelStyle}>Homologação — sindicato ou órgão *</label>
                  <input style={inputStyle} placeholder="Ex: SINDBELEZA-RJ"
                    value={c.homologacaoSindicato ?? ""} onChange={e => up('homologacaoSindicato', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Data da homologação</label>
                  <input type="date" style={inputStyle}
                    value={c.homologacaoData ?? ""} onChange={e => up('homologacaoData', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div>
        <h4 style={{ margin: "0 0 16px", fontSize: 12, color: C.sidebarBg, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, textTransform: "uppercase" }}>Repasse Bancário</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12 }}>
            <div><label style={labelStyle}>Instituição Bancária</label><input style={inputStyle} placeholder="Ex: Itaú" value={form.banco.banco || ""} onChange={e => setForm({ ...form, banco: { ...form.banco, banco: e.target.value } })} /></div>
            <div><label style={labelStyle}>Agência</label><input style={inputStyle} placeholder="0000" value={form.banco.agencia || ""} onChange={e => setForm({ ...form, banco: { ...form.banco, agencia: e.target.value } })} /></div>
            <div><label style={labelStyle}>Conta com Dígito</label><input style={inputStyle} placeholder="00000-0" value={form.banco.conta || ""} onChange={e => setForm({ ...form, banco: { ...form.banco, conta: e.target.value } })} /></div>
            <div><label style={labelStyle}>Tipo</label><select style={inputStyle} value={form.banco.tipoConta || "Corrente"} onChange={e => setForm({ ...form, banco: { ...form.banco, tipoConta: e.target.value } })}><option value="Corrente">Corrente</option><option value="Poupança">Poupança</option></select></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            <div><label style={labelStyle}>Chave Pix Tipo</label><select style={inputStyle} value={form.banco.tipoPix || ""} onChange={e => setForm({ ...form, banco: { ...form.banco, tipoPix: e.target.value } })}><option value="CPF/CNPJ">CPF / CNPJ</option><option value="Celular">Celular</option><option value="E-mail">E-mail</option><option value="Chave Aleatória">Chave Aleatória</option></select></div>
            <div><label style={labelStyle}>Chave Pix</label><input style={inputStyle} value={form.banco.chavePix || ""} onChange={e => setForm({ ...form, banco: { ...form.banco, chavePix: e.target.value } })} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
