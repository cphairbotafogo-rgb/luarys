// src/modules/financeiro/ModalNovaTransacao.tsx
// Modal de lançamento financeiro avulso (receita ou despesa).
'use client'
import { C } from '@/lib/constants';
import { FONTE_TITULO, RAIO_MD, RAIO_XL, overlayModal, containerModal, inputAdmin, labelPadrao } from '@/lib/estiloGlobal';
import { FiArrowUpRight, FiArrowDownRight, FiLink, FiSave, FiX } from 'react-icons/fi';
import { FormTransacao } from './tipos';

interface Props {
  form: FormTransacao;
  setForm: (f: FormTransacao) => void;
  profissionais: any[];
  fornecedores: any[];
  onSubmit: (e: any) => void;
  onFechar: () => void;
  sugerirTipoCusto: (categoria: string) => 'Fixo' | 'Variável' | '';
}

export function ModalNovaTransacao({ form, setForm, profissionais, fornecedores, onSubmit, onFechar, sugerirTipoCusto }: Props) {
  const inputStyle = inputAdmin;
  const labelStyle = labelPadrao;

  return (
    <div style={{ ...overlayModal, zIndex: 9999 }}>
      <div style={{ ...containerModal, padding: 32, width: '100%', maxWidth: 650 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>
          <h3 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg }}>Lançamento Financeiro Avulso</h3>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: C.textLight, display: 'flex', opacity: 0.8 }}><FiX size={24} /></button>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Tipo: Receita ou Despesa */}
          <div style={{ display: 'flex', gap: 12 }}>
            <label className="transition-all" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', border: `1px solid ${form.tipo === 'entrada' ? '#10B981' : C.borderMid}`, background: form.tipo === 'entrada' ? '#F4F8F5' : C.bgCard, borderRadius: RAIO_MD, cursor: 'pointer', fontWeight: 600, color: form.tipo === 'entrada' ? '#065F46' : C.textMuted, fontSize: 13 }}>
              <input type="radio" checked={form.tipo === 'entrada'} onChange={() => setForm({ ...form, tipo: 'entrada' })} style={{ display: 'none' }} />
              <FiArrowUpRight size={18} /> Receita (Entrada)
            </label>
            <label className="transition-all" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', border: `1px solid ${form.tipo === 'saida' ? '#EF4444' : C.borderMid}`, background: form.tipo === 'saida' ? '#FEF2F2' : C.bgCard, borderRadius: RAIO_MD, cursor: 'pointer', fontWeight: 600, color: form.tipo === 'saida' ? '#991B1B' : C.textMuted, fontSize: 13 }}>
              <input type="radio" checked={form.tipo === 'saida'} onChange={() => setForm({ ...form, tipo: 'saida' })} style={{ display: 'none' }} />
              <FiArrowDownRight size={18} /> Despesa (Saída)
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Descrição da Movimentação *</label>
              <input style={inputStyle} required placeholder="Ex: Venda de Produto" value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })} autoFocus />
            </div>

            <div>
              <label style={labelStyle}>Categoria de Classificação</label>
              <select style={inputStyle} value={form.categoria}
                onChange={e => setForm({ ...form, categoria: e.target.value, tipo_custo: sugerirTipoCusto(e.target.value) })}>
                <optgroup label="Saídas (Despesas)">
                  <option value="Despesas Fixas">Despesas Fixas (Aluguel, Água, Luz)</option>
                  <option value="Despesas Variáveis">Despesas Variáveis (Materiais, Produtos)</option>
                  <option value="Pessoal / Folha">Pessoal / Folha de Pagamento</option>
                  <option value="Comissões">Comissões (Parceiros)</option>
                  <option value="Adiantamento Salarial (Vale)">Adiantamento Salarial (Vale)</option>
                  <option value="Impostos / Taxas">Impostos e Taxas</option>
                  <option value="Marketing">Marketing e Publicidade</option>
                </optgroup>
                <optgroup label="Entradas (Receitas)">
                  <option value="Venda de Serviços">Venda de Serviços</option>
                  <option value="Venda de Produtos">Venda de Produtos</option>
                  <option value="Aporte de Sócio">Aporte de Sócio / Investimento</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Valor (R$) *</label>
              <input type="text" inputMode="decimal" placeholder="0,00"
                style={{ ...inputStyle, fontSize: 16, fontWeight: 700, color: form.tipo === 'entrada' ? C.success : C.danger, fontFamily: FONTE_TITULO }}
                required value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
            </div>

            {form.tipo === 'saida' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>
                  Tipo de Custo *
                  {form.categoria === 'Pessoal / Folha' && (
                    <span style={{ textTransform: 'none', fontWeight: 500, color: C.textLight, marginLeft: 6 }}>
                      (depende de quem é: ADM/salário fixo = Fixa · comissionado de produção = Variável)
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" onClick={() => setForm({ ...form, tipo_custo: 'Fixo' })}
                    style={{ flex: 1, padding: '10px 8px', background: form.tipo_custo === 'Fixo' ? '#EFF6FF' : C.bg, border: `1px solid ${form.tipo_custo === 'Fixo' ? '#93C5FD' : C.borderMid}`, borderRadius: RAIO_MD, color: form.tipo_custo === 'Fixo' ? '#1D4ED8' : C.textMuted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Fixa
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, tipo_custo: 'Variável' })}
                    style={{ flex: 1, padding: '10px 8px', background: form.tipo_custo === 'Variável' ? '#FFFBEB' : C.bg, border: `1px solid ${form.tipo_custo === 'Variável' ? '#FCD34D' : C.borderMid}`, borderRadius: RAIO_MD, color: form.tipo_custo === 'Variável' ? '#92400E' : C.textMuted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Variável
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Relação opcional */}
          <div style={{ background: C.bg, padding: 20, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
            <label style={{ ...labelStyle, color: C.sidebarBg, display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 12px' }}>
              <FiLink size={14} /> Relação do Lançamento (Opcional)
            </label>
            <div style={{ display: 'flex', gap: 12, marginBottom: form.relacao_tipo !== 'Nenhuma' ? 12 : 0 }}>
              <select style={{ ...inputStyle, flex: 1 }} value={form.relacao_tipo}
                onChange={e => setForm({ ...form, relacao_tipo: e.target.value, relacao_id: '' })}>
                <option value="Nenhuma">Sem relação definida</option>
                <option value="Profissional">Relacionada a Profissional</option>
                <option value="Fornecedor">Relacionada a Fornecedor</option>
              </select>
            </div>
            {form.relacao_tipo === 'Profissional' && (
              <select style={inputStyle} value={form.relacao_id}
                onChange={e => setForm({ ...form, relacao_id: e.target.value })} required>
                <option value="">Selecione o Profissional...</option>
                {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}{p.ativo === false ? ' (Inativo)' : ''}</option>)}
              </select>
            )}
            {form.relacao_tipo === 'Fornecedor' && (
              <select style={inputStyle} value={form.relacao_id}
                onChange={e => setForm({ ...form, relacao_id: e.target.value })} required>
                <option value="">Selecione o Fornecedor...</option>
                {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_empresa}</option>)}
              </select>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Vencimento / Data</label>
              <input type="date" style={inputStyle} required value={form.data_movimentacao}
                onChange={e => setForm({ ...form, data_movimentacao: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Forma de Pagto</label>
              <select style={inputStyle} value={form.forma_pagamento} onChange={e => setForm({ ...form, forma_pagamento: e.target.value })}>
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão Crédito">Cartão Crédito</option>
                <option value="Cartão Débito">Cartão Débito</option>
                <option value="Boleto">Boleto</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                style={{ ...inputStyle, background: form.status === 'Pago' ? '#F4F8F5' : '#FEF3C7', fontWeight: 600, color: form.status === 'Pago' ? '#065F46' : '#92400E', borderColor: form.status === 'Pago' ? '#E8F0EA' : '#FDE68A' }}
                value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="Pago">Pago / Liquidado</option>
                <option value="Pendente">A Pagar (Pendente)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12, paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
            <button type="button" onClick={onFechar} className="transition-all hover:bg-slate-50"
              style={{ flex: 1, padding: '14px 0', background: 'transparent', color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" className="transition-all hover:opacity-90"
              style={{ flex: 2, padding: '14px 0', background: C.sidebarBg, color: '#fff', border: 'none', borderRadius: RAIO_MD, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <FiSave size={16} /> Salvar Lançamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
