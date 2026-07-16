'use client'
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { RAIO_XS, RAIO_MD, RAIO_XL } from "@/lib/estiloGlobal";
import { useToast } from "@/components/Toast";
import { confirmarAcaoGlobal } from '@/components/ConfirmacaoGlobal';
import { FiPlus, FiTrash2, FiCalendar, FiAlertCircle } from "react-icons/fi";

type Excecao = {
  id: string;
  data: string;
  tipo: 'fechado' | 'horario_especial';
  hora_abertura: string | null;
  hora_fechamento: string | null;
  motivo: string | null;
};

const DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

function diaSemana(dataStr: string) {
  return DIAS_SEMANA[new Date(dataStr + 'T12:00:00').getDay()];
}

const inputSt: React.CSSProperties = {
  padding: "9px 12px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`,
  fontSize: 13, outlineColor: C.sidebarBg, color: C.textMain, background: C.bgCard,
  boxSizing: "border-box", width: "100%",
};

export function DiasExcepcionais({ perfil }: any) {
  const toast = useToast();
  const [lista, setLista]           = useState<Excecao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando]     = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({
    data: '', tipo: 'fechado' as 'fechado' | 'horario_especial',
    hora_abertura: '08:00', hora_fechamento: '18:00', motivo: '',
  });

  const carregar = useCallback(async () => {
    if (!perfil?.salao_id) return;
    setCarregando(true);
    const { data } = await supabase
      .from('dias_excepcionais')
      .select('id, data, tipo, hora_abertura, hora_fechamento, motivo')
      .eq('salao_id', perfil.salao_id)
      .gte('data', new Date().toISOString().slice(0, 10))
      .order('data', { ascending: true });
    setLista((data as Excecao[]) || []);
    setCarregando(false);
  }, [perfil?.salao_id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    if (!form.data) return toast.erro("Selecione uma data.");
    setSalvando(true);
    const payload: any = {
      salao_id: perfil.salao_id,
      data: form.data,
      tipo: form.tipo,
      motivo: form.motivo || null,
      hora_abertura:   form.tipo === 'horario_especial' ? form.hora_abertura  : null,
      hora_fechamento: form.tipo === 'horario_especial' ? form.hora_fechamento : null,
    };
    const { error } = await supabase.from('dias_excepcionais').insert(payload);
    setSalvando(false);
    if (error) return toast.erro("Erro ao salvar: " + error.message);
    toast.sucesso("Data especial registrada.");
    setForm({ data: '', tipo: 'fechado', hora_abertura: '08:00', hora_fechamento: '18:00', motivo: '' });
    setMostrarForm(false);
    carregar();
  }

  async function remover(id: string) {
    if (!await confirmarAcaoGlobal({ titulo: 'Remover esta data especial?', perigoso: true })) return;
    await supabase.from('dias_excepcionais').delete().eq('id', id);
    toast.sucesso("Removida.");
    carregar();
  }

  return (
    <div style={{ marginTop: 24, border: `1px solid ${C.border}`, borderRadius: RAIO_XL, overflow: "hidden" }}>
      {/* cabeçalho */}
      <div style={{ padding: "14px 20px", background: C.bg, borderBottom: `1px solid ${C.borderMid}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.sidebarBg, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Calendário de Exceções
          </h4>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: C.textMuted }}>
            Registre dias fechados ou com horário diferente do padrão semanal.
          </p>
        </div>
        <button
          onClick={() => setMostrarForm(v => !v)}
          style={{ background: C.sidebarBg, color: "#fff", border: "none", padding: "8px 16px", borderRadius: RAIO_MD, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase" }}
        >
          <FiPlus size={13} /> Nova Exceção
        </button>
      </div>

      {/* formulário inline */}
      {mostrarForm && (
        <div style={{ padding: "16px 20px", background: "#FAFBFF", borderBottom: `1px solid ${C.borderMid}`, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ minWidth: 140 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Data</label>
            <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} style={inputSt} />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Situação</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(['fechado', 'horario_especial'] as const).map(v => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 14px", borderRadius: RAIO_MD, border: `2px solid ${form.tipo === v ? C.sidebarBg : C.borderMid}`, background: form.tipo === v ? `${C.sidebarBg}10` : C.bgCard, fontSize: 12, fontWeight: 700, color: form.tipo === v ? C.sidebarBg : C.textMuted }}>
                  <input type="radio" name="tipo_exc" checked={form.tipo === v} onChange={() => setForm(f => ({ ...f, tipo: v }))} style={{ accentColor: C.sidebarBg }} />
                  {v === 'fechado' ? 'Fechado' : 'Horário Especial'}
                </label>
              ))}
            </div>
          </div>

          {form.tipo === 'horario_especial' && (
            <>
              <div style={{ minWidth: 100 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Abertura</label>
                <input type="time" value={form.hora_abertura} onChange={e => setForm(f => ({ ...f, hora_abertura: e.target.value }))} style={{ ...inputSt, width: 110 }} />
              </div>
              <div style={{ minWidth: 100 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Fechamento</label>
                <input type="time" value={form.hora_fechamento} onChange={e => setForm(f => ({ ...f, hora_fechamento: e.target.value }))} style={{ ...inputSt, width: 110 }} />
              </div>
            </>
          )}

          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 5, textTransform: "uppercase" }}>Motivo (opcional)</label>
            <input placeholder="Ex.: Feriado Municipal, Evento..." value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} style={inputSt} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setMostrarForm(false)} style={{ padding: "9px 16px", borderRadius: RAIO_MD, border: `1px solid ${C.borderMid}`, background: C.bgCard, color: C.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando} style={{ padding: "9px 20px", borderRadius: RAIO_MD, border: "none", background: salvando ? C.borderMid : C.success, color: "#fff", fontWeight: 700, fontSize: 12, cursor: salvando ? "not-allowed" : "pointer" }}>
              {salvando ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {/* aviso de impacto */}
      <div style={{ padding: "10px 20px", background: "#EFF6FF", borderBottom: `1px solid #BFDBFE`, display: "flex", gap: 8, alignItems: "center" }}>
        <FiAlertCircle size={13} color="#3B82F6" />
        <span style={{ fontSize: 11, color: "#1D4ED8" }}>
          Dias marcados como <strong>fechado</strong> bloqueiam o agendamento pelo portal nessa data. Dias com <strong>horário especial</strong> sobrepõem o horário semanal padrão.
        </span>
      </div>

      {/* lista */}
      {carregando ? (
        <div style={{ padding: "32px 20px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div style={{ padding: "28px 20px", textAlign: "center", color: C.textLight, fontSize: 13 }}>
          <FiCalendar size={20} style={{ marginBottom: 6, color: C.borderMid, display: "block", margin: "0 auto 8px" }} />
          Nenhuma exceção registrada para datas futuras.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: C.bg }}>
            <tr>
              {["Data", "Dia", "Situação", "Horário", "Motivo", ""].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: "uppercase", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map(e => (
              <tr key={e.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: C.textMain }}>
                  {new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td style={{ padding: "13px 16px", fontSize: 12, color: C.textMuted }}>{diaSemana(e.data)}</td>
                <td style={{ padding: "13px 16px" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: RAIO_XS, background: e.tipo === 'fechado' ? "#FEE2E2" : "#FEF3C7", color: e.tipo === 'fechado' ? "#991B1B" : "#92400E" }}>
                    {e.tipo === 'fechado' ? 'Fechado' : 'Horário Especial'}
                  </span>
                </td>
                <td style={{ padding: "13px 16px", fontSize: 12, color: C.textMuted, fontFamily: "monospace" }}>
                  {e.tipo === 'horario_especial' && e.hora_abertura ? `${e.hora_abertura} – ${e.hora_fechamento}` : '—'}
                </td>
                <td style={{ padding: "13px 16px", fontSize: 12, color: C.textMuted }}>{e.motivo || '—'}</td>
                <td style={{ padding: "13px 16px" }}>
                  <button onClick={() => remover(e.id)} title="Remover" style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 4, borderRadius: RAIO_XS }} className="hover:text-red-500">
                    <FiTrash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
