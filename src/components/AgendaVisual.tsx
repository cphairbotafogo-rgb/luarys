'use client'
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";
import { COR_POR_STATUS } from "@/lib/agendaUtils";
import { FiChevronLeft, FiChevronRight, FiMessageCircle } from "react-icons/fi";

// Formata Date em YYYY-MM-DD usando timezone local (evita UTC shift do toISOString)
function paraISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function whatsappHref(telefone: string) {
  const limpo = telefone.replace(/\D/g, '');
  const num = limpo.startsWith('55') ? limpo : `55${limpo}`;
  return `https://wa.me/${num}`;
}

const LABEL_STATUS: Record<string, string> = {
  agendado: 'Agendado', confirmado: 'Confirmado', aguardando: 'Aguardando',
  'em atendimento': 'Em Atendimento', finalizado: 'Finalizado ✅',
  faltou: 'Faltou', cancelado: 'Cancelado', bloqueado: 'Bloqueado',
};

export function AgendaVisual({ perfil }: { perfil: any }) {
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [telefonesMap, setTelefonesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [erroBD, setErroBD] = useState<string | null>(null);

  const dataFormatada = paraISO(dataSelecionada);
  const salaoId = perfil?.salao_id;

  useEffect(() => {
    async function buscarAgendaDoDia() {
      if (!salaoId) { setLoading(false); return; }
      try {
        setLoading(true);
        setErroBD(null);

        const { data, error } = await supabase
          .from('agendamentos')
          .select('id, cliente_id, cliente_nome, profissional_id, profissional_nome, servico_id, inicio, duracao_min, status, cor, observacao')
          .eq('salao_id', salaoId)
          .eq('data', dataFormatada)
          .order('inicio', { ascending: true });

        if (error) { setErroBD(error.message); return; }
        const ags = data || [];
        setAgendamentos(ags);

        // Busca telefones dos clientes encontrados no dia
        const clienteIds = [...new Set(ags.map((a: any) => a.cliente_id).filter(Boolean))];
        if (clienteIds.length > 0) {
          const { data: clientes } = await supabase
            .from('clientes')
            .select('id, telefone_whatsapp')
            .in('id', clienteIds as string[]);
          const mapa: Record<string, string> = {};
          (clientes || []).forEach((c: any) => { if (c.telefone_whatsapp) mapa[c.id] = c.telefone_whatsapp; });
          setTelefonesMap(mapa);
        }
      } catch (err: any) {
        setErroBD(err.message);
      } finally {
        setLoading(false);
      }
    }
    buscarAgendaDoDia();
  }, [dataFormatada, salaoId]);

  const horas = Array.from({ length: 13 }, (_, i) => i + 8);
  const profissionaisSet = new Set(agendamentos.map(a => a.profissional_nome || 'Equipe'));
  const colunas = profissionaisSet.size > 0 ? Array.from(profissionaisSet) : ['Equipe'];

  return (
    <div className="flex flex-col h-full p-6 font-body" style={{ backgroundColor: C.bg, minHeight: "100vh" }}>

      {/* CABEÇALHO */}
      <div className="flex justify-between items-center mb-6 bg-white p-5 rounded-xl shadow-sm border" style={{ borderColor: C.border }}>
        <h2 className="font-title text-xl font-bold uppercase tracking-widest m-0" style={{ color: C.sidebarBg }}>
          Agenda Diária
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => { const d = new Date(dataSelecionada); d.setDate(d.getDate() - 1); setDataSelecionada(d); }}
            className="flex items-center justify-center w-10 h-10 rounded-full border-none cursor-pointer transition-all hover:scale-105 shadow-sm"
            style={{ backgroundColor: C.bg, color: C.sidebarBg, fontSize: "16px" }}
          >◀</button>
          <div className="font-title font-bold text-sm uppercase tracking-wide text-center" style={{ color: C.textMain, minWidth: "200px" }}>
            {dataSelecionada.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>
          <button
            onClick={() => { const d = new Date(dataSelecionada); d.setDate(d.getDate() + 1); setDataSelecionada(d); }}
            className="flex items-center justify-center w-10 h-10 rounded-full border-none cursor-pointer transition-all hover:scale-105 shadow-sm"
            style={{ backgroundColor: C.bg, color: C.sidebarBg, fontSize: "16px" }}
          >▶</button>
        </div>
      </div>

      {erroBD && (
        <div className="mb-5 p-4 rounded-xl border" style={{ backgroundColor: C.dangerBg, borderColor: "#FECACA", color: C.dangerText }}>
          <strong>Erro:</strong> {erroBD}
        </div>
      )}

      {/* GRADE */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col relative" style={{ borderColor: C.borderMid }}>

        {/* Cabeçalho das colunas */}
        <div className="flex border-b" style={{ borderColor: C.borderMid, backgroundColor: "#F8F9FA" }}>
          <div className="w-24 shrink-0 border-r" style={{ borderColor: C.border }}></div>
          {colunas.map((col, i) => (
            <div key={i} className="flex-1 border-r p-4 text-center font-title font-bold uppercase tracking-widest text-xs" style={{ borderColor: C.border, color: C.sidebarBg }}>
              {col}
            </div>
          ))}
        </div>

        <div className="relative flex-1 overflow-y-auto overflow-x-hidden" style={{ minHeight: `${horas.length * 100}px` }}>

          {/* Linhas de fundo */}
          <div className="absolute inset-0 flex flex-col pointer-events-none">
            {horas.map(hora => (
              <div key={hora} className="flex border-b" style={{ borderColor: C.border, minHeight: 100 }}>
                <div className="w-24 shrink-0 border-r flex items-start justify-end pr-4 pt-2 text-sm font-medium" style={{ borderColor: C.border, color: C.textLight }}>
                  {hora}:00
                </div>
                {colunas.map((_, i) => (
                  <div key={i} className="flex-1 border-r border-dashed" style={{ borderColor: C.borderMid, opacity: 0.5 }}></div>
                ))}
              </div>
            ))}
          </div>

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
              <span className="font-title uppercase tracking-widest font-bold text-sm" style={{ color: C.textLight }}>A carregar horários... ⏳</span>
            </div>
          )}
          {!loading && agendamentos.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <span className="font-body font-medium italic text-sm p-4 rounded-lg bg-white/80 border border-dashed" style={{ color: C.textMuted, borderColor: C.borderMid }}>
                Nenhum agendamento registrado para esta data.
              </span>
            </div>
          )}

          {/* Cards de agendamento */}
          {!loading && agendamentos.map(ag => {
            const statusKey = (ag.status || 'Confirmado').toLowerCase();
            const corStatus = COR_POR_STATUS[ag.status as keyof typeof COR_POR_STATUS] || ag.cor || C.cardSlate;
            const labelSt   = LABEL_STATUS[statusKey] || ag.status || 'Confirmado';
            const isFinalizado = statusKey === 'finalizado';
            const isCancelado  = statusKey === 'cancelado' || statusKey === 'faltou';

            const horaStr = ag.inicio || '08:00';
            const [h, m]  = horaStr.split(':').map(Number);
            const topPos  = ((isNaN(h) ? 8 : h) - 8) * 100 + ((isNaN(m) ? 0 : m) / 60) * 100;

            const profNome   = ag.profissional_nome || 'Equipe';
            const colIdx     = colunas.indexOf(profNome);
            const colSafe    = colIdx >= 0 ? colIdx : 0;
            const leftPos    = `calc(6rem + ((100% - 6rem) / ${colunas.length}) * ${colSafe})`;
            const width      = `calc((100% - 6rem) / ${colunas.length} - 16px)`;
            const telefone   = ag.cliente_id ? telefonesMap[ag.cliente_id] : null;

            return (
              <div
                key={ag.id}
                className="absolute z-10 p-3 rounded-xl shadow-sm border flex flex-col gap-1"
                style={{
                  top: `${topPos}px`,
                  left: leftPos,
                  width,
                  background: isCancelado ? "#FEF2F2" : isFinalizado ? "#F4F8F5" : "#FFFFFF",
                  borderLeft: `4px solid ${corStatus}`,
                  borderColor: C.border,
                  opacity: isCancelado ? 0.7 : 1,
                }}
              >
                <div className="flex justify-between items-start gap-2">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.06)", color: C.sidebarBg }}>
                      {horaStr.substring(0, 5)}
                    </span>
                    <h3 className="m-0 mt-2 font-title font-bold text-sm tracking-wide truncate" style={{ color: C.sidebarBg, textDecoration: isCancelado ? "line-through" : "none" }}>
                      {ag.cliente_nome || 'Cliente'}
                    </h3>
                    <p className="m-0 mt-0.5 text-xs font-medium truncate" style={{ color: C.textMuted }}>
                      {ag.observacao || 'Serviço'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap" style={{ background: `${corStatus}22`, color: corStatus }}>
                      {labelSt}
                    </span>
                    {telefone && (
                      <a
                        href={whatsappHref(telefone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`WhatsApp: ${telefone}`}
                        className="flex items-center gap-1 text-[10px] font-bold rounded px-2 py-0.5"
                        style={{ background: "#DCFCE7", color: "#15803D", textDecoration: "none" }}
                        onClick={e => e.stopPropagation()}
                      >
                        <FiMessageCircle size={11} /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
