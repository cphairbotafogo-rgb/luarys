'use client'
import { useState, useEffect } from "react";
import { C, brl } from "@/lib/constants";
import { RAIO_MD, RAIO_XL, RAIO_SM, FONTE_TITULO, SOMBRA_SUAVE } from "@/lib/estiloGlobal";
import { FiScissors, FiPlus, FiEdit2, FiTrash2, FiCheckSquare, FiPercent, FiArrowUpRight, FiArrowDownRight, FiTrendingUp, FiList, FiShield, FiSave, FiCopy, FiSearch, FiX, FiAlertTriangle, FiUsers } from "react-icons/fi";
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { useServicos } from "@/modules/servicos/hooks/useServicos";
import { ModalServicos } from "@/modules/servicos/modals/ModalServicos";
import { AbaSetorLote } from "@/modules/servicos/AbaSetorLote";

const NBS_COMPLETA = [
  { nbs: '126021000', descricao: 'Serviços de cabeleireiros e barbeiros (Corte, escova, etc)' },
  { nbs: '126022000', descricao: 'Serviços de manicure e pedicure' },
  { nbs: '126023000', descricao: 'Serviços de estética, cuidados de beleza e depilação' },
  { nbs: '126029000', descricao: 'Outros tratamentos de beleza (Maquiagem, design de sobrancelha)' },
  { nbs: '126011000', descricao: 'Banhos, massagens e afins' },
  { nbs: '126012000', descricao: 'Condicionamento físico (Academias/Personal)' },
  { nbs: '010101000', descricao: 'Análise clínica / Exames médicos' },
  { nbs: '126024000', descricao: 'Serviços de podologia avançada' }
];
export function AbaServicos({ perfil }: any) {
  const {
    servicos, produtosEstoque, carregando, carregarDados,
    tributosLote, setTributosLote, salvandoTributos, salvarTodosTributos,
    setorLote, setSetorLote, salvandoSetores, salvarTodosSetores,
    selecionados, setSelecionados, processandoLote, aplicarReajusteEmLote, excluirServico
  } = useServicos(perfil);

  const [subAba, setSubAba] = useState<'catalogo' | 'reajuste' | 'tributacao' | 'setor'>('catalogo');
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<any>(null);
  const [buscaCatalogo, setBuscaCatalogo] = useState('');

  const [reajusteValor, setReajusteValor] = useState<string>("");
  const [reajusteTipo, setReajusteTipo] = useState<'aumento' | 'desconto'>('aumento');
  const [valoresGrupo, setValoresGrupo] = useState<Record<string, { nbs: string; codigo_municipio: string; aliquota_iss: string }>>({});

  useEffect(() => {
    const idParaEditar = new URLSearchParams(window.location.hash.split('?')[1] || '').get('editar');
    if (idParaEditar) {
      setEditandoId(idParaEditar);
      setModalAberto(true);
      window.history.replaceState(null, '', '#servicos');
    }
  }, []);

  const normalizar = (texto: string) => (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const termoBusca = normalizar(buscaCatalogo);
  const servicosFiltrados = termoBusca
    ? servicos.filter((s: any) => normalizar(s.nome_servico).includes(termoBusca) || normalizar(s.categoria).includes(termoBusca))
    : servicos;

  const servicosAgrupados = servicosFiltrados.reduce((acc: any, curr: any) => {
    const cat = curr.categoria || 'Sem Categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(curr);
    return acc;
  }, {});

  const categoriasUnicas = Object.keys(servicosAgrupados).sort();

  const abrirNovo = () => { setEditandoId(null); setModalAberto(true); };
  const abrirEdicao = (servico: any) => { setEditandoId(servico.id); setModalAberto(true); };

  function handleTributoLoteChange(id: string, campo: string, valor: string) {
    setTributosLote(prev => prev.map(t => t.id === id ? { ...t, [campo]: valor } : t));
  }

  async function replicarTributacaoCategoria(idReferencia: string, categoria: string) {
    const ref = tributosLote.find(t => t.id === idReferencia);
    if (!ref) return;
    if (!await confirmarAcaoGlobal({ titulo: `Replicar tributação de "${ref.nome_servico}"?`, descricao: `Isso sobrescreve os códigos e alíquota de todos os serviços da categoria "${categoria}".`, perigoso: false })) return;
    setTributosLote(prev => prev.map(t => {
      if (t.categoria === categoria) return { ...t, nbs: ref.nbs, codigo_municipio: ref.codigo_municipio, aliquota_iss: ref.aliquota_iss };
      return t;
    }));
  }

  const setoresAgrupados = tributosLote.reduce((acc: any, t: any) => {
    const s = t.setor || 'Sem Setor';
    if (!acc[s]) acc[s] = [];
    acc[s].push(t);
    return acc;
  }, {});
  const setoresOrdenados = Object.keys(setoresAgrupados).sort((a, b) =>
    a === 'Sem Setor' ? 1 : b === 'Sem Setor' ? -1 : a.localeCompare(b, 'pt-BR')
  );

  function atualizarValorGrupo(setor: string, campo: string, valor: string) {
    setValoresGrupo(prev => {
      const atual: any = prev[setor] || {}; // any → spread não dispara "chave duplicada"
      return { ...prev, [setor]: { nbs: '', codigo_municipio: '', aliquota_iss: '', ...atual, [campo]: valor } };
    });
  }

  function aplicarGrupoAoSetor(setor: string) {
    const g = valoresGrupo[setor] || {};
    if (!g.nbs && !g.codigo_municipio && !g.aliquota_iss) return;
    setTributosLote(prev => prev.map(t => {
      if ((t.setor || 'Sem Setor') !== setor) return t;
      return {
        ...t,
        ...(g.nbs ? { nbs: g.nbs } : {}),
        ...(g.codigo_municipio ? { codigo_municipio: g.codigo_municipio } : {}),
        ...(g.aliquota_iss ? { aliquota_iss: g.aliquota_iss } : {}),
      };
    }));
  }

  const toggleSelecao = (id: number) => setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const inputStyle = { padding:"10px 14px", borderRadius: RAIO_MD, border:`1px solid ${C.borderMid}`, width:"100%", boxSizing:"border-box" as const, outlineColor: C.sidebarBg, fontSize: 13, color: C.textMain, backgroundColor: C.bgCard, fontWeight: 500 };
  const tabBtnStyle = (ativa: boolean) => ({ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", fontSize: 11, fontWeight: 700, cursor: "pointer", background: "none", border: "none", borderBottom: ativa ? `2px solid ${C.sidebarBg}` : "2px solid transparent", color: ativa ? C.sidebarBg : C.textLight, fontFamily: FONTE_TITULO, textTransform: "uppercase" as const, letterSpacing: "0.5px", transition: "all 0.2s" });

  if (carregando) return <div style={{ padding: 40, color: C.textLight, fontWeight: 700, textAlign: "center" }}>A sincronizar catálogo e preços...</div>;

  return (
    <div style={{ padding: 32, overflowY: "auto", flex: 1, background: C.bg }}>
      
      <datalist id="nbs-lista-completa">
        {NBS_COMPLETA.map(n => <option key={n.nbs} value={n.nbs}>{n.descricao}</option>)}
      </datalist>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <FiScissors size={24} color={C.sidebarBg} />
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "1px" }}>Catálogo de Serviços</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Gestão de portfólio, tempos de cabine, ficha técnica e saldo líquido.</p>
          </div>
        </div>
        {subAba === 'catalogo' && (
          <button onClick={abrirNovo} style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "12px 24px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.5px", transition: "0.2s" }}>
            <FiPlus size={16} /> Novo Serviço
          </button>
        )}
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${C.borderMid}`, marginBottom: 32, gap: 4 }}>
        <button style={tabBtnStyle(subAba === 'catalogo')} onClick={() => setSubAba('catalogo')}><FiList size={16} /> Lista do Catálogo</button>
        <button style={tabBtnStyle(subAba === 'reajuste')} onClick={() => setSubAba('reajuste')}><FiTrendingUp size={16} /> Reajuste em Lote</button>
        <button style={tabBtnStyle(subAba === 'tributacao')} onClick={() => setSubAba('tributacao')}><FiShield size={16} /> Edição Rápida Fiscal</button>
        <button style={tabBtnStyle(subAba === 'setor')} onClick={() => setSubAba('setor')}><FiUsers size={16} /> Setor em Lote</button>
      </div>

      {/* ================= ABA 1: CATÁLOGO ================= */}
      {subAba === 'catalogo' && (
        <div style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 260, maxWidth: 380 }}>
              <FiSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textLight, pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Buscar serviço por nome ou categoria..."
                value={buscaCatalogo}
                onChange={e => setBuscaCatalogo(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 36, paddingRight: buscaCatalogo ? 36 : 14 }}
              />
              {buscaCatalogo && (
                <button onClick={() => setBuscaCatalogo("")} title="Limpar busca"
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex" }}>
                  <FiX size={14} />
                </button>
              )}
            </div>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>
              {termoBusca
                ? `${servicosFiltrados.length} de ${servicos.length} serviço${servicos.length !== 1 ? "s" : ""}`
                : `${servicos.length} serviço${servicos.length !== 1 ? "s" : ""} cadastrado${servicos.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {servicos.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 24px", background: C.bgCard, borderRadius: RAIO_XL, border: `1px dashed ${C.borderMid}` }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✂️</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: C.textMain }}>Nenhum serviço cadastrado</h3>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
                Cadastre os procedimentos do seu salão para poder agendar clientes e calcular comissões.
              </p>
              <button onClick={abrirNovo} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                <FiPlus size={16} /> Cadastrar primeiro serviço
              </button>
            </div>
          )}
          {servicos.length > 0 && categoriasUnicas.length === 0 && (
            <p style={{ color: C.textLight, fontStyle: "italic", fontSize: 14 }}>
              Nenhum serviço encontrado para "{buscaCatalogo}". Confira se o nome foi salvo corretamente ao cadastrar.
            </p>
          )}
          {categoriasUnicas.map(categoria => (
            <div key={categoria} style={{ marginBottom: 32, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ background: C.sidebarBg, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "1px" }}>{categoria}</h3>
                <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: RAIO_XL, fontWeight: 700 }}>{servicosAgrupados[categoria].length}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.borderMid}`, background: C.bg }}>
                    <th style={{ padding: "12px 20px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Serviço</th>
                    <th style={{ padding: "12px 20px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", width: "14%" }}>Setor</th>
                    <th style={{ padding: "12px 20px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", width: "26%" }}>Descrição</th>
                    <th style={{ padding: "12px 20px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", width: "15%" }}>Valor Padrão</th>
                    <th style={{ padding: "12px 20px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", width: "15%", textAlign: "center" }}>Duração</th>
                    <th style={{ padding: "12px 20px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", width: "8%", textAlign: "center" }}>NFS-e</th>
                    <th style={{ padding: "12px 20px", width: "10%", textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {servicosAgrupados[categoria].map((s: any) => (
                    <tr key={`list-${s.id}`} style={{ borderBottom: `1px solid ${C.border}`, transition: "0.2s" }} className="hover:bg-slate-50">
                      <td style={{ padding: "16px 20px" }}><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textMain }}>{s.nome_servico}</p></td>
                      <td style={{ padding: "16px 20px" }}>
                        {s.setor
                          ? <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: C.sidebarBg + '15', color: C.sidebarBg }}>{s.setor}</span>
                          : <span style={{ fontSize: 11, color: C.textLight, fontStyle: "italic" }}>—</span>
                        }
                      </td>
                      <td style={{ padding: "16px 20px" }}><p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>{s.descricao || "—"}</p></td>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: 10, color: C.textLight, textTransform: "uppercase", fontWeight: 700 }}>
                            {s.tipo_preco === 'A partir de' ? 'A Partir De' : 'Fixo'}
                          </span>
                          <span style={{ fontWeight: 800, color: s.preco_promocional ? C.textMuted : C.sidebarBg, textDecoration: s.preco_promocional ? 'line-through' : 'none', fontSize: s.preco_promocional ? 12 : 14 }}>
                            {brl(s.preco_padrao)}
                          </span>
                          {s.preco_promocional > 0 && (
                            <span style={{ fontWeight: 800, color: '#10B981', fontSize: 14 }}>
                              {brl(s.preco_promocional)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "center" }}><span style={{ fontSize: 13, color: C.textMain, fontWeight: 600 }}>{s.duracao_minutos || 0} min</span></td>
                      <td style={{ padding: "16px 20px", textAlign: "center" }}>
                        {s.nbs
                          ? <span title={`NBS ${s.nbs} — pronto para NFS-e`}><FiShield size={16} color="#4F9D6E" /></span>
                          : <span title="Sem código NBS — nota fiscal de serviço não será emitida"><FiAlertTriangle size={16} color="#D97706" /></span>
                        }
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button onClick={() => abrirEdicao(s)} style={{ background: "transparent", border: "none", color: C.textLight, cursor: "pointer" }}><FiEdit2 size={16} /></button>
                          <button onClick={() => excluirServico(s.id)} style={{ background: "transparent", border: "none", color: C.danger, cursor: "pointer" }}><FiTrash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ================= ABA 2: REAJUSTE EM LOTE ================= */}
      {subAba === 'reajuste' && (
        <div style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div style={{ background: C.bgCard, border: `1px solid ${C.sidebarBg}`, borderRadius: RAIO_XL, padding: "24px", marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase" }}><FiCheckSquare size={16}/> {selecionados.length} Item(ns) Selecionado(s)</h4>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, overflow: "hidden" }}>
                <button onClick={() => setReajusteTipo('aumento')} style={{ background: reajusteTipo === 'aumento' ? C.sidebarBg : C.bgCard, color: reajusteTipo === 'aumento' ? "#fff" : C.textMain, border: "none", padding: "12px 16px", cursor: "pointer", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}><FiArrowUpRight size={14} className="inline mr-1"/> Aumentar</button>
                <button onClick={() => setReajusteTipo('desconto')} style={{ background: reajusteTipo === 'desconto' ? C.sidebarBg : C.bgCard, color: reajusteTipo === 'desconto' ? "#fff" : C.textMain, border: "none", borderLeft: `1px solid ${C.borderMid}`, padding: "12px 16px", cursor: "pointer", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}><FiArrowDownRight size={14} className="inline mr-1"/> Descontar</button>
              </div>
              <div style={{ position: "relative" }}>
                <FiPercent style={{ position: "absolute", left: 14, top: 13, color: C.textLight }} size={14} />
                <input type="number" placeholder="0.00" value={reajusteValor} onChange={(e) => setReajusteValor(e.target.value)} style={{ ...inputStyle, paddingLeft: 38, width: 130 }} />
              </div>
              <button onClick={() => aplicarReajusteEmLote(reajusteTipo, reajusteValor)} disabled={processandoLote || selecionados.length === 0} style={{ background: selecionados.length === 0 ? C.borderMid : C.success, color: "#fff", border: "none", padding: "12px 24px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: (processandoLote || selecionados.length === 0) ? "not-allowed" : "pointer", textTransform: "uppercase" }}>
                Aplicar Lote
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", marginRight: 8 }}>Seleção:</span>
            <button onClick={() => setSelecionados(selecionados.length === servicos.length ? [] : servicos.map(s => s.id))} style={{ background: selecionados.length === servicos.length && servicos.length > 0 ? C.sidebarBg : C.bgCard, color: selecionados.length === servicos.length && servicos.length > 0 ? "#fff" : C.textMain, border: `1px solid ${C.borderMid}`, padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{selecionados.length === servicos.length && servicos.length > 0 ? "Desmarcar Todos" : "Selecionar Todos"}</button>
            {categoriasUnicas.map((cat) => <button key={cat.toString()} onClick={() => setSelecionados(Array.from(new Set([...selecionados, ...servicosAgrupados[cat].map((s: any) => s.id)])))} style={{ background: C.bgCard, color: C.textMain, border: `1px solid ${C.borderMid}`, padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>+ {cat}</button>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {servicos.map(s => {
              const isSelected = selecionados.includes(s.id);
              return (
                <div key={`lote-${s.id}`} onClick={() => toggleSelecao(s.id)} style={{ background: C.bgCard, borderRadius: RAIO_XL, border: `2px solid ${isSelected ? C.sidebarBg : C.border}`, display: "flex", padding: 20, alignItems: "center", justifyContent: "space-between", cursor: "pointer", transform: isSelected ? "scale(1.02)" : "scale(1)", boxShadow: isSelected ? SOMBRA_SUAVE : "none" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.sidebarBg }}>{s.nome_servico}</h3>
                    <span style={{ fontSize: 16, fontWeight: 800, color: isSelected ? C.sidebarBg : C.textMain }}>{brl(s.preco_padrao)}</span>
                  </div>
                  <div style={{ width: 24, height: 24, borderRadius: RAIO_SM, border: `2px solid ${isSelected ? C.sidebarBg : C.borderMid}`, background: isSelected ? C.sidebarBg : C.bgCard, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isSelected && <FiCheckSquare color="#fff" size={16} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= ABA 3: EDIÇÃO RÁPIDA FISCAL ================= */}
      {subAba === 'tributacao' && (
        <div style={{ animation: "fadeIn 0.2s ease-out", background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "24px 32px", borderBottom: `1px solid ${C.borderMid}`, background: C.bg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                <FiShield size={20} /> Edição Rápida de Tributação (NFS-e)
              </h3>
            </div>
            <button onClick={salvarTodosTributos} disabled={salvandoTributos} style={{ background: C.success, color: "#fff", border: "none", padding: "12px 24px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: salvandoTributos ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <FiSave size={16} className="inline mr-2" /> Salvar Toda a Lista
            </button>
          </div>
          {tributosLote.filter(t => !t.nbs).length > 0 && (
            <div style={{ margin: "0 0 20px", padding: "14px 20px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: RAIO_MD, display: "flex", alignItems: "center", gap: 12 }}>
              <FiAlertTriangle size={18} color="#D97706" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#92400E", fontWeight: 600 }}>
                {tributosLote.filter(t => !t.nbs).length} serviço(s) sem código NBS — a NFS-e não será emitida para estes serviços. Preencha o código federal abaixo e clique em "Salvar Toda a Lista".
              </span>
              <button
                onClick={() => {
                  const primeiro = tributosLote.find(t => !t.nbs);
                  if (primeiro) {
                    const el = document.getElementById(`nbs-input-${primeiro.id}`);
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
                  }
                }}
                style={{ marginLeft: "auto", background: "#D97706", color: "#fff", border: "none", borderRadius: RAIO_MD, padding: "8px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                Ir ao 1º incompleto
              </button>
            </div>
          )}
          <div style={{ overflowX: "auto", maxHeight: "60vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "800px" }}>
              <thead style={{ position: "sticky", top: 0, background: C.bgCard, zIndex: 1, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <tr>
                  <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Nome do Serviço</th>
                  <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Código Federal (NBS)</th>
                  <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Cód. Municipal (LC 116)</th>
                  <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>Alíquota ISS (%)</th>
                  <th style={{ padding: "14px 24px", fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "center" }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {setoresOrdenados.map(setor => {
                  const tributos = setoresAgrupados[setor];
                  const g = valoresGrupo[setor] || { nbs: '', codigo_municipio: '', aliquota_iss: '' };
                  const temIncompleto = tributos.some((t: any) => !t.nbs);
                  const grupoAtivo = !!(g.nbs || g.codigo_municipio || g.aliquota_iss);
                  return (
                    <>
                      <tr key={`setor-${setor}`} style={{ background: '#EFF3F8', borderTop: `2px solid ${C.sidebarBg}` }}>
                        <td style={{ padding: "10px 24px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.5px" }}>{setor}</span>
                            <span style={{ background: C.sidebarBg, color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10 }}>{tributos.length}</span>
                            {temIncompleto && <FiAlertTriangle size={13} color="#D97706" title="Serviços sem NBS neste setor" />}
                          </div>
                        </td>
                        <td style={{ padding: "8px 24px" }}>
                          <input list="nbs-lista-completa" placeholder="NBS para o setor…" style={{ ...inputStyle, maxWidth: 220, padding: "6px 10px", fontSize: 12, background: grupoAtivo ? "#EFF6FF" : undefined }} value={g.nbs} onChange={e => atualizarValorGrupo(setor, 'nbs', e.target.value.replace(/\D/g, ''))} />
                        </td>
                        <td style={{ padding: "8px 24px" }}>
                          <input placeholder="Ex: 06.01" style={{ ...inputStyle, width: 100, padding: "6px 10px", fontSize: 12, background: grupoAtivo ? "#EFF6FF" : undefined }} value={g.codigo_municipio} onChange={e => atualizarValorGrupo(setor, 'codigo_municipio', e.target.value)} />
                        </td>
                        <td style={{ padding: "8px 24px" }}>
                          <input type="number" step="0.01" placeholder="%" style={{ ...inputStyle, width: 90, padding: "6px 10px", fontSize: 12, background: grupoAtivo ? "#EFF6FF" : undefined }} value={g.aliquota_iss} onChange={e => atualizarValorGrupo(setor, 'aliquota_iss', e.target.value)} />
                        </td>
                        <td style={{ padding: "8px 24px", textAlign: "center" }}>
                          <button onClick={() => aplicarGrupoAoSetor(setor)} disabled={!grupoAtivo}
                            title={grupoAtivo ? `Aplicar aos ${tributos.length} serviços deste setor` : "Preencha ao menos um campo ao lado"}
                            style={{ background: grupoAtivo ? C.sidebarBg : C.borderMid, color: "#fff", border: "none", borderRadius: RAIO_SM, padding: "6px 14px", cursor: grupoAtivo ? "pointer" : "not-allowed", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", transition: "0.2s" }}>
                            Aplicar ao Setor
                          </button>
                        </td>
                      </tr>
                      {tributos.map((t: any, index: number) => (
                        <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}`, background: index % 2 === 0 ? C.bg : C.bgCard }}>
                          <td style={{ padding: "12px 24px 12px 36px" }}><strong style={{ fontSize: 13, color: C.textMain }}>{t.nome_servico}</strong></td>
                          <td style={{ padding: "12px 24px" }}><input id={`nbs-input-${t.id}`} list="nbs-lista-completa" style={{ ...inputStyle, width: "100%", maxWidth: "220px", padding: "8px 10px", borderColor: t.nbs ? undefined : '#F59E0B' }} value={t.nbs} onChange={e => handleTributoLoteChange(t.id, 'nbs', e.target.value.replace(/\D/g, ''))} /></td>
                          <td style={{ padding: "12px 24px" }}><input style={{ ...inputStyle, width: "100px", padding: "8px 10px" }} value={t.codigo_municipio} onChange={e => handleTributoLoteChange(t.id, 'codigo_municipio', e.target.value)} /></td>
                          <td style={{ padding: "12px 24px" }}><input type="number" step="0.01" style={{ ...inputStyle, width: "100px", padding: "8px 10px" }} value={t.aliquota_iss} onChange={e => handleTributoLoteChange(t.id, 'aliquota_iss', e.target.value)} /></td>
                          <td style={{ padding: "12px 24px", textAlign: "center" }}><button onClick={() => replicarTributacaoCategoria(t.id, t.categoria)} title="Copiar tributação para toda a categoria" style={{ background: C.bg, color: C.sidebarBg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_SM, padding: "6px 8px", cursor: "pointer" }}><FiCopy size={14} /></button></td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= ABA 4: SETOR EM LOTE ================= */}
      {subAba === 'setor' && (
        <AbaSetorLote
          setorLote={setorLote}
          setSetorLote={setSetorLote}
          salvandoSetores={salvandoSetores}
          salvarTodosSetores={salvarTodosSetores}
        />
      )}

      {modalAberto && (
        <ModalServicos 
          perfil={perfil} 
          editandoId={editandoId} 
          produtosEstoque={produtosEstoque}
          categoriasUnicas={categoriasUnicas}
          onClose={(foiSalvo: boolean) => {
            setModalAberto(false);
            if (foiSalvo) carregarDados(); // Recarrega a tabela se houve alteração
          }} 
        />
      )}

    </div>
  );
}