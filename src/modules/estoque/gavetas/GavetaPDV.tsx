'use client'
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { inputAdmin, RAIO_SM, RAIO_MD, RAIO_XL, RAIO_2XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { Card } from "@/components/ui";
import { FiSearch, FiShoppingBag, FiPlus, FiX, FiDollarSign, FiShoppingCart, FiCheckCircle } from "react-icons/fi";
import { useDadosGlobais } from "@/lib/contexto/DadosGlobaisContext";
import { useFechamentoCaixa } from "@/modules/agenda/modals/hooks/useFechamentoCaixa";
import { ModalFechamentoCaixa } from "@/modules/agenda/modals/ModalFechamentoCaixa";

// PDV de balcão: monta o carrinho de produtos e envia para a tela rica de
// Fechamento de Caixa (pagamento completo + RPC atômica + NFC-e automática).
// Cliente do CRM é opcional e vincula a venda ao histórico do cliente.
export function GavetaPDV({ perfil }: any) {
  const toast = useToast();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<any[]>([]);

  // Cliente do CRM (opcional) — vincula a venda ao histórico do cliente.
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteSel, setClienteSel] = useState<any>(null);
  const [clientesResult, setClientesResult] = useState<any[]>([]);
  const [dropdownCliente, setDropdownCliente] = useState(false);
  const refCliente = useRef<HTMLDivElement>(null);

  // ── Integração com a tela rica de Fechamento de Caixa ──────────────────────
  const { servicos } = useDadosGlobais();
  const dataHojeStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

  // O contexto global não traz comissao_produtos; carregamos os profissionais com
  // os campos que o Fechamento precisa para calcular comissão de produto.
  const [profsFechamento, setProfsFechamento] = useState<any[]>([]);
  useEffect(() => {
    if (!perfil?.salao_id) return;
    supabase.from('profissionais')
      .select('id, nome, servicos_comissoes, comissao_produtos')
      .eq('salao_id', perfil.salao_id).eq('ativo', true).order('nome')
      .then(({ data }) => { if (data) setProfsFechamento(data); });
  }, [perfil?.salao_id]);

  // Busca de cliente no CRM (debounce). Não busca quando já há um selecionado.
  useEffect(() => {
    const t = buscaCliente.trim().replace(/[,()]/g, '');
    if (t.length < 2 || clienteSel || !perfil?.salao_id) { setClientesResult([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('clientes')
        .select('id, nome_completo, cpf, telefone_whatsapp')
        .eq('salao_id', perfil.salao_id)
        .or(`nome_completo.ilike.%${t}%,cpf.ilike.%${t}%,telefone_whatsapp.ilike.%${t}%`)
        .order('nome_completo').limit(8);
      setClientesResult(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaCliente, clienteSel, perfil?.salao_id]);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (refCliente.current && !refCliente.current.contains(e.target as Node)) setDropdownCliente(false);
    }
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  const fechamento = useFechamentoCaixa({
    perfil,
    agendamentos: [],
    setAgendamentos: () => {},
    clientesDb: [],
    servicosDb: servicos,
    profissionaisDb: profsFechamento,
    produtosDb: produtos,
    dataHojeStr,
    editandoAg: null,
    setModalEdicaoAberto: () => {},
  });

  async function carregarProdutos() {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('salao_id', perfil.salao_id)
      .gt('quantidade_atual', 0)
      .order('nome_produto');
    if (data) setProdutos(data);
    setCarregando(false);
  }

  useEffect(() => { carregarProdutos(); }, [perfil]);

  function adicionarAoCarrinho(produto: any) {
    if (!produto.preco_venda || produto.preco_venda <= 0) {
      toast.aviso('Este produto não tem preço de venda configurado.');
      return;
    }
    setCarrinho(prev => {
      const jaExiste = prev.find(item => item.produto.id === produto.id);
      if (jaExiste) {
        if (jaExiste.qtd >= produto.quantidade_atual) {
          toast.aviso('Não há unidades disponíveis no estoque.');
          return prev;
        }
        return prev.map(item => item.produto.id === produto.id ? { ...item, qtd: item.qtd + 1 } : item);
      }
      return [...prev, { produto, qtd: 1 }];
    });
  }

  function removerDoCarrinho(produtoId: number) {
    setCarrinho(prev => prev.filter(item => item.produto.id !== produtoId));
  }

  function alterarQuantidade(produtoId: number, novaQtd: number) {
    if (novaQtd < 1) return;
    const prodRef = produtos.find(p => p.id === produtoId);
    if (novaQtd > prodRef?.quantidade_atual) {
      toast.aviso('Quantidade superior ao estoque disponível.');
      return;
    }
    setCarrinho(prev => prev.map(item => item.produto.id === produtoId ? { ...item, qtd: novaQtd } : item));
  }

  const valorProdutos = carrinho.reduce((acc, item) => acc + (item.produto.preco_venda * item.qtd), 0);

  // Abre o Fechamento de Caixa com os produtos do carrinho como itens avulsos.
  function irParaPagamento() {
    if (carrinho.length === 0) return;
    const itens = carrinho.map((item, i) => ({
      id: `pdv-${item.produto.id}-${i}`,
      id_linha: `pdv-linha-${item.produto.id}-${i}`,
      agendamento_id: null,
      nome: item.produto.nome_produto,
      item_id: item.produto.id,
      produto_id: item.produto.id,
      tipo: 'produto',
      preco: Number(item.produto.preco_venda) || 0,
      desconto: 0,
      qtd: item.qtd,
      profissional: 'Equipe',
      profissional_id: null,
      custo: 0,
      fiscal: {
        cprod: item.produto.codigo_sku || String(item.produto.id).substring(0, 8),
        xprod: item.produto.nome_produto,
        ncm: item.produto.ncm || '',
        cfop: item.produto.cfop_padrao || '5102',
        csosn: item.produto.csosn_padrao || '102',
        origem: item.produto.origem || '0',
        unidade: item.produto.unidade_medida || 'UN',
      },
    }));
    const totalProdutos = itens.reduce((a, s) => a + s.preco * s.qtd, 0);
    fechamento.setDadosCaixa({
      clienteNome: clienteSel?.nome_completo || buscaCliente.trim() || '',
      clienteTelefone: clienteSel?.telefone_whatsapp || null,
      clienteId: clienteSel?.id || null,
      clienteCpf: clienteSel?.cpf || null,
      horaInicio: '',
      dataAgendamento: dataHojeStr,
      servicos: itens,
      total: totalProdutos,
      recebido: 0,
      falta: totalProdutos,
      pagamentos: { pix: 0, credito: 0, debito: 0, dinheiro: 0, cheque: 0, prePago: 0, sinalOnline: 0 },
      deixarComoDivida: false,
      deixarComoGorjeta: false,
      comentario: '',
    });
    fechamento.setModalCaixaAberto(true);
  }

  const inputStyle = { ...inputAdmin, padding: "14px 16px" };
  const produtosFiltrados = produtos.filter(p => p.nome_produto.toLowerCase().includes(busca.toLowerCase()));

  if (carregando) return <div className="flex w-full items-center justify-center font-title uppercase tracking-widest font-bold text-xs" style={{ padding: 40, color: C.textLight }}>A carregar o módulo de caixa... ⏳</div>;

  return (
    <div className="font-body" style={{ animation: "fadeIn 0.3s ease-out" }}>

      {/* CABEÇALHO DO PDV */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h3 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 16, color: C.sidebarBg, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
            <FiShoppingCart size={18}/> Checkout Direto (Balcão)
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.textMuted, fontWeight: 500 }}>
            Monte o carrinho e siga para o pagamento completo no Fechamento de Caixa.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24 }}>

        {/* LADO ESQUERDO: CATÁLOGO DE PRODUTOS */}
        <div>
          <div style={{ position: "relative", marginBottom: 24 }}>
             <FiSearch style={{ position: "absolute", left: 16, top: 15, color: C.textLight }} size={16} />
             <input type="text" placeholder="Buscar insumos ou produtos para venda..." style={{...inputStyle, paddingLeft: 44}} value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxHeight: "55vh", overflowY: "auto", paddingRight: 8 }}>
            {produtosFiltrados.length === 0 && <p style={{ color: C.textLight, fontSize: 13, fontStyle: "italic", gridColumn: "1 / -1" }}>Nenhum produto com disponibilidade em estoque.</p>}

            {produtosFiltrados.map(p => (
              <Card key={p.id} className="shadow-sm transition-transform hover:scale-[1.02]" onClick={() => adicionarAoCarrinho(p)} style={{ padding: 20, cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", border: `1px solid ${p.categoria === 'Revenda' ? C.sidebarBg : C.border}`, borderRadius: RAIO_XL, background: C.bgCard }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h4 className="font-title" style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: C.sidebarBg, lineHeight: 1.3 }}>{p.nome_produto}</h4>
                    {p.categoria === 'Revenda' && <FiShoppingBag size={16} color={C.textLight} />}
                  </div>
                  <p className="font-title uppercase tracking-wider" style={{ margin: 0, fontSize: 10, color: C.textLight, fontWeight: 600 }}>Estoque: <span style={{ color: C.textMain }}>{p.quantidade_atual} {p.unidade_medida.slice(0,3).toUpperCase()}</span></p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
                  <span className="font-title" style={{ fontSize: 15, fontWeight: 700, color: C.sidebarBg }}>{p.preco_venda ? brl(p.preco_venda) : <span style={{ fontSize:10, color: C.danger, textTransform: "uppercase" }}>S/ Preço</span>}</span>
                  <div className="transition-all hover:bg-slate-100" style={{ background: C.bg, color: C.sidebarBg, width: 32, height: 32, borderRadius: RAIO_MD, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}` }}><FiPlus size={16}/></div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* LADO DIREITO: RESUMO DO CHECKOUT */}
        <div style={{ background: C.bgCard, borderRadius: RAIO_2XL, padding: 32, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", height: "fit-content", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.02)" }}>
          <h3 className="font-title uppercase tracking-widest" style={{ margin: "0 0 20px", fontSize: 13, color: C.sidebarBg, fontWeight: 700, borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>Resumo da Conta</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
            {carrinho.length === 0 && (
              <p style={{ color: C.textLight, fontSize: 13, fontStyle: "italic", textAlign: "center", padding: "24px 0" }}>Clique nos produtos para adicionar ao carrinho.</p>
            )}

            {/* CARRINHO DE PRODUTOS */}
            {carrinho.map(item => (
              <div key={item.produto.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg, padding: 16, borderRadius: RAIO_MD, border: `1px solid ${C.border}` }}>
                <div style={{ flex: 1 }}>
                  <h5 className="font-title" style={{ margin: "0 0 4px", fontSize: 12, color: C.textMain, fontWeight: 700 }}>{item.produto.nome_produto}</h5>
                  <span className="font-title" style={{ fontSize: 12, fontWeight: 700, color: C.sidebarBg }}>{brl(item.produto.preco_venda)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input type="number" value={item.qtd} onChange={(e) => alterarQuantidade(item.produto.id, Number(e.target.value))} style={{ width: 50, padding: "6px", borderRadius: RAIO_SM, border: `1px solid ${C.borderMid}`, textAlign: "center", fontWeight: 700, outlineColor: C.sidebarBg, fontFamily: "var(--font-title)", color: C.textMain }} />
                  <button onClick={() => removerDoCarrinho(item.produto.id)} className="transition-all hover:scale-110" style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 16, display: "flex" }}><FiX size={18}/></button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
            <div ref={refCliente} style={{ position: "relative" }}>
              <label className="font-title uppercase tracking-widest" style={{ fontSize: 10, fontWeight: 700, color: C.textLight, display: "block", marginBottom: 6 }}>Cliente (opcional)</label>
              <div style={{ position: "relative" }}>
                <FiSearch size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textLight, pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="Buscar no CRM por nome, CPF ou telefone..."
                  style={{ ...inputStyle, paddingLeft: 40, paddingRight: 36 }}
                  value={buscaCliente}
                  onChange={(e) => { setBuscaCliente(e.target.value); setClienteSel(null); setDropdownCliente(true); }}
                  onFocus={() => setDropdownCliente(true)}
                />
                {(buscaCliente || clienteSel) && (
                  <button onClick={() => { setBuscaCliente(""); setClienteSel(null); setClientesResult([]); setDropdownCliente(false); }}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex" }}>
                    <FiX size={15} />
                  </button>
                )}
              </div>

              {clienteSel && (
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#166534", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                  <FiCheckCircle size={12} /> Vinculado ao CRM — a compra entra no histórico do cliente.
                </p>
              )}

              {dropdownCliente && !clienteSel && clientesResult.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, marginTop: 4, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.12)", maxHeight: 200, overflowY: "auto" }}>
                  {clientesResult.map((c) => (
                    <div key={c.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setClienteSel(c); setBuscaCliente(c.nome_completo); setDropdownCliente(false); }}
                      className="hover:bg-slate-50"
                      style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: C.textMain }}>{c.nome_completo}</span>
                      <span style={{ color: C.textLight, fontSize: 11 }}>{c.telefone_whatsapp || c.cpf || ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, padding: "20px 0", borderTop: `1px dashed ${C.borderMid}` }}>
              <span className="font-title uppercase tracking-widest" style={{ fontSize: 12, fontWeight: 700, color: C.sidebarBg }}>Total dos Produtos</span>
              <span className="font-title" style={{ fontSize: 24, fontWeight: 800, color: C.success }}>{brl(valorProdutos)}</span>
            </div>

            <button
              onClick={irParaPagamento}
              disabled={carrinho.length === 0}
              className="font-title uppercase tracking-wider transition-all hover:opacity-95 shadow-sm"
              style={{
                background: carrinho.length === 0 ? C.borderMid : C.sidebarBg,
                color: "#fff", border: "none", padding: "16px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700,
                marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                cursor: carrinho.length === 0 ? "not-allowed" : "pointer"
              }}
            >
              <FiDollarSign size={16}/> Ir para Pagamento
            </button>
          </div>
        </div>
      </div>

      {fechamento.modalCaixaAberto && (
        <ModalFechamentoCaixa
          perfil={perfil}
          dadosCaixa={fechamento.dadosCaixa}
          setDadosCaixa={fechamento.setDadosCaixa}
          servicosDb={servicos}
          profissionaisDb={profsFechamento}
          produtosDb={produtos}
          clientesDb={[]}
          adicionarItemAvulsoCaixa={fechamento.adicionarItemAvulsoCaixa}
          onClose={() => fechamento.setModalCaixaAberto(false)}
          onFinalizar={async (bandeiras: any) => {
            const idFin = await fechamento.finalizarFechamentoConta(bandeiras);
            if (idFin) { setCarrinho([]); setBuscaCliente(''); setClienteSel(null); carregarProdutos(); }
            return idFin;
          }}
        />
      )}
    </div>
  );
}
