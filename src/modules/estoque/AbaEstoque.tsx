'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { inputAdmin, RAIO_SM, RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { Btn, Card, Badge } from "@/components/ui";
import { GavetaParceiros } from "./gavetas/GavetaParceiros";
import { GavetaAuditoria } from "../relatorios/gavetas/GavetaAuditoria";
import { GavetaPDV } from "./gavetas/GavetaPDV";
import { temPermissao } from "@/lib/permissoes";
import { ModalMovimentoEstoque } from "./components/ModalMovimentoEstoque";
import { FormProduto } from "./components/FormProduto";
import { AbaReajusteLote } from "./components/AbaReajusteLote";
import {
  FiPackage, FiFileText, FiTruck, FiShoppingCart, FiAward,
  FiScissors, FiShoppingBag, FiDroplet, FiArrowDownCircle, FiArrowUpCircle,
  FiTrendingUp
} from "react-icons/fi";

export function AbaEstoque({ perfil }: any) {
  const pAcesso = perfil?.permissoes?.perfil_acesso || '';
  const podeEditarEstoque = perfil?.isDono || temPermissao(perfil, 'modulo.estoque') || ['Administrador', 'Administrativo', 'Gerente', 'Estoquista'].includes(pAcesso);

  const toast = useToast();
  const [abaAtiva, setAbaAtiva] = useState('prateleira');
  const [produtos, setProdutos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [modalMovimento, setModalMovimento] = useState<any>(null);
  const [salvandoMov, setSalvandoMov] = useState(false);

  const formMovVazio = { tipo: "Saída", quantidade: '', motivo: "Uso em Serviço" };
  const [formMov, setFormMov] = useState(formMovVazio);

  const formVazio = {
    nome_produto: '', categoria: 'Mega Hair', subcategoria: '', unidade_medida: 'Gramas',
    quantidade_atual: '', estoque_minimo: '', custo_medio: '', preco_venda: '',
    codigo_sku: '', codigo_barras: 'SEM GTIN', ncm: '', cest: '', cfop_padrao: '5102', csosn_padrao: '102', origem: '0'
  };
  const [form, setForm] = useState(formVazio);

  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [reajusteValor, setReajusteValor] = useState<string>("");
  const [reajusteTipo, setReajusteTipo] = useState<'aumento' | 'desconto'>('aumento');
  const [processandoLote, setProcessandoLote] = useState(false);
  const [categoriaLote, setCategoriaLote] = useState<string>("");

  async function carregarEstoque() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const { data } = await supabase.from('produtos').select('*').eq('salao_id', perfil.salao_id).order('nome_produto');
    if (data) setProdutos(data);
    setCarregando(false);
  }

  useEffect(() => { carregarEstoque(); }, [perfil]);

  const subcategoriasUnicas = Array.from(new Set(produtos.map(p => p.subcategoria).filter(Boolean)));
  const categoriasUnicas = Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean)));

  function toggleSelecao(id: number) {
    if (selecionados.includes(id)) setSelecionados(selecionados.filter(i => i !== id));
    else setSelecionados([...selecionados, id]);
  }
  function selecionarTodos() {
    if (selecionados.length === produtos.length) setSelecionados([]);
    else setSelecionados(produtos.map(p => p.id));
  }
  function selecionarPorCategoria(categoria: string) {
    const ids = produtos.filter(p => p.categoria === categoria).map(p => p.id);
    setSelecionados(Array.from(new Set([...selecionados, ...ids])));
  }
  function selecionarPorSubcategoria(categoria: string, subcategoria: string) {
    const ids = produtos.filter(p => p.categoria === categoria && p.subcategoria === subcategoria).map(p => p.id);
    setSelecionados(Array.from(new Set([...selecionados, ...ids])));
  }

  async function aplicarReajusteEmLote() {
    const valorPercentual = parseFloat(reajusteValor.replace(',', '.'));
    if (!valorPercentual || valorPercentual <= 0) { toast.aviso('Digite um valor percentual válido maior que zero.'); return; }
    if (selecionados.length === 0) return;
    if (!await confirmarAcaoGlobal({ titulo: `Aplicar ${reajusteTipo} de ${valorPercentual}%?`, descricao: `Isso altera o preço de ${selecionados.length} produto(s) selecionado(s).`, perigoso: false })) return;
    setProcessandoLote(true);
    try {
      await Promise.all(selecionados.map(id => {
        const item = produtos.find(p => p.id === id);
        if (!item) return Promise.resolve();
        const fator = reajusteTipo === 'aumento' ? (1 + valorPercentual / 100) : (1 - valorPercentual / 100);
        return supabase.from('produtos').update({ preco_venda: (item.preco_venda || 0) * fator }).eq('id', id);
      }));
      toast.sucesso('Reajuste aplicado com sucesso!');
      setSelecionados([]); setReajusteValor(""); carregarEstoque();
    } catch (err: any) {
      toast.erro("Erro ao processar lote: " + err.message);
    } finally {
      setProcessandoLote(false);
    }
  }

  function abrirNovoProduto() { setForm(formVazio); setEditandoId(null); setModalAberto(true); }
  function abrirEdicao(prod: any) {
    setForm({
      nome_produto: prod.nome_produto || '', categoria: prod.categoria || 'Mega Hair',
      subcategoria: prod.subcategoria || '', unidade_medida: prod.unidade_medida || 'Gramas',
      quantidade_atual: prod.quantidade_atual?.toString() || '0', estoque_minimo: prod.estoque_minimo?.toString() || '0',
      custo_medio: prod.custo_medio?.toString() || '0', preco_venda: prod.preco_venda?.toString() || '0',
      codigo_sku: prod.codigo_sku || '', codigo_barras: prod.codigo_barras || 'SEM GTIN',
      ncm: prod.ncm || '', cest: prod.cest || '',
      cfop_padrao: prod.cfop_padrao || '5102', csosn_padrao: prod.csosn_padrao || '102', origem: prod.origem || '0'
    });
    setEditandoId(prod.id); setModalAberto(true);
  }

  async function salvarProduto(e: any) {
    e.preventDefault();
    if (!form.nome_produto) { toast.aviso('O nome do produto é obrigatório.'); return; }
    const parseNum = (val: any) => parseFloat(val.toString().replace(',', '.')) || 0;
    const dados = {
      salao_id: perfil.salao_id, nome_produto: form.nome_produto,
      categoria: form.categoria, subcategoria: form.subcategoria, unidade_medida: form.unidade_medida,
      quantidade_atual: parseNum(form.quantidade_atual), estoque_minimo: parseNum(form.estoque_minimo),
      custo_medio: parseNum(form.custo_medio), preco_venda: parseNum(form.preco_venda),
      codigo_sku: form.codigo_sku || null, codigo_barras: form.codigo_barras || 'SEM GTIN',
      ncm: form.ncm || null, cest: form.cest || null,
      cfop_padrao: form.cfop_padrao || '5102', csosn_padrao: form.csosn_padrao || '102', origem: form.origem || '0'
    };
    if (editandoId) {
      const { error } = await supabase.from('produtos').update(dados).eq('id', editandoId);
      if (error) { toast.erro("Erro ao atualizar: " + error.message); return; }
      toast.sucesso('Produto atualizado com sucesso!');
    } else {
      const { error } = await supabase.from('produtos').insert([dados]);
      if (error) { toast.erro("Erro ao criar: " + error.message); return; }
      toast.sucesso('Produto cadastrado com sucesso!');
    }
    setModalAberto(false); carregarEstoque();
  }

  async function excluirProduto(id: string) {
    if (!await confirmarAcaoGlobal({ titulo: 'Excluir produto?', descricao: 'O produto será removido permanentemente do estoque.', perigoso: true })) return;
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (!error) carregarEstoque();
  }

  async function salvarMovimento(e: any) {
    e.preventDefault();
    if (!modalMovimento) return;
    const qtd = parseFloat(formMov.quantidade.toString().replace(',', '.')) || 0;
    if (qtd <= 0) { toast.aviso('A quantidade deve ser maior que zero.'); return; }
    setSalvandoMov(true);
    const novaQtd = formMov.tipo === 'Entrada' ? Number(modalMovimento.quantidade_atual) + qtd : Number(modalMovimento.quantidade_atual) - qtd;
    await supabase.from('produtos').update({ quantidade_atual: novaQtd }).eq('id', modalMovimento.id);
    await supabase.from('historico_estoque').insert([{ salao_id: perfil.salao_id, produto_id: modalMovimento.id, tipo: formMov.tipo, quantidade: qtd, motivo: formMov.motivo }]);
    setSalvandoMov(false); setModalMovimento(null); setFormMov(formMovVazio); carregarEstoque();
  }

  const capitalInvestido = produtos.reduce((acc, p) => acc + ((p.custo_medio || 0) * (p.quantidade_atual || 0)), 0);
  const itensEmAlerta = produtos.filter(p => p.quantidade_atual <= p.estoque_minimo);
  const lista = produtos.filter(p => p.nome_produto.toLowerCase().includes(busca.toLowerCase()) && (filtroCategoria ? p.categoria === filtroCategoria : true));

  const tabStyle = (ativa: boolean) => ({ padding: "10px 20px", display: "flex", alignItems: "center", gap: 8, background: ativa ? C.sidebarBg : "transparent", color: ativa ? "#fff" : C.textMuted, border: "none", borderRadius: RAIO_MD, fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all 0.2s" });

  if (carregando) return <div style={{ padding: 28, color: C.sidebarBg, fontWeight: 800 }}>Contando o estoque...</div>;

  return (
    <div style={{ padding: 28, overflowY: "auto", flex: 1, background: C.bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.sidebarBg }}>Armazém Inteligente</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textLight }}>Gestão de Mega Hairs, produtos e fornecedores.</p>
        </div>
        {podeEditarEstoque && abaAtiva === 'prateleira' && <Btn onClick={abrirNovoProduto} style={{ background: C.sidebarBg, color: "#fff", border: "none" }}>+ Novo Produto</Btn>}
      </div>

      <div style={{ display: "flex", gap: 10, background: C.bgCard, padding: 8, borderRadius: RAIO_XL, border: `1px solid ${C.borderMid}`, marginBottom: 24, overflowX: "auto" }}>
        <button style={tabStyle(abaAtiva === "prateleira")} onClick={() => setAbaAtiva("prateleira")}><FiPackage size={16} /> Prateleira</button>
        {podeEditarEstoque && (
          <button style={tabStyle(abaAtiva === "reajuste")} onClick={() => setAbaAtiva("reajuste")}><FiTrendingUp size={16} /> Reajuste em Lote</button>
        )}
        <button style={tabStyle(abaAtiva === "auditoria")} onClick={() => setAbaAtiva("auditoria")}><FiFileText size={16} /> Auditoria de Movimentos</button>
        <button style={tabStyle(abaAtiva === "fornecedores")} onClick={() => setAbaAtiva("fornecedores")}><FiTruck size={16} /> Rede de Parceiros</button>
        <button style={tabStyle(abaAtiva === "pdv")} onClick={() => setAbaAtiva("pdv")}><FiShoppingCart size={16} /> PDV Expresso</button>
        <button style={tabStyle(abaAtiva === "ranking")} onClick={() => setAbaAtiva("ranking")}><FiAward size={16} /> Top Produtos</button>
      </div>

      {abaAtiva === 'prateleira' && (
        <div style={{ animation: "fadeIn 0.3s ease-out" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
            <Card style={{ padding: 20 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Total de Itens</p>
              <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 900, color: C.textMain }}>{produtos.length}</p>
            </Card>
            <Card style={{ padding: 20, borderLeft: `4px solid ${C.sidebarBg}` }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Capital Investido (Custo)</p>
              <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 900, color: C.sidebarBg }}>{brl(capitalInvestido)}</p>
            </Card>
            <Card style={{ padding: 20, borderLeft: itensEmAlerta.length > 0 ? `4px solid ${C.danger}` : `4px solid ${C.success}` }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Alerta de Estoque</p>
              <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 900, color: itensEmAlerta.length > 0 ? C.danger : C.success }}>
                {itensEmAlerta.length > 0 ? `${itensEmAlerta.length} itens acabando` : 'Estoque Saudável'}
              </p>
            </Card>
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar produto..." style={{ ...inputAdmin, maxWidth: 300 }} />
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ ...inputAdmin, maxWidth: 200, cursor: "pointer" }}>
              <option value="">Todas as Categorias</option>
              <option value="Mega Hair">Mega Hair</option>
              <option value="Revenda">Revenda (Cliente)</option>
              <option value="Uso Interno">Uso Interno (Lavatório)</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lista.length === 0 && <p style={{ color: C.textMuted }}>Nenhum produto encontrado.</p>}
            {lista.map(p => {
              const emAlerta = p.quantidade_atual <= p.estoque_minimo;
              return (
                <Card key={p.id} style={{ padding: "16px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px", border: emAlerta ? `1px solid ${C.dangerBg}` : `1px solid ${C.borderMid}`, transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: "250px", cursor: podeEditarEstoque ? "pointer" : "default" }} onClick={() => { if (podeEditarEstoque) abrirEdicao(p); }}>
                    <div style={{ width: 48, height: 48, borderRadius: RAIO_MD, background: emAlerta ? C.dangerBg : '#F1F5F9', color: emAlerta ? C.danger : C.sidebarBg, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 16 }}>
                      {p.categoria === 'Mega Hair' ? <FiScissors size={24} /> : (p.categoria === 'Revenda' ? <FiShoppingBag size={24} /> : <FiDroplet size={24} />)}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>{p.nome_produto}</h4>
                      {p.subcategoria && <span style={{ display: "block", fontSize: 11, color: C.textLight, fontWeight: 600, marginBottom: 4 }}>{p.subcategoria}</span>}
                      <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                        <Badge label={p.categoria} style={{ bg: "#F1F5F9", color: C.textMuted }} />
                        {emAlerta && <Badge label="Estoque Baixo" style={{ bg: C.dangerBg, color: C.danger }} />}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 32, alignItems: "center", padding: "0 16px", borderLeft: `1px solid ${C.borderMid}`, borderRight: `1px solid ${C.borderMid}` }}>
                    <div style={{ textAlign: "center" }}><span style={{ fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Qtd</span><p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: emAlerta ? C.danger : C.textMain }}>{p.quantidade_atual} <span style={{ fontSize: 12 }}>{p.unidade_medida.slice(0, 3).toLowerCase()}</span></p></div>
                    <div style={{ textAlign: "center" }}><span style={{ fontSize: 10, fontWeight: 800, color: C.textLight, textTransform: "uppercase" }}>Custo</span><p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.sidebarBg }}>{brl(p.custo_medio)}</p></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: "120px" }}>
                    <button onClick={e => { e.stopPropagation(); setFormMov({ ...formMovVazio, tipo: 'Entrada', motivo: 'Compra de Fornecedor' }); setModalMovimento(p); }} style={{ background: C.successBg, color: C.successText, border: `1px solid #BBF7D0`, padding: "8px", borderRadius: RAIO_SM, fontWeight: 800, cursor: "pointer", width: "100%", transition: "0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <FiArrowDownCircle size={14} /> Entrada
                    </button>
                    <button onClick={e => { e.stopPropagation(); setFormMov({ ...formMovVazio, tipo: 'Saída', motivo: 'Uso em Serviço' }); setModalMovimento(p); }} style={{ background: C.dangerBg, color: C.dangerText, border: `1px solid #FECACA`, padding: "8px", borderRadius: RAIO_SM, fontWeight: 800, cursor: "pointer", width: "100%", transition: "0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <FiArrowUpCircle size={14} /> Saída
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {abaAtiva === 'reajuste' && podeEditarEstoque && (
        <AbaReajusteLote
          produtos={produtos}
          selecionados={selecionados}
          reajusteValor={reajusteValor}
          reajusteTipo={reajusteTipo}
          processandoLote={processandoLote}
          categoriaLote={categoriaLote}
          categoriasUnicas={categoriasUnicas}
          setCategoriaLote={setCategoriaLote}
          setReajusteValor={setReajusteValor}
          setReajusteTipo={setReajusteTipo}
          onToggleSelecao={toggleSelecao}
          onSelecionarTodos={selecionarTodos}
          onSelecionarPorCategoria={selecionarPorCategoria}
          onSelecionarPorSubcategoria={selecionarPorSubcategoria}
          onAplicar={aplicarReajusteEmLote}
        />
      )}

      {abaAtiva === 'auditoria' && <GavetaAuditoria perfil={perfil} />}
      {abaAtiva === 'fornecedores' && <GavetaParceiros perfil={perfil} />}
      {abaAtiva === 'pdv' && <GavetaPDV perfil={perfil} />}
      {abaAtiva === 'ranking' && <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}><h3>Ranking de Produtos em construção... 🚧</h3></div>}

      {modalMovimento && (
        <ModalMovimentoEstoque
          produto={modalMovimento}
          formMov={formMov}
          onCampoChange={(campo, valor) => setFormMov({ ...formMov, [campo]: valor })}
          onSubmit={salvarMovimento}
          onClose={() => setModalMovimento(null)}
          salvando={salvandoMov}
        />
      )}

      {modalAberto && podeEditarEstoque && (
        <FormProduto
          form={form}
          setForm={setForm}
          editandoId={editandoId}
          subcategoriasUnicas={subcategoriasUnicas}
          onSubmit={salvarProduto}
          onClose={() => setModalAberto(false)}
          onExcluir={excluirProduto}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }` }} />
    </div>
  );
}
