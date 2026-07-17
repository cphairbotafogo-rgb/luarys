'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { RAIO_SM, RAIO_MD, RAIO_XL, RAIO_2XL, SOMBRA_MODAL, overlayModal, containerModal } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { FiScissors, FiX, FiPackage, FiShield, FiPercent, FiSettings } from "react-icons/fi";
import { IconeAjuda } from "@/components/IconeAjuda";
import { ModalGerenciarSetores } from "./ModalGerenciarSetores";

const TABELA_TRIBUTACAO_SALAO = [
  { id: 1, label: 'Cabelereiros e Barbeiros', nbs: '126021000', mun: '06.01' },
  { id: 2, label: 'Manicure e Pedicure', nbs: '126022000', mun: '06.01' },
  { id: 3, label: 'Estética, Bem-estar e Depilação', nbs: '126023000', mun: '06.02' },
  { id: 4, label: 'Maquiagem e Outros', nbs: '126029000', mun: '06.02' }
];

const formVazio = { 
  nome_servico: '', categoria: '', setor: '', descricao: '', 
  tipo_preco: 'Fixo', preco_padrao: '', duracao: '60',
  exibir_online: true, custo_operacional: '', 
  tipo_despesa: 'Fixo', valor_despesa: '',
  codigo_municipio: '', nbs: '', aliquota_iss: '0.00',
  comissao_padrao: '', eh_cortesia: false
};

