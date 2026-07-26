import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { inputAdmin, labelPadrao, containerModalPerigo, overlayModal, RAIO_MD, RAIO_SM, FONTE_CORPO } from "@/lib/estiloGlobal";
import { FiAlertTriangle, FiCheckSquare, FiSquare } from "react-icons/fi";

export function ModalCancelamento({ editandoAg, dadosCancelamento, setDadosCancelamento, confirmarCancelamento, onClose }: any) {
  const inputStyle = { ...inputAdmin, outlineColor: C.danger };
  const labelStyle = { ...labelPadrao };
  const tipoAcao = dadosCancelamento.tipoAcao || 'cancelado';

  // Se o cliente tiver mais de um agendamento no mesmo dia, permite escolher
  // quais cancelar (um, vários ou todos) em vez de só o que foi clicado.
  const [outrosAgendamentosDia, setOutrosAgendamentosDia] = useState<any[]>([]);
  const [idsSelecionados, setIdsSelecionados] = useState<Set<string>>(new Set([editandoAg?.id]));

  useEffect(() => {
    if (!editandoAg?.cliente_id || !editandoAg?.data) return;
    supabase
      .from('agendamentos')
      .select('id, cliente_nome, profissional_id, servico, servico_id, valor_sinal, data, inicio, status')
      .eq('cliente_id', editandoAg.cliente_id)
      .eq('data', editandoAg.data)
      .not('status', 'in', '("Cancelado","Faltou")')
      .order('inicio')
      .then(({ data }) => { if (data) setOutrosAgendamentosDia(data); });
  }, [editandoAg?.cliente_id, editandoAg?.data]);

  const temMaisDeUm = outrosAgendamentosDia.length > 1;

  function alternarSelecao(id: string) {
    setIdsSelecionados(prev => {
      const novo = new Set(prev);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });
  }

  function selecionarTodos() {
    setIdsSelecionados(new Set(outrosAgendamentosDia.map(a => a.id)));
  }

  function confirmar() {
    if (!temMaisDeUm) { confirmarCancelamento(); return; }
    // Mapeia pro mesmo formato de editandoAg (cliente/id_prof) que
    // confirmarCancelamento já sabe processar.
    const selecionados = outrosAgendamentosDia
      .filter(a => idsSelecionados.has(a.id))
      .map(a => ({
        id: a.id, cliente: a.cliente_nome, id_prof: a.profissional_id,
        servico: a.servico, servico_id: a.servico_id, valor_sinal: a.valor_sinal,
        data: a.data, inicio: a.inicio, status: a.status,
      }));
    confirmarCancelamento(selecionados.length > 0 ? selecionados : undefined);
  }

  return (
    <div className="font-body" style={{ ...overlayModal, zIndex: 1000 }}>
      <div style={{ ...containerModalPerigo, padding: 32, width: "100%", maxWidth: 450 }}>

        <h3 className="font-title uppercase tracking-widest" style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: C.danger, display: "flex", alignItems: "center", gap: 10 }}>
          <FiAlertTriangle size={20} /> O que aconteceu?
        </h3>

        <p style={{ margin: "0 0 20px", fontSize: 13, color: C.textMuted, fontWeight: 500, lineHeight: 1.5 }}>
          <strong style={{ color: C.textMain }}>{editandoAg?.cliente}</strong> — {editandoAg?.servico}
        </p>

        {/* Cliente com mais de um agendamento no dia — escolher quais cancelar */}
        {temMaisDeUm && (
          <div style={{ marginBottom: 20, padding: 12, borderRadius: RAIO_MD, background: C.bg, border: `1px solid ${C.borderMid}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label className="font-title" style={{ ...labelStyle, color: C.textMain, marginBottom: 0 }}>
                {editandoAg?.cliente} tem {outrosAgendamentosDia.length} agendamentos hoje — quais cancelar?
              </label>
              <button
                onClick={selecionarTodos}
                style={{ fontSize: 11, fontWeight: 700, color: C.danger, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", marginLeft: 8 }}
              >
                Selecionar todos
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {outrosAgendamentosDia.map(a => {
                const marcado = idsSelecionados.has(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => alternarSelecao(a.id)}
                    className="transition-all"
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", textAlign: "left" as const,
                      borderRadius: RAIO_SM, cursor: "pointer", fontFamily: FONTE_CORPO,
                      background: marcado ? C.dangerBg : "#fff",
                      border: `1px solid ${marcado ? "#FCA5A5" : C.borderMid}`,
                    }}
                  >
                    {marcado ? <FiCheckSquare size={15} color={C.dangerText} /> : <FiSquare size={15} color={C.textLight} />}
                    <span style={{ fontSize: 12, fontWeight: 700, color: marcado ? C.dangerText : C.textMain }}>{a.inicio}</span>
                    <span style={{ fontSize: 12, color: marcado ? C.dangerText : C.textMuted }}>{a.servico}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tipo: Cancelado ou Faltou */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { valor: 'cancelado', label: 'Cancelamento', desc: 'Cliente avisou com antecedência' },
            { valor: 'faltou',    label: 'Cliente Faltou', desc: 'Não apareceu sem aviso (no-show)' },
          ].map(op => (
            <button key={op.valor}
              onClick={() => setDadosCancelamento({ ...dadosCancelamento, tipoAcao: op.valor })}
              className="transition-all"
              style={{
                padding: "12px 10px", borderRadius: RAIO_MD, cursor: "pointer", textAlign: 'left' as const,
                background: tipoAcao === op.valor ? C.dangerBg : C.bg,
                border: `1px solid ${tipoAcao === op.valor ? "#FCA5A5" : C.borderMid}`,
                fontFamily: FONTE_CORPO,
              }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: tipoAcao === op.valor ? C.dangerText : C.textMain }}>
                {op.label}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{op.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {tipoAcao === 'cancelado' && (
            <div>
              <label className="font-title" style={{ ...labelStyle, color: C.textMain }}>Quem solicitou? *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                {['Cliente', 'Profissional', 'Estabelecimento'].map(opcao => (
                  <button key={opcao} onClick={() => setDadosCancelamento({ ...dadosCancelamento, quem: opcao })}
                    className="transition-all"
                    style={{
                      padding: "10px 4px", fontSize: 11, fontWeight: 600, borderRadius: RAIO_MD, cursor: "pointer",
                      background: dadosCancelamento.quem === opcao ? C.dangerBg : C.bg,
                      color: dadosCancelamento.quem === opcao ? C.dangerText : C.textMuted,
                      border: `1px solid ${dadosCancelamento.quem === opcao ? "#FCA5A5" : C.borderMid}`,
                      fontFamily: FONTE_CORPO,
                    }}>
                    {opcao}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="font-title" style={{ ...labelStyle, color: C.textMain }}>
              {tipoAcao === 'faltou' ? 'Observação (opcional)' : 'Motivo *'}
            </label>
            <textarea
              placeholder={tipoAcao === 'faltou' ? 'Ex: Tentei contato, sem retorno...' : 'Ex: Imprevisto médico, remarcação de viagem...'}
              value={dadosCancelamento.motivo}
              onChange={e => setDadosCancelamento({ ...dadosCancelamento, motivo: e.target.value })}
              style={{ ...inputStyle, height: 80, resize: "none" as const }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button onClick={confirmar} disabled={temMaisDeUm && idsSelecionados.size === 0} className="transition-all hover:opacity-90"
            style={{ flex: 2, padding: "12px 0", fontSize: 13, fontWeight: 600, background: (temMaisDeUm && idsSelecionados.size === 0) ? C.borderMid : C.danger, color: "#fff", border: "none", borderRadius: RAIO_MD, cursor: (temMaisDeUm && idsSelecionados.size === 0) ? "not-allowed" : "pointer" }}>
            {tipoAcao === 'faltou'
              ? (temMaisDeUm ? `Registrar Falta (${idsSelecionados.size})` : 'Registrar Falta')
              : (temMaisDeUm ? `Confirmar Cancelamento (${idsSelecionados.size})` : 'Confirmar Cancelamento')}
          </button>
          <button onClick={onClose} className="transition-all hover:bg-slate-50"
            style={{ flex: 1, padding: "12px 0", fontSize: 13, fontWeight: 600, background: "transparent", color: C.textMain, border: `1px solid ${C.borderMid}`, borderRadius: RAIO_MD, cursor: "pointer" }}>
            Voltar
          </button>
        </div>

      </div>
    </div>
  );
}
