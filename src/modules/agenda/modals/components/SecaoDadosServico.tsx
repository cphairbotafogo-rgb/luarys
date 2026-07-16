'use client'
import { C, brl } from "@/lib/constants";
import { FONTE_CORPO, RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { FiCheck, FiPlus, FiScissors, FiZap } from "react-icons/fi";
import { ServicoExtra } from "../ServicoExtra";

const inputStyle = {
  padding: "12px 14px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
  width: "100%", boxSizing: "border-box" as const, outlineColor: C.sidebarBg,
  fontSize: 13, color: C.textMain, backgroundColor: C.bgCard, fontWeight: 500, fontFamily: FONTE_CORPO,
};
const labelStyle = {
  margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: C.textMuted,
  display: "block", textTransform: "uppercase" as const, letterSpacing: "0.5px",
};

interface Props {
  editandoAg: any;
  setEditandoAg: (ag: any) => void;
  servicosDb: any[];
  profissionaisDb: any[];
  md: any;
}

export function SecaoDadosServico({ editandoAg, setEditandoAg, servicosDb, profissionaisDb, md }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Profissional */}
      <div>
        <label style={labelStyle}>Profissional</label>
        <select style={inputStyle} value={editandoAg.id_prof} onChange={e => setEditandoAg({ ...editandoAg, id_prof: e.target.value })}>
          {profissionaisDb.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>

      {/* Serviço com autocomplete */}
      <div style={{ position: "relative" }}>
        <label style={labelStyle}>Serviço Agendado</label>
        <input
          style={inputStyle} value={editandoAg.servico}
          placeholder="Buscar serviço..." autoComplete="off"
          onFocus={() => md.setServicoAberto(true)}
          onBlur={() => setTimeout(() => md.setServicoAberto(false), 200)}
          onChange={e => {
            const nome = e.target.value;
            const serv = servicosDb.find((s: any) => s.nome_servico === nome);
            setEditandoAg({
              ...editandoAg, servico: nome,
              servico_id: serv?.id ?? editandoAg.servico_id,
              valor_final: editandoAg.preco_editado_manualmente ? editandoAg.valor_final : (serv?.preco_padrao ?? editandoAg.valor_final ?? null),
              duracaoMin: serv?.duracao_minutos || editandoAg.duracaoMin,
            });
            md.setServicoAberto(true);
          }}
        />
        {md.servicoAberto && (() => {
          const filtrados = servicosDb.filter((s: any) =>
            (s.nome_servico || "").toLowerCase().includes((editandoAg.servico || "").toLowerCase())
          );
          if (filtrados.length === 0) return null;
          return (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200, background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 16px rgba(0,0,0,0.12)" }}>
              {filtrados.map((s: any) => (
                <div key={s.id}
                  onMouseDown={() => {
                    setEditandoAg({
                      ...editandoAg, servico: s.nome_servico, servico_id: s.id,
                      valor_final: editandoAg.preco_editado_manualmente ? editandoAg.valor_final : (s.preco_padrao ?? editandoAg.valor_final ?? null),
                      duracaoMin: s.duracao_minutos || editandoAg.duracaoMin,
                    });
                    md.setServicoAberto(false);
                  }}
                  style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", fontSize: 13, color: C.textMain, display: "flex", justifyContent: "space-between" }}
                  className="hover:bg-slate-50">
                  <span>{s.nome_servico}</span>
                  {s.preco_padrao != null && <span style={{ color: C.textLight, fontSize: 11 }}>{brl(s.preco_padrao)}</span>}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Valor */}
      <div>
        <label style={labelStyle}>Valor do Serviço (R$)</label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: 13, color: "#10B981", fontWeight: 700, fontSize: 14 }}>R$</span>
          <input type="text" inputMode="decimal"
            style={{ ...inputStyle, paddingLeft: 36, fontWeight: 700, color: "#10B981", fontSize: 15 }}
            value={editandoAg.valor_final != null ? String(editandoAg.valor_final).replace(".", ",") : ""}
            placeholder={(() => { const pp = servicosDb.find((s: any) => s.nome_servico === editandoAg.servico)?.preco_padrao; return pp != null ? String(pp).replace(".", ",") : "0,00"; })()}
            onChange={e => {
              const v = e.target.value.replace(",", ".");
              if (v === "" || /^\d*\.?\d{0,2}$/.test(v))
                setEditandoAg({ ...editandoAg, valor_final: v === "" ? null : Number(v), preco_editado_manualmente: true });
            }}
          />
        </div>
        {(() => {
          const pp = servicosDb.find((s: any) => s.nome_servico === editandoAg.servico)?.preco_padrao;
          if (pp && editandoAg.valor_final && Number(editandoAg.valor_final) !== Number(pp)) {
            return <p style={{ margin: "4px 0 0", fontSize: 11, color: "#F59E0B" }}>⚠ Preço padrão: R$ {Number(pp).toFixed(2).replace(".", ",")}</p>;
          }
          return null;
        })()}
      </div>

      {/* Data / Hora / Duração */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Data</label>
          <input type="date" style={inputStyle} value={editandoAg.data} onChange={e => setEditandoAg({ ...editandoAg, data: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Horário</label>
          <input type="time" style={inputStyle} value={editandoAg.inicio} onChange={e => setEditandoAg({ ...editandoAg, inicio: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Duração (Min)</label>
          <input type="number" style={inputStyle} value={editandoAg.duracaoMin} onChange={e => setEditandoAg({ ...editandoAg, duracaoMin: Number(e.target.value) })} />
        </div>
      </div>

      {/* Serviços Adicionais */}
      <div style={{ border: `1px solid ${C.borderMid}`, borderRadius: RAIO_XL, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: C.bg, borderBottom: md.servicosExtras.length > 0 ? `1px solid ${C.borderMid}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiScissors size={14} color={C.sidebarBg} />
            <span className="font-title uppercase tracking-widest" style={{ fontSize: 10, fontWeight: 700, color: C.sidebarBg }}>Serviços Adicionais</span>
            {md.servicosExtras.length > 0 && (
              <span style={{ background: C.sidebarBg, color: "#fff", borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{md.servicosExtras.length}</span>
            )}
          </div>
          <button type="button" onClick={md.adicionarServicoExtra}
            style={{ display: "flex", alignItems: "center", gap: 6, background: C.sidebarBg, color: "#fff", border: "none", borderRadius: RAIO_MD, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            <FiPlus size={13} /> Adicionar Serviço
          </button>
        </div>

        {md.servicosExtras.map((extra: any, idx: number) => (
          <ServicoExtra
            key={extra._key}
            extra={extra}
            servicosDb={servicosDb}
            profissionaisDb={profissionaisDb}
            onAtualizar={md.atualizarExtra}
            onSelecionar={md.selecionarServicoExtra}
            onRemover={md.removerServicoExtra}
            isUltimo={idx === md.servicosExtras.length - 1}
          />
        ))}

        {md.servicosExtras.length > 0 && (
          <div style={{ padding: "12px 16px", background: C.bg, borderTop: `1px solid ${C.borderMid}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              Total geral: <strong style={{ color: C.sidebarBg, fontSize: 14 }}>{brl(md.totalGeral)}</strong>
              <span style={{ fontSize: 11, color: C.textLight, marginLeft: 8 }}>({brl(Number(md.valorPrincipal))} principal + {brl(md.totalExtras)} extras)</span>
            </div>
            <button type="button" onClick={md.salvarServicosExtras} disabled={md.salvandoExtras}
              style={{ background: md.salvandoExtras ? C.borderMid : "#10B981", color: "#fff", border: "none", borderRadius: RAIO_MD, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: md.salvandoExtras ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <FiCheck size={13} /> {md.salvandoExtras ? "Salvando..." : "Confirmar Serviços"}
            </button>
          </div>
        )}

        {md.servicosExtras.length === 0 && (
          <div style={{ padding: "16px", textAlign: "center", fontSize: 12, color: C.textLight }}>
            Clique em "Adicionar Serviço" para incluir serviços extras com profissionais diferentes.
          </div>
        )}
      </div>

      {/* Recorrência */}
      <div>
        <label style={labelStyle}>Repetir Agendamento</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { val: "nao", label: "Não repetir" },
            { val: "semanal", label: "Toda semana" },
            { val: "quinzenal", label: "A cada 15 dias" },
            { val: "mensal", label: "Todo mês" },
          ].map(op => (
            <button key={op.val} type="button" onClick={() => setEditandoAg({ ...editandoAg, recorrencia: op.val })}
              style={{
                padding: "8px 14px", borderRadius: RAIO_MD, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "0.2s",
                border: `1px solid ${(editandoAg.recorrencia || "nao") === op.val ? C.sidebarBg : C.borderMid}`,
                background: (editandoAg.recorrencia || "nao") === op.val ? C.sidebarBg : "#fff",
                color: (editandoAg.recorrencia || "nao") === op.val ? "#fff" : C.textMuted,
              }}>
              {op.label}
            </button>
          ))}
        </div>
        {editandoAg.recorrencia && editandoAg.recorrencia !== "nao" && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: C.textLight }}>
            ℹ️ Ao salvar, serão criadas as próximas 6 ocorrências automaticamente.
          </p>
        )}
      </div>

      {/* Observações */}
      <div>
        <label style={labelStyle}>Observações do Agendamento</label>
        <textarea
          style={{ ...inputStyle, height: 80, resize: "none", background: "#FDF8E7", borderColor: "#FDE68A" } as any}
          placeholder="Ex: Trazendo a filha, usar tinta sem amônia..."
          value={editandoAg.observacao}
          onChange={e => setEditandoAg({ ...editandoAg, observacao: e.target.value })} />
      </div>
    </div>
  );
}
