'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C, brl } from "@/lib/constants";
import { RAIO_MD, RAIO_XL, RAIO_2XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { Card } from "@/components/ui";
import { FiCheckCircle, FiUsers, FiPackage, FiShield, FiLoader, FiArrowRight, FiLock } from "react-icons/fi";

type Periodo = 'mensal' | 'anual';

function precoEfetivo(mensal: number | null, anual: number | null, periodo: Periodo): number {
  if (periodo === 'anual' && anual != null) return Number(anual);
  return Number(mensal ?? 0);
}

function badgeEconomia(mensal: number | null, anual: number | null): number | null {
  if (!mensal || !anual || anual <= 0) return null;
  const efetivoMes = anual / 12;
  const economia = Math.round((1 - efetivoMes / mensal) * 100);
  return economia > 0 ? economia : null;
}

export function AbaMeuPlano({ perfil }: any) {
  const toast = useToast();
  const [carregando, setCarregando] = useState(true);
  const [salao, setSalao] = useState<any>(null);
  const [planos, setPlanos] = useState<any[]>([]);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [modulosInfo, setModulosInfo] = useState<Record<string, any>>({});
  const [vagasUsadas, setVagasUsadas] = useState(0);
  const [processandoChave, setProcessandoChave] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('mensal');

  useEffect(() => { carregarDados(); }, [perfil]);

  async function carregarDados() {
    if (!perfil?.salao_id) return;
    setCarregando(true);

    const [resSalao, resPlanos, resCatalogo, resSalaoModulos, resProfs] = await Promise.all([
      supabase.from('saloes').select('acesso_total, limite_profissionais, modulo_fiscal_liberado, api_whatsapp_liberada, plano_chave, plano_periodo, preco_legado').eq('id', perfil.salao_id).maybeSingle(),
      supabase.from('planos').select('chave, nome, descricao, limite_profissionais, preco_mensal, preco_anual, ordem').eq('ativo', true).order('ordem'),
      supabase.from('modulos_catalogo').select('chave, nome, descricao, preco_mensal, preco_anual, ativo').eq('ativo', true),
      supabase.from('salao_modulos').select('modulo_chave, ativo, renovacao_em, cancelamento_agendado, periodo').eq('salao_id', perfil.salao_id).eq('ativo', true),
      supabase.from('profissionais').select('id', { count: 'exact', head: true }).eq('salao_id', perfil.salao_id).eq('ativo', true).eq('produtivo', true),
    ]);

    if (resSalao.data) {
      setSalao(resSalao.data);
      if (resSalao.data.plano_periodo) setPeriodo(resSalao.data.plano_periodo);
    }
    if (resPlanos.data) setPlanos(resPlanos.data);
    if (resCatalogo.data) setCatalogo(resCatalogo.data);
    if (resSalaoModulos.data) {
      const mapa: Record<string, any> = {};
      resSalaoModulos.data.forEach((m: any) => { mapa[m.modulo_chave] = m; });
      setModulosInfo(mapa);
    }
    setVagasUsadas(resProfs.count || 0);
    setCarregando(false);
  }

  async function assinar(moduloChave: string, nomeItem: string, precoItem: number) {
    if (!perfil?.salao_id) return;
    const labelPeriodo = periodo === 'anual' ? 'por ano' : 'por mês';
    const confirmou = await confirmarAcaoGlobal({
      titulo: `Assinar ${nomeItem}?`,
      descricao: `Ao confirmar, você concorda com os Termos de Uso do Luarys e autoriza a cobrança de ${brl(precoItem)} ${labelPeriodo} pelo serviço "${nomeItem}". O plano pode ser cancelado a qualquer momento.`,
      rotuloCta: 'Concordar e Assinar',
      perigoso: false,
    });
    if (!confirmou) return;

    setProcessandoChave(moduloChave);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch('/api/assinatura/criar-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ salao_id: perfil.salao_id, modulo_chave: moduloChave, periodo }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.sucesso) throw new Error(data.erro || 'Erro ao gerar checkout.');
      if (!data.checkoutUrl) throw new Error('URL de pagamento não retornada. Tente novamente.');
      window.location.href = data.checkoutUrl;
    } catch (e: any) {
      toast.erro(e.message);
      setProcessandoChave(null);
    }
  }

  async function desativarModulo(modulo: any) {
    const dataFormatada = modulo.renovacao_em ? new Date(modulo.renovacao_em + 'T12:00:00').toLocaleDateString('pt-BR') : null;
    const mensagem = dataFormatada
      ? `Cancelar "${modulo.nome}"? Você continua com acesso normalmente até ${dataFormatada} (fim do período já pago) — depois disso ele é desativado.`
      : `Cancelar "${modulo.nome}"? O acesso será encerrado ao final do período já pago.`;

    if (!await confirmarAcaoGlobal({ titulo: `Cancelar "${modulo.nome}"?`, descricao: mensagem, perigoso: true, rotuloCta: 'Cancelar módulo' })) return;

    setProcessandoChave(modulo.chave);
    const { error } = await supabase.from('salao_modulos')
      .update({ cancelamento_agendado: true })
      .eq('salao_id', perfil.salao_id)
      .eq('modulo_chave', modulo.chave);
    setProcessandoChave(null);
    if (error) { toast.erro('Erro ao cancelar: ' + error.message); return; }
    toast.sucesso('Cancelamento agendado. Seu acesso continua até o fim do período pago.');
    carregarDados();
  }

  async function reativarModulo(modulo: any) {
    setProcessandoChave(modulo.chave);
    const { error } = await supabase.from('salao_modulos')
      .update({ cancelamento_agendado: false })
      .eq('salao_id', perfil.salao_id)
      .eq('modulo_chave', modulo.chave);
    setProcessandoChave(null);
    if (error) { toast.erro('Erro ao reativar: ' + error.message); return; }
    toast.sucesso('Cancelamento desfeito — módulo continua ativo normalmente.');
    carregarDados();
  }

  if (carregando) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: C.sidebarBg, fontWeight: 700, padding: 40 }}>
        <FiLoader className="animate-spin" size={18} /> A carregar plano...
      </div>
    );
  }

  const acessoTotal = !!salao?.acesso_total;
  const limiteAtual: number | null = salao?.limite_profissionais ?? null;
  const planoAtual = planos.find(p => p.chave === salao?.plano_chave) ?? null;
  const precoPlano = planoAtual
    ? (salao?.preco_legado != null ? Number(salao.preco_legado) : precoEfetivo(planoAtual.preco_mensal, planoAtual.preco_anual, periodo))
    : 0;
  const modulosAtivos = catalogo.filter(m => !!modulosInfo[m.chave] && Number(m.preco_mensal) > 0);
  const totalPeriodo = precoPlano + modulosAtivos.reduce((s, m) => s + precoEfetivo(m.preco_mensal, m.preco_anual, periodo), 0);
  const datesRenovacao = (Object.values(modulosInfo) as any[]).map(m => m.renovacao_em).filter(Boolean).sort();
  const proximaRenovacao = datesRenovacao[0] ? new Date(datesRenovacao[0] + 'T12:00:00').toLocaleDateString('pt-BR') : null;
  const addons = catalogo.filter(m => !m.chave.startsWith('pacote_profissionais_')).sort((a, b) => a.nome.localeCompare(b.nome));

  const cardStyle = { padding: 24, background: C.bgCard, borderRadius: RAIO_XL, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column" as const, gap: 12 };
  const btnPrimary = { background: C.sidebarBg, color: "#fff", border: "none", padding: "12px 0", borderRadius: RAIO_MD, fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "uppercase" as const, letterSpacing: "0.5px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
  const btnDisabled = { ...btnPrimary, background: C.bg, color: C.textLight, cursor: "not-allowed" as const };
  const btnAtivo = { ...btnPrimary, background: "#F0FDF4", color: C.success, border: `1px solid #A7F3D0`, cursor: "default" as const };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* ─── TOGGLE MENSAL / ANUAL ─── */}
      {!acessoTotal && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>Cobrança:</span>
          {(['mensal', 'anual'] as Periodo[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)} style={{
              padding: "6px 16px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: periodo === p ? C.sidebarBg : C.bg,
              color: periodo === p ? "#fff" : C.textMuted,
              border: `1px solid ${periodo === p ? C.sidebarBg : C.borderMid}`,
              textTransform: "capitalize",
            }}>
              {p}{p === 'anual' ? ' (-20%)' : ''}
            </button>
          ))}
        </div>
      )}

      {/* ─── PAINEL DA MENSALIDADE ─── */}
      {!acessoTotal && (planoAtual || modulosAtivos.length > 0) && (
        <div style={{ background: "linear-gradient(135deg, #1e2d3d 0%, #2C3643 100%)", borderRadius: RAIO_2XL, padding: "28px 32px", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <p style={{ margin: "0 0 16px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", opacity: 0.55 }}>Composição da cobrança</p>
              {planoAtual && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontSize: 13, opacity: 0.85 }}>{planoAtual.nome}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{brl(precoPlano)}<span style={{ fontSize: 10, fontWeight: 400, opacity: 0.6 }}>/{periodo === 'anual' ? 'ano' : 'mês'}</span></span>
                </div>
              )}
              {modulosAtivos.map(m => (
                <div key={m.chave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontSize: 13, opacity: 0.85 }}>{m.nome}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>+ {brl(precoEfetivo(m.preco_mensal, m.preco_anual, periodo))}<span style={{ fontSize: 10, fontWeight: 400, opacity: 0.6 }}>/{periodo === 'anual' ? 'ano' : 'mês'}</span></span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, marginTop: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.9 }}>Total {periodo}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#D4AF37" }}>{brl(totalPeriodo)}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-end", minWidth: 160 }}>
              {proximaRenovacao && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: 0.55, letterSpacing: "0.5px" }}>Próxima renovação</p>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{proximaRenovacao}</p>
                </div>
              )}
              <div style={{ textAlign: "right", fontSize: 10, opacity: 0.4, lineHeight: 1.5, maxWidth: 170 }}>
                Cada módulo renova de forma independente conforme a data da ativação.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESUMO DO PLANO */}
      <Card style={{ padding: 28, background: acessoTotal ? "linear-gradient(135deg, #1F2937 0%, #111827 100%)" : C.bgCard, borderRadius: RAIO_2XL, border: `1px solid ${C.border}`, color: acessoTotal ? "#fff" : C.textMain }}>
        {acessoTotal ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <FiShield size={32} color="#D4AF37" />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, textTransform: "uppercase" }}>Acesso Total Liberado</h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.8 }}>Todos os módulos liberados e sem limite de profissionais. Nenhuma assinatura necessária.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: RAIO_XL, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FiUsers size={24} color={C.sidebarBg} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase" }}>Vagas de Profissionais</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>
                  {vagasUsadas} de {limiteAtual !== null ? limiteAtual : "∞"} vagas usadas
                  {limiteAtual === null && " — sem pacote ativo"}
                </p>
              </div>
            </div>
            {limiteAtual !== null && vagasUsadas > limiteAtual && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#D97706", background: "#FFFBEB", padding: "6px 12px", borderRadius: RAIO_MD, border: "1px solid #FDE68A" }}>
                Você está usando mais vagas do que o pacote permite — escolha um pacote maior.
              </span>
            )}
          </div>
        )}
      </Card>

      {/* PLANOS */}
      {!acessoTotal && (
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.5px" }}>Planos</h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: C.textMuted }}>O plano define quantos profissionais podem estar ativos. Os recursos do sistema são contratados separadamente como módulos.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {planos.map(p => {
              const isAtual = salao?.plano_chave === p.chave;
              const isEnterprise = p.chave === 'enterprise';
              const preco = isAtual && salao?.preco_legado != null ? Number(salao.preco_legado) : precoEfetivo(p.preco_mensal, p.preco_anual, periodo);
              const economia = badgeEconomia(p.preco_mensal, p.preco_anual);
              const bloqueadoPorVagas = !isEnterprise && p.limite_profissionais != null && vagasUsadas > p.limite_profissionais;
              const carregandoEste = processandoChave === p.chave;

              return (
                <div key={p.chave} style={{ ...cardStyle, border: isAtual ? `2px solid ${C.sidebarBg}` : `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: "uppercase" }}>{p.nome}</span>
                      <h4 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800, color: C.sidebarBg }}>
                        {p.limite_profissionais != null ? `Até ${p.limite_profissionais} vagas` : "Vagas personalizadas"}
                      </h4>
                    </div>
                    {economia && periodo === 'anual' && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#15803D", background: "#DCFCE7", padding: "3px 7px", borderRadius: RAIO_MD, whiteSpace: "nowrap" }}>-{economia}%</span>
                    )}
                  </div>
                  {p.descricao && <p style={{ margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.4 }}>{p.descricao}</p>}
                  {preco > 0 ? (
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.textMain }}>
                      {brl(preco)}<span style={{ fontSize: 11, fontWeight: 600, color: C.textLight }}>/{periodo === 'anual' ? 'ano' : 'mês'}</span>
                    </p>
                  ) : p.chave === 'enterprise' ? (
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textLight, fontStyle: "italic" }}>Sob consulta</p>
                  ) : null}

                  {isAtual ? (
                    <button disabled style={btnAtivo}><FiCheckCircle size={14} /> Plano Atual</button>
                  ) : isEnterprise ? (
                    <button disabled title="Fale com a nossa equipe para configurar um plano sob medida." style={btnDisabled}>Fale com a gente</button>
                  ) : bloqueadoPorVagas ? (
                    <button disabled title={`Inative ${vagasUsadas - (p.limite_profissionais || 0)} profissional(is) na Aba Equipe para escolher este plano.`} style={btnDisabled}>
                      <FiLock size={12} /> Inative {vagasUsadas - (p.limite_profissionais || 0)} antes
                    </button>
                  ) : (
                    <button onClick={() => assinar(p.chave, p.nome, preco)} disabled={!!processandoChave} style={btnPrimary}>
                      {carregandoEste ? <FiLoader className="animate-spin" size={14} /> : <>Assinar <FiArrowRight size={14} /></>}
                    </button>
                  )}
                </div>
              );
            })}
            {planos.length === 0 && <p style={{ color: C.textLight, fontStyle: "italic", fontSize: 13 }}>Nenhum plano disponível no momento.</p>}
          </div>
        </div>
      )}

      {/* MÓDULOS */}
      <div>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.5px" }}>Módulos</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: C.textMuted }}>Cada módulo libera um conjunto de funcionalidades. Contrate apenas o que o seu salão precisa — pode cancelar a qualquer momento.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {addons.map(m => {
            const info = modulosInfo[m.chave];
            const ativo = acessoTotal || !!info;
            const gratis = Number(m.preco_mensal) <= 0;
            const preco = precoEfetivo(m.preco_mensal, m.preco_anual, periodo);
            const economia = badgeEconomia(m.preco_mensal, m.preco_anual);
            const carregandoEste = processandoChave === m.chave;
            const cancelamentoAgendado = !!info?.cancelamento_agendado;
            const dataAcessoAte = info?.renovacao_em ? new Date(info.renovacao_em + 'T12:00:00').toLocaleDateString('pt-BR') : null;

            return (
              <div key={m.chave} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <FiPackage size={20} color={C.sidebarBg} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {ativo && !cancelamentoAgendado && <span style={{ fontSize: 10, fontWeight: 800, color: C.success, background: "#F0FDF4", padding: "3px 8px", borderRadius: RAIO_XL, textTransform: "uppercase" }}>Ativo</span>}
                    {ativo && cancelamentoAgendado && <span style={{ fontSize: 10, fontWeight: 800, color: "#B45309", background: "#FFFBEB", padding: "3px 8px", borderRadius: RAIO_XL, textTransform: "uppercase" }}>Cancelamento agendado</span>}
                    {!ativo && economia && periodo === 'anual' && <span style={{ fontSize: 10, fontWeight: 800, color: "#15803D", background: "#DCFCE7", padding: "3px 7px", borderRadius: RAIO_MD }}>-{economia}%</span>}
                  </div>
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.textMain }}>{m.nome}</h4>
                  {m.descricao && <p style={{ margin: "4px 0 0", fontSize: 11, color: C.textLight, lineHeight: 1.4 }}>{m.descricao}</p>}
                </div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.textMain }}>
                  {gratis ? "Grátis" : <>{brl(preco)}<span style={{ fontSize: 11, fontWeight: 600, color: C.textLight }}>/{periodo === 'anual' ? 'ano' : 'mês'}</span></>}
                </p>
                {ativo && cancelamentoAgendado && dataAcessoAte && (
                  <p style={{ margin: 0, fontSize: 11, color: "#B45309" }}>Acesso garantido até <strong>{dataAcessoAte}</strong></p>
                )}
                {ativo ? (
                  acessoTotal ? (
                    <button disabled style={btnAtivo}><FiCheckCircle size={14} /> Incluído</button>
                  ) : cancelamentoAgendado ? (
                    <button onClick={() => reativarModulo({ ...m, ...info })} disabled={!!processandoChave} style={btnPrimary}>
                      {carregandoEste ? <FiLoader className="animate-spin" size={14} /> : "Manter Assinatura"}
                    </button>
                  ) : (
                    <button onClick={() => desativarModulo({ ...m, ...info })} disabled={!!processandoChave} style={{ ...btnAtivo, cursor: processandoChave ? "not-allowed" : "pointer" }}>
                      {carregandoEste ? <FiLoader className="animate-spin" size={14} /> : <><FiCheckCircle size={14} /> Ativo — Desativar</>}
                    </button>
                  )
                ) : gratis ? (
                  <button disabled title="Configure este módulo na aba correspondente." style={btnDisabled}>Configuração manual</button>
                ) : (
                  <button onClick={() => assinar(m.chave, m.nome, preco)} disabled={!!processandoChave} style={btnPrimary}>
                    {carregandoEste ? <FiLoader className="animate-spin" size={14} /> : <>Assinar <FiArrowRight size={14} /></>}
                  </button>
                )}
              </div>
            );
          })}
          {addons.length === 0 && <p style={{ color: C.textLight, fontStyle: "italic", fontSize: 13 }}>Nenhum módulo disponível no momento.</p>}
        </div>
      </div>
    </div>
  );
}