export function ModalServicos({ perfil, onClose, editandoId, produtosEstoque, categoriasUnicas }: any) {
  const toast = useToast();
    const [form, setForm] = useState(formVazio);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [novoInsumo, setNovoInsumo] = useState({ produto_id: '', quantidade: '' });
  const [salvando, setSalvando] = useState(false);
  const [setoresAtivos, setSetoresAtivos] = useState<any[]>([]);
  const [modalSetoresAberto, setModalSetoresAberto] = useState(false);

  async function carregarSetores() {
    const { data } = await supabase
      .from('setores_salao').select('id, nome').eq('ativo', true).order('nome');
    if (data) setSetoresAtivos(data);
  }

  useEffect(() => { carregarSetores(); }, []);

  useEffect(() => {
    async function carregarServico() {
      if (editandoId) {
        const { data: servico } = await supabase.from('servicos').select('*').eq('id', editandoId).maybeSingle();
        if (servico) {
          setForm({
            nome_servico: servico.nome_servico || '', categoria: servico.categoria || '', setor: servico.setor || '', descricao: servico.descricao || '',
            tipo_preco: servico.tipo_preco || 'Fixo', duracao: String(servico.duracao_minutos || '60'), preco_padrao: String(servico.preco_padrao || '0'),
            exibir_online: servico.exibir_online !== false, custo_operacional: String(servico.custo_operacional || ''),
            tipo_despesa: servico.tipo_despesa || 'Fixo', valor_despesa: String(servico.valor_despesa || ''),
            codigo_municipio: servico.codigo_municipio || '', nbs: servico.nbs || '', aliquota_iss: servico.aliquota_iss?.toString() || '0.00',
            comissao_padrao: servico.comissao_padrao !== null && servico.comissao_padrao !== undefined ? String(servico.comissao_padrao) : '',
            eh_cortesia: !!servico.eh_cortesia
          });
        }
        const { data: fichas } = await supabase.from('ficha_tecnica').select('produto_id, quantidade, produtos(nome_produto, custo_medio, unidade_medida)').eq('servico_id', editandoId);
        if (fichas) {
          setInsumos(fichas.map((d: any) => ({
            produto_id: d.produto_id, quantidade: d.quantidade, nome_produto: d.produtos?.nome_produto,
            custo_medio: d.produtos?.custo_medio || 0, unidade_medida: d.produtos?.unidade_medida || 'un'
          })));
        }
      }
    }
    carregarServico();
  }, [editandoId]);

  function adicionarInsumo() {
    if (!novoInsumo.produto_id || !novoInsumo.quantidade) return;
    const prod = produtosEstoque.find((p: any) => p.id === novoInsumo.produto_id);
    if (!prod) return;
    
    setInsumos([...insumos, {
      produto_id: prod.id, nome_produto: prod.nome_produto,
      quantidade: parseFloat(novoInsumo.quantidade.replace(',', '.')),
      unidade_medida: prod.unidade_medida, custo_medio: prod.custo_medio || 0
    }]);
    setNovoInsumo({ produto_id: '', quantidade: '' });
  }

  function removerInsumo(index: number) {
    setInsumos(insumos.filter((_, i) => i !== index));
  }

  async function salvarServico(e: any) {
    e.preventDefault();
    if (!form.nome_servico) { toast.aviso('O nome do serviço é obrigatório.'); return; }

    setSalvando(true);

    try {
      const payload = {
        salao_id: perfil.salao_id, nome_servico: form.nome_servico, categoria: form.categoria || 'Geral', setor: form.setor || null, descricao: form.descricao,
        tipo_preco: form.tipo_preco, exibir_online: form.exibir_online, duracao_minutos: parseInt(String(form.duracao || 60)) || 60,
        preco_padrao: parseFloat(String(form.preco_padrao || 0).replace(',', '.')) || 0, custo_operacional: parseFloat(String(form.custo_operacional || 0).replace(',', '.')) || 0,
        tipo_despesa: form.tipo_despesa, valor_despesa: parseFloat(String(form.valor_despesa || 0).replace(',', '.')) || 0,
        codigo_municipio: form.codigo_municipio || null, nbs: form.nbs || null, aliquota_iss: parseFloat(String(form.aliquota_iss || 0).replace(',', '.')) || 0,
        comissao_padrao: form.comissao_padrao === '' ? null : (parseFloat(String(form.comissao_padrao).replace(',', '.')) || 0),
        eh_cortesia: !!form.eh_cortesia
      };

      let servicoID = editandoId;

      if (editandoId) {
        const { error: erroUpdate } = await supabase.from('servicos').update(payload).eq('id', editandoId);
        if (erroUpdate) throw erroUpdate;
      } else {
        const { data, error } = await supabase.from('servicos').insert([payload]).select('id').single();
        if (error) throw error;
        servicoID = data.id;
      }

      if (servicoID) {
        await supabase.from('ficha_tecnica').delete().eq('servico_id', servicoID); 
        if (insumos.length > 0) {
          const payloadInsumos = insumos.map(i => ({ servico_id: servicoID, produto_id: i.produto_id, quantidade: i.quantidade }));
          await supabase.from('ficha_tecnica').insert(payloadInsumos);
        }
      }
      onClose(true); // Retorna true para o pai saber que salvou e precisa recarregar a lista
    } catch (error: any) {
      toast.erro("Erro ao salvar: " + error.message);

    } finally {
      setSalvando(false);
    }
  }

  const precoAtual = parseFloat(String(form.preco_padrao || 0).replace(',', '.')) || 0;
  const custoOp = parseFloat(String(form.custo_operacional || 0).replace(',', '.')) || 0;
  const valDesp = parseFloat(String(form.valor_despesa || 0).replace(',', '.')) || 0;
  const despesaCalculada = form.tipo_despesa === 'Porcentagem' ? (precoAtual * (valDesp / 100)) : valDesp;
  const custoTotalInsumos = insumos.reduce((acc, curr) => acc + (curr.quantidade * curr.custo_medio), 0);
  const saldoLiquidoEstimado = precoAtual - custoOp - despesaCalculada - custoTotalInsumos;

  const inputStyle = { padding:"10px 14px", borderRadius: RAIO_MD, border:`1px solid ${C.borderMid}`, width:"100%", boxSizing:"border-box" as const, outlineColor: C.sidebarBg, fontSize: 13, color: C.textMain, backgroundColor: C.bgCard, fontWeight: 500 };
  const labelStyle = { margin:"0 0 6px", fontSize:10, fontWeight:700, color:C.textMuted, display:"flex", alignItems:"center", gap:4, textTransform: "uppercase" as const, letterSpacing: "0.5px" };
  // Span vermelho para campos obrigatórios — use após o texto: <Obrig />
  const Obrig = () => <span style={{ color: '#EF4444', fontWeight: 900, fontSize: 11 }}>*</span>;

  return (
    <div style={{ ...overlayModal, zIndex: 999 }}>
      <div style={{ ...containerModal, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        <div style={{ background: C.bgCard, padding: "20px 32px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px", display: "flex", alignItems: "center", gap: 8 }}>
            <FiScissors size={18} /> {editandoId ? "Editar Ficha de Serviço" : "Novo Cadastro de Serviço"}
          </h3>
          <button type="button" onClick={() => onClose(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight }}><FiX size={24} /></button>
        </div>

        <form id="form-servico" onSubmit={salvarServico} style={{ overflowY: "auto", padding: 32, display: "flex", flexDirection: "column", gap: 32 }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 16 }}>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
                  Setor (profissional responsável)
                  <IconeAjuda texto={"Qual profissão executa este serviço?\nEx: Cabeleireiro, Manicure, Estética.\nUsado para agrupar serviços na ficha do profissional."} posicao="baixo" />
                  <button type="button" onClick={() => setModalSetoresAberto(true)} title="Gerenciar Setores" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', padding: 2 }}>
                    <FiSettings size={12} />
                  </button>
                </label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.setor} onChange={e => setForm({ ...form, setor: e.target.value })}>
                  <option value="">— Selecionar setor —</option>
                  {setoresAtivos.map((s: any) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                  {form.setor && !setoresAtivos.some((s: any) => s.nome === form.setor) && (
                    <option value={form.setor}>{form.setor} (legado)</option>
                  )}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Categoria</label>
                <input style={inputStyle} value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} placeholder="Ex: Barba e Bigode" list="categorias-lista" />
                <datalist id="categorias-lista">{categoriasUnicas.map((c: string) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label style={labelStyle}>Nome do Serviço <Obrig /></label>
                <input required style={inputStyle} value={form.nome_servico} onChange={e => setForm({...form, nome_servico: e.target.value})} placeholder="Ex: Barba com máquina" autoFocus />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Descrição / Detalhes</label>
              <textarea style={{ ...inputStyle, resize: "none", height: 80 }} value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Ex: Barbear os pelos da face utilizando máquina elétrica..." />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: C.textMain, fontWeight: 500 }}>
              <input type="checkbox" checked={form.exibir_online} onChange={e => setForm({...form, exibir_online: e.target.checked})} style={{ accentColor: C.sidebarBg, width: 16, height: 16 }} />
              Exibir este serviço no Site / App de Agendamento Online
            </label>
          </div>

          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 24 }}>
            <h4 style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Precificação Base & Duração</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Tipo de Preço</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={form.tipo_preco} onChange={e => setForm({...form, tipo_preco: e.target.value})}>
                  <option value="Fixo">Preço Fixo</option>
                  <option value="A partir de">A partir de</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Preço (R$) <Obrig /></label>
                <input
                  type="number" step="0.01" min="0" required={!form.eh_cortesia}
                  disabled={form.eh_cortesia}
                  style={{ ...inputStyle, opacity: form.eh_cortesia ? 0.5 : 1, cursor: form.eh_cortesia ? "not-allowed" : "text" }}
                  value={form.eh_cortesia ? '0' : form.preco_padrao}
                  onChange={e => setForm({...form, preco_padrao: e.target.value})}
                  placeholder="60.00"
                />
              </div>
              <div>
                <label style={labelStyle}>Duração (Minutos) <Obrig /></label>
                <input type="number" required min="1" style={inputStyle} value={form.duracao} onChange={e => setForm({...form, duracao: e.target.value})} placeholder="40" />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: C.textMain, fontWeight: 500, marginTop: 14 }}>
              <input
                type="checkbox"
                checked={form.eh_cortesia}
                onChange={e => setForm({ ...form, eh_cortesia: e.target.checked, preco_padrao: e.target.checked ? '0' : form.preco_padrao })}
                style={{ accentColor: C.sidebarBg, width: 16, height: 16 }}
              />
              Este é um serviço de cortesia / não cobrado (ex: retoque grátis)
            </label>
            {form.eh_cortesia && (
              <p style={{ fontSize: 11, color: C.textLight, margin: "6px 0 0 24px" }}>
                Não vai gerar alertas de margem no Diagnóstico, mesmo com preço R$ 0,00.
              </p>
            )}
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Comissão Padrão (%) — sugestão ao habilitar para um profissional novo</label>
              <input type="number" step="0.1" min="0" max="100" style={{ ...inputStyle, maxWidth: 200 }} value={form.comissao_padrao} onChange={e => setForm({...form, comissao_padrao: e.target.value})} placeholder="Ex: 40" />
            </div>
          </div>

          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, padding: 24 }}>
            <h4 style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
              Composição de Custos & Ficha Técnica
            </h4>
            
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 32 }}>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ background: C.bg, padding: 16, borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}` }}>
                  <h5 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                    <FiPackage size={14}/> Insumos do Estoque (Baixa Automática)
                  </h5>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <select style={{ ...inputStyle, flex: 2, padding: "8px 12px" }} value={novoInsumo.produto_id} onChange={e => setNovoInsumo({...novoInsumo, produto_id: e.target.value})}>
                      <option value="">Selecione o produto...</option>
                      {produtosEstoque.map((p: any) => <option key={p.id} value={p.id}>{p.nome_produto} ({p.unidade_medida})</option>)}
                    </select>
                    <input type="number" step="0.01" style={{ ...inputStyle, flex: 1, padding: "8px 12px" }} value={novoInsumo.quantidade} onChange={e => setNovoInsumo({...novoInsumo, quantidade: e.target.value})} placeholder="Qtd." />
                    <button type="button" onClick={adicionarInsumo} style={{ background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, padding: "0 12px", cursor: "pointer", fontWeight: 700 }}>Add</button>
                  </div>
                  {insumos.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {insumos.map((ins, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bgCard, padding: "8px 12px", borderRadius: RAIO_SM, border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.textMain }}>{ins.quantidade} {ins.unidade_medida} - {ins.nome_produto}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 11, color: C.textMuted }}>{brl(ins.quantidade * ins.custo_medio)}</span>
                            <button type="button" onClick={() => removerInsumo(idx)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer" }}><FiX size={14}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 11, color: C.textLight, fontStyle: "italic" }}>Nenhum insumo vinculado.</p>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Custo Operacional Fixo (R$)</label>
                  <input type="number" step="0.01" min="0" style={inputStyle} value={form.custo_operacional} onChange={e => setForm({...form, custo_operacional: e.target.value})} placeholder="Ex: 5.00" />
                </div>
                <div>
                  <label style={labelStyle}>Taxas / Outras Despesas</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select style={{ ...inputStyle, width: "110px", cursor: "pointer" }} value={form.tipo_despesa} onChange={e => setForm({...form, tipo_despesa: e.target.value})}>
                      <option value="Fixo">Valor Fixo</option>
                      <option value="Porcentagem">% Porcent.</option>
                    </select>
                    <input type="number" step="0.01" min="0" style={{ ...inputStyle, flex: 1 }} value={form.valor_despesa} onChange={e => setForm({...form, valor_despesa: e.target.value})} placeholder="0.00" />
                  </div>
                </div>
              </div>

              <div style={{ background: C.bg, padding: 24, borderRadius: RAIO_XL, border: `1px solid ${C.borderMid}`, alignSelf: "start" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 13, color: C.textMuted }}>
                  <span>Preço (Receita):</span>
                  <strong style={{ color: C.textMain }}>{brl(precoAtual)}</strong>
                </div>
                {custoTotalInsumos > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: C.danger }}>
                    <span>(-) Custo Ficha Técnica:</span>
                    <span>{brl(custoTotalInsumos)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: C.danger }}>
                  <span>(-) Custos Operacionais:</span>
                  <span>{brl(custoOp)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 12, color: C.danger, paddingBottom: 16, borderBottom: `1px solid ${C.borderMid}` }}>
                  <span>(-) Outras Desp. ({form.tipo_despesa === 'Porcentagem' ? `${valDesp}%` : 'Fixo'}):</span>
                  <span>{brl(despesaCalculada)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Saldo do Serviço</span>
                  <strong style={{ fontSize: 24, color: C.success }}>{brl(saldoLiquidoEstimado)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: C.bg, padding: 24, borderRadius: RAIO_XL, border: `1px solid ${C.borderMid}`, marginTop: 8, boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)" }}>
            <h4 className="font-title uppercase tracking-widest" style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8 }}>
              <FiShield size={16} /> Tributação de Serviço (NFS-e Nacional)
            </h4>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Seleção Inteligente de Tributação</label>
              <select
                value={TABELA_TRIBUTACAO_SALAO.find(t => t.nbs === form.nbs)?.nbs || ''}
                style={{ ...inputStyle, cursor: "pointer", border: `1px solid ${C.sidebarBg}`, color: C.sidebarBg, fontWeight: 700 }}
                onChange={(e) => {
                  const selecionado = TABELA_TRIBUTACAO_SALAO.find(t => t.nbs === e.target.value);
                  if (selecionado) setForm({...form, nbs: selecionado.nbs, codigo_municipio: selecionado.mun});
                }}
              >
                <option value="">-- Selecione o tipo de serviço para auto-preencher --</option>
                {TABELA_TRIBUTACAO_SALAO.map(t => <option key={t.id} value={t.nbs}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
                  Código Federal (NBS) *
                  <IconeAjuda texto={"Nomenclatura Brasileira de Serviços — necessário para emitir NFS-e (nota fiscal de serviço).\nUse a seleção inteligente acima para preencher automaticamente."} posicao="cima" />
                </label>
                <input list="nbs-lista-completa" style={inputStyle} value={form.nbs} onChange={e=>setForm({...form, nbs: e.target.value.replace(/\D/g, '')})} placeholder="Ex: 126021000" maxLength={9} />
              </div>
              <div>
                <label style={labelStyle}>Código Municipal</label>
                <input style={inputStyle} value={form.codigo_municipio} onChange={e=>setForm({...form, codigo_municipio: e.target.value})} placeholder="Ex: 06.01" />
              </div>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
                  Alíquota ISS (%) *
                  <IconeAjuda texto={"Imposto Sobre Serviços — percentual cobrado pela prefeitura.\nSalões geralmente pagam entre 2% e 5%. Consulte seu contador."} posicao="esquerda" />
                </label>
                <div style={{ position: "relative" }}>
                  <input type="number" step="0.01" style={{ ...inputStyle, paddingRight: 30 }} value={form.aliquota_iss} onChange={e=>setForm({...form, aliquota_iss: e.target.value})} placeholder="Ex: 2.00" />
                  <FiPercent size={12} color={C.textLight} style={{ position: "absolute", right: 12, top: 14 }} />
                </div>
              </div>
            </div>
          </div>
        </form>

        <div style={{ background: C.bg, padding: "20px 32px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <span style={{ marginRight: "auto", fontSize: 10, color: C.textLight }}>
            <span style={{ color: '#EF4444', fontWeight: 900 }}>*</span> Campos obrigatórios
          </span>
          <button type="button" onClick={() => onClose(false)} style={{ padding: "12px 24px", background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Cancelar
          </button>
          <button type="submit" form="form-servico" disabled={salvando} style={{ padding: "12px 32px", background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: salvando ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.5px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
            {salvando ? "Salvando..." : (editandoId ? "Salvar Alterações" : "Gravar Serviço")}
          </button>
        </div>

      </div>

      {modalSetoresAberto && (
        <ModalGerenciarSetores
          perfil={perfil}
          onClose={() => setModalSetoresAberto(false)}
          onAtualizar={carregarSetores}
        />
      )}
    </div>
  );
}