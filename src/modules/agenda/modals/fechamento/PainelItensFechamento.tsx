'use client'
/**
 * src/modules/agenda/modals/fechamento/PainelItensFechamento.tsx
 *
 * Lado esquerdo do Fechamento de Caixa: dados do cliente, stats rápidos,
 * botões de item avulso, lista de itens (serviço/produto + profissional +
 * preço/desconto), e bloco de autorização de desconto por PIN.
 */
import { C, brl } from "@/lib/constants";
import { RAIO_SM, RAIO_MD, RAIO_LG } from "@/lib/estiloGlobal";
import {
  FiUser, FiScissors, FiShoppingBag, FiPackage, FiGift,
  FiSearch, FiChevronDown, FiTrash2, FiLock, FiX
} from "react-icons/fi";

export function PainelItensFechamento({
  dadosCaixa, servicosDb, produtosDb, profissionaisDb, adicionarItemAvulsoCaixa,
  ui,
}: any) {
  const {
    clienteReal, buscas, setBuscas, dropdownAtivo, setDropdownAtivo, dropdownRef,
    atualizarItem, atualizarPrecoOuDesconto, selecionarItem, selecionarProfissional, removerItem,
    descontoLiberado, precoLiberado, senhaDesconto, setSenhaDesconto, validarSenha,
  } = ui;

  const inputStyle: any = { padding:"10px 12px", borderRadius:8, border:`1px solid ${C.borderMid}`, width:"100%", outlineColor: C.sidebarBg, fontSize: 14, color: C.textMain, fontWeight: 700, boxSizing: 'border-box' };
  const inputNumStyle: any = { ...inputStyle, textAlign: "right" };
  const miniLabel: any = { margin:"0 0 4px", fontSize:9, fontWeight:800, color:C.textLight, textTransform: "uppercase", letterSpacing: "0.5px" };
  const dropdownListStyle: any = { position: "absolute", top: 46, left: 0, right: 0, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 999, maxHeight: 180, overflowY: "auto" };
  const dropdownItemStyle: any = { padding: "10px 14px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", color: C.textMain, fontWeight: 600, display: "flex", justifyContent: "space-between", fontSize: 12 };

  return (
    <div ref={dropdownRef} style={{ flex: 1.4, padding: 24, borderRight: `1px solid ${C.border}`, background: C.bg, overflowY: "auto", display: "flex", flexDirection: "column" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: RAIO_MD, background: C.sidebarBg, color: C.bgCard, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FiUser size={20}/>
        </div>
        <div style={{ flex: 1 }}>
          <p className="font-title" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg }}>{dadosCaixa.clienteNome}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted, fontWeight: 600 }}>
            {dadosCaixa.clienteTelefone || clienteReal?.telefone_whatsapp || "Sem WhatsApp"}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, background: C.bgCard, padding: 12, borderRadius: RAIO_LG, border: `1px solid ${C.borderMid}`, marginBottom: 24 }}>
        <div style={{ textAlign: "center" }}>
          <p style={miniLabel}>Aniversário</p>
          <p className="font-title" style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.textMain }}>
            {clienteReal?.nascimento ? new Date(clienteReal.nascimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--'}
          </p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={miniLabel}>Cliente Desde</p>
          <p className="font-title" style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.textMain }}>
            {clienteReal?.created_at ? new Date(clienteReal.created_at).getFullYear() : '—'}
          </p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={miniLabel}>Última Visita</p>
          <p className="font-title" style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.textMain }}>
            {clienteReal?.data_ultima_visita ? new Date(clienteReal.data_ultima_visita + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}
          </p>
        </div>
        <div style={{ textAlign: "center", borderLeft: `1px solid ${C.borderMid}`, borderRight: `1px solid ${C.borderMid}` }}>
          <p style={miniLabel}>Visitas</p>
          <p className="font-title" style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.textMain }}>
            {clienteReal?.total_visitas || 1}
          </p>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={miniLabel}>Gasto Médio</p>
          <p className="font-title" style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.sidebarBg }}>
            {clienteReal?.total_visitas ? brl((clienteReal.total_gasto || 0) / clienteReal.total_visitas) : brl(dadosCaixa.total)}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button onClick={() => adicionarItemAvulsoCaixa?.('servico')} className="transition-all hover:bg-slate-50" style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.borderMid}`, color: C.sidebarBg, padding: "8px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><FiScissors size={14}/> Serviços</button>
        <button onClick={() => adicionarItemAvulsoCaixa?.('produto')} className="transition-all hover:bg-slate-50" style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.borderMid}`, color: C.sidebarBg, padding: "8px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><FiShoppingBag size={14}/> Produtos</button>
        <button onClick={() => adicionarItemAvulsoCaixa?.('pacote')} className="transition-all hover:bg-slate-50" style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.borderMid}`, color: C.sidebarBg, padding: "8px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><FiPackage size={14}/> Pacotes</button>
        <button onClick={() => adicionarItemAvulsoCaixa?.('vale')} className="transition-all hover:bg-slate-50" style={{ flex: 1, background: C.bgCard, border: `1px solid ${C.borderMid}`, color: C.sidebarBg, padding: "8px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><FiGift size={14}/> Vales</button>
      </div>

      {/* LISTA DE ITENS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {dadosCaixa.servicos.map((item: any, _idx: number) => {
          // idLinha: chave React, precisa ser única mesmo sem id_linha (fallback com índice).
          // idRef: identificador usado para falar com o hook (atualizarItem, selecionarItem,
          // etc.) — deve bater exatamente com "s.id_linha || s.id" usado lá dentro,
          // SEM o sufixo de índice, senão a comparação nunca encontra o item.
          const idLinha = item.id_linha || `${item.id}-${_idx}`;
          const idRef = item.id_linha || item.id;
          const isProduto = item.tipo === 'produto';
          const listaItems = isProduto ? produtosDb : servicosDb;
          const termoBusca = (buscas[idRef]?.item || '').toLowerCase();
          const termoProf = (buscas[idRef]?.prof || '').toLowerCase();

          // Serviços filtrados pelos habilitados no profissional selecionado
          const profSelecionado = item.profissional_id
            ? profissionaisDb.find((p: any) => p.id === item.profissional_id)
            : null;
          const servicosHabilitadosIds = profSelecionado?.servicos_comissoes
            ? Object.keys(profSelecionado.servicos_comissoes)
            : null;

          const itensFiltrados = listaItems.filter((i: any) => {
            const nome = isProduto ? (i.nome_produto || '') : (i.nome_servico || i.nome || '');
            const passaNome = nome.toLowerCase().includes(termoBusca);
            const passaProf = isProduto || !servicosHabilitadosIds || servicosHabilitadosIds.includes(i.id);
            return passaNome && passaProf;
          });

          // Profissionais filtrados pelos que atendem o serviço selecionado.
          // Produtos NÃO restringem por servicos_comissoes (usam comissao_produtos),
          // senão o filtro esvazia a lista — o id do produto nunca está lá.
          const servicoSelecionadoId = item.item_id || null;
          const profsFiltrados = profissionaisDb.filter((p: any) => {
            const passaNome = !termoProf || p.nome.toLowerCase().includes(termoProf);
            const passaServico = isProduto || !servicoSelecionadoId || !p.servicos_comissoes ||
              Object.keys(p.servicos_comissoes).includes(servicoSelecionadoId);
            return passaNome && passaServico;
          });

          return (
            <div key={idLinha} style={{ background: C.bgCard, padding: 16, borderRadius: RAIO_LG, border: `1px solid ${C.borderMid}`, display: "flex", flexDirection: "column", gap: 10 }}>

              {item.nome && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg, borderRadius: RAIO_SM, padding: "6px 10px" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.sidebarBg }}>{item.nome}</span>
                  </div>
                  <button onClick={() => removerItem(idRef)} style={{ background: "transparent", border: "none", color: C.danger, cursor: "pointer", padding: 4 }} title="Remover">
                    <FiTrash2 size={16} />
                  </button>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "8px 12px", cursor: "text" }}
                    onClick={() => setDropdownAtivo(`item-${idLinha}`)}>
                    <FiSearch size={14} color={C.textMuted} style={{ marginRight: 8, flexShrink: 0 }} />
                    <input
                      placeholder={isProduto ? "Buscar produto..." : "Buscar serviço..."}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 13, fontWeight: 600, color: C.sidebarBg, background: "transparent" }}
                      value={buscas[idRef]?.item || ''}
                      onChange={(e) => {
                        setBuscas((prev: any) => ({ ...prev, [idRef]: { ...prev[idRef], item: e.target.value } }));
                        setDropdownAtivo(`item-${idLinha}`);
                      }}
                    />
                    <FiChevronDown size={14} color={C.textLight} />
                  </div>

                  {dropdownAtivo === `item-${idLinha}` && itensFiltrados.length > 0 && (
                    <div style={dropdownListStyle}>
                      {itensFiltrados.map((i: any) => {
                        const nomeExibido = isProduto ? (i.nome_produto || i.nome) : (i.nome_servico || i.nome);
                        const precoExibido = isProduto ? (i.preco_venda || 0) : (i.preco_padrao || i.preco || 0);
                        return (
                          <div key={i.id} style={dropdownItemStyle} className="hover:bg-slate-50"
                            onMouseDown={(e) => { e.preventDefault(); selecionarItem(idRef, i, isProduto); }}>
                            <span>{nomeExibido}</span>
                            <span style={{ color: C.textLight }}>{brl(precoExibido)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ position: "relative" }}>
                  {item.profissional && item.profissional !== 'Equipe' ? (
                    <div style={{ display: "flex", alignItems: "center", border: `2px solid ${C.sidebarBg}`, borderRadius: RAIO_MD, padding: "6px 12px", background: C.bg, cursor: "pointer" }}
                      onClick={() => setDropdownAtivo(`prof-${idLinha}`)}>
                      <FiUser size={13} color={C.sidebarBg} style={{ marginRight: 8, flexShrink: 0 }} />
                      <input
                        style={{ border: "none", outline: "none", flex: 1, fontSize: 13, fontWeight: 900, color: C.sidebarBg, background: "transparent", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", fontFamily: "var(--font-title)" }}
                        value={dropdownAtivo === `prof-${idLinha}` ? (buscas[idRef]?.prof || '') : item.profissional}
                        onChange={e => { setBuscas((prev: any) => ({ ...prev, [idRef]: { ...prev[idRef], prof: e.target.value } })); setDropdownAtivo(`prof-${idLinha}`); }}
                        onFocus={() => { setBuscas((prev: any) => ({ ...prev, [idRef]: { ...prev[idRef], prof: '' } })); setDropdownAtivo(`prof-${idLinha}`); }}
                        readOnly={dropdownAtivo !== `prof-${idLinha}`}
                      />
                      <button onClick={e => { e.stopPropagation(); atualizarItem(idRef, 'profissional', ''); atualizarItem(idRef, 'profissional_id', null); }} style={{ background: "transparent", border: "none", color: C.danger, cursor: "pointer", padding: 2 }}><FiX size={16}/></button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "6px 12px", cursor: "text" }}
                      onClick={() => setDropdownAtivo(`prof-${idLinha}`)}>
                      <FiUser size={13} color={C.textMuted} style={{ marginRight: 8, flexShrink: 0 }} />
                      <input
                        placeholder="⚠️ Selecionar profissional..."
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12, fontWeight: 600, color: C.textMain, background: "transparent" }}
                        value={buscas[idRef]?.prof || ''}
                        onChange={(e) => {
                          setBuscas((prev: any) => ({ ...prev, [idRef]: { ...prev[idRef], prof: e.target.value } }));
                          setDropdownAtivo(`prof-${idLinha}`);
                        }}
                      />
                      <FiChevronDown size={14} color={C.textLight} />
                    </div>
                  )}

                  {dropdownAtivo === `prof-${idLinha}` && (
                    <div style={dropdownListStyle}>
                      {profsFiltrados.map((p: any) => (
                        <div key={p.id} style={dropdownItemStyle} className="hover:bg-slate-50"
                          onMouseDown={(e) => {
                          e.preventDefault();
                          selecionarProfissional(idRef, p);
                          if (item.item_id && p.servicos_comissoes) {
                            const atende = Object.keys(p.servicos_comissoes).includes(item.item_id);
                            if (!atende) {
                              atualizarItem(idRef, 'nome', '');
                              atualizarItem(idRef, 'item_id', null);
                              setBuscas((prev: any) => ({ ...prev, [idRef]: { ...prev[idRef], item: '' } }));
                            }
                          }
                        }}>
                          {p.nome}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center", borderTop: `1px dashed ${C.borderMid}`, paddingTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={miniLabel}>Preço (R$){!precoLiberado && <span style={{ color: C.danger }}> · <FiLock size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>}</p>
                  <input
                    type="number"
                    style={{
                      ...inputNumStyle,
                      background: !precoLiberado ? C.bg : C.bgCard,
                      color: !precoLiberado ? C.textLight : C.textMain,
                    }}
                    value={item.preco}
                    onChange={e => atualizarPrecoOuDesconto(idRef, 'preco', e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    disabled={!precoLiberado}
                    title={!precoLiberado ? 'Use o PIN do Gerente para liberar a alteração de preço.' : undefined}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={miniLabel}>
                    Desconto (R$){item.isPromocional && <span style={{ color: C.success, fontWeight: 800 }}> · Promocional</span>}
                  </p>
                  <input
                    type="number"
                    style={{
                      ...inputNumStyle,
                      background: (!descontoLiberado || item.isPromocional) ? C.bg : C.bgCard,
                      color: (!descontoLiberado || item.isPromocional) ? C.textLight : C.textMain,
                    }}
                    value={item.desconto}
                    onChange={e => atualizarPrecoOuDesconto(idRef, 'desconto', e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    disabled={!descontoLiberado || item.isPromocional}
                    title={item.isPromocional ? 'Serviços promocionais não recebem desconto adicional.' : undefined}
                  />
                </div>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <p style={miniLabel}>A Pagar</p>
                  <span className="font-title" style={{ fontSize: 16, fontWeight: 800, color: C.sidebarBg }}>
                    {brl((item.preco * (item.qtd || 1)) - (item.desconto || 0))}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!descontoLiberado && (
        <div style={{ padding: 16, background: C.dangerBg, border: `1px solid ${C.danger}`, borderRadius: RAIO_LG, display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div style={{ background: C.danger, color: C.bgCard, padding: 10, borderRadius: RAIO_MD }}><FiLock size={18}/></div>
          <div style={{ flex: 1 }}>
            <p className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.danger }}>Autorizar Descontos Manuais</p>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input type="password" placeholder="PIN do Gerente" value={senhaDesconto} onChange={e => setSenhaDesconto(e.target.value)} style={{ padding: "8px 12px", border: `1px solid ${C.danger}`, borderRadius: RAIO_SM, fontSize: 12, outlineColor: C.danger, width: 140 }} />
              <button onClick={validarSenha} className="transition-all hover:opacity-90" style={{ background: C.danger, color: C.bgCard, border: "none", borderRadius: RAIO_SM, padding: "0 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Liberar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}