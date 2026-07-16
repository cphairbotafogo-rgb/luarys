'use client'
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_MD, RAIO_2XL, overlayModal, containerModalPerigo, inputAdmin, labelPadrao } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { FiX, FiDollarSign, FiCalendar, FiCheckCircle, FiLayers, FiRepeat, FiCreditCard } from "react-icons/fi";

// Sugestão automática de Fixo/Variável por categoria — só um ponto de
// partida, sempre editável. "Outros" fica sem sugestão (null) porque é
// categoria genérica demais para adivinhar.
function sugerirTipoCusto(categoria: string): 'Fixo' | 'Variável' | '' {
  if (categoria === 'Custos Fixos de Infraestrutura') return 'Fixo';
  if ([
    'Insumos, Logística e Variáveis',
    'Retenções Tributárias e Taxas',
    'Comissões Dedução de Pessoal',
  ].includes(categoria)) return 'Variável';
  return '';
}

export function ModalNovaDespesa({ perfil, onClose, aoSalvar }: any) {
  const dataHoje = new Date().toISOString().split('T')[0];
  
  const toast = useToast();
    const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    descricao: '',
    categoria: 'Custos Fixos de Infraestrutura',
    tipo_custo: sugerirTipoCusto('Custos Fixos de Infraestrutura') as 'Fixo' | 'Variável' | '',
    valor: '',
    data_vencimento: dataHoje,
    status: 'Pendente',
    data_pagamento: dataHoje,
    forma_pagamento: 'Cartão de Crédito',
    observacao: ''
  });

  // 🟢 ESTADOS DE TIPO DE LANÇAMENTO E PARCELAS
  const [tipoLancamento, setTipoLancamento] = useState<'unico' | 'parcelado' | 'recorrente'>('unico');
  const [quantidadeMeses, setQuantidadeMeses] = useState(2);

  // Calcula o valor da parcela em tempo real para mostrar na tela
  const valorTotalNum = parseFloat(form.valor.replace(',', '.')) || 0;
  const valorParcelaPreview = (valorTotalNum / quantidadeMeses).toFixed(2).replace('.', ',');

  async function handleSalvar(e: any) {
    e.preventDefault();
    if (!form.descricao || !form.valor || !form.data_vencimento) {
      { toast.aviso('Preencha descrição, valor e vencimento.'); return; }

    }
    if (!form.tipo_custo) {
      { toast.aviso('Selecione se essa despesa é Fixa ou Variável.'); return; }
    }

    setSalvando(true);
    try {
      const payloads = [];
      const numVezes = (tipoLancamento === 'unico') ? 1 : quantidadeMeses;
      
      // Define se vai dividir o valor (Parcelado) ou repetir o valor (Recorrente)
      const valorPorLancamento = (tipoLancamento === 'parcelado') 
        ? (valorTotalNum / numVezes) 
        : valorTotalNum;

      for (let i = 0; i < numVezes; i++) {
        // Calcula o vencimento adicionando meses
        const dataVencObj = new Date(form.data_vencimento + 'T12:00:00Z');
        dataVencObj.setMonth(dataVencObj.getMonth() + i);
        const vencimentoFormatado = dataVencObj.toISOString().split('T')[0];

        // Se for parcelado ou recorrente, apenas o mês atual fica com o status que o usuário escolheu (Ex: Pago).
        // Os meses futuros entram no banco como Pendentes automaticamente.
        const statusParcela = (i === 0) ? form.status : 'Pendente';
        const dataPagParcela = (i === 0 && form.status === 'Pago') ? form.data_pagamento : null;
        
        // Regra do Nome (Adiciona "1/5", "2/5" se for parcelado)
        let descricaoFinal = form.descricao;
        if (tipoLancamento === 'parcelado') descricaoFinal += ` (${i + 1}/${numVezes})`;

        payloads.push({
          salao_id: perfil.salao_id,
          descricao: descricaoFinal,
          categoria: form.categoria,
          tipo_custo: form.tipo_custo,
          valor: parseFloat(valorPorLancamento.toFixed(2)),
          data_vencimento: vencimentoFormatado,
          status: statusParcela,
          data_pagamento: dataPagParcela,
          forma_pagamento: form.forma_pagamento,
          observacao: form.observacao
        });
      }

      // Salva tudo no banco de dados de uma vez só!
      const { error } = await supabase.from('despesas').insert(payloads);
      if (error) throw error;

      toast.sucesso(numVezes > 1 ? `${numVezes} lançamentos gerados com sucesso!` : "Despesa lançada com sucesso!");

      aoSalvar();
      onClose();
    } catch (error: any) {
      toast.erro("Erro ao salvar: " + error.message);

    } finally {
      setSalvando(false);
    }
  }

  // ─── ESTILOS ───
  const inputStyle = inputAdmin;
  const labelStyle = labelPadrao;
  const btnTipoStyle = (ativo: boolean) => ({
    flex: 1, padding: "12px 8px", background: ativo ? "#FEE2E2" : C.bg, border: `1px solid ${ativo ? "#FCA5A5" : C.borderMid}`, borderRadius: RAIO_MD,
    color: ativo ? "#991B1B" : C.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 6, transition: "0.2s"
  });

  return (
    <div style={{ ...overlayModal, zIndex: 9999 }} className="font-body">
      <div style={{ ...containerModalPerigo, width: "100%", maxWidth: 650, overflow: "hidden", maxHeight: "95vh", display: "flex", flexDirection: "column" }}>
        
        {/* CABEÇALHO */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
          <h2 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.danger, display: "flex", alignItems: "center", gap: 10 }}>
            <FiDollarSign size={20} /> Lançar Despesa
          </h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.textLight, cursor: "pointer" }} className="hover:text-slate-800"><FiX size={24} /></button>
        </div>

        {/* CORPO DO FORMULÁRIO */}
        <div style={{ overflowY: "auto", padding: 24 }}>
          <form id="form-despesa" onSubmit={handleSalvar} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* 🟢 TIPO DE LANÇAMENTO (O Segredo do Parcelamento) */}
            <div>
              <label style={labelStyle}>Como essa despesa será paga?</label>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" style={btnTipoStyle(tipoLancamento === 'unico')} onClick={() => setTipoLancamento('unico')}>
                  <FiCheckCircle size={18} /> Compra Única
                </button>
                <button type="button" style={btnTipoStyle(tipoLancamento === 'parcelado')} onClick={() => setTipoLancamento('parcelado')}>
                  <FiLayers size={18} /> Parcelada
                </button>
                <button type="button" style={btnTipoStyle(tipoLancamento === 'recorrente')} onClick={() => setTipoLancamento('recorrente')}>
                  <FiRepeat size={18} /> Conta Fixa (Mensal)
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Descrição da Despesa *</label>
                <input style={inputStyle} placeholder={tipoLancamento === 'parcelado' ? "Ex: Secador Taiff" : "Ex: Conta de Luz (Enel)"} value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required autoFocus />
              </div>
              <div>
                <label style={labelStyle}>{tipoLancamento === 'parcelado' ? "Valor Total (R$) *" : "Valor (R$) *"}</label>
                <input style={{...inputStyle, fontWeight: 700, color: C.danger}} type="number" step="0.01" placeholder="0.00" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required />
              </div>
            </div>

            {/* 🟢 CAIXA DINÂMICA DE MESES/PARCELAS */}
            {tipoLancamento !== 'unico' && (
              <div style={{ background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{...labelStyle, margin: 0, color: C.textMain}}>
                    {tipoLancamento === 'parcelado' ? "Em quantas parcelas?" : "Repetir por quantos meses?"}
                  </label>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <select style={{...inputStyle, width: "auto", padding: "8px 12px"}} value={quantidadeMeses} onChange={(e) => setQuantidadeMeses(Number(e.target.value))}>
                    {[2,3,4,5,6,7,8,9,10,11,12,18,24].map(num => (
                      <option key={num} value={num}>{num} {tipoLancamento === 'parcelado' ? 'vezes' : 'meses'}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Mostra o valor da parcela como ajuda visual se for parcelado */}
            {tipoLancamento === 'parcelado' && valorTotalNum > 0 && (
              <div style={{ marginTop: -16, fontSize: 12, color: "#15803D", fontWeight: 600, display: "flex", justifyContent: "flex-end" }}>
                O sistema gerará {quantidadeMeses} parcelas de R$ {valorParcelaPreview}
              </div>
            )}

            <div>
              <label style={labelStyle}>Categoria (Mapeamento DRE) *</label>
              <select style={inputStyle} value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value, tipo_custo: sugerirTipoCusto(e.target.value)})}>
                <option value="Custos Fixos de Infraestrutura">Custos Fixos (Aluguel, Água, Luz, Internet)</option>
                <option value="Insumos, Logística e Variáveis">Insumos e Produtos (Descartáveis, Tintas, Equipamentos)</option>
                <option value="Retenções Tributárias e Taxas">Impostos e Taxas (DAS, Contador, Taxas)</option>
                <option value="Comissões Dedução de Pessoal">Comissões de Funcionários / Pessoal</option>
                <option value="Outros">Outras Despesas</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Tipo de Custo *
                {form.categoria === 'Comissões Dedução de Pessoal' && (
                  <span style={{ textTransform: 'none', fontWeight: 500, color: C.textLight, marginLeft: 6 }}>
                    (sugerido como Variável — ajuste se for um cargo ADM com valor fixo)
                  </span>
                )}
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" onClick={() => setForm({...form, tipo_custo: 'Fixo'})}
                  style={{ flex: 1, padding: "10px 8px", background: form.tipo_custo === 'Fixo' ? '#EFF6FF' : C.bg, border: `1px solid ${form.tipo_custo === 'Fixo' ? '#93C5FD' : C.borderMid}`, borderRadius: RAIO_MD, color: form.tipo_custo === 'Fixo' ? '#1D4ED8' : C.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  Fixa
                </button>
                <button type="button" onClick={() => setForm({...form, tipo_custo: 'Variável'})}
                  style={{ flex: 1, padding: "10px 8px", background: form.tipo_custo === 'Variável' ? '#FFFBEB' : C.bg, border: `1px solid ${form.tipo_custo === 'Variável' ? '#FCD34D' : C.borderMid}`, borderRadius: RAIO_MD, color: form.tipo_custo === 'Variável' ? '#92400E' : C.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  Variável
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>{tipoLancamento === 'parcelado' ? "Vencimento 1ª Parcela *" : "Vencimento *"}</label>
                <div style={{ position: "relative" }}>
                  <FiCalendar style={{ position: "absolute", left: 14, top: 14, color: C.textLight }} />
                  <input type="date" style={{...inputStyle, paddingLeft: 42}} value={form.data_vencimento} onChange={e => setForm({...form, data_vencimento: e.target.value})} required />
                </div>
              </div>
              
              <div>
                <label style={labelStyle}>Forma de Pagamento</label>
                <select style={inputStyle} value={form.forma_pagamento} onChange={e => setForm({...form, forma_pagamento: e.target.value})}>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Boleto">Boleto Bancário</option>
                  <option value="Pix">Pix</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Dinheiro">Dinheiro (Espécie)</option>
                  <option value="Débito Automático">Débito Automático</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "16px 0", borderTop: `1px dashed ${C.borderMid}` }}>
              <div>
                <label style={labelStyle}>{tipoLancamento === 'unico' ? "Status" : "Status do Primeiro Mês"}</label>
                <select 
                  style={{...inputStyle, fontWeight: 700, color: form.status === 'Pago' ? '#15803D' : '#B45309', backgroundColor: form.status === 'Pago' ? '#F0FDF4' : '#FFFBEB', borderColor: form.status === 'Pago' ? '#BBF7D0' : '#FDE68A'}} 
                  value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                >
                  <option value="Pendente">A Pagar (Pendente)</option>
                  <option value="Pago">Já foi Pago</option>
                </select>
              </div>

              {form.status === 'Pago' && (
                <div>
                  <label style={labelStyle}>Data do Pagamento</label>
                  <input type="date" style={inputStyle} value={form.data_pagamento} onChange={e => setForm({...form, data_pagamento: e.target.value})} />
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Observações (Opcional)</label>
              <input style={inputStyle} placeholder="Ex: Mês de referência, código de barras..." value={form.observacao} onChange={e => setForm({...form, observacao: e.target.value})} />
            </div>

          </form>
        </div>

        {/* RODAPÉ DO MODAL (FIXO EMBAIXO) */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "20px 24px", borderTop: `1px solid ${C.border}`, background: C.bg }}>
          <button type="button" onClick={onClose} style={{ padding: "14px 20px", background: C.bgCard, color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontWeight: 700, fontSize: 13, cursor: "pointer" }} className="hover:bg-slate-50 transition-all">
            Cancelar
          </button>
          <button form="form-despesa" type="submit" disabled={salvando} style={{ padding: "14px 24px", background: C.danger, color: "#fff", border: "none", borderRadius: RAIO_MD, fontWeight: 700, fontSize: 13, cursor: salvando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }} className="hover:opacity-90 transition-all shadow-sm">
            {salvando ? "Salvando..." : <><FiCheckCircle size={18} /> Salvar Lançamento</>}
          </button>
        </div>

      </div>
    </div>
  );
}