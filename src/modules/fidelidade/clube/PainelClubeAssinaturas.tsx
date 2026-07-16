'use client'
import { useState, useEffect, useRef } from "react";
import { C, brl } from "@/lib/constants";
import { RAIO_MD, RAIO_LG, RAIO_XL } from "@/lib/estiloGlobal";
import { FiPlus, FiTrash2, FiEdit2, FiStar, FiX, FiSave, FiLoader } from "react-icons/fi";
import { useGuardModulo } from "@/lib/useGuardModulo";
import { BloqueioModulo } from "@/components/BloqueioModulo";
import { useClubeAssinaturas } from "./useClubeAssinaturas";
import { PainelCobrancasAssinatura } from "./PainelCobrancasAssinatura";
import { PLANO_VAZIO, resumoBeneficios, type PlanoAssinatura } from "./tipos";

export function PainelClubeAssinaturas({ perfil }: any) {
  const liberado = useGuardModulo(perfil?.salao_id, 'clube_assinaturas');
  const { planos, servicos, carregando, salvando, salvarPlano, alternarAtivo, excluirPlano } = useClubeAssinaturas(perfil);
  const [aba, setAba] = useState<'planos' | 'cobrancas'>('planos');
  const [editando, setEditando] = useState<PlanoAssinatura | null>(null);
  const [servSel, setServSel] = useState("");
  const [servQtd, setServQtd] = useState(1);
  const [buscaServ, setBuscaServ] = useState("");
  const [dropServ, setDropServ] = useState(false);
  const refServ = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (refServ.current && !refServ.current.contains(e.target as Node)) setDropServ(false);
    }
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  // Módulo liberável pelo admin (modulos_catalogo → 'clube_assinaturas')
  if (liberado === null) return <div style={{ padding: 40, color: C.textMuted, fontSize: 13 }}>Verificando acesso…</div>;
  if (!liberado) return (
    <BloqueioModulo
      salaoId={perfil?.salao_id}
      moduloChave="clube_assinaturas"
      nome="Clube de Assinaturas"
      descricao="Crie planos de mensalidade recorrente e fidelize seus clientes com serviços inclusos e descontos exclusivos."
      preco={39.90}
      itens={[
        'Planos de mensalidade personalizados',
        'Serviços inclusos por mês',
        'Desconto automático para assinantes',
        'Vínculo e histórico no perfil do cliente',
        'Base para receita recorrente do salão',
      ]}
    />
  );

  const inputStyle: React.CSSProperties = { padding: "10px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, color: C.textMain, background: C.bgCard, width: "100%", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 };

  function novo() { setEditando({ ...PLANO_VAZIO }); }
  function abrir(p: PlanoAssinatura) { setEditando({ ...p, servicos_inclusos: [...(p.servicos_inclusos || [])] }); }

  // Alguns serviços têm o nome em `nome`, não em `nome_servico`; e o preço em preco_padrao ou preco.
  const nomeServ = (s: any) => s?.nome_servico || s?.nome || 'Serviço';
  const precoServ = (s: any) => Number(s?.preco_padrao ?? s?.preco ?? 0) || 0;
  // Preço unitário do item: busca o preço ATUAL do serviço no catálogo (por id),
  // com o snapshot salvo como fallback. Assim o valor aparece mesmo em itens antigos.
  const precoUnit = (item: any) => {
    const cat = servicos.find((s: any) => s.id === item.servico_id);
    return cat ? precoServ(cat) : (Number(item.preco) || 0);
  };

  // Valor cheio dos serviços inclusos (soma preço × qtd/mês) — é a BASE do desconto.
  const somaServicos = (lista: any[]) => (lista || []).reduce((acc, x) => acc + precoUnit(x) * (Number(x.qtd_mes) || 1), 0);
  const arred = (n: number) => Math.round(n * 100) / 100;
  const clampPct = (n: number) => Math.max(0, Math.min(100, n));
  const valorServicos = somaServicos(editando?.servicos_inclusos || []);

  function addServico() {
    if (!editando || !servSel) return;
    const s = servicos.find((x: any) => x.id === servSel);
    if (!s) return;
    if (editando.servicos_inclusos.some(x => x.servico_id === servSel)) return;
    const nova = [...editando.servicos_inclusos, { servico_id: s.id, nome: nomeServ(s), qtd_mes: Math.max(1, Number(servQtd) || 1), preco: precoServ(s) }];
    const val = somaServicos(nova);
    // Se ainda não definiu preço, começa no valor cheio (0% de desconto); senão mantém o preço e recalcula o %.
    const precoBase = editando.preco_mensal && editando.preco_mensal > 0 ? editando.preco_mensal : val;
    const desc = val > 0 ? clampPct((1 - precoBase / val) * 100) : editando.desconto_percentual;
    setEditando({ ...editando, servicos_inclusos: nova, preco_mensal: arred(precoBase), desconto_percentual: arred(desc) });
    setServSel(""); setServQtd(1); setBuscaServ(""); setDropServ(false);
  }

  function removeServico(id: string) {
    if (!editando) return;
    const nova = editando.servicos_inclusos.filter(x => x.servico_id !== id);
    const val = somaServicos(nova);
    const desc = val > 0 ? clampPct((1 - (editando.preco_mensal || 0) / val) * 100) : editando.desconto_percentual;
    setEditando({ ...editando, servicos_inclusos: nova, desconto_percentual: arred(desc) });
  }

  // Edição VINCULADA: mexeu no preço → recalcula o %; mexeu no % → recalcula o preço que o cliente vê.
  function setPrecoMensal(v: number) {
    if (!editando) return;
    const preco = Math.max(0, Number(v) || 0);
    const desc = valorServicos > 0 ? clampPct((1 - preco / valorServicos) * 100) : editando.desconto_percentual;
    setEditando({ ...editando, preco_mensal: preco, desconto_percentual: arred(desc) });
  }
  function setDescontoPercent(v: number) {
    if (!editando) return;
    const desc = clampPct(Number(v) || 0);
    const preco = valorServicos > 0 ? arred(valorServicos * (1 - desc / 100)) : editando.preco_mensal;
    setEditando({ ...editando, desconto_percentual: desc, preco_mensal: preco });
  }

  // Serviços ainda não incluídos, filtrados pelo texto digitado.
  // Busca insensível a acento e maiúscula (ex: "hidratacao" acha "Hidratação").
  const norm = (t: string) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const servicosDisponiveis = servicos.filter((s: any) => !(editando?.servicos_inclusos || []).some(x => x.servico_id === s.id));
  const termoServ = norm(buscaServ.trim());
  const servFiltrados = termoServ
    ? servicosDisponiveis.filter((s: any) => norm(nomeServ(s)).includes(termoServ) || norm(s.categoria).includes(termoServ))
    : servicosDisponiveis;

  async function salvar() {
    if (!editando) return;
    const ok = await salvarPlano(editando);
    if (ok) setEditando(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Abas Planos | Cobranças */}
      <div style={{ display: "flex", gap: 6, borderBottom: `1px solid ${C.borderMid}` }}>
        {([['planos', 'Planos'], ['cobrancas', 'Cobranças']] as const).map(([id, rot]) => (
          <button key={id} onClick={() => setAba(id)}
            style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: `2px solid ${aba === id ? C.sidebarBg : 'transparent'}`, color: aba === id ? C.sidebarBg : C.textLight, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {rot}
          </button>
        ))}
      </div>

      {aba === 'cobrancas' ? (
        <PainelCobrancasAssinatura perfil={perfil} />
      ) : (
      <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h3 className="font-title uppercase tracking-widest" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.sidebarBg, display: "flex", alignItems: "center", gap: 8 }}>
            <FiStar size={16} /> Clube de Assinaturas
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.textMuted }}>
            Planos de mensalidade recorrente para fidelizar seus clientes.
          </p>
        </div>
        {!editando && (
          <button onClick={novo} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <FiPlus size={15} /> Novo Plano
          </button>
        )}
      </div>

      {/* FORMULÁRIO */}
      {editando && (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, borderTop: `4px solid ${C.sidebarBg}`, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.sidebarBg }}>{editando.id ? "Editar plano" : "Novo plano"}</h4>
            <button onClick={() => setEditando(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, display: "flex" }}><FiX size={18} /></button>
          </div>

          <div>
            <label style={labelStyle}>Nome do plano</label>
            <input style={inputStyle} value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })} placeholder="Ex: Clube VIP" />
          </div>

          <div>
            <label style={labelStyle}>Descrição (opcional)</label>
            <input style={inputStyle} value={editando.descricao} onChange={e => setEditando({ ...editando, descricao: e.target.value })} placeholder="O que o cliente ganha com este plano" />
          </div>

          {/* Serviços inclusos */}
          <div>
            <label style={labelStyle}>Serviços inclusos por mês</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
              <div ref={refServ} style={{ position: "relative", flex: 1 }}>
                <input
                  style={inputStyle}
                  placeholder="Digite para buscar um serviço…"
                  value={buscaServ}
                  onChange={e => { setBuscaServ(e.target.value); setServSel(""); setDropServ(true); }}
                  onFocus={() => setDropServ(true)}
                />
                {dropServ && servFiltrados.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, marginTop: 4, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.12)", maxHeight: 200, overflowY: "auto" }}>
                    {servFiltrados.map((s: any) => (
                      <div key={s.id}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setServSel(s.id); setBuscaServ(nomeServ(s)); setDropServ(false); }}
                        className="hover:bg-slate-50"
                        style={{ padding: "9px 12px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", fontSize: 13, color: C.textMain, fontWeight: 600 }}>
                        {nomeServ(s)}{s.categoria ? <span style={{ color: C.textMuted, fontWeight: 500, fontSize: 11 }}> · {s.categoria}</span> : null}
                      </div>
                    ))}
                  </div>
                )}
                {dropServ && buscaServ.trim() !== "" && servFiltrados.length === 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, marginTop: 4, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, padding: "10px 12px", fontSize: 12, color: C.textMuted }}>
                    Nenhum serviço encontrado.
                  </div>
                )}
              </div>
              <input type="number" min="1" style={{ ...inputStyle, width: 70 }} value={servQtd} onChange={e => setServQtd(Number(e.target.value))} title="Quantidade por mês" />
              <button onClick={addServico} disabled={!servSel} style={{ padding: "10px 16px", background: servSel ? C.sidebarBg : C.borderMid, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: servSel ? "pointer" : "not-allowed", flexShrink: 0 }}>Adicionar</button>
            </div>
            {editando.servicos_inclusos.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {editando.servicos_inclusos.map(s => (
                  <div key={s.servico_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: RAIO_MD, padding: "8px 12px", fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: C.textMain }}>{s.nome} <span style={{ color: C.textMuted, fontWeight: 500 }}>· {s.qtd_mes}×/mês · {brl(precoUnit(s) * (Number(s.qtd_mes) || 1))}</span></span>
                    <button onClick={() => removeServico(s.servico_id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.danger, display: "flex" }}><FiX size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PRECIFICAÇÃO — preço e desconto vinculados ao valor cheio dos serviços */}
          <div style={{ background: C.bg, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_LG, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: C.textLight, textTransform: "uppercase", letterSpacing: "0.5px" }}>Valor cheio dos serviços inclusos</span>
              <span className="font-title" style={{ fontSize: 16, fontWeight: 800, color: C.sidebarBg }}>{brl(valorServicos)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Preço da assinatura (R$/mês)</label>
                <input type="number" min="0" step="0.01" style={inputStyle} value={editando.preco_mensal} onChange={e => setPrecoMensal(Number(e.target.value))} />
              </div>
              <div>
                <label style={labelStyle}>Desconto sobre os serviços (%)</label>
                <input type="number" min="0" max="100" step="0.5" style={{ ...inputStyle, opacity: valorServicos > 0 ? 1 : 0.6 }} value={editando.desconto_percentual} onChange={e => setDescontoPercent(Number(e.target.value))} disabled={valorServicos <= 0} title={valorServicos <= 0 ? "Adicione serviços inclusos para o desconto ser calculado" : undefined} />
              </div>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              {valorServicos > 0 ? (
                <>💡 O cliente paga <strong style={{ color: C.textMain }}>{brl(editando.preco_mensal)}/mês</strong> — economia de <strong style={{ color: C.success }}>{editando.desconto_percentual.toFixed(1)}% ({brl(Math.max(0, valorServicos - editando.preco_mensal))})</strong> sobre o valor cheio dos serviços.</>
              ) : (
                <>Adicione serviços inclusos acima — o desconto é calculado sobre o total deles. Digite o <strong>preço</strong> que aparece o <strong>%</strong>, ou digite o <strong>%</strong> que aparece o preço.</>
              )}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <label style={labelStyle}>Cor</label>
              <input type="color" value={editando.cor} onChange={e => setEditando({ ...editando, cor: e.target.value })} style={{ width: 44, height: 38, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: "pointer", background: C.bgCard }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 18 }}>
              <input type="checkbox" checked={editando.ativo} onChange={e => setEditando({ ...editando, ativo: e.target.checked })} style={{ width: 15, height: 15, accentColor: C.sidebarBg }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>Plano ativo</span>
            </label>
            <button onClick={salvar} disabled={salvando} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, padding: "11px 24px", background: salvando ? C.borderMid : C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 13, fontWeight: 700, cursor: salvando ? "not-allowed" : "pointer" }}>
              {salvando ? <FiLoader size={15} /> : <FiSave size={15} />} {salvando ? "Salvando…" : "Salvar Plano"}
            </button>
          </div>
        </div>
      )}

      {/* LISTA */}
      {carregando ? (
        <p style={{ color: C.textMuted, fontSize: 13, padding: 20 }}>Carregando planos…</p>
      ) : planos.length === 0 && !editando ? (
        <div style={{ textAlign: "center", padding: 48, color: C.textLight, border: `1px dashed ${C.borderMid}`, borderRadius: RAIO_XL }}>
          <FiStar size={36} color={C.borderMid} style={{ marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.textMain }}>Nenhum plano criado ainda</p>
          <p style={{ margin: "4px 0 0", fontSize: 12 }}>Crie um plano de mensalidade para começar a fidelizar clientes.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {planos.map(p => (
            <div key={p.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderLeft: `5px solid ${p.cor || C.sidebarBg}`, borderRadius: RAIO_LG, padding: 18, opacity: p.ativo ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.sidebarBg }}>{p.nome}</h4>
                  <p className="font-title" style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800, color: C.textMain }}>{brl(p.preco_mensal)}<span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}> /mês</span></p>
                </div>
                {!p.ativo && <span style={{ fontSize: 9, fontWeight: 700, color: C.textLight, background: C.bg, padding: "3px 8px", borderRadius: 10, textTransform: "uppercase" }}>Inativo</span>}
              </div>
              {p.descricao && <p style={{ margin: "10px 0 0", fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{p.descricao}</p>}
              <p style={{ margin: "10px 0 0", fontSize: 12, color: C.textMain, fontWeight: 600 }}>{resumoBeneficios(p)}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <button onClick={() => abrir(p)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", background: "transparent", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, color: C.sidebarBg, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><FiEdit2 size={13} /> Editar</button>
                <button onClick={() => alternarAtivo(p)} style={{ padding: "8px 12px", background: "transparent", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, color: C.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{p.ativo ? "Desativar" : "Ativar"}</button>
                <button onClick={() => excluirPlano(p.id)} style={{ padding: "8px 10px", background: "transparent", border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, color: C.danger, cursor: "pointer", display: "flex" }}><FiTrash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
