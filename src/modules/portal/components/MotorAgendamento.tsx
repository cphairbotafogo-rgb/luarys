'use client'
import { C, getDataHojeLocal } from "@/lib/constants";
import { FiCalendar, FiSearch, FiClock, FiCheckCircle } from "react-icons/fi";
import { PortalPagamentoReserva } from "../PortalPagamentoReserva";
import { RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";

interface Props { ag: ReturnType<any> }

export function MotorAgendamento({ ag }: Props) {
  if (!ag.modalAberto) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
      <div style={{ background: C.bgCard, width: "100%", maxWidth: 600, maxHeight: "90vh", borderRadius: RAIO_XL, padding: "24px 24px 0", display: "flex", flexDirection: "column", animation: "slideUp 0.3s ease-out", overflow: "hidden", border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.sidebarBg }}>
            {ag.passo === 1 && "1. Escolha a Data"}
            {ag.passo === 2 && "2. Escolha o Serviço"}
            {ag.passo === 3 && "3. Escolha o Horário"}
            {ag.passo === 4 && "4. Escolha o Profissional"}
            {ag.passo === 5 && "5. Confirmação e Pagamento"}
            {ag.passo === 6 && "Tudo Certo!"}
          </h3>
          <button onClick={() => ag.setModalAberto(false)} style={{ background: C.bg, color: C.sidebarBg, border: `1px solid ${C.border}`, width: 36, height: 36, borderRadius: "50%", fontSize: 20, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 40 }}>
          {ag.carregandoDados ? (
            <p style={{ textAlign: "center", padding: 40, color: C.sidebarBg, fontWeight: "bold" }}>A preparar o motor de agendamento...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {ag.passo === 1 && (
                <>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Qual a melhor data?</label>
                    <input type="date" value={ag.dataEscolhida} onChange={e => ag.aoEscolherData(e.target.value)} min={getDataHojeLocal()} style={{ width: "100%", padding: "10px 14px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 14, outlineColor: C.sidebarBg, boxSizing: "border-box" as const, color: C.textMain }} />
                  </div>
                  <button onClick={() => ag.setPasso(2)} disabled={!ag.dataEscolhida || ag.buscandoAgenda} style={{ width: "100%", padding: 16, background: (!ag.dataEscolhida || ag.buscandoAgenda) ? C.borderMid : C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 14, fontWeight: 700, cursor: (!ag.dataEscolhida || ag.buscandoAgenda) ? "not-allowed" : "pointer", marginTop: 24 }}>
                    {ag.buscandoAgenda ? "A verificar disponibilidade..." : "Escolher Serviço"}
                  </button>
                </>
              )}

              {ag.passo === 2 && (
                <>
                  <button onClick={() => ag.setPasso(1)} style={{ background: "none", border: "none", color: C.textLight, textAlign: "left", cursor: "pointer", marginBottom: 12, fontSize: 13 }}>← Voltar para Datas</button>
                  {ag.setoresUnicos.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                      {ag.setoresUnicos.map((setor: string) => (
                        <button key={setor} onClick={() => ag.setSetorFiltro(ag.setorFiltro === setor ? "" : setor)} style={{ padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", background: ag.setorFiltro === setor ? C.sidebarBg : C.bgCard, color: ag.setorFiltro === setor ? "#fff" : C.textMuted, border: `1px solid ${ag.setorFiltro === setor ? C.sidebarBg : C.borderMid}` }}>{setor}</button>
                      ))}
                    </div>
                  )}
                  <div style={{ position: "relative", marginBottom: 8 }}>
                    <span style={{ position: "absolute", left: 14, top: 16, display: "flex" }}><FiSearch size={16} color={C.textLight} /></span>
                    <input type="text" placeholder="Ou busque pelo nome do serviço..." value={ag.termoBusca} onChange={e => ag.setTermoBusca(e.target.value)} style={{ width: "100%", padding: "10px 14px 10px 44px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, fontSize: 13, outlineColor: C.sidebarBg, boxSizing: "border-box" as const, color: C.textMain, background: C.bgCard }} />
                  </div>
                  {ag.erroCarregamento ? (
                    <div style={{ textAlign: "center", padding: 30, color: '#B91C1C', background: '#FEF2F2', borderRadius: RAIO_XL, border: '1px solid #FCA5A5' }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{ag.erroCarregamento}</p>
                    </div>
                  ) : !ag.termoBusca && !ag.setorFiltro ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: C.textLight, fontSize: 13 }}>
                      <FiSearch size={28} color={C.borderMid} />
                      <p style={{ margin: "8px 0 0" }}>Selecione uma categoria ou busque pelo nome</p>
                    </div>
                  ) : ag.servicosFiltrados.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 30, color: C.textMuted, fontSize: 13 }}>
                      Nenhum serviço encontrado{ag.termoBusca ? ` para "${ag.termoBusca}"` : ""}{ag.setorFiltro ? ` em ${ag.setorFiltro}` : ""}.
                    </div>
                  ) : ag.servicosFiltrados.map((s: any) => (
                    <div key={s?.id} onClick={() => { ag.setServicoEscolhido(s); ag.setPasso(3); }} style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div><h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.textMain }}>{s?.nome_servico}</h4><p style={{ margin: "4px 0 0", fontSize: 12, color: C.textLight, display: "flex", alignItems: "center", gap: 4 }}><FiClock size={11} /> {s?.duracao_minutos} min</p></div>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.sidebarBg }}>{s?.preco_padrao?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  ))}
                </>
              )}

              {ag.passo === 3 && (
                <>
                  <button onClick={() => ag.setPasso(2)} style={{ background: "none", border: "none", color: C.textLight, textAlign: "left", cursor: "pointer", marginBottom: 8, fontSize: 13 }}>← Voltar para Serviços</button>
                  {ag.horariosDisponiveis.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, color: C.textMuted, background: C.bg, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><FiCalendar size={40} color={C.textLight} /></div>
                      <h4 style={{ margin: "0 0 8px", color: C.textMain, fontWeight: 800 }}>Fechado neste dia</h4>
                      <p style={{ margin: 0, fontSize: 13 }}>O estabelecimento não atende nesta data. Escolha outro dia!</p>
                    </div>
                  ) : ag.horariosLivres.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, color: C.textMuted, background: C.bg, borderRadius: RAIO_XL, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><FiCalendar size={40} color={C.textLight} /></div>
                      <h4 style={{ margin: "0 0 8px", color: C.textMain, fontWeight: 800 }}>Sem horários disponíveis</h4>
                      <p style={{ margin: 0, fontSize: 13 }}>Todos os horários estão ocupados ou já passaram. Tente outra data.</p>
                    </div>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 4px", fontSize: 12, color: C.textLight }}>
                        Horários para <strong>{ag.servicoEscolhido?.nome_servico}</strong> ({ag.servicoEscolhido?.duracao_minutos} min).
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                        {ag.horariosLivres.map((h: string) => (
                          <button key={h} onClick={() => { ag.setHoraEscolhida(h); ag.setProfissionalEscolhido(null); ag.setPasso(4); }}
                            style={{ padding: "12px 0", borderRadius: RAIO_MD, border: ag.horaEscolhida === h ? `2px solid ${C.sidebarBg}` : `1px solid ${C.borderMid}`, background: ag.horaEscolhida === h ? C.border : C.bgCard, color: ag.horaEscolhida === h ? C.sidebarBg : C.textMuted, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                            {h}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {ag.passo === 4 && (
                <>
                  <button onClick={() => ag.setPasso(3)} style={{ background: "none", border: "none", color: C.textLight, textAlign: "left", cursor: "pointer", marginBottom: 8, fontSize: 13 }}>← Voltar para Horários</button>
                  {ag.profissionaisDisponiveis.map((p: any) => (
                    <div key={p?.id}
                      onClick={() => {
                        ag.setProfissionalEscolhido(p);
                        if (ag.salaoFresh?.cobrar_sinal) { ag.setPasso(5); }
                        else { ag.setAceitouTermos(true); setTimeout(() => ag.confirmarAgendamento('Confirmado', p), 100); }
                      }}
                      style={{ padding: 16, border: ag.profissionalEscolhido?.id === p?.id ? `2px solid ${C.sidebarBg}` : `1px solid ${C.border}`, background: ag.profissionalEscolhido?.id === p?.id ? C.bg : C.bgCard, borderRadius: RAIO_XL, cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.sidebarBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 18 }}>{p?.nome?.substring(0, 2).toUpperCase()}</div>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.textMain }}>{p?.nome}</h4>
                    </div>
                  ))}
                </>
              )}

              {ag.passo === 5 && (
                <>
                  <button onClick={() => ag.setPasso(4)} style={{ background: "none", border: "none", color: C.textLight, textAlign: "left", cursor: "pointer", marginBottom: 8, fontSize: 13 }}>← Voltar para Profissionais</button>
                  <PortalPagamentoReserva salaoSelecionado={ag.salaoFresh} servicoEscolhido={ag.servicoEscolhido} clienteNome={ag.clienteNome || 'Cliente'} aceitouTermos={ag.aceitouTermos} setAceitouTermos={ag.setAceitouTermos} salvando={ag.salvando} confirmarAgendamento={ag.confirmarAgendamento} />
                </>
              )}

              {ag.passo === 6 && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><FiCheckCircle size={64} color={C.success} /></div>
                  <h2 style={{ margin: "0 0 8px", color: C.sidebarBg, fontWeight: 900 }}>Agendado com Sucesso!</h2>
                  <button onClick={async () => { ag.setModalAberto(false); await ag.onAgendado?.(); }} style={{ width: "100%", padding: 16, background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 32 }}>Voltar ao Início</button>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
